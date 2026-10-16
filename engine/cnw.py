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


# Pausa e memória: depois que o site responde com erro, não insistimos por um tempo (cada
# tentativa a mais pode prolongar o bloqueio) e o que já foi lido não é pedido de novo.
PAUSA_APOS_ERRO = 15 * 60
_pausado_ate = 0.0
_memoria: dict[str, dict] = {}

_cookies = CookieJar()
_abridor = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cookies))


def _texto_pausa(inicio: str) -> str:
    ate = time.strftime("%H:%M", time.localtime(_pausado_ate))
    return (
        f"{inicio} O app não vai consultar o site de novo antes das {ate}, para não prolongar o bloqueio. "
        "Enquanto isso: use outra conexão (por exemplo, o roteador do celular), ou abra a ficha no "
        "celular e use 'Colar ficha técnica'."
    )


def _checar_pausa() -> None:
    if time.time() < _pausado_ate:
        raise SiteComErro(_texto_pausa("O Carros na Web está bloqueando ou fora do ar."))


def _sem_acento(texto: str) -> str:
    tabela = str.maketrans("ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ", "AAAAAEEEEIIIIOOOOOUUUUCN")
    return texto.upper().translate(tabela)


def _pegar(caminho: str, referer: str | None = None, tentativas: int = 3) -> str:
    """Busca uma página do site. O servidor às vezes responde 500/302 a pedidos seguidos,
    então tenta de novo com uma pausa antes de desistir."""
    _checar_pausa()
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
                    global _pausado_ate
                    _pausado_ate = time.time() + PAUSA_APOS_ERRO
                    raise SiteComErro(_texto_pausa("O Carros na Web respondeu com erro (página 'Ocorreu um erro')."))
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
    # A ficha do Studio pode guardar "2016/2017"; o catálogo filtra por um ano só.
    achado = re.search(r"(?<!\d)((?:19|20)\d{2})(?!\d)", str(ano or ""))
    if achado:
        ano = achado.group(1)
    # O catálogo procura o nome exatamente como escrito: "GLA-250" não acha "GLA 250".
    # Tenta o nome como está e, se o site não listar nada, a grafia com espaço no lugar do hífen.
    nomes = [modelo]
    if "-" in modelo:
        nomes.append(re.sub(r"\s*-\s*", " ", modelo))
    chave = f"busca|{'/'.join(nomes)}|{ano if achado else ''}"
    if chave in _memoria:
        return _memoria[chave]
    if not len(_cookies):
        _pegar("")  # abre a página principal antes: é assim que o site cria a sessão
    pagina, caminho, ultimo_erro = "", "", None
    for i, tentado in enumerate(nomes):
        parametros = {"varnome": tentado}
        if achado:
            parametros["anoini"] = parametros["anofim"] = ano
        caminho = "catalogo.asp?" + urllib.parse.urlencode(parametros)
        try:
            pagina = _pegar(caminho, urllib.parse.urljoin(BASE, ""), tentativas=3 if i == len(nomes) - 1 else 1)
            modelo = tentado
            break
        except SiteComErro:
            raise
        except ValueError as exc:
            ultimo_erro = exc
    else:
        raise ValueError(
            f"{ultimo_erro} Pesquisado: modelo '{' / '.join(nomes)}'"
            + (f", ano {ano}." if achado else ", sem ano.")
        )
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
    resultado = {"modelo": modelo, "versoes": versoes, "busca": urllib.parse.urljoin(BASE, caminho)}
    _memoria[chave] = resultado
    return resultado


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
    if f"ficha|{codigo}" in _memoria:
        return _memoria[f"ficha|{codigo}"]
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
    resultado = {
        "codigo": str(codigo),
        "url": urllib.parse.urljoin(BASE, f"fichadetalhe.asp?codigo={codigo}"),
        "tecnicos": dados,
        "equipamentos": _equipamentos(pagina),
    }
    _memoria[f"ficha|{codigo}"] = resultado
    return resultado


_ROTULOS_FICHA = [
    "Ano", "Preço", "Desvalorização", "Propulsão", "Combustível", "IPVA", "Seguro", "Revisões",
    "Procedência", "Garantia", "Configuração", "Porte", "Lugares", "Portas", "Plataforma",
    "Código do câmbio", "Acoplamento", "Tração", "Câmbio", "Assistência", "Diâmetro de giro",
    "MOTOR", "TRANSMISSÃO", "SUSPENSÃO", "FREIOS", "DIREÇÃO", "PNEUS", "DIMENSÕES", "Nota do leitor",
]


def ficha_texto(texto: str) -> dict:
    """Dados técnicos a partir do TEXTO da página da ficha, copiado pela pessoa (Selecionar tudo,
    Copiar) em qualquer aparelho. Não depende do site estar acessível desta máquina.

    Os equipamentos NÃO são lidos daqui: no texto copiado se perde a diferença entre item de série
    e opcional, e só os de série podem entrar no anúncio. Para eles use o OCR de equipamentos."""
    linhas = [re.sub(r"\s+", " ", x).strip() for x in re.split(r"[\r\n]+", str(texto or ""))]
    linhas = [x for x in linhas if x]
    if len(linhas) < 5:
        raise ValueError("Cole o texto inteiro da página da ficha técnica (Selecionar tudo e Copiar).")
    rotulos = {_sem_acento(x) for x in _ROTULOS_FICHA}
    # Quando rótulo e valor vêm na mesma linha ("Lugares 5"), separa os dois.
    separadas: list[str] = []
    for linha in linhas:
        for rotulo in sorted(_ROTULOS_FICHA, key=len, reverse=True):
            sem = _sem_acento(linha)
            if sem.startswith(_sem_acento(rotulo) + " ") and sem not in rotulos:
                separadas += [linha[: len(rotulo)], linha[len(rotulo) :].strip()]
                break
        else:
            separadas.append(linha)
    linhas = separadas
    titulo = ""
    for i, linha in enumerate(linhas):
        if _sem_acento(linha) == "COMPARTILHE:" and i + 1 < len(linhas):
            titulo = linhas[i + 1]
            break
    depois = linhas[next((i for i, l in enumerate(linhas) if _sem_acento(l) == "DIRECAO"), len(linhas)) :]
    dados = {
        "titulo": titulo,
        "ano": _valor_apos(linhas, "Ano", rotulos, 1),
        "configuracao": _valor_apos(linhas, "Configuração", rotulos, 1),
        "lugares": _valor_apos(linhas, "Lugares", rotulos, 1),
        "portas": _valor_apos(linhas, "Portas", rotulos, 1),
        "cambio": _valor_apos(linhas, "Câmbio", rotulos, 2),
        "direcao": _valor_apos(depois, "Assistência", rotulos, 1),
        "combustivel": _valor_apos(linhas, "Combustível", rotulos, 1),
    }
    if not any(v for k, v in dados.items() if k != "titulo"):
        raise ValueError(
            "Não encontrei os dados técnicos nesse texto (Ano, Lugares, Portas, Câmbio…). "
            "Cole a página da ficha técnica de uma versão, não a lista do catálogo."
        )
    return {
        "codigo": "",
        "url": "",
        "tecnicos": dados,
        "equipamentos": {"seguranca": [], "conforto": [], "infotenimento": []},
    }
