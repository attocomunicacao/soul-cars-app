"""Edição da planilha de finanças (uma aba por mês, uma tabela por vencimento).

Cada bloco é: linha de cabeçalho ("VENCIMENTO" na coluna B), contas e linha "TOTAL" (coluna C).
O app só altera vencimento e valor das contas e cria o mês seguinte a partir do anterior; o resto
(destinatário, chave, via, acesso, local) é da planilha. Estilos, tabelas do Excel, validações e
links são mantidos. Antes de gravar, uma cópia do arquivo vai para a pasta de backups do app, e a
gravação é atômica.
"""

import copy
import datetime as dt
import os
import shutil
import tempfile
import unicodedata
from collections import Counter
from pathlib import Path

COL_VENCIMENTO, COL_DESTINATARIO, COL_VALOR = 2, 3, 4
COLUNAS_EDITAVEIS = (COL_VENCIMENTO, COL_VALOR)
BACKUPS_MANTIDOS = 10
MESES = [
    "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
    "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
]  # fmt: skip
DIAS_PADRAO = (5, 20)  # vencimentos de cada bloco, quando a aba ainda não tem datas


def _sem_acento(texto) -> str:
    base = unicodedata.normalize("NFD", str(texto or ""))
    return "".join(c for c in base if unicodedata.category(c) != "Mn").strip().upper()


def _texto(celula) -> str:
    return "" if celula.value is None else str(celula.value).strip().upper()


def _blocos(ws):
    """[(cabecalho, total)] — linhas (1-based) de cada bloco, na ordem da aba."""
    blocos, cabecalho = [], None
    for linha in range(1, ws.max_row + 1):
        if _texto(ws.cell(linha, COL_VENCIMENTO)) == "VENCIMENTO":
            cabecalho = linha
        elif cabecalho and _texto(ws.cell(linha, COL_DESTINATARIO)) == "TOTAL":
            blocos.append((cabecalho, linha))
            cabecalho = None
    return blocos


def _bloco_da_linha(ws, linha):
    for cabecalho, total in _blocos(ws):
        if cabecalho < linha < total:
            return cabecalho, total
    raise ValueError(f"A linha {linha} não é uma conta de nenhuma tabela.")


def refazer_totais(ws) -> None:
    """TOTAL de cada bloco = soma de todas as contas do bloco."""
    for cabecalho, total in _blocos(ws):
        ws.cell(total, COL_VALOR).value = (
            f"=SUM('{ws.title}'!$D${cabecalho + 1}:$D${total - 1})"
            if total - 1 > cabecalho
            else 0
        )


def ajustar_datas(ws, ano: int, mes: int) -> None:
    """Põe o vencimento de cada conta no mês/ano da aba, mantendo o dia de cada bloco
    (o dia que mais se repete; 5 e 20 se o bloco não tem datas) e acerta a data do TOTAL."""
    for i, (cabecalho, total) in enumerate(_blocos(ws)):
        dias = Counter(
            ws.cell(l, COL_VENCIMENTO).value.day
            for l in range(cabecalho + 1, total)
            if isinstance(ws.cell(l, COL_VENCIMENTO).value, dt.datetime)
        )
        dia = dias.most_common(1)[0][0] if dias else DIAS_PADRAO[min(i, len(DIAS_PADRAO) - 1)]
        for l in range(cabecalho + 1, total):
            ws.cell(l, COL_VENCIMENTO).value = dt.datetime(ano, mes, dia)
        ws.cell(total, COL_VENCIMENTO).value = f"{dia:02d}/{mes:02d}/{ano}"


def _valor(valor, tipo: str | None):
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return None
    if tipo == "data":
        if isinstance(valor, str):
            return dt.datetime.strptime(valor[:10], "%Y-%m-%d")
        raise ValueError("Data inválida.")
    if tipo == "numero":
        return float(valor)
    return valor.strip() if isinstance(valor, str) else valor


def _celula(wb, op) -> None:
    ws = wb[op["aba"]]
    linha, coluna = int(op["linha"]), int(op["coluna"])
    if coluna not in COLUNAS_EDITAVEIS:
        raise ValueError("Esta coluna só pode ser alterada na planilha.")
    _bloco_da_linha(ws, linha)
    ws.cell(linha, coluna).value = _valor(op.get("valor"), op.get("tipo"))


def _ano_da_aba(ws) -> int:
    anos = Counter(
        c.value.year
        for linha in ws.iter_rows(min_col=COL_VENCIMENTO, max_col=COL_VENCIMENTO)
        for c in linha
        if isinstance(c.value, dt.datetime)
    )
    return anos.most_common(1)[0][0] if anos else dt.date.today().year


def _novo_mes(wb, op) -> None:
    """Cria a aba do mês seguinte a `op["aba"]`: mesma estrutura, mesmas contas, vencimentos
    no novo mês e valor em branco nas contas variáveis (`op["variaveis"]`: uma lista de nomes
    por bloco; vale o início do nome, sem acento nem maiúsculas)."""
    origem = wb[op["aba"]]
    nome_origem = _sem_acento(origem.title)
    indices = [i for i, m in enumerate(MESES) if _sem_acento(m) == nome_origem]
    if not indices:
        raise ValueError(f'A aba "{origem.title}" não tem nome de mês.')
    mes_origem = indices[0] + 1
    ano = _ano_da_aba(origem)
    mes, ano = (1, ano + 1) if mes_origem == 12 else (mes_origem + 1, ano)
    nome = MESES[mes - 1]
    if nome in wb.sheetnames:
        raise ValueError(f"A aba {nome} já existe.")

    nova = wb.copy_worksheet(origem)
    nova.title = nome
    nova.sheet_view.showGridLines = origem.sheet_view.showGridLines
    nova.sheet_view.zoomScale = origem.sheet_view.zoomScale
    nova.sheet_view.tabSelected = False
    # copy_worksheet não leva as tabelas do Excel nem as validações das células.
    proximo_id = max((t.id or 0) for ws in wb for t in ws.tables.values()) + 1
    for tabela in list(origem.tables.values()):
        copia = copy.deepcopy(tabela)
        copia.name = copia.displayName = f"{tabela.name}_{nome}"
        copia.id = proximo_id
        proximo_id += 1
        nova.add_table(copia)
    for validacao in origem.data_validations.dataValidation:
        nova.add_data_validation(copy.deepcopy(validacao))

    variaveis = [[_sem_acento(n) for n in bloco] for bloco in op.get("variaveis") or []]
    for i, (cabecalho, total) in enumerate(_blocos(nova)):
        nomes = variaveis[i] if i < len(variaveis) else []
        for linha in range(cabecalho + 1, total):
            conta = _sem_acento(nova.cell(linha, COL_DESTINATARIO).value)
            if any(conta.startswith(n) for n in nomes):
                nova.cell(linha, COL_VALOR).value = None
    ajustar_datas(nova, ano, mes)
    refazer_totais(nova)


def _aplicar_operacao(wb, op) -> str:
    if op.get("aba") not in wb.sheetnames:
        raise ValueError(f"Aba não encontrada: {op.get('aba')}")
    tipo = op.get("op")
    if tipo == "celula":
        _celula(wb, op)
    elif tipo == "novo_mes":
        _novo_mes(wb, op)
    else:
        raise ValueError(f"Operação desconhecida: {tipo}")
    return op["aba"]


def _backup(caminho: Path, pasta: Path) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    carimbo = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    shutil.copy2(caminho, pasta / f"{caminho.stem}-{carimbo}{caminho.suffix}")
    antigos = sorted(pasta.glob(f"{caminho.stem}-*{caminho.suffix}"))[:-BACKUPS_MANTIDOS]
    for velho in antigos:
        velho.unlink(missing_ok=True)


def gravar(wb, arquivo: Path, pasta_backup: Path) -> float:
    """Backup, gravação num temporário, conferência e troca atômica do arquivo."""
    import openpyxl

    _backup(arquivo, pasta_backup)
    descritor, temporario = tempfile.mkstemp(suffix=".xlsx", dir=arquivo.parent)
    os.close(descritor)
    try:
        wb.save(temporario)
        openpyxl.load_workbook(temporario).close()  # confere que o arquivo gravado abre
        try:
            os.replace(temporario, arquivo)
        except PermissionError as exc:
            raise ValueError(
                "Não foi possível gravar: feche a planilha no Excel e tente de novo."
            ) from exc
    finally:
        if os.path.exists(temporario):
            os.unlink(temporario)
    return arquivo.stat().st_mtime


def aplicar(caminho: str, operacoes: list, lido_em: float | None, pasta_backup: str) -> dict:
    """Aplica as operações (em ordem) e grava a planilha. `lido_em` (segundos desde 1970) é o
    horário do arquivo quando a tela o leu: se mudou no disco desde então, nada é gravado."""
    import openpyxl

    arquivo = Path(caminho)
    if not arquivo.is_file():
        raise ValueError("Planilha não encontrada.")
    if lido_em is not None and arquivo.stat().st_mtime > lido_em + 1:
        raise ValueError(
            "A planilha foi alterada fora do app desde a última leitura. Releia antes de editar."
        )
    wb = openpyxl.load_workbook(arquivo)
    tocadas = {_aplicar_operacao(wb, op) for op in operacoes}
    for aba in tocadas:
        if wb[aba].title in wb.sheetnames:
            refazer_totais(wb[aba])
    return {"modificado": gravar(wb, arquivo, Path(pasta_backup))}


def otimizar(caminho: str, pasta_backup: str) -> dict:
    """Arruma a planilha toda: fórmulas do TOTAL somando todas as contas e vencimentos no mês
    de cada aba. Usado uma vez, para limpar planilhas feitas à mão."""
    import openpyxl

    arquivo = Path(caminho)
    wb = openpyxl.load_workbook(arquivo)
    ano = None
    for ws in wb:
        indices = [i for i, m in enumerate(MESES) if _sem_acento(m) == _sem_acento(ws.title)]
        if not indices:
            continue
        ano = _ano_da_aba(ws) if ano is None else ano
        ajustar_datas(ws, ano, indices[0] + 1)
        refazer_totais(ws)
    return {"modificado": gravar(wb, arquivo, Path(pasta_backup))}
