"""Ficha técnica e equipamentos do Carros na Web (carrosnaweb.com.br).

Dois passos, iguais aos que o usuário faz à mão:
  1. `buscar(nome, ano)` lista as versões daquele modelo/ano (catalogo.asp);
  2. `ficha(codigo)` lê a ficha da versão escolhida (fichadetalhe.asp).

O site só devolve a ficha para quem já passou pelo catálogo (sessão ASP), então as duas
chamadas compartilham os cookies. Só entram nos equipamentos os itens DE SÉRIE: no site
eles têm o ícone verde; o amarelo é opcional e não vale para o anúncio.
"""

from __future__ import annotations

import gzip
import html
import re
import time
import urllib.parse
import urllib.request
import zlib
from http.cookiejar import CookieJar

BASE = "https://www.carrosnaweb.com.br/"
NAVEGADOR = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)
CATEGORIAS = {"SEGURANCA": "seguranca", "CONFORTO": "conforto", "INFOTENIMENTO": "infotenimento"}

class SiteComErro(ValueError):
    """O site respondeu, mas mandou para a própria página de erro."""


_cookies = CookieJar()
_abridor = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cookies))


def _sem_acento(texto: str) -> str:
    tabela = str.maketrans("ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ", "AAAAAEEEEIIIIOOOOOUUUUCN")
    return texto.upper().translate(tabela)


def _pegar(caminho: str, referer: str | None = None, tentativas: int = 3) -> str:
    """Busca uma página do site. O servidor às vezes responde 500/302 a pedidos seguidos,
    então tenta de novo com uma pausa antes de desistir."""
    url = urllib.parse.urljoin(BASE, caminho)
    cabecalhos = {
        "User-Agent": NAVEGADOR,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
        # Sem isso o Python manda "Accept-Encoding: identity" e a ficha do site quebra (erro 500).
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        **({"Referer": referer} if referer else {}),
    }
    ultimo = ""
    for tentativa in range(tentativas):
        try:
            with _abridor.open(urllib.request.Request(url, headers=cabecalhos), timeout=30) as resposta:
                if resposta.url.endswith("erro.asp"):
                    # O próprio site desvia para a página "Ocorreu um erro" — acontece com
                    # qualquer navegador quando o catálogo dele está fora do ar.
                    raise SiteComErro(
                        "O Carros na Web está respondendo com erro (ele desvia para a página "
                        "'Ocorreu um erro'). Isso é do site, não do app: tente mais tarde ou "
                        "use 'Colar ficha técnica'."
                    )
                dados = resposta.read()
                codificacao = (resposta.headers.get("Content-Encoding") or "").lower()
                if codificacao == "gzip":
                    dados = gzip.decompress(dados)
                elif codificacao == "deflate":
                    dados = zlib.decompress(dados, -zlib.MAX_WBITS) if dados[:1] != b"x" else zlib.decompress(dados)
                pagina = dados.decode("latin-1")
            esperado = "catalogo.asp" not in caminho or "fichadetalhe" in pagina
            if "Internal server error" not in pagina and len(pagina) > 2000 and esperado:
                return pagina
            ultimo = "o site devolveu uma página inesperada (pode estar limitando consultas)"
        except SiteComErro:
            raise
        except (OSError, zlib.error) as exc:
            ultimo = str(exc)
        time.sleep(1.5 * (tentativa + 1))
    raise ValueError(f"Não foi possível ler o Carros na Web ({ultimo}). Tente de novo em instantes.")


def _texto(bruto: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", bruto))).strip()


def _linhas(pagina: str) -> list[str]:
    limpo = html.unescape(re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", pagina))
    return [t for t in (re.sub(r"\s+", " ", x).strip() for x in re.sub(r"<[^>]+>", "\n", limpo).split("\n")) if t]


def _modelo_de(nome: str) -> str:
    """"FIAT ARGO" -> "ARGO"; "MERCEDES BENZ GLA 250" -> "GLA 250" (tira a marca)."""
    partes = _sem_acento(nome).split()
    marcas = {"FIAT", "FORD", "VOLKSWAGEN", "VW", "CHEVROLET", "GM", "RENAULT", "PEUGEOT", "CITROEN",
              "HYUNDAI", "TOYOTA", "HONDA", "NISSAN", "JEEP", "MITSUBISHI", "KIA", "MERCEDES",
              "MERCEDES-BENZ", "BENZ", "BMW", "AUDI", "VOLVO", "LAND", "ROVER", "CHERY", "CAOA",
              "RAM", "DODGE", "SUZUKI", "SUBARU", "MINI", "BYD", "GWM", "JAC"}
    while partes and partes[0] in marcas:
        partes.pop(0)
    return " ".join(partes) if partes else _sem_acento(nome)


def buscar(nome: str, ano: str | int | None = None) -> dict:
    """Versões do modelo no ano pedido: [{'codigo', 'titulo', 'ano'}]."""
    modelo = _modelo_de(nome)
    if not modelo:
        raise ValueError("Informe o nome do veículo para buscar a ficha.")
    parametros = {"varnome": modelo}
    if str(ano or "").strip().isdigit():
        parametros["anoini"] = parametros["anofim"] = str(ano).strip()
    caminho = "catalogo.asp?" + urllib.parse.urlencode(parametros)
    if not len(_cookies):
        _pegar("")  # abre a página principal antes: é assim que o site cria a sessão
    pagina = _pegar(caminho, urllib.parse.urljoin(BASE, ""))
    versoes, vistos = [], set()
    # O link vem como <a HREF="fichadetalhe.asp?codigo=N"> e o nome da versão está no
    # title da imagem ou do próprio link, logo depois.
    for achado in re.finditer(r'(?i)fichadetalhe\.asp\?codigo=(\d+)"', pagina):
        codigo = achado.group(1)
        vizinho = re.search(r'(?i)title="([^"]+)"', pagina[achado.end() : achado.end() + 400])
        rotulo = _texto(vizinho.group(1)) if vizinho else ""
        rotulo = re.sub(r"(?i)^ficha t[eé]cnica,[^d]*do\s+", "", rotulo).strip()
        if codigo in vistos or not rotulo:
            continue
        vistos.add(codigo)
        versoes.append({"codigo": codigo, "titulo": rotulo, "ano": str(ano or "").strip()})
    if not versoes:
        raise ValueError(
            f"O Carros na Web não listou versões para {modelo} {str(ano or '').strip()}. "
            "Confira o nome e o ano, ou tente de novo em alguns minutos (o site limita consultas seguidas)."
        )
    return {"modelo": modelo, "versoes": versoes, "busca": urllib.parse.urljoin(BASE, caminho)}


def _valor_apos(linhas: list[str], rotulo: str, ate: set[str], maximo: int = 3) -> str:
    """Valor de um campo da ficha: o que vem depois do rótulo, até o próximo rótulo conhecido."""
    alvo = _sem_acento(rotulo)
    for i, linha in enumerate(linhas):
        if _sem_acento(linha) != alvo:
            continue
        pedacos = []
        for proxima in linhas[i + 1 : i + 1 + maximo]:
            if _sem_acento(proxima) in ate or len(proxima) > 60:
                break
            pedacos.append(proxima)
        if pedacos:
            return " ".join(pedacos)
    return ""


def _equipamentos(pagina: str) -> dict[str, list[str]]:
    itens: dict[str, list[str]] = {"seguranca": [], "conforto": [], "infotenimento": []}
    # A página pode vir com acentos escapados (&Ccedil;): desescapa antes de procurar.
    pagina = html.unescape(pagina)
    trecho = pagina[pagina.find("Equipamentos") :] if "Equipamentos" in pagina else pagina
    atual = None
    padrao = re.compile(
        r'(?is)(?:<font[^>]*>[\s ]*(SEGURAN\w+|CONFORTO|INFOTENIMENTO)[\s ]*</font>)'
        r'|(?:<img[^>]+src="[^"]*?(\w+)\.gif"[^>]*title="([^"]*)"[^>]*>\s*</td>\s*'
        r'<td[^>]*>\s*<font[^>]*>([^<]+)</font>)'
    )
    for titulo, _icone, tipo, nome in padrao.findall(trecho):
        if titulo:
            atual = CATEGORIAS.get(_sem_acento(titulo))
            continue
        if atual is None or "SERIE" not in _sem_acento(tipo):
            continue  # opcional (ícone amarelo) não entra no anúncio
        rotulo = _texto(nome)
        if rotulo and rotulo not in itens[atual]:
            itens[atual].append(rotulo)
    return itens


def ficha(codigo: str | int, referer: str | None = None) -> dict:
    """Ficha técnica + equipamentos de série de uma versão (fichadetalhe.asp?codigo=…)."""
    if not str(codigo).isdigit():
        raise ValueError("Código de versão inválido.")
    pagina = _pegar(f"fichadetalhe.asp?codigo={codigo}", referer)
    if "fichadetalhe" not in pagina and "Ficha" not in pagina:
        raise ValueError("O Carros na Web não devolveu a ficha desta versão.")
    linhas = _linhas(pagina)
    rotulos = {_sem_acento(x) for x in [
        "Ano", "Preço", "Desvalorização", "Propulsão", "Combustível", "IPVA", "Seguro", "Revisões",
        "Procedência", "Garantia", "Configuração", "Porte", "Lugares", "Portas", "Plataforma",
        "Código do câmbio", "Acoplamento", "Tração", "Câmbio", "Assistência", "Diâmetro de giro",
        "MOTOR", "TRANSMISSÃO", "SUSPENSÃO", "FREIOS", "DIREÇÃO", "PNEUS", "DIMENSÕES", "Nota do leitor",
    ]}
    titulo = ""
    for i, linha in enumerate(linhas):
        if _sem_acento(linha) == "COMPARTILHE:" and i + 1 < len(linhas):
            titulo = linhas[i + 1]
            break
    direcao = ""
    if "DIREÇÃO" in pagina or "DIRE" in pagina:
        depois = linhas[next((i for i, l in enumerate(linhas) if _sem_acento(l) == "DIRECAO"), len(linhas)) :]
        direcao = _valor_apos(depois, "Assistência", rotulos, 1)
    dados = {
        "titulo": titulo,
        "ano": _valor_apos(linhas, "Ano", rotulos, 1),
        "configuracao": _valor_apos(linhas, "Configuração", rotulos, 1),
        "lugares": _valor_apos(linhas, "Lugares", rotulos, 1),
        "portas": _valor_apos(linhas, "Portas", rotulos, 1),
        "cambio": _valor_apos(linhas, "Câmbio", rotulos, 2),
        "direcao": direcao,
        "combustivel": _valor_apos(linhas, "Combustível", rotulos, 1),
    }
    return {
        "codigo": str(codigo),
        "url": urllib.parse.urljoin(BASE, f"fichadetalhe.asp?codigo={codigo}"),
        "tecnicos": dados,
        "equipamentos": _equipamentos(pagina),
    }
