"""Ficha técnica e equipamentos do Ficha Completa (fichacompleta.com.br).

Segunda fonte de consulta na web, independente do Carros na Web. As páginas são servidas
prontas (sem JavaScript) e seguem um caminho previsível:

  /carros/                      lista de marcas
  /carros/<marca>/              lista de modelos da marca
  /carros/<marca>/<modelo>/     versões do modelo, uma por ano
  /carros/<marca>/<versao-ano>  ficha da versão

ATENÇÃO sobre equipamentos: esta fonte lista os itens do modelo sem separar o que é de série do
que é opcional (por exemplo, "Teto panorâmico" e "Teto solar elétrico" aparecem juntos). Só os de
série podem entrar no anúncio, então estes itens são devolvidos como SUGESTÃO, nunca como certos.
"""

from __future__ import annotations

import gzip
import html
import re
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://www.fichacompleta.com.br"
NAVEGADOR = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)
CATEGORIAS = {"Conforto": "conforto", "Infotenimento": "infotenimento", "Segurança": "seguranca"}

# O que já foi lido fica na memória: o mesmo modelo não é pedido duas vezes.
_memoria: dict[str, str] = {}

# Depois de um "muitas consultas" (429) o app para de pedir por um tempo, como faz com o Carros na Web.
PAUSA_APOS_LIMITE = 10 * 60
_pausado_ate = 0.0


class FonteIndisponivel(ValueError):
    """A fonte não respondeu como esperado."""


class PaginaInexistente(FonteIndisponivel):
    """A página pedida não existe (404): serve para testar endereços candidatos."""


def _sem_acento(texto: str) -> str:
    tabela = str.maketrans("ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑáàãâäéèêëíìîïóòõôöúùûüçñ", "AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn")
    return texto.translate(tabela)


def _slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _sem_acento(texto).lower()).strip("-")


def _pegar(caminho: str, tentativas: int = 2) -> str:
    """Baixa uma página (HTML). Guarda na memória; erro 404 vira FonteIndisponivel."""
    global _pausado_ate
    if caminho in _memoria:
        return _memoria[caminho]
    if time.time() < _pausado_ate:
        ate = time.strftime("%H:%M", time.localtime(_pausado_ate))
        raise FonteIndisponivel(f"o Ficha Completa está limitando consultas (nova tentativa só depois das {ate})")
    cabecalhos = {
        "User-Agent": NAVEGADOR,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Accept-Encoding": "gzip",
    }
    ultimo = ""
    for tentativa in range(tentativas):
        try:
            requisicao = urllib.request.Request(urllib.parse.urljoin(BASE, caminho), headers=cabecalhos)
            with urllib.request.urlopen(requisicao, timeout=30) as resposta:
                dados = resposta.read()
                if (resposta.headers.get("Content-Encoding") or "").lower() == "gzip":
                    dados = gzip.decompress(dados)
            pagina = dados.decode("utf-8", "replace")
            if len(pagina) < 2000:
                raise FonteIndisponivel("o Ficha Completa devolveu uma página inesperada")
            _memoria[caminho] = pagina
            return pagina
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise PaginaInexistente("página não encontrada no Ficha Completa") from exc
            if exc.code == 429:
                _pausado_ate = time.time() + PAUSA_APOS_LIMITE
                raise FonteIndisponivel("o Ficha Completa está limitando consultas (muitas seguidas)") from exc
            ultimo = f"erro {exc.code}"
        except FonteIndisponivel:
            raise
        except (OSError, EOFError) as exc:
            ultimo = str(exc)
        time.sleep(1.5 * (tentativa + 1))
    raise FonteIndisponivel(f"não foi possível ler o Ficha Completa ({ultimo})")


def _linhas(pagina: str) -> list[str]:
    limpo = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", pagina)
    texto = html.unescape(re.sub(r"<[^>]+>", "\n", limpo))
    return [t for t in (re.sub(r"\s+", " ", x).strip() for x in texto.split("\n")) if t]


# Grafias comuns no cadastro que o endereço da marca escreve de outro jeito.
APELIDOS_MARCA = {"vw": "volkswagen", "gm": "chevrolet", "mercedes": "mercedes-benz", "mb": "mercedes-benz"}


def _marca_slug(nome: str) -> tuple[str, str]:
    """Separa marca e modelo do nome ("Mercedes Benz GLA-250" -> ("mercedes-benz", "gla 250"))."""
    partes = re.sub(r"[-_/]+", " ", _sem_acento(nome)).lower().split()
    if not partes:
        raise ValueError("Informe o nome do veículo para buscar a ficha.")
    # O endereço da marca é a própria grafia ("mercedes-benz", "land-rover", "fiat"): testa de
    # três palavras a uma, e a página da marca existir (não dar 404) é a confirmação.
    for tamanho in (3, 2, 1):
        if len(partes) <= tamanho:
            continue
        candidata = "-".join(partes[:tamanho])
        candidata = APELIDOS_MARCA.get(candidata, candidata)
        try:
            _pegar(f"/carros/{candidata}/")
        except PaginaInexistente:
            continue  # não é a marca; qualquer outra falha (rede, site) sobe como erro de verdade
        return candidata, " ".join(partes[tamanho:])
    raise FonteIndisponivel(f"marca de '{nome}' não encontrada no Ficha Completa")


def buscar(nome: str, ano: str | int | None = None) -> dict:
    """Versões do modelo no ano pedido: [{'codigo', 'titulo', 'ano'}]."""
    marca, modelo = _marca_slug(nome)
    slug_modelo = _slug(modelo)
    modelos = re.findall(rf'href="/carros/{re.escape(marca)}/([a-z0-9-]+)/"', _pegar(f"/carros/{marca}/"))
    modelos = list(dict.fromkeys(modelos))
    escolhidos = [m for m in modelos if m == slug_modelo]
    if not escolhidos:
        # O cadastro costuma ter palavras a mais que o site ("New Fiesta Hatch" -> "fiesta"):
        # vale o modelo do site cujas palavras todas aparecem no nome, o mais específico primeiro
        # ("corsa-sedan" antes de "corsa").
        palavras = set(slug_modelo.split("-"))
        contidos = [m for m in modelos if set(m.split("-")) <= palavras]
        if contidos:
            maior = max(len(m.split("-")) for m in contidos)
            escolhidos = [m for m in contidos if len(m.split("-")) == maior][:2]
    if not escolhidos:  # "gla 250" não existe, mas "gla-250-amg" sim: aceita quem começa igual
        escolhidos = [m for m in modelos if m.startswith(slug_modelo + "-")][:3]
    if not escolhidos:
        raise FonteIndisponivel(f"modelo '{modelo.upper()}' não encontrado em {marca} no Ficha Completa")
    achado = re.search(r"(?<!\d)((?:19|20)\d{2})(?!\d)", str(ano or ""))
    alvo = achado.group(1) if achado else ""
    ignoradas = sorted(set(slug_modelo.split("-")) - {p for m in escolhidos for p in m.split("-")})
    versoes, vistos = [], set()
    for slug in escolhidos:
        for caminho in re.findall(rf'href="(/carros/{re.escape(marca)}/{re.escape(slug)}-[a-z0-9-]*-?(?:19|20)\d{{2}})"', _pegar(f"/carros/{marca}/{slug}/")):
            ano_versao = caminho[-4:]
            if caminho in vistos or (alvo and ano_versao != alvo):
                continue
            vistos.add(caminho)
            versoes.append({"codigo": "fc:" + caminho, "titulo": _titulo(caminho), "ano": ano_versao})
    if not versoes:
        raise FonteIndisponivel(f"o Ficha Completa não listou versões de {modelo.upper()} {alvo}".strip())
    return {
        "modelo": modelo.upper(),
        "versoes": versoes,
        "busca": urllib.parse.urljoin(BASE, f"/carros/{marca}/"),
        # Palavras do nome que o site não usa no modelo ("hatch", "drive"): a interface avisa.
        "ignoradas": ignoradas,
    }


def _titulo(caminho: str) -> str:
    slug = re.sub(r"-(?:19|20)\d{2}$", "", caminho.rstrip("/").rsplit("/", 1)[-1])
    slug = re.sub(r"(?<=\d)-(?=\d(?:-|$))", ".", slug)
    return " ".join(p.upper() if len(p) <= 3 or p.isdigit() else p.capitalize() for p in slug.split("-"))


def _valor(linhas: list[str], rotulo: str, inicio: int = 0) -> str:
    for i in range(inicio, len(linhas) - 1):
        if linhas[i] == rotulo:
            return linhas[i + 1]
    return ""


def ler_ficha(pagina: str) -> dict:
    """Dados técnicos e equipamentos (sugestão) de uma página de versão já baixada."""
    linhas = _linhas(pagina)
    if "Ficha Técnica" not in linhas:
        raise FonteIndisponivel("a página não tem a ficha técnica esperada")
    cambio = _valor(linhas, "Câmbio")
    marchas = _valor(linhas, "Quantidade de marchas")
    if cambio and marchas.isdigit():
        cambio = f"{cambio} de {marchas} marchas"
    pos_direcao = linhas.index("Direção") if "Direção" in linhas else 0
    dados = {
        "titulo": linhas[0] if linhas else "",
        "ano": _valor(linhas, "Ano"),
        "configuracao": _valor(linhas, "Configuração"),
        "lugares": _valor(linhas, "Lugares"),
        "portas": _valor(linhas, "Portas"),
        "cambio": cambio,
        "direcao": _valor(linhas, "Assistência", pos_direcao),
        "combustivel": _valor(linhas, "Combustível"),
    }
    equipamentos: dict[str, list[str]] = {"seguranca": [], "conforto": [], "infotenimento": []}
    if "Equipamentos" in linhas:
        inicio = linhas.index("Equipamentos") + 1
        fim = next((i for i in range(inicio, len(linhas)) if linhas[i] in ("Avaliações", "Mais Informações")), len(linhas))
        atual = None
        for linha in linhas[inicio:fim]:
            if linha in CATEGORIAS:
                atual = CATEGORIAS[linha]
            elif atual and linha not in equipamentos[atual]:
                equipamentos[atual].append(linha)
    return {"tecnicos": dados, "equipamentos": equipamentos}


def ficha(codigo: str) -> dict:
    """Ficha da versão escolhida. `codigo` vem de buscar(): "fc:/carros/<marca>/<versao-ano>"."""
    caminho = str(codigo).removeprefix("fc:")
    if not re.fullmatch(r"/carros/[a-z0-9-]+/[a-z0-9-]+", caminho):
        raise ValueError("Código de versão inválido.")
    resultado = ler_ficha(_pegar(caminho))
    return {
        "codigo": f"fc:{caminho}",
        "url": urllib.parse.urljoin(BASE, caminho),
        **resultado,
        # Esta fonte não separa série de opcional: a interface mostra como sugestão.
        "equipamentos_de_serie": False,
        "fonte": "Ficha Completa",
    }
