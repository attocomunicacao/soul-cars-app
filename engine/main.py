"""Motor de automação do SOUL Cars Studio.

Protocolo: uma requisição JSON por linha no stdin ({"method", "params"}),
uma resposta JSON por linha no stdout ({"result"} ou {"error"}).
Arquivos trafegam em base64. Nunca use print() para depuração: escreva em sys.stderr.
Bibliotecas pesadas são importadas só no primeiro uso (o ping responde na hora).
"""

import base64
import json
import platform
import sys
import time
from pathlib import Path

STARTED = time.time()


def _bytes(params, key="arquivo"):
    """Conteúdo do arquivo: em base64 (anexo do navegador) ou lido de 'origem' (já no disco)."""
    origem = params.get("origem")
    if origem:
        try:
            return Path(origem).read_bytes()
        except OSError as exc:
            raise ValueError(f"Não foi possível ler {origem}: {exc}") from exc
    try:
        return base64.b64decode(params[key])
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Arquivo não recebido corretamente.") from exc


def progresso(pct: float, texto: str = "") -> None:
    """Avisa o app do andamento: linha própria no stdout, antes da resposta final.
    O app mostra a porcentagem; quem não entende a linha simplesmente a ignora."""
    linha = json.dumps({"progress": {"pct": max(0, min(100, round(pct))), "texto": texto}})
    sys.stdout.write(linha + "\n")
    sys.stdout.flush()


def ping(_params):
    return {"python": platform.python_version(), "uptime_s": round(time.time() - STARTED, 1)}


def ler_crlv(params):
    import crlv

    data = _bytes(params)
    try:
        return _ler_com_ocr_se_preciso(data, params.get("senha"))
    except crlv.SenhaNecessaria as exc:
        return {"senha": str(exc)}


def _precisa_de_ocr(result) -> bool:
    """Sem texto nenhum, ou com os campos principais vazios: é um PDF "de imagem"."""
    if not result["paginas"]:
        return False
    essenciais = [result["values"].get(k) for k in ("renavam", "placa", "marca", "chassi")]
    return len(result["sem_texto"]) == result["paginas"] or sum(map(bool, essenciais)) < 2


def _ler_com_ocr_se_preciso(data, senha, incluir_texto=False):
    import crlv

    result = crlv.read_pdf(data, senha, incluir_texto=incluir_texto)
    if not _precisa_de_ocr(result):
        return result
    try:
        ocr_result = _crlv_por_ocr(data, senha)
    except Exception as exc:  # noqa: BLE001 — sem OCR, devolve o que o texto deu
        result["ocr_erro"] = str(exc)
        return result
    if incluir_texto:
        # O texto integral do DOC.md vem do próprio OCR: o PDF escaneado não tem texto.
        ocr_result["paginas_texto"] = ocr_result.pop("paginas_ocr", []) or result.get("paginas_texto", [])
    else:
        ocr_result.pop("paginas_ocr", None)
    return ocr_result


def _crlv_por_ocr(data, senha):
    """PDF escaneado: renderiza cada página e aplica a mesma leitura por posição."""
    import io

    import crlv
    import ocr
    import pdfplumber

    pages = []
    with pdfplumber.open(io.BytesIO(data), password=senha or "") as pdf:
        for page in pdf.pages:
            scale = 300 / 72  # 300 dpi: o CRLV escaneado tem letra miúda
            image = page.to_image(resolution=300).original.convert("RGB")
            pages.append({"items": ocr.pagina_pdf_itens(image, scale), "width": float(page.width), "height": float(page.height)})
    result = crlv.sanitizar(crlv.extract(pages))
    result.update(paginas=len(pages), sem_texto=[], ocr=True, paginas_ocr=[crlv.lines(p["items"]) for p in pages])
    return result


def ocr_equipamentos(params):
    import ocr

    return ocr.equipamentos(_bytes(params), params.get("modo", "auto"))


def remover_fundo(params):
    """Recorta a foto. Com 'origem' (caminho), grava o PNG no disco (ex.: FOTOS/1_sem_fundo.png);
    senão, devolve o PNG em base64 para o editor de criativos."""
    import fundo

    modelo = params.get("modelo") or fundo.MODELO
    if params.get("origem"):
        caminho = fundo.remover_arquivo(params["origem"], params.get("destino"), modelo, progresso)
        return {"caminho": caminho}
    png = fundo.remover(_bytes(params), modelo, progresso)
    return {"png": base64.b64encode(png).decode("ascii")}


def gerar_doc_md(params):
    """DOC.md do CRLV, no mesmo formato do sistema antigo."""
    import crlv

    dados = _bytes(params)
    try:
        resultado = _ler_com_ocr_se_preciso(dados, params.get("senha"), incluir_texto=True)
    except crlv.SenhaNecessaria as exc:
        return {"senha": str(exc)}
    markdown = crlv.markdown(resultado["values"], resultado.get("paginas_texto", []), params.get("texto_integral", True))
    return {"values": resultado["values"], "markdown": markdown, "conflicts": resultado["conflicts"]}


def cnw_buscar(params):
    """Versões do modelo no Carros na Web (catálogo do site)."""
    import cnw

    return cnw.buscar(params.get("nome") or "", params.get("ano"))


def cnw_ficha(params):
    """Ficha técnica + equipamentos DE SÉRIE de uma versão do Carros na Web."""
    import cnw

    return cnw.ficha(params.get("codigo"), params.get("referer"))


def fotos_organizar(params):
    """Ordem sugerida das fotos do veículo (a IA olha cada uma). Não renomeia nada."""
    import fotos

    return fotos.organizar(params, progresso)


METHODS = {
    "ping": ping,
    "ler_crlv": ler_crlv,
    "ocr_equipamentos": ocr_equipamentos,
    "remover_fundo": remover_fundo,
    "gerar_doc_md": gerar_doc_md,
    "cnw_buscar": cnw_buscar,
    "cnw_ficha": cnw_ficha,
    "fotos_organizar": fotos_organizar,
}


def main():
    # O app fala UTF-8; sem isso o Windows usa cp1252 nos pipes e os acentos quebram.
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.path.insert(0, __file__.rsplit("\\", 1)[0].rsplit("/", 1)[0])
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            request = json.loads(line.lstrip("﻿"))
            handler = METHODS.get(request.get("method"))
            if handler is None:
                raise ValueError(f"Método desconhecido: {request.get('method')}")
            response = {"result": handler(request.get("params") or {})}
        except Exception as exc:  # noqa: BLE001 - todo erro volta para a interface
            print(f"[engine] {type(exc).__name__}: {exc}", file=sys.stderr)
            response = {"error": str(exc)}
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
