"""Leitura do CRLV-e (PDF). Porta do extractor.js do sistema HTML anterior.

Localiza cada rótulo conhecido na página e lê o valor logo abaixo dele, limitado pelo
próximo rótulo à direita e abaixo. PDFs sem texto caem no OCR (ocr.py).
"""

from __future__ import annotations

import io
import re
import unicodedata

import pdfplumber
from pdfminer.pdfdocument import PDFPasswordIncorrect
from pdfplumber.utils.exceptions import PdfminerException

FIELDS = [
    ("renavam", "CÓDIGO RENAVAM"),
    ("placa", "PLACA"),
    ("exercicio", "EXERCÍCIO"),
    ("fabricacao", "ANO FABRICAÇÃO"),
    ("modelo", "ANO MODELO"),
    ("crv", "NÚMERO DO CRV"),
    ("seguranca", "CÓDIGO DE SEGURANÇA DO CLA"),
    ("cat", "CAT"),
    ("marca", "MARCA / MODELO / VERSÃO"),
    ("especie", "ESPÉCIE / TIPO"),
    ("anterior", "PLACA ANTERIOR / UF"),
    ("chassi", "CHASSI"),
    ("cor", "COR PREDOMINANTE"),
    ("combustivel", "COMBUSTÍVEL"),
    ("observacoes", "OBSERVAÇÕES DO VEÍCULO"),
]
# Títulos do DOC.md: iguais aos rótulos, mas "CAT" é um bloco sem título no arquivo antigo.
FIELDS_TITULOS = [(fid, "" if fid == "cat" else label) for fid, label in FIELDS]

EXTRA_LABELS = [
    "CATEGORIA", "CAPACIDADE", "POTÊNCIA/CILINDRADA", "PESO BRUTO TOTAL", "MOTOR", "CMT",
    "EIXOS", "LOTAÇÃO", "CARROCERIA", "NOME", "CPF / CNPJ", "LOCAL", "DATA",
    "INFORMAÇÕES DO SEGURO DPVAT", "MENSAGENS SENATRAN", "DADOS DO SEGURO DPVAT",
]


class SenhaNecessaria(Exception):
    pass


def normalize(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s*/\s*", "/", s.upper())
    return re.sub(r"\s+", " ", s).strip()


KNOWN = {normalize(label) for _, label in FIELDS} | {normalize(label) for label in EXTRA_LABELS}


def lines(items: list[dict]) -> str:
    rows: list[dict] = []
    for item in sorted(items, key=lambda i: (i["y"], i["x"])):
        row = next((r for r in rows if abs(r["y"] - item["y"]) < 2.5), None)
        if row is None:
            row = {"y": item["y"], "items": []}
            rows.append(row)
        row["items"].append(item)
    return "\n".join(
        " ".join(i["text"] for i in sorted(r["items"], key=lambda i: i["x"])).strip() for r in rows
    )


def _linhas_de(candidates: list[dict]) -> list[str]:
    """Texto de cada linha do bloco, de cima para baixo."""
    return [linha for linha in lines(candidates).split(chr(10)) if linha.strip()]


def _melhor_linha(fid: str, candidates: list[dict]) -> str:
    """Valor do campo: a 1ª linha do bloco, ou — em campo de formato fixo — a 1ª que
    bate com o formato. O OCR costuma inserir lixo entre o rótulo e o valor."""
    linhas = _linhas_de(candidates)
    if not linhas:
        return ""
    formato = _FORMATOS.get(fid)
    if formato:
        padrao, limpar = formato
        for linha in linhas:
            # A linha inteira ou um pedaço dela: o OCR gruda lixo ao lado do valor
            # ("01271950550 Falsa") e às vezes joga uma linha de ruído antes dele.
            for trecho in [linha.strip(), *linha.split()]:
                if re.fullmatch(padrao, trecho):
                    return trecho
                limpo = limpar(trecho)
                # Troca de letra por número (O->0, S->5…) só vale quando o trecho já é quase
                # todo número: senão "Em ng bos" vira "0805" e passa por ano.
                digitos = sum(c.isdigit() for c in trecho)
                if limpar is _so_digitos and digitos < max(1, len(limpo)) * 0.75:
                    continue
                if re.fullmatch(padrao, limpo):
                    return trecho
    return linhas[0].strip()


def extract(pages: list[dict]) -> dict:
    values = {fid: "" for fid, _ in FIELDS}
    conflicts: set[str] = set()
    for page in pages:
        labels = [i for i in page["items"] if normalize(i["text"]) in KNOWN]
        crlv = any(normalize(i["text"]) == "CODIGO RENAVAM" for i in labels)
        for fid, label in FIELDS:
            for anchor in (i for i in labels if normalize(i["text"]) == normalize(label)):
                right_candidates = sorted(
                    (i for i in labels if abs(i["y"] - anchor["y"]) < 3 and i["x"] > anchor["x"] + 8),
                    key=lambda i: i["x"],
                )
                right = min(
                    right_candidates[0]["x"] if right_candidates else page["width"],
                    page["width"] / 2 if crlv and anchor["x"] < page["width"] / 2 else page["width"],
                )
                below = sorted(
                    (i for i in labels if i["y"] > anchor["y"] + 4 and anchor["x"] - 4 <= i["x"] < right - 4),
                    key=lambda i: i["y"],
                )
                bottom = min(
                    below[0]["y"] if below else page["height"],
                    anchor["y"] + (300 if fid == "observacoes" else 85),
                )
                candidates = [
                    i for i in page["items"]
                    if anchor["y"] + 3 < i["y"] < bottom - 2
                    and anchor["x"] - 4 <= i["x"] < right - 3
                    and normalize(i["text"]) not in KNOWN
                    and not re.match(r"^(QRCode|Documento emitido)", i["text"], re.I)
                ]
                if fid == "observacoes":
                    value = lines(candidates).strip()
                else:
                    value = _melhor_linha(fid, candidates)
                if value and values[fid] and values[fid] != value:
                    conflicts.add(label)
                if value and not values[fid]:
                    values[fid] = value
    return {"values": values, "conflicts": sorted(conflicts)}


# O OCR troca letras por números parecidos nos campos que só têm dígitos.
_CONFUSOES = str.maketrans({"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "S": "5", "B": "8", "Z": "2"})


def _so_digitos(texto: str) -> str:
    return re.sub(r"\D", "", texto.upper().translate(_CONFUSOES))


def _placa(texto: str) -> str:
    """Placa: 3 letras + dígito + (letra ou dígito) + 2 dígitos. Corrige O/0 pela posição."""
    bruto = re.sub(r"[^A-Z0-9]", "", texto.upper())
    if len(bruto) != 7:
        return bruto
    digito = {"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "S": "5", "B": "8", "Z": "2"}
    letra = {"0": "O", "1": "I", "5": "S", "8": "B", "2": "Z"}
    saida = [letra.get(c, c) if i < 3 else digito.get(c, c) if i in (3, 5, 6) else c for i, c in enumerate(bruto)]
    return "".join(saida)




# Campos com formato fixo: em PDF escaneado o OCR às vezes devolve lixo
# ("DE Ma Ea Ra" no lugar do Renavam). Melhor deixar em branco do que errado.
_FORMATOS = {
    "renavam": (r"\d{9,11}", _so_digitos),
    "placa": (r"[A-Z]{3}\d[A-Z0-9]\d{2}", _placa),
    "chassi": (r"[A-HJ-NPR-Z0-9]{17}", lambda t: re.sub(r"[^A-Z0-9]", "", t.upper())),
    "exercicio": (r"(19[5-9]\d|20[0-4]\d)", _so_digitos),
    "fabricacao": (r"(19[5-9]\d|20[0-4]\d)", _so_digitos),
    "modelo": (r"(19[5-9]\d|20[0-4]\d)", _so_digitos),
}

def sanitizar(dados: dict) -> dict:
    """Descarta valores que não batem com o formato do campo (sem tocar nos válidos).

    Aceita tanto o dicionário de campos quanto o resultado inteiro do extract().
    """
    values = dados.get("values") if isinstance(dados.get("values"), dict) else dados
    for fid, (formato, limpar) in _FORMATOS.items():
        bruto = (values.get(fid) or "").strip()
        if not bruto or re.fullmatch(formato, bruto):
            continue
        limpo = limpar(bruto)
        values[fid] = limpo if re.fullmatch(formato, limpo) else ""
    return dados


def _page_items(page) -> list[dict]:
    """Trechos de texto com x à esquerda e y na linha de base (como no pdf.js)."""
    words = page.extract_words(keep_blank_chars=True, x_tolerance=1.5, y_tolerance=2, extra_attrs=["upright"])
    items = [
        {"text": w["text"].strip(), "x": float(w["x0"]), "y": float(w["bottom"])}
        for w in words
        if w["text"].strip() and w["upright"]  # ignora texto girado (ex.: aviso do QR Code)
    ]
    # Campos de formulário preenchidos (valor fora do fluxo de texto).
    texts = {i["text"] for i in items}
    try:
        annots = page.annots or []
    except (KeyError, TypeError, ValueError):
        annots = []  # anotação malformada (ex.: sem /Rect) em alguns CRLVs: o texto já basta
    for annot in annots:
        value = (annot.get("data") or {}).get("V")
        if isinstance(value, bytes):
            value = value.decode("utf-8", "ignore")
        if isinstance(value, str) and value.strip() and value not in texts:
            items.append({"text": value.strip(), "x": float(annot["x0"]), "y": float(annot["bottom"])})
    return items


def markdown(values: dict, paginas_texto: list[str], incluir_texto: bool = True) -> str:
    """DOC.md no mesmo formato do sistema antigo (extractor.js → markdown)."""
    corpo = "\n\n".join(
        f"## {title}\n{(values.get(fid) or '').strip() or 'NÃO IDENTIFICADO'}" for fid, title in FIELDS_TITULOS
    )
    resultado = f"# DOCUMENTO\n\n{corpo}\n"
    if incluir_texto and paginas_texto:
        resultado += "\n---\n\n# TEXTO INTEGRAL DO PDF\n\n"
        for indice, conteudo in enumerate(paginas_texto, 1):
            maior = max((len(m) for m in re.findall(r"`+", conteudo)), default=0)
            cerca = "`" * max(3, maior + 1)
            texto = conteudo or "[Página sem texto extraível: pode conter imagem ou digitalização.]"
            resultado += f"## PÁGINA {indice}\n\n{cerca}text\n{texto}\n{cerca}\n\n"
    return resultado


def read_pdf(data: bytes, password: str | None = None, incluir_texto: bool = False) -> dict:
    try:
        pdf = pdfplumber.open(io.BytesIO(data), password=password or "")
        pages = []
        with pdf:
            for page in pdf.pages:
                items = _page_items(page)
                pages.append({"items": items, "width": float(page.width), "height": float(page.height)})
    except PdfminerException as exc:
        if any(isinstance(a, PDFPasswordIncorrect) for a in exc.args):
            raise SenhaNecessaria("senha incorreta" if password else "PDF protegido por senha") from exc
        raise ValueError("Não foi possível abrir este PDF. O arquivo pode estar danificado.") from exc
    result = sanitizar(extract(pages))
    result["paginas"] = len(pages)
    result["sem_texto"] = [n + 1 for n, p in enumerate(pages) if not p["items"]]
    if incluir_texto:
        result["paginas_texto"] = [lines(p["items"]) for p in pages]
    return result
