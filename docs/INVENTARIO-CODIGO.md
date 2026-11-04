# Inventário do código SOUL Cars

Referência: 23/10/2026. Índice dos arquivos autorais, configurações e fixtures examinados. Símbolos são extraídos mecanicamente, sem representar todas as funções anônimas ou métodos internos. Consulte o [contexto](CONTEXTO-PARA-OUTRO-CHAT.md), os [detalhes de implementação](DETALHES-IMPLEMENTACAO.md) e a [cobertura da leitura](COBERTURA-LEITURA.md).

Total: 206 arquivos, 35594 linhas.

## [.github/dependabot.yml](../.github/dependabot.yml)

Linhas: 13.

## [.github/workflows/ci.yml](../.github/workflows/ci.yml)

Linhas: 71.

## [.gitignore](../.gitignore)

Linhas: 30.

## [electron.vite.config.ts](../electron.vite.config.ts)

Linhas: 36.

```text
9: export default defineConfig({
```

## [engine/.python-version](../engine/.python-version)

Linhas: 1.

## [engine/cnw.py](../engine/cnw.py)

Linhas: 328.

```text
30: class SiteComErro(ValueError):
44: def _texto_pausa(inicio: str) -> str:
53: def _checar_pausa() -> None:
58: def _sem_acento(texto: str) -> str:
63: def _pegar(caminho: str, referer: str | None = None, tentativas: int = 3) -> str:
107: def _texto(bruto: str) -> str:
111: def _linhas(pagina: str) -> list[str]:
116: def _modelo_de(nome: str) -> str:
128: def buscar(nome: str, ano: str | int | None = None) -> dict:
188: def _valor_apos(linhas: list[str], rotulo: str, ate: set[str], maximo: int = 3) -> str:
204: def _equipamentos(pagina: str) -> dict[str, list[str]]:
227: def ficha(codigo: str | int, referer: str | None = None) -> dict:
280: def ficha_texto(texto: str) -> dict:
```

## [engine/crlv.py](../engine/crlv.py)

Linhas: 246.

```text
44: class SenhaNecessaria(Exception):
48: def normalize(s: str) -> str:
57: def lines(items: list[dict]) -> str:
70: def _linhas_de(candidates: list[dict]) -> list[str]:
75: def _melhor_linha(fid: str, candidates: list[dict]) -> str:
101: def extract(pages: list[dict]) -> dict:
147: def _so_digitos(texto: str) -> str:
151: def _placa(texto: str) -> str:
175: def sanitizar(dados: dict) -> dict:
190: def _page_items(page) -> list[dict]:
213: def markdown(values: dict, paginas_texto: list[str], incluir_texto: bool = True) -> str:
229: def read_pdf(data: bytes, password: str | None = None, incluir_texto: bool = False) -> dict:
```

## [engine/estudio_3d.py](../engine/estudio_3d.py)

Linhas: 372.

```text
27: def _numero(valor, minimo, maximo, nome):
38: def validar(params):
99: def molde(tipo, altura_solo):
121: def camera(params):
182: def intersecao(origens, direcao, centro, raios):
197: def bloqueado(origens, direcao, objetos, distancia_maxima):
204: def distancia_oclusao(origens, direcao, objetos):
212: def _png(imagem):
219: def _renderizar(chave):
363: def renderizar(params, progresso=None):
```

## [engine/ficha_web.py](../engine/ficha_web.py)

Linhas: 38.

```text
16: def _curto(exc: Exception) -> str:
20: def buscar(nome: str, ano: str | int | None = None) -> dict:
33: def ficha(codigo: str) -> dict:
```

## [engine/fichacompleta.py](../engine/fichacompleta.py)

Linhas: 231.

```text
41: class FonteIndisponivel(ValueError):
45: class PaginaInexistente(FonteIndisponivel):
49: def _sem_acento(texto: str) -> str:
54: def _slug(texto: str) -> str:
58: def _pegar(caminho: str, tentativas: int = 2) -> str:
100: def _linhas(pagina: str) -> list[str]:
110: def _marca_slug(nome: str) -> tuple[str, str]:
130: def buscar(nome: str, ano: str | int | None = None) -> dict:
172: def _titulo(caminho: str) -> str:
178: def _valor(linhas: list[str], rotulo: str, inicio: int = 0) -> str:
185: def ler_ficha(pagina: str) -> dict:
218: def ficha(codigo: str) -> dict:
```

## [engine/fotos.py](../engine/fotos.py)

Linhas: 97.

```text
41: def _fotos_da_pasta(pasta: str) -> list[Path]:
53: def _miniatura(caminho: Path) -> str:
62: def organizar(params: dict, progresso=None) -> dict:
```

## [engine/fundo.py](../engine/fundo.py)

Linhas: 97.

```text
30: def _sessao(modelo: str):
36: def limpar_mascara(alpha: np.ndarray) -> np.ndarray:
53: def _abrir(data: bytes) -> Image.Image:
64: def remover(data: bytes, modelo: str = MODELO, progresso=None) -> bytes:
89: def remover_arquivo(origem: str, destino: str | None = None, modelo: str = MODELO, progresso=None) -> str:
```

## [engine/main.py](../engine/main.py)

Linhas: 246.

```text
20: def _bytes(params, key="arquivo"):
34: def progresso(pct: float, texto: str = "") -> None:
42: def ping(_params):
46: def ler_crlv(params):
56: def _precisa_de_ocr(result) -> bool:
64: def _ler_com_ocr_se_preciso(data, senha, incluir_texto=False):
83: def _crlv_por_ocr(data, senha):
102: def ocr_equipamentos(params):
108: def remover_fundo(params):
121: def aquecer_recorte(params):
129: def estudio_renderizar(params):
135: def gerar_doc_md(params):
148: def planilha_aplicar(params):
156: def soulia_planilha(params):
163: def cnw_buscar(params):
170: def cnw_ficha(params):
177: def ficha_web_buscar(params):
184: def ficha_web_ficha(params):
191: def cnw_texto(params):
198: def fotos_organizar(params):
224: def main():
```

## [engine/ocr.py](../engine/ocr.py)

Linhas: 168.

```text
26: def _tesseract():
37: def _normalize(s: str) -> str:
41: def abrir_imagem(data: bytes) -> Image.Image:
54: def _sem_icones(image: Image.Image) -> Image.Image:
65: def linhas(image: Image.Image, limpar_icones: bool = True) -> tuple[list[dict], float]:
107: def _limpar(s: str) -> str:
113: def _amarelo(pixels: np.ndarray, line: dict) -> bool:
127: def equipamentos(data: bytes, modo: str = "auto") -> dict:
165: def pagina_pdf_itens(image: Image.Image, scale: float) -> list[dict]:
```

## [engine/planilha.py](../engine/planilha.py)

Linhas: 230.

```text
29: def _sem_acento(texto) -> str:
34: def _texto(celula) -> str:
38: def _blocos(ws):
50: def _bloco_da_linha(ws, linha):
57: def refazer_totais(ws) -> None:
67: def ajustar_datas(ws, ano: int, mes: int) -> None:
77: def _valor(valor, tipo: str | None):
89: def _celula(wb, op) -> None:
98: def _ano_da_aba(ws) -> int:
108: def _novo_mes(wb, op) -> None:
151: def _aplicar_operacao(wb, op) -> str:
164: def _backup(caminho: Path, pasta: Path) -> None:
173: def gravar(wb, arquivo: Path, pasta_backup: Path) -> float:
195: def aplicar(caminho: str, operacoes: list, lido_em: float | None, pasta_backup: str) -> dict:
215: def otimizar(caminho: str, pasta_backup: str) -> dict:
```

## [engine/pyproject.toml](../engine/pyproject.toml)

Linhas: 14.

## [engine/soulia_planilha.py](../engine/soulia_planilha.py)

Linhas: 55.

```text
14: def _limpar(valor):
21: def exportar(entrada: str, saida: str) -> dict:
```

## [engine/tests/fixtures/equipamentos-esperados.json](../engine/tests/fixtures/equipamentos-esperados.json)

Linhas: 14.

## [engine/tests/test_cnw.py](../engine/tests/test_cnw.py)

Linhas: 157.

```text
64: class TestBusca(unittest.TestCase):
79: class TestFicha(unittest.TestCase):
128: class TestTextoColado(unittest.TestCase):
145: class TestPausa(unittest.TestCase):
```

## [engine/tests/test_crlv.py](../engine/tests/test_crlv.py)

Linhas: 109.

```text
21: def ler(dados: bytes, incluir_texto: bool = False) -> dict:
27: def esperado(doc_md: Path) -> dict:
41: def pastas_com_crlv():
48: class TestCrlv(unittest.TestCase):
90: class TestSanitizar(unittest.TestCase):
```

## [engine/tests/test_doc_md.py](../engine/tests/test_doc_md.py)

Linhas: 82.

```text
17: def ler(dados: bytes, incluir_texto: bool = False) -> dict:
23: def pastas():
29: def cabecalho(texto: str) -> str:
37: class TestDocMd(unittest.TestCase):
```

## [engine/tests/test_estudio_3d.py](../engine/tests/test_estudio_3d.py)

Linhas: 107.

```text
18: def cena():
25: class TestEstudio3D(unittest.TestCase):
```

## [engine/tests/test_ficha_web.py](../engine/tests/test_ficha_web.py)

Linhas: 154.

```text
31: class TestLeituraDaFicha(unittest.TestCase):
62: class TestOrdemDasFontes(unittest.TestCase):
98: def _paginas(mapa):
107: class TestNomeDoCadastro(unittest.TestCase):
```

## [engine/tests/test_fundo.py](../engine/tests/test_fundo.py)

Linhas: 41.

```text
14: class TestFundo(unittest.TestCase):
```

## [engine/tests/test_legendas.py](../engine/tests/test_legendas.py)

Linhas: 257.

```text
29: def falar(texto, pausa=0.25):
39: def agrupar_simples(frase):
43: class TestContexto(unittest.TestCase):
112: class TestAgrupar(unittest.TestCase):
127: class TestAssRenderiza(unittest.TestCase):
219: class TestTarjas(unittest.TestCase):
```

## [engine/tests/test_licencas.py](../engine/tests/test_licencas.py)

Linhas: 41.

```text
15: class TestLicencas(unittest.TestCase):
```

## [engine/tests/test_ocr.py](../engine/tests/test_ocr.py)

Linhas: 109.

```text
25: def norm(s: str) -> str:
29: def fonte(tamanho: int, negrito=False):
38: def gerar_print(esperado: dict, escala: float = 1.0) -> bytes:
61: class TestOcr(unittest.TestCase):
94: class TestIconeInicial(unittest.TestCase):
```

## [engine/tests/test_planilha.py](../engine/tests/test_planilha.py)

Linhas: 133.

```text
17: def _criar(pasta: Path) -> Path:
37: class TestPlanilha(unittest.TestCase):
```

## [engine/tests/test_soulia_planilha.py](../engine/tests/test_soulia_planilha.py)

Linhas: 43.

```text
16: class TestSouliaPlanilha(unittest.TestCase):
```

## [engine/tests/test_utf8.py](../engine/tests/test_utf8.py)

Linhas: 26.

```text
12: class TestUtf8(unittest.TestCase):
```

## [engine/tests/test_video.py](../engine/tests/test_video.py)

Linhas: 219.

```text
17: def palavras(*textos):
21: def texto(ws):
25: class TestFixWords(unittest.TestCase):
56: class TestAssets(unittest.TestCase):
82: def criar_video_final(destino: Path) -> None:
91: def codec_video(arquivo: Path) -> str:
97: class TestVersaoLeve(unittest.TestCase):
169: class TestTrilha(unittest.TestCase):
198: class TestRunFfmpeg(unittest.TestCase):
```

## [engine/video/animacao_tarjas.py](../engine/video/animacao_tarjas.py)

Linhas: 59.

```text
19: def escolher(veiculo: str) -> str:
27: def _entrada(t0: float, t1: float) -> str:
32: def _saida(t0: float, t1: float) -> str:
36: def _por_fase(t_in0, t_in1, t_out0, t_out1, antes, durante_in, parado, durante_out, depois) -> str:
41: def filtros(predefinicao: str, indice: int, largura: int, y: int, entra: tuple, sai: tuple) -> dict:
```

## [engine/video/contexto.py](../engine/video/contexto.py)

Linhas: 210.

```text
87: def sem_acento(texto: str) -> str:
91: def nucleo(palavra: str) -> str:
96: def texto_da(palavras: list) -> str:
100: def frases(words: list, pausa: float = 0.9) -> list:
116: def classificar(palavras: list, primeira: bool = False) -> tuple:
133: def palavra_destaque(palavras: list, assunto: str):
158: def _semente(veiculo: str) -> int:
162: def planejar(words: list, agrupar, veiculo: str = "") -> list:
204: def resumo(plano: list) -> str:
```

## [engine/video/correcoes.txt](../engine/video/correcoes.txt)

Linhas: 12.

## [engine/video/legendas.py](../engine/video/legendas.py)

Linhas: 247.

```text
42: def ass_time(t: float) -> str:
50: def _limpa(w: str) -> str:
54: def _largura(palavras: list, destaque, pequena, grande) -> float:
63: def agrupar_legendas(frase: list, cabe=None) -> list:
83: def _n(valor: float) -> str:
90: def curva_expo(t: float, forca: float) -> float:
95: def curva_quint(t: float, forca: float) -> float:
99: def curva_back(t: float, forca: float) -> float:
105: def curva_mola(t: float, forca: float) -> float:
118: def _alfa(valor: float) -> str:
122: def _estado(nome: str, p: float, t: float, k: float, direcao: int, largura: float, sombra: bool) -> dict:
147: def _marcas_do_estado(e: dict) -> str:
154: def eventos_da_animacao(plano: dict, largura: float, ini: float, fim: float, sombra: bool = False) -> list:
190: def texto_da_frase(plano: dict, inicio: float, sombra: bool = False) -> str:
210: def gerar_ass(words: list, video_end: float, out: Path, fonte: Path, veiculo: str = "") -> list:
```

## [engine/video/leve.py](../engine/video/leve.py)

Linhas: 114.

```text
38: def localizar_final(root: Path) -> Path:
50: def nome_saida(final: Path) -> str:
54: def montar_comando(entrada: Path, saida: Path, args_video: list) -> list:
60: def gerar(folder: str, codificadores: list = None) -> Path:
```

## [engine/video/render.py](../engine/video/render.py)

Linhas: 344.

```text
43: def log(msg: str) -> None:
50: def pasta_trilha_do_app() -> Path | None:
56: def localizar_trilha(assets: Path) -> Path | None:
62: def progresso(pct: float, texto: str) -> None:
67: def run_ffmpeg(cmd: list, segundos_totais: float, inicio: float, fim: float, texto: str) -> None:
88: def run(cmd: list) -> None:
94: def probe_duration(path: Path) -> float:
100: def strip_accents(s: str) -> str:
104: def levenshtein(a: str, b: str) -> int:
115: def tarja_png(text: str, spec, out: Path) -> tuple:
134: def fix_words(words: list, veiculo: str, correcoes: list) -> list:
176: def build_ass(words: list, video_end: float, out: Path, veiculo: str = "") -> list:
181: def preparar_fontes(destino: Path) -> Path:
188: def localizar_video(root: Path) -> Path:
199: def main(folder: str, veiculo: str, motor: str, preco: str) -> None:
```

## [engine/video/transcribe.py](../engine/video/transcribe.py)

Linhas: 35.

```text
11: def main(audio_path: str, out_json: str, duracao: float = 0.0, progresso=None) -> None:
```

## [engine/visao.py](../engine/visao.py)

Linhas: 105.

```text
28: def pasta_modelo() -> Path:
37: def baixar(progresso=None) -> Path:
64: def _sessao():
73: def _entrada(caminho: Path) -> np.ndarray:
85: def pontuar(caminhos: list[Path], frases: list[str], progresso=None) -> np.ndarray:
```

## [eslint.config.js](../eslint.config.js)

Linhas: 94.

```text
25: export default tseslint.config(
```

## [package.json](../package.json)

Linhas: 99.

## [scripts/gerar-avisos-licencas.py](../scripts/gerar-avisos-licencas.py)

Linhas: 151.

```text
19: def norm(nome: str) -> str:
45: def licenca(nome: str) -> str:
62: def diretas() -> dict[str, str]:
71: def pacotes() -> list[tuple[str, str, str, str]]:
106: def main() -> int:
```

## [scripts/iniciar-dev.cmd](../scripts/iniciar-dev.cmd)

Linhas: 6.

## [scripts/iniciar-oculto.vbs](../scripts/iniciar-oculto.vbs)

Linhas: 10.

## [scripts/iniciar.cmd](../scripts/iniciar.cmd)

Linhas: 13.

## [scripts/iniciar.mjs](../scripts/iniciar.mjs)

Linhas: 100.

```text
13: function registrar(texto) {
21: function falhar(texto) {
27: function maisRecente(alvo) {
```

## [scripts/instalar-motor.cmd](../scripts/instalar-motor.cmd)

Linhas: 11.

## [scripts/instalar.cmd](../scripts/instalar.cmd)

Linhas: 14.

## [scripts/preparar-smoke-instagram.cjs](../scripts/preparar-smoke-instagram.cjs)

Linhas: 17.

## [scripts/smoke-instagram.cjs](../scripts/smoke-instagram.cjs)

Linhas: 165.

## [scripts/smoke.cjs](../scripts/smoke.cjs)

Linhas: 220.

## [src/compartilhado/anuncio-ia.ts](../src/compartilhado/anuncio-ia.ts)

Linhas: 234.

```text
6: export type FichaIA = {
21: export type TextosAnuncio = {
27: export type ResultadoValidacao =
60: const limpaMarcador = (linha: string) => linha.replace(/^[-*•]\s*/, "").trim();
61: const chave = (s: string) =>
65: export function equipamentosDaFicha(f: FichaIA): string[] {
74: const ehOpcional = (item: string) => item.toUpperCase().includes("OPCIONAL");
76: export function montarPrompt(ficha: FichaIA, loja: string): string {
97: export function extrairJson(bruto: string): unknown {
118: const ehTexto = (x: unknown): x is string => typeof x === "string";
120: export function validarResposta(
```

## [src/compartilhado/anuncio.ts](../src/compartilhado/anuncio.ts)

Linhas: 236.

```text
14: export type DestinoChecklist = "producao" | "ficha" | "criativos";
16: export type EntradaChecklist = {
27: export type ItemChecklist = {
36: const stem = (n: string) => n.replace(/\.[^.]+$/, "");
39: function fotosDoVeiculo(nomes: string[]) {
44: export function fotosNumeradas(nomes: string[]): {
74: export const nomeBaseCriativo = (nome: string, ano: string | null) =>
77: export function fotoDoAnuncio(
90: export function checklist(e: EntradaChecklist): ItemChecklist[] {
141: export const prontoParaAnunciar = (itens: ItemChecklist[]) =>
145: export type CartaoCampanha = {
154: export function nomeComPrefixoVenda(nome: string): string {
165: export function cartaoCampanha(desMd: string): CartaoCampanha {
178: export type AnuncioRegistrado = {
189: export type AvisoPausa = {
195: const dia = (iso: string) => iso.slice(0, 10);
201: export function anunciosParaPausar(
216: export function dadosDoBndvAntigos(
228: export function hoje(agora = new Date()): string {
233: export const dataBr = (d: string) =>
```

## [src/compartilhado/crm-etiquetas.ts](../src/compartilhado/crm-etiquetas.ts)

Linhas: 134.

```text
10: export type EtiquetaClassificada =
17: export type Etapa =
50: export function textoLimpo(s: string): string {
61: export const compacto = (s: string) => textoLimpo(s).replace(/\s/g, "");
65: export function classificarEtiqueta(
86: export type DemandaModelo = {
92: type Contada = { nome: string; emoji?: string | null; leads: number };
95: export function demandaPorModelo(etiquetas: Contada[]): DemandaModelo[] {
116: export type VeiculoEstoque = {
123: export function emEstoque(
```

## [src/compartilhado/entrada.ts](../src/compartilhado/entrada.ts)

Linhas: 77.

```text
6: export type TipoArquivo =
27: const semAcento = (s: string) =>
34: export function extrairPlacas(nome: string): string[] {
44: export function placaDaPasta(nome: string): string | null {
48: export function ehTemporario(nome: string): boolean {
58: export function classificar(nome: string): TipoArquivo {
69: export function nomeComSufixo(nome: string, n: number): string {
```

## [src/compartilhado/estudio-3d.ts](../src/compartilhado/estudio-3d.ts)

Linhas: 23.

```text
2: export type CenaEstudio = {
15: export type RenderEstudio = {
```

## [src/compartilhado/instagram.ts](../src/compartilhado/instagram.ts)

Linhas: 49.

```text
1: export type MidiaInstagram = {
8: export type PlanoInstagram = {
17: export type EtapaInstagram =
19: export type RegistroInstagram = {
28: export type EstadoInstagram = {
34: export const contaInstagram = (valor: string) =>
36: export function slugInstagram(nome: string, ano: string | null) {
```

## [src/compartilhado/publicacao.ts](../src/compartilhado/publicacao.ts)

Linhas: 80.

```text
3: export type BlocoCopia = { label: string; text: string };
5: const norm = (s: string) =>
18: function sections(markdown: string) {
51: export function blocosDeCopia(markdown: string): BlocoCopia[] {
```

## [src/compartilhado/veiculo.ts](../src/compartilhado/veiculo.ts)

Linhas: 30.

## [src/compartilhado/vitrine.ts](../src/compartilhado/vitrine.ts)

Linhas: 27.

```text
2: export type CartaoVitrine = {
```

## [src/main/caminhos.ts](../src/main/caminhos.ts)

Linhas: 113.

```text
27: export const userData = () => app.getPath("userData");
28: export const ARQUIVO_CONFIG = () => path.join(userData(), "config.json");
29: export const BANCO = () => path.join(userData(), "soul.db");
30: export const PASTA_VEICULOS = () => path.join(userData(), "veiculos");
31: export const PASTA_BACKUPS = () => path.join(userData(), "backups");
33: type Config = { raizDados?: string } & Record<string, unknown>;
37: export function lerConfig(): Config {
59: export function gravarConfig(patch: Config) {
74: export function raizDados(): string {
92: export const ESTOQUE = () => path.join(raizDados(), "ESTOQUE");
93: export const DADOS = () => path.join(raizDados(), "dados");
94: export const PERFIL_BNDV = () => path.join(raizDados(), ".perfil-bndv");
96: export const CSV_VEICULOS = () => path.join(DADOS(), "bndv_veiculos.csv");
97: export const CSV_VENDAS = () => path.join(DADOS(), "bndv_vendas.csv");
98: export const BALANCO_JSON = () => path.join(DADOS(), "balanco.json");
99: export const RELATORIO_HTML = () => path.join(DADOS(), "RELATORIO.html");
100: export const INDICE_CSV = () => path.join(ESTOQUE(), "_INDICE.csv");
103: export function garantir() {
108: export function recurso(nome: string) {
```

## [src/main/config-json.ts](../src/main/config-json.ts)

Linhas: 16.

```text
7: export function lerConfigJson(texto: string): Record<string, unknown> | null {
```

## [src/main/diagnostico.ts](../src/main/diagnostico.ts)

Linhas: 73.

```text
14: export const arquivoDoLog = () => path.join(app.getPath("userData"), "app.log");
17: export function registrar(texto: string) {
39: export function iniciarDiagnostico() {
```

## [src/main/embutidas.ts](../src/main/embutidas.ts)

Linhas: 139.

```text
13: export type IdEmbutida = "crm" | "bndv" | "meta";
15: export type Retangulo = {
44: type Embutida = {
51: function criar(id: IdEmbutida, janela: BrowserWindow): Embutida {
89: export function mostrarEmbutida(
121: export function esconderEmbutidas(menos?: IdEmbutida) {
128: export function fecharEmbutidas() {
```

## [src/main/estoque/balanco.ts](../src/main/estoque/balanco.ts)

Linhas: 374.

```text
75: export type Contas = Record<string, Record<string, number>>;
78: export function moedaBr(v: number) {
85: export function num(v: unknown): number {
98: export function carregar(): Contas {
117: export function salvar(dados: Contas) {
134: const lerCsvOpcional = (arquivo: string) => {
143: export type LinhaVeiculo = {
175: export type DadosBndv = {
190: export function dadosBndv(): DadosBndv | null {
329: export type Balanco = {
341: export function montar(dados?: Contas): Balanco {
```

## [src/main/estoque/bndv-esquema.ts](../src/main/estoque/bndv-esquema.ts)

Linhas: 234.

```text
12: export type PapelExtra =
48: export type TipoGql = {
53: export type CampoGql = {
60: export function tipoBase(t: TipoGql): {
74: const exigeArgumento = (c: CampoGql) =>
79: export type Escolha = { papel: PapelExtra; campo: string; sub: string | null };
85: export function escolherCampos(
119: export function selecaoDasEscolhas(escolhas: Escolha[]): string {
130: export function textoDoValor(v: unknown): string {
156: export type Descoberta = {
163: async function camposDoTipo(api: Opcoes, nome: string): Promise<CampoGql[]> {
175: export async function descobrirExtras(
```

## [src/main/estoque/extracao.ts](../src/main/estoque/extracao.ts)

Linhas: 390.

```text
31: export type { Log };
87: const campo = (d: unknown, ...chaves: string[]) => {
94: function celula(x: unknown) {
106: function csv(
117: export function gravarCsvs(veiculos: Registro[], vendas: Registro[]) {
176: const PARECE_LOGIN = (url: string) => /login|auth|signin/i.test(url);
185: async function capturarToken(
294: export type ResultadoExtracao = {
301: function registrarCampos(extras: Awaited<ReturnType<typeof descobrirExtras>>) {
329: export async function extrair(
```

## [src/main/estoque/graphql.ts](../src/main/estoque/graphql.ts)

Linhas: 257.

```text
14: export class SessaoExpirada extends Error {
24: export function ehErroDeSessao(mensagem: string, status = 0): boolean {
34: export type Log = (
38: export type Registro = Record<string, unknown>;
39: export type Pagina = { itens: Registro[]; total: number };
40: export type ErroGraphql = {
44: type Resposta = {
54: export const montarConsulta = (raiz: string, pagina: number, selecao: string) =>
58: export function campoInexistente(mensagem: string): string | null {
67: export function removerCampoEm(selecao: string, pos: number): string {
100: export function podarCampoDoErro(
126: export type Opcoes = {
135: export async function consultar(
166: export async function puxar(
```

## [src/main/estoque/ordem.ts](../src/main/estoque/ordem.ts)

Linhas: 12.

```text
7: export function ordenarPorEntrada(linhas: LinhaVeiculo[]): LinhaVeiculo[] {
```

## [src/main/estoque/relatorio-impressao.ts](../src/main/estoque/relatorio-impressao.ts)

Linhas: 54.

```text
43: export function comEstiloDeImpressao(html: string): string {
48: export function nomeDoPdf(hoje = new Date()): string {
```

## [src/main/estoque/relatorio-pdf.ts](../src/main/estoque/relatorio-pdf.ts)

Linhas: 76.

```text
19: export async function htmlParaPdf(html: string): Promise<Buffer> {
57: export async function exportarRelatorioPdf(pai?: BrowserWindow | null) {
```

## [src/main/estoque/relatorio.ts](../src/main/estoque/relatorio.ts)

Linhas: 629.

```text
27: const esc = (s: unknown) =>
50: const curto = (v: number) =>
53: const dataBr = (iso: string) =>
64: function barrasMes(porMes: DadosBndv["porMes"], limite = 12) {
146: export function janelasLucro(porMes: DadosBndv["porMes"], hoje = new Date()) {
171: function lucroNavegavel(porMes: DadosBndv["porMes"]) {
186: function barrasH(
206: function histograma(
244: function tabelaCarros(linhas: LinhaVeiculo[]) {
284: export function render(b: Balanco): string {
438: export function gerarHtml(destino = caminhos.RELATORIO_HTML()) {
591: function mostrarMes(indice){
```

## [src/main/estoque/sync.ts](../src/main/estoque/sync.ts)

Linhas: 459.

```text
22: export type LinhaCsv = Record<string, string>;
25: export function slug(s: string) {
35: export function brl(v: unknown) {
45: export const ehAtivo = (v: LinhaCsv) =>
51: export const ehConsignado = (v: LinhaCsv) =>
58: export const dataBr = (iso: string) =>
61: export function diasEntre(inicio: string, fim: string): number | null {
70: export function lerCsv(arquivo: string): LinhaCsv[] {
113: function gravarCsv(arquivo: string, linhas: Record<string, string | number>[]) {
133: export function ficha(v: LinhaCsv, vds: LinhaCsv[]) {
215: export function fichaTxt(v: LinhaCsv, vds: LinhaCsv[]) {
303: export function selecionar(veiculos: LinhaCsv[], todos = false) {
321: export type ResumoSync = {
332: export function sincronizar(log: Log, todos = false): ResumoSync {
```

## [src/main/estoque/vendas.ts](../src/main/estoque/vendas.ts)

Linhas: 34.

```text
11: export type UltimasVendas = {
18: export function ultimasVendas(): UltimasVendas {
```

## [src/main/estoque/vitrine-dados.ts](../src/main/estoque/vitrine-dados.ts)

Linhas: 112.

```text
13: export type { CartaoVitrine };
15: export type PastaMin = { nome: string; caminho: string; fotos: string[] };
16: export type FichaMin = {
28: const idDaPasta = (nome: string) => /^(\d+)_/.exec(nome)?.[1] ?? null;
29: const texto = (v: unknown) => {
33: const numero = (v: unknown) => {
39: export function diasDesde(entrada: string, hoje = new Date()): number | null {
51: export function ordemDeFotos(fotos: string[]): string[] {
58: export function montarVitrine(
```

## [src/main/estoque/vitrine.ts](../src/main/estoque/vitrine.ts)

Linhas: 51.

```text
16: export type { CartaoVitrine };
21: function reduzirFoto(arquivo: string): string | null {
39: export function vitrine(): CartaoVitrine[] {
```

## [src/main/financas.ts](../src/main/financas.ts)

Linhas: 110.

```text
13: type Pagos = Record<string, boolean>;
15: function caminhoVinculado(): string | null {
20: export function estadoFinancas() {
29: export function vincularFinancas(origem: string) {
37: export function desvincularFinancas() {
43: export function lerFinancas() {
63: export function marcarPagos(chaves: string[], pago: boolean) {
77: export async function editarFinancas(
103: export async function abrirFinancas() {
```

## [src/main/gpu.ts](../src/main/gpu.ts)

Linhas: 24.

```text
12: export function pedeReabrirSemGpu(
```

## [src/main/index.ts](../src/main/index.ts)

Linhas: 172.

```text
31: function limparRestosDoModoApi() {
45: function criarJanela(splash: Splash | null) {
```

## [src/main/ipc-esquemas.ts](../src/main/ipc-esquemas.ts)

Linhas: 415.

```text
49: export type Contexto = {
146: function esquemasDoBanco(): Record<string, Esquema> {
217: export function criarEsquemas(ctx: Contexto): Record<string, Esquema> {
```

## [src/main/ipc.ts](../src/main/ipc.ts)

Linhas: 472.

```text
50: type Args = Record<string, any>;
51: type Cabecalhos = Record<string, string>;
52: type Comando = (
61: export const definirJanela = (w: BrowserWindow) => {
66: export const emitir = (nome: string, carga: unknown) => {
82: const semCopiaEmAndamento = () => {
88: export const iniciarEntrada = () => entrada.iniciar();
89: export const pararEntrada = () => entrada.parar();
91: const naoVazio = (v: unknown, mensagem: string) => {
98: function resumoEstoque() {
116: async function atualizarEstoque(args: Args) {
150: type OpcoesDialogo = {
159: async function dialogo(opcoes: OpcoesDialogo) {
410: function conferirEsquemas() {
421: export function registrarIpc() {
472: export const nomesDeComandos = () => Object.keys(COMANDOS).sort();
```

## [src/main/limpeza-ia.ts](../src/main/limpeza-ia.ts)

Linhas: 48.

```text
15: export function removerConfigIa(bancos: string[]): number {
46: export function apagarArquivoDeSegredos(pastaDados: string) {
```

## [src/main/soulia/analise.ts](../src/main/soulia/analise.ts)

Linhas: 898.

```text
14: const semAcento = (s: string) =>
21: const ms = (iso: string) => new Date(iso).getTime();
22: const local = (iso: string) => new Date(ms(iso) - UTC_MENOS_3);
24: export const mediana = (v: number[]): number | null => percentil(v, 0.5);
26: export function percentil(v: number[], p: number): number | null {
33: const arred = (n: number | null, casas = 1) =>
36: export function formatarMinutos(min: number | null): string {
44: const pct = (parte: number, total: number) =>
48: export function anonimizar(texto: string, nomeLead?: string | null): string {
69: const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
70: const normalizarFrase = (t: string) =>
77: export type Situacao =
137: export function situacaoDaMensagem(texto: string): Situacao | null {
147: export const temEtiquetaPositiva = (etiquetas: string[]) =>
151: const nossa = (m: MensagemLida) =>
153: const doLead = (m: MensagemLida) => !m.privada && m.origem === "lead";
154: const comTexto = (m: MensagemLida) => !!m.texto && m.texto.trim().length > 0;
156: export type MetricaConversa = {
182: function textoDoAnuncio(a: unknown): string | null {
190: export function metricaDaConversa(
252: export type Exemplo = {
262: export function extrairExemplos(conversas: ConversaLida[]): Exemplo[] {
307: function contar(itens: string[], minimo = 1, topo = 10) {
317: export function exemplosTipicos(exemplos: Exemplo[], porSituacao = 5) {
354: export type Faixa =
365: const faixaDe = (iso: string): Faixa => {
373: export type Analise = {
429: export function analisar(
656: const dataBr = (iso: string | null) =>
660: const aspas = (t: string) => `“${t.replace(/\s*\n\s*/g, " ⏎ ")}”`;
663: export function gerarPadraoMd(a: Analise): string {
833: export function gerarExemplosJsonl(exemplos: Exemplo[]): string {
850: export function gerarPromptRefino(
```

## [src/main/soulia/desempenho.ts](../src/main/soulia/desempenho.ts)

Linhas: 128.

```text
9: export type Desempenho = {
39: const diaLocal = (iso: string) =>
42: export function faixaDeEspera(min: number | null): string {
60: export function calcularDesempenho(
```

## [src/main/soulia/memoria.ts](../src/main/soulia/memoria.ts)

Linhas: 425.

```text
71: export type Origem = "lead" | "vendedor" | "robo" | "externo";
73: export type LeadGravar = {
82: export type ConversaGravar = {
97: export type MensagemGravar = {
109: export type EventoGravar = {
117: export function migrarMemoria(db: DatabaseSync) {
138: const json = (v: unknown) => (v == null ? null : JSON.stringify(v));
140: export function gravarLead(db: DatabaseSync, l: LeadGravar, agora: string) {
163: export function gravarConversa(db: DatabaseSync, c: ConversaGravar) {
191: export function gravarMensagens(
219: export function gravarEventos(db: DatabaseSync, eventos: EventoGravar[]) {
227: export function marcarSincronizada(
239: export function estadoDaConversa(db: DatabaseSync, id: string) {
249: export function definirSync(db: DatabaseSync, chave: string, valor: string) {
256: export function lerSync(db: DatabaseSync, chave: string): string | null {
263: export type ResumoMemoria = {
274: export function resumoDaMemoria(db: DatabaseSync): ResumoMemoria {
295: export type ConversaLida = {
312: export type MensagemLida = {
332: export function lerConversas(db: DatabaseSync): ConversaLida[] {
386: export type EventoLido = {
393: export function lerEventos(db: DatabaseSync): EventoLido[] {
409: export function esquecerTudo(db: DatabaseSync) {
```

## [src/main/soulia/planilha.ts](../src/main/soulia/planilha.ts)

Linhas: 212.

```text
8: export type Celula = string | number | boolean | null;
9: export type Aba = {
19: export function dataHoraBr(iso: string | null | undefined): string {
35: export function montarAbas(
198: const escaparCsv = (v: Celula) => {
207: export function paraCsv(aba: Aba): string {
```

## [src/main/soulia/sincronizar.ts](../src/main/soulia/sincronizar.ts)

Linhas: 352.

```text
30: type Registro = Record<string, unknown>;
32: export type Progresso = {
39: export type OpcoesSincronizacao = {
47: export type ResultadoSincronizacao = {
61: const reg = (v: unknown): Registro | null =>
63: const txt = (v: unknown): string | null =>
65: const nomeDe = (v: unknown): string | null => {
71: export function origemDaMensagem(m: Registro): Origem {
87: const ehMensagem = (m: Registro) =>
90: export function mensagemDaApi(
111: export function eventoDaApi(
131: type PaginaMensagens = { messages?: Registro[] };
133: async function baixarMensagens(
196: export async function sincronizar(
307: function registrarConversa(
```

## [src/main/soulia/soulia.ts](../src/main/soulia/soulia.ts)

Linhas: 195.

```text
36: const arquivoBanco = () => path.join(caminhos.userData(), "soul-ia.db");
37: export const pastaSaida = () => path.join(caminhos.raizDados(), "soul-ia");
39: function banco(): DatabaseSync {
49: export function fecharMemoria() {
54: export function estadoSouliaIa() {
62: export async function sincronizarSouliaIa(
87: export function desempenhoSouliaIa() {
99: export function cancelarSouliaIa() {
104: export function esquecerSouliaIa() {
110: function gravar(nome: string, conteudo: string) {
118: function resumirAnalise(a: Analise) {
133: export async function exportarSouliaIa(emitir: Emitir) {
189: export async function abrirPastaSouliaIa() {
```

## [src/main/splash.ts](../src/main/splash.ts)

Linhas: 123.

```text
18: function html(logo: string) {
52: export type Splash = {
64: export function mostrarSplash(): Splash {
```

## [src/main/studio/arquivos.ts](../src/main/studio/arquivos.ts)

Linhas: 511.

```text
14: export type Slot = (typeof SLOTS)[number];
28: export const mime = (nome: string) =>
32: export function arquivos(dir: string): string[] {
43: const stem = (p: string) => path.basename(p, path.extname(p));
44: const ext = (p: string) => path.extname(p).toLowerCase();
47: export function natural(a: string, b: string) {
57: export function pastaFotos(pasta: string) {
72: export function nomeSeguro(nome: string) {
85: export function dentro(raiz: string, alvo: string) {
94: export type PastaVeiculo = {
106: export function listarEstoque(raiz: string): PastaVeiculo[] {
150: export const lerArquivo = (raiz: string, caminho: string) =>
154: const pastaDoVeiculo = (veiculo: number | string) =>
161: export type FotoSalva = { slot: Slot; mime: string; nome: string };
163: export function salvarFoto(
195: export function listarFotos(veiculo: number | string): FotoSalva[] {
211: export function lerFoto(veiculo: number | string, slot: string) {
220: export function apagarArquivosVeiculo(veiculo: number | string) {
230: export function importarFotosPadrao(veiculo: number | string, pasta: string) {
264: export function salvarCriativo(
280: export function gravarNaPasta(pasta: string, nome: string, corpo: Uint8Array) {
289: export type StatusProducao = {
306: export function statusProducao(pasta: string): StatusProducao {
362: export function documentoNaPasta(pasta: string) {
378: export function previaFotos(pasta: string) {
388: export function copiarComoDoc(pasta: string, origem: string) {
402: export function renomearFotos(pasta: string, ordem: string[]) {
452: export function proximoNumero(raiz: string) {
467: export function criarPasta(
```

## [src/main/studio/banco.ts](../src/main/studio/banco.ts)

Linhas: 132.

```text
20: export function banco(): DatabaseSync {
31: function migrar(db: DatabaseSync) {
68: export function traduzir(sql: string, valores: unknown[]): [string, unknown[]] {
79: const comoValor = (v: unknown) => {
88: export function selecionar(sql: string, valores: unknown[] = []) {
98: export function executar(sql: string, valores: unknown[] = []) {
116: export function manutencao(agora = new Date()) {
```

## [src/main/studio/entrada.ts](../src/main/studio/entrada.ts)

Linhas: 642.

```text
29: type Linha = Record<string, any>;
31: export type DepsEntrada = {
42: export type EstadoEntrada = {
53: export type Liberavel = {
60: export type ResultadoLiberar = {
72: export async function hashArquivo(caminho: string): Promise<string> {
79: const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));
80: const ehPasta = (p: string) => {
89: export function mapaPlacas(estoque: string): Map<string, string[]> {
108: type Item = { caminho: string; nome: string; tamanho: number; mtime: number };
110: function listarItens(dir: string, nivel = 0): Item[] {
140: const VIDEOS_BRUTOS = (pasta: string) =>
146: function videoBrutoExistente(pasta: string): string | null {
156: function pdfExistente(pasta: string): string | null {
163: export function criarEntrada(deps: DepsEntrada) {
```

## [src/main/studio/esquema.ts](../src/main/studio/esquema.ts)

Linhas: 150.

## [src/main/studio/instagram-browser.ts](../src/main/studio/instagram-browser.ts)

Linhas: 371.

```text
13: const achar = (labels, raiz) => {
25: const botao = (labels, raiz = area) => achar(labels, raiz) || (raiz === area && area !== document ? achar(labels, document) : undefined);
28: const legenda = () => area === document ? undefined : [...area.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"][aria-label]')].find(e => visivel(e) && !comentario(e) && /caption|legenda/i.test([e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-placeholder')].join(' '))) || (area === document ? undefined : [...area.querySelectorAll('textarea,[contenteditable="true"][role="textbox"]')].find(e => visivel(e) && !comentario(e)));
31: export class InstagramBrowser {
```

## [src/main/studio/instagram-plano.ts](../src/main/studio/instagram-plano.ts)

Linhas: 106.

```text
9: export function montarPlanoInstagram(v: {
```

## [src/main/studio/instagram.ts](../src/main/studio/instagram.ts)

Linhas: 356.

```text
18: type Emitir = (nome: string, dados: unknown) => void;
19: const diretorio = () => path.join(userData(), "instagram");
20: const arquivoConta = () => path.join(diretorio(), "conta.json");
21: export function lerContaInstagram(): string {
28: export function salvarContaInstagram(valor: string) {
40: function caminhoRegistro(id: number, conta: string) {
45: export function registroInstagram(
87: function gravarRegistro(registro: RegistroInstagram) {
95: export function planoInstagram(id: number, previas = true): PlanoInstagram {
116: export function estadoInstagram(id: number): EstadoInstagram {
124: function origemPermitida(url: string) {
137: export async function abrirInstagram(pai: BrowserWindow, emitir: Emitir) {
186: export function reiniciarInstagram(id: number) {
192: export function cancelarInstagram() {
195: export function encerrarInstagram() {
199: function verificarPagina() {
209: export async function publicarInstagram(
```

## [src/main/studio/legado.ts](../src/main/studio/legado.ts)

Linhas: 36.

```text
9: export async function importarLegado() {
```

## [src/main/studio/modelos.ts](../src/main/studio/modelos.ts)

Linhas: 19.

```text
10: export function pastaDeModelos(
```

## [src/main/studio/motor.ts](../src/main/studio/motor.ts)

Linhas: 373.

```text
29: export type Emitir = (canal: string, carga: unknown) => void;
35: export function pastaMotor(): string | null {
49: export function pythonMotor(): string | null {
64: export function estadoMotor() {
82: export function instalarMotor(emitir: Emitir) {
119: function naPath(nome: string): string | null {
137: function garantirProcesso(emitir: Emitir) {
199: function falharMotor(mensagem: string) {
206: export function chamarMotor<T = unknown>(
245: export function reiniciarMotor() {
259: type VideoPronto = { caminho: string; segundos: number };
266: export const videoEmExecucao = () => videoEmAndamento;
269: export function cancelarVideo(): boolean {
282: function executarVideo(
349: export function gerarVideo(
368: export function gerarVideoLeve(
```

## [src/main/studio/repositorio.ts](../src/main/studio/repositorio.ts)

Linhas: 201.

```text
11: type Valor = string | number | null;
12: type Linha = Record<string, unknown>;
15: const copiar = (linhas: Linha[]) => linhas.map((l) => ({ ...l }));
17: const todas = (db: DatabaseSync, sql: string, ...args: Valor[]) =>
21: export function listarVeiculos(db: DatabaseSync, busca = "") {
32: export function obterVeiculo(db: DatabaseSync, id: number) {
36: export function criarVeiculo(
66: export function atualizarVeiculo(
80: export function listarAnuncios(db: DatabaseSync, veiculoId?: number) {
90: export function registrarAnuncio(
108: export function marcarAnuncioPausado(
116: export function removerAnuncio(db: DatabaseSync, id: number) {
121: export function obterConfig(db: DatabaseSync, chave: string) {
128: export function salvarConfig(
148: export function obterLoja(db: DatabaseSync) {
155: export function salvarLoja(db: DatabaseSync, loja: Record<string, string>) {
161: export function salvarRelatorio(
179: export function listarRelatorios(db: DatabaseSync, limite = 50) {
183: export function excluirRelatorio(db: DatabaseSync, id: number) {
189: export function conferirBanco(db: DatabaseSync) {
199: export function copiarBanco(db: DatabaseSync, destino: string) {
```

## [src/main/utalk-api.ts](../src/main/utalk-api.ts)

Linhas: 304.

```text
10: export type Buscar = (url: string, init: RequestInit) => Promise<Response>;
12: export type ContagemEtiqueta = {
19: export type LeadResumo = {
26: export type VisaoGeral = {
41: export type Pagina<T> = { items?: T[]; page?: { totalItems?: number } };
42: type Etiqueta = { id: string; name?: string; emoji?: string | null };
48: export class ErroUtalk extends Error {}
50: export async function pedir<T>(
102: export async function emLotes<T, R>(
123: export async function descobrirOrganizacao(buscar: Buscar, token: string) {
133: export async function listarEtiquetas(
152: async function contarContatos(
177: type ContatoItem = {
183: type ConversaItem = {
191: const nomesDasEtiquetas = (tags?: { name?: string }[]) =>
195: export async function visaoGeral(
```

## [src/main/utalk.ts](../src/main/utalk.ts)

Linhas: 52.

```text
13: export function tokenUtalk() {
17: function lerToken(): string | null {
27: export function estadoUtalk() {
31: export function salvarTokenUtalk(token: string) {
43: export function removerTokenUtalk() {
48: export async function visaoUtalk() {
```

## [src/main/validacao.ts](../src/main/validacao.ts)

Linhas: 169.

```text
11: export type Regra<T = unknown> = (valor: unknown, campo: string) => T;
12: export type Esquema = {
18: const erro = (campo: string, esperado: string): never => {
22: const ehObjetoPlano = (v: unknown): v is Record<string, unknown> =>
95: const minusculas = (s: string) =>
98: export function dentroDe(raiz: string, alvo: string) {
125: function aplicar(
141: export function validarChamada(
```

## [src/preload/index.ts](../src/preload/index.ts)

Linhas: 57.

```text
10: export type Cabecalhos = Record<string, string>;
57: export type SoulApi = typeof api;
```

## [src/renderer/index.html](../src/renderer/index.html)

Linhas: 1.

## [src/renderer/public/criativo/app-bridge.js](../src/renderer/public/criativo/app-bridge.js)

Linhas: 171.

## [src/renderer/public/criativo/assets/barlow-source.css](../src/renderer/public/criativo/assets/barlow-source.css)

Linhas: 17.

## [src/renderer/public/criativo/assets/condensed-source.css](../src/renderer/public/criativo/assets/condensed-source.css)

Linhas: 7.

## [src/renderer/public/criativo/assets/font-source.css](../src/renderer/public/criativo/assets/font-source.css)

Linhas: 35.

## [src/renderer/public/criativo/compact.css](../src/renderer/public/criativo/compact.css)

Linhas: 34.

## [src/renderer/public/criativo/estudio-3d.js](../src/renderer/public/criativo/estudio-3d.js)

Linhas: 259.

## [src/renderer/public/criativo/flow-bridge.js](../src/renderer/public/criativo/flow-bridge.js)

Linhas: 60.

## [src/renderer/public/criativo/harmony.css](../src/renderer/public/criativo/harmony.css)

Linhas: 25.

## [src/renderer/public/criativo/index.html](../src/renderer/public/criativo/index.html)

Linhas: 111.

## [src/renderer/public/criativo/layout4.css](../src/renderer/public/criativo/layout4.css)

Linhas: 392.

## [src/renderer/public/criativo/layout4.js](../src/renderer/public/criativo/layout4.js)

Linhas: 175.

## [src/renderer/public/criativo/layout6.css](../src/renderer/public/criativo/layout6.css)

Linhas: 506.

## [src/renderer/public/criativo/layout6.js](../src/renderer/public/criativo/layout6.js)

Linhas: 835.

## [src/renderer/public/criativo/layouts.js](../src/renderer/public/criativo/layouts.js)

Linhas: 108.

## [src/renderer/public/criativo/original-floor.js](../src/renderer/public/criativo/original-floor.js)

Linhas: 340.

## [src/renderer/public/criativo/script.js](../src/renderer/public/criativo/script.js)

Linhas: 366.

```text
11: const tamanhoDoLayout = (numero) => {
22: function message(text, error = false) {
100: function readFile(file) {
110: function hasTransparency(image) {
124: function queueImage(key, file) {
138: async function loadImage(key, file, version) {
179: function updateTexts() { window.Layouts?.sync(); message('Prévia atualizada.'); }
183: function resizePreview() {
204: async function ensureFonts() {
219: function fileName() {
232: async function exportLayouts(numbers) {
```

## [src/renderer/public/criativo/shadow.js](../src/renderer/public/criativo/shadow.js)

Linhas: 395.

## [src/renderer/public/criativo/studio.css](../src/renderer/public/criativo/studio.css)

Linhas: 123.

## [src/renderer/public/criativo/style.css](../src/renderer/public/criativo/style.css)

Linhas: 745.

## [src/renderer/public/criativo/workbench.css](../src/renderer/public/criativo/workbench.css)

Linhas: 335.

## [src/renderer/public/criativo/workbench.js](../src/renderer/public/criativo/workbench.js)

Linhas: 43.

## [src/renderer/public/shared/theme.js](../src/renderer/public/shared/theme.js)

Linhas: 62.

## [src/renderer/public/shared/tokens.css](../src/renderer/public/shared/tokens.css)

Linhas: 42.

## [src/renderer/src/AndamentoVideo.tsx](../src/renderer/src/AndamentoVideo.tsx)

Linhas: 122.

```text
4: export type Andamento = {
21: export function aplicarLinha(
54: const tempo = (ms: number) => {
62: export function AndamentoVideo({ andamento }: { andamento: Andamento | null }) {
```

## [src/renderer/src/Anunciar.tsx](../src/renderer/src/Anunciar.tsx)

Linhas: 349.

```text
29: const juntar = (pasta: string, ...partes: string[]) =>
38: export function Anunciar({
```

## [src/renderer/src/App.tsx](../src/renderer/src/App.tsx)

Linhas: 646.

```text
17: const moeda = (n: number) =>
19: function SelosAnexos({ status }: { status?: StatusProducao }) {
54: export function App() {
```

## [src/renderer/src/AvisosAnuncio.tsx](../src/renderer/src/AvisosAnuncio.tsx)

Linhas: 107.

```text
12: type Vendas = { vendas: Record<string, string>; atualizadoEm: string | null };
18: export function AvisosAnuncio({
```

## [src/renderer/src/Configuracoes.tsx](../src/renderer/src/Configuracoes.tsx)

Linhas: 64.

```text
4: export function Configuracoes() {
```

## [src/renderer/src/Criativos.tsx](../src/renderer/src/Criativos.tsx)

Linhas: 215.

```text
18: export function Criativos({
```

## [src/renderer/src/DesempenhoLeads.tsx](../src/renderer/src/DesempenhoLeads.tsx)

Linhas: 343.

```text
5: type Desempenho = {
31: const minutos = (m: number | null) =>
37: const numero = (n: number) => n.toLocaleString("pt-BR");
38: const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
46: function LinhaPorDia({ dados }: { dados: Desempenho["porDia"] }) {
120: function MapaCalor({ mapa }: { mapa: number[][] }) {
146: function MapaLinha({
171: export function useDesempenho(aoErro: (mensagem: string) => void) {
195: function semanas(porDia: Desempenho["porDia"]) {
206: export function CartoesDesempenho({ dados }: { dados: Desempenho }) {
247: export function PaineisDesempenho({ dados }: { dados: Desempenho }) {
330: export function SemMemoria({ irParaMemoria }: { irParaMemoria: () => void }) {
```

## [src/renderer/src/DocumentoCrlv.tsx](../src/renderer/src/DocumentoCrlv.tsx)

Linhas: 133.

```text
11: export function DocumentoCrlv({
```

## [src/renderer/src/Embutida.tsx](../src/renderer/src/Embutida.tsx)

Linhas: 54.

```text
8: export function Embutida({
```

## [src/renderer/src/Entrada.tsx](../src/renderer/src/Entrada.tsx)

Linhas: 285.

```text
5: type Estado = {
15: type Pendencia = {
22: type Aviso = {
28: type Liberavel = {
34: type Resposta = {
40: type Liberado = {
46: const mb = (b: number) =>
49: const nome = (caminho: string) => caminho.split(/[\\/]/).at(-1) ?? caminho;
52: export function Entrada() {
```

## [src/renderer/src/Ficha.tsx](../src/renderer/src/Ficha.tsx)

Linhas: 582.

```text
52: const erroLegivel = (e: unknown) =>
68: export function Ficha({
```

## [src/renderer/src/Financas.tsx](../src/renderer/src/Financas.tsx)

Linhas: 568.

```text
14: type Estado = { caminho: string | null; nome: string | null; existe: boolean };
15: type Lida = Estado & {
20: type Operacao = {
45: function hojeIso() {
51: const dataBr = (iso: string | null, vazio = "—") =>
54: const numeroBr = (n: number) =>
60: const ou = (texto: string) => (texto && texto !== "-" ? texto : "—");
63: function CaixaPago({
102: export function Financas({ aoErro }: { aoErro: (mensagem: string) => void }) {
```

## [src/renderer/src/Instagram.tsx](../src/renderer/src/Instagram.tsx)

Linhas: 271.

```text
16: export function Instagram({
```

## [src/renderer/src/LeadsSouliaIa.tsx](../src/renderer/src/LeadsSouliaIa.tsx)

Linhas: 38.

```text
5: type Aba = "painel" | "memoria";
13: export function LeadsSouliaIa({
```

## [src/renderer/src/lib/arquivos.ts](../src/renderer/src/lib/arquivos.ts)

Linhas: 133.

```text
4: export type Slot = "main" | "left" | "center" | "right" | "original";
5: export type FotoSalva = { slot: Slot; mime: string; nome: string };
9: export async function salvarFoto(veiculo: number, slot: Slot, file: File) {
21: export async function carregarFotos(
43: export const importarFotosPadrao = (veiculo: number, pasta: string) =>
46: export const contarFotos = async (veiculo: number) =>
50: export type NumeroVitrine = (typeof FOTOS_VITRINE)[number];
53: export async function localizarFotosVitrine(pasta: string) {
75: export async function carregarFotosVitrine(
112: export const apagarArquivosVeiculo = (veiculo: number) =>
116: export async function salvarCriativo(
```

## [src/renderer/src/lib/cnw-banco.ts](../src/renderer/src/lib/cnw-banco.ts)

Linhas: 126.

```text
12: const normalizar = (t: string) =>
20: const anoDe = (ano?: string | null) =>
23: const chaveBusca = (nome: string, ano?: string | null) =>
25: const chaveFicha = (codigo: string) => `web_ficha:${codigo}`;
27: async function lerBanco<T>(chave: string): Promise<T | null> {
36: async function gravarBanco(chave: string, valor: unknown) {
44: export type Origem = "banco" | "site";
47: export async function buscarCnwComBanco(
60: export async function fichaCnwComBanco(
72: export const guardarFichaCnw = (codigo: string, ficha: FichaWeb) =>
89: const preenchido = (v: unknown) =>
93: export function origemDaFicha(v: Veiculo) {
120: export function versaoDoTitulo(titulo: string, modelo: string): string {
```

## [src/renderer/src/lib/db.ts](../src/renderer/src/lib/db.ts)

Linhas: 174.

```text
6: export type Status = "rascunho" | "criativos" | "publicado";
8: export type Veiculo = {
40: export type NovoVeiculo = Pick<Veiculo, "nome"> &
48: export type Editavel = (typeof EDITAVEIS)[number];
52: function comIdEstoque(v: Veiculo): Veiculo {
56: export async function listarVeiculos(busca = ""): Promise<Veiculo[]> {
63: export async function obterVeiculo(id: number): Promise<Veiculo | null> {
68: export function criarVeiculo(v: NovoVeiculo): Promise<number> {
72: export async function atualizarVeiculo(
80: export type Anuncio = {
92: export function listarAnuncios(veiculoId?: number): Promise<Anuncio[]> {
96: export function registrarAnuncio(anuncio: {
106: export async function marcarAnuncioPausado(id: number, dia: string) {
110: export async function removerAnuncio(id: number) {
114: export function obterConfig(chave: string): Promise<string | null> {
118: export async function salvarConfig(
125: export type RelatorioSalvo = {
135: export function salvarRelatorio(
147: export function listarRelatorios(limite = 50): Promise<RelatorioSalvo[]> {
151: export async function excluirRelatorio(id: number) {
155: export function obterLoja(): Promise<Loja> {
159: export async function salvarLoja(loja: Loja): Promise<void> {
168: export function manutencaoBanco(): Promise<{
```

## [src/renderer/src/lib/des.ts](../src/renderer/src/lib/des.ts)

Linhas: 409.

```text
6: export type Loja = {
13: export type FichaDes = {
88: export function parseNumber(raw: string, whole = false): number | null {
100: export const formatNumber = (value: number, decimals = 0) =>
106: export function shortGearbox(value: string) {
111: export function fuelLabel(value: string) {
121: export function termoBusca(nome: string, marcaModelo: string, ano: string) {
140: export function sugerirNome(marca: string) {
151: const field = (h: string, c: string) => `## ${h}\n${c}\n`;
152: const block = (h: string, c: string) => `## ${h}\n\n${c}\n`;
153: const bold = (h: string, c: string) => `**${h}**\n${c}`;
156: export function camposVazios(f: FichaDes) {
163: export type TextosIA = {
173: export function gerarDes(
337: type CampoImport =
340: const normalize = (s: string) =>
348: const norm = (s: string) =>
364: const isEquip = (id: CampoImport | null) =>
367: export function importarFicha(
```

## [src/renderer/src/lib/desktop.ts](../src/renderer/src/lib/desktop.ts)

Linhas: 46.

```text
7: export async function invoke<T = unknown>(
22: export const ask = async (message: string, _options?: unknown) =>
24: type Options = {
31: export const open = (options: Options = {}) =>
33: export const save = (options: Options = {}) =>
35: export const revealItemInDir = (path: string) => invoke("reveal", { path });
36: export const openPath = (path: string) => invoke("open_path", { path });
37: export const openUrl = (url: string) => invoke("open_url", { url });
38: export const appDataDir = () => invoke<string>("app_data");
39: export const getVersion = async () => window.soul.versoes.app;
40: export const getTauriVersion = async () => window.soul.versoes.electron;
41: export async function listen<T>(
```

## [src/renderer/src/lib/engine.ts](../src/renderer/src/lib/engine.ts)

Linhas: 144.

```text
4: export function engine<T = unknown>(
11: export async function paraBase64(blob: Blob): Promise<string> {
19: export function deBase64(b64: string, type: string, nome: string): File {
26: export type CamposCrlv = {
43: export type ResultadoCrlv =
54: export const lerCrlv = async (pdf: File | string, senha?: string) =>
62: export type Categoria = "seguranca" | "conforto" | "infotenimento";
63: export const ocrEquipamentos = async (
78: export function aquecerRecorte() {
87: export async function removerFundo(foto: Blob, nome = "foto"): Promise<File> {
99: export type VersaoCnw = { codigo: string; titulo: string; ano: string };
100: export type BuscaCnw = { modelo: string; versoes: VersaoCnw[]; busca: string };
101: export type FichaCnw = {
118: export const buscarCnw = (nome: string, ano?: string | null) =>
122: export const fichaCnw = (codigo: string, referer?: string) =>
126: export type BuscaWeb = BuscaCnw & {
132: export type FichaWeb = FichaCnw & {
137: export const buscarWeb = (nome: string, ano?: string | null) =>
139: export const fichaWeb = (codigo: string) =>
143: export const fichaCnwTexto = (texto: string) =>
```

## [src/renderer/src/lib/estoque-parse.ts](../src/renderer/src/lib/estoque-parse.ts)

Linhas: 129.

```text
4: export type PastaVeiculo = {
18: export function lerNomePasta(nome: string): {
32: const semAcento = (s: string) =>
36: export function lerDesExistente(md: string) {
77: const arquivo = (caminho: string) => caminho.split(/[\\/]/).pop() ?? caminho;
78: const stem = (caminho: string) => arquivo(caminho).replace(/\.[^.]+$/, "");
79: const isPng = (caminho: string) => /\.png$/i.test(caminho);
86: export function distribuirFotos(fotos: string[]) {
105: export function idEstoque(nome: string): number | null {
111: export function lerInfoBndv(md: string) {
```

## [src/renderer/src/lib/financas.ts](../src/renderer/src/lib/financas.ts)

Linhas: 179.

```text
3: export type Conta = {
17: export type Bloco = {
36: const semAcento = (s: string) =>
39: export function valorVariavel(bloco: number, destinatario: string): boolean {
44: export type Mes = { nome: string; blocos: Bloco[] };
47: export function lerValorDigitado(entrada: string): number | null | undefined {
56: const texto = (c: Celula | undefined) =>
59: const arredondar = (n: number) => Math.round(n * 100) / 100;
62: export function dataIso(c: Celula | undefined): string | null {
71: const numero = (c: Celula | undefined) =>
79: export function lerMeses(abas: { nome: string; linhas: Celula[][] }[]): Mes[] {
128: export type ResumoMes = {
137: export function resumirMes(
169: export async function lerPlanilhaFinancas(base64: string): Promise<Mes[]> {
```

## [src/renderer/src/lib/format.ts](../src/renderer/src/lib/format.ts)

Linhas: 16.

```text
8: export const moeda = (v: number | null) => (v == null ? "—" : brl.format(v));
9: export const km = (v: number | null) =>
13: export const inteiro = (s: string) => {
```

## [src/renderer/src/lib/importacao.ts](../src/renderer/src/lib/importacao.ts)

Linhas: 76.

```text
20: export function importarEstoque() {
25: async function executarImportacao() {
```

## [src/renderer/src/lib/producao.ts](../src/renderer/src/lib/producao.ts)

Linhas: 238.

```text
6: export type PastaCriada = {
13: export type StatusProducao = {
29: export const proximoNumero = (raiz: string) =>
32: export const criarPasta = (
39: export const statusProducao = (pasta: string) =>
42: export type DocumentoNaPasta = {
49: export const documentoNaPasta = (pasta: string) =>
52: export const copiarComoDoc = (pasta: string, origem: string) =>
56: export async function gravarNaPasta(
73: export type DocGerado =
78: export const gerarDocMd = (
89: export const recortarArquivo = (
95: export type FotoOrganizada = {
102: export type OrdemFotos = { pasta: string; fotos: FotoOrganizada[] };
105: export const organizarFotos = (pasta: string) =>
109: export const renomearFotos = (pasta: string, ordem: string[]) =>
115: export type VideoPronto = { caminho: string; segundos: number };
117: export const gerarVideo = (
129: export type Etapa = {
136: export function etapas(
217: export function tarjas(v: {
```

## [src/renderer/src/lib/publicacao.ts](../src/renderer/src/lib/publicacao.ts)

Linhas: 4.

## [src/renderer/src/lib/relatorio-frame.ts](../src/renderer/src/lib/relatorio-frame.ts)

Linhas: 37.

```text
23: export function comAvisoDeAltura(html: string) {
30: export function alturaDaMensagem(dados: unknown): number | null {
```

## [src/renderer/src/lib/relatorios.ts](../src/renderer/src/lib/relatorios.ts)

Linhas: 534.

```text
8: export type Registro = Record<string, Celula>;
9: export type Bloco = { titulo: string; texto: string };
10: export type Relatorio = {
41: export function numero(v: Celula): number {
50: const vazio = (v: Celula) =>
54: export function dataIso(v: Celula): string | null {
64: const diasEntre = (a: string, b: string) =>
66: const dmy = (iso: string) => {
71: const milharBr = (n: number) =>
76: export function tipoDoArquivo(
100: export function limparNomeVeiculo(nome: string) {
108: export const formatarDataVeiculos = (inicio: string, fim: string) => {
115: const escalaVeiculos = (n: number) =>
117: const reaisTruncados = (n: number) => `R$ ${milharBr(Math.floor(n))},00`;
119: export function statusCusto(custo: number | null): string {
126: type Metricas = {
133: function blocoVeiculo(
156: export function relatorioVeiculos(
291: function compararVeiculos(
334: const dataCompleta = (iso: string) => {
338: const decimalBr = (n: number, casas: number) =>
340: const reaisBr = (n: number) => `R$ ${decimalBr(Math.round(n * 100) / 100, 2)}`;
341: const escalaTrafego = (n: number, sufixo = "") =>
346: type Trafego = {
359: function blocoTrafego(titulo: string, nome: string, t: Trafego) {
370: export function relatorioSindeprestem(
521: export function gerarRelatorio(
```

## [src/renderer/src/lib/tempo.ts](../src/renderer/src/lib/tempo.ts)

Linhas: 12.

```text
2: export function haQuanto(iso: string | null | undefined, agora = Date.now()) {
```

## [src/renderer/src/lib/xlsx.ts](../src/renderer/src/lib/xlsx.ts)

Linhas: 215.

```text
8: export type Celula = string | number | boolean | null;
9: export type Planilha = { nome: string; linhas: Celula[][] };
13: async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
20: export async function lerZip(
76: export const decodeXml = (s: string) =>
87: const attr = (tag: string, nome: string) =>
89: const textoDeRuns = (xml: string) =>
94: function colunaIndice(ref: string): number {
103: export async function lerXlsx(buffer: ArrayBuffer): Promise<Planilha[]> {
195: export function serialParaIso(serial: number): string {
201: export function comoRegistros(planilha: Planilha): {
```

## [src/renderer/src/main.tsx](../src/renderer/src/main.tsx)

Linhas: 9.

## [src/renderer/src/Producao.tsx](../src/renderer/src/Producao.tsx)

Linhas: 312.

```text
13: type Foto = { nome: string; miniatura: string };
14: const mb = (b: number) =>
17: export function Producao({
```

## [src/renderer/src/PromptAnuncio.tsx](../src/renderer/src/PromptAnuncio.tsx)

Linhas: 130.

```text
15: export function PromptAnuncio({
```

## [src/renderer/src/Relatorios.tsx](../src/renderer/src/Relatorios.tsx)

Linhas: 139.

```text
10: export function Relatorios() {
```

## [src/renderer/src/SouliaIa.tsx](../src/renderer/src/SouliaIa.tsx)

Linhas: 321.

```text
5: type Memoria = {
15: type Estado = { sincronizando: boolean; pasta: string; memoria: Memoria };
16: type Progresso = { fase: string; feito: number; total: number; texto: string };
17: type Resultado = {
24: type Exportacao = {
43: const mensagem = (e: unknown) => String(e instanceof Error ? e.message : e);
44: const numero = (n: number) => n.toLocaleString("pt-BR");
45: const minutos = (m: number | null) =>
51: const dia = (iso: string | null) =>
58: export function SouliaIa({ aoErro }: { aoErro: (mensagem: string) => void }) {
```

## [src/renderer/src/style.css](../src/renderer/src/style.css)

Linhas: 1022.

## [src/renderer/src/types.ts](../src/renderer/src/types.ts)

Linhas: 23.

```text
1: export type Contas = Record<string, Record<string, number>>;
2: export type Balanco = {
14: export type SoulApi = {
```

## [src/renderer/src/VisaoCrm.tsx](../src/renderer/src/VisaoCrm.tsx)

Linhas: 477.

```text
20: type Contagem = {
26: type Lead = {
32: type Visao = {
45: const mensagem = (e: unknown) => String(e instanceof Error ? e.message : e);
47: function Cartao({
64: export type ItemBarra = { rotulo: string; valor: number; extra?: string };
67: export function Barras({ itens }: { itens: ItemBarra[] }) {
92: function ListaLeads({
132: export function VisaoCrm({
```

## [src/renderer/src/Vitrine.tsx](../src/renderer/src/Vitrine.tsx)

Linhas: 145.

```text
7: const km = (v: number | null) =>
11: export function Vitrine({
```

## [testes/andamento-video.test.ts](../testes/andamento-video.test.ts)

Linhas: 47.

## [testes/anuncio-ia.test.ts](../testes/anuncio-ia.test.ts)

Linhas: 192.

```text
22: const texto = (destaques: string[], extra: object = {}) => ({
29: function respostaValida() {
53: const json = (o: unknown) => JSON.stringify(o);
```

## [testes/anuncio.test.ts](../testes/anuncio.test.ts)

Linhas: 208.

```text
56: const estado = (e: Partial<EntradaChecklist>) =>
58: const item = (id: string, e: Partial<EntradaChecklist>) =>
146: const anuncio = (p: Partial<AnuncioRegistrado> = {}): AnuncioRegistrado => ({
```

## [testes/bndv-extras.test.ts](../testes/bndv-extras.test.ts)

Linhas: 233.

```text
13: const escalar = (nome: string): TipoGql => ({ kind: "SCALAR", name: nome });
14: const objeto = (nome: string): TipoGql => ({ kind: "OBJECT", name: nome });
15: const naoNulo = (t: TipoGql): TipoGql => ({
20: const lista = (t: TipoGql): TipoGql => ({
25: const campo = (
```

## [testes/cnw-banco.test.ts](../testes/cnw-banco.test.ts)

Linhas: 21.

## [testes/config-json.test.ts](../testes/config-json.test.ts)

Linhas: 26.

## [testes/crm-etiquetas.test.ts](../testes/crm-etiquetas.test.ts)

Linhas: 88.

## [testes/des-web.test.ts](../testes/des-web.test.ts)

Linhas: 54.

## [testes/des.test.ts](../testes/des.test.ts)

Linhas: 119.

## [testes/desempenho.test.ts](../testes/desempenho.test.ts)

Linhas: 60.

```text
10: const metrica = (criadaEm: string, esperaMin: number | null, sem = false) =>
```

## [testes/entrada.test.ts](../testes/entrada.test.ts)

Linhas: 377.

## [testes/estoque.test.ts](../testes/estoque.test.ts)

Linhas: 105.

## [testes/financas.test.ts](../testes/financas.test.ts)

Linhas: 104.

```text
11: const linha = (...c: Celula[]): Celula[] => [null, ...c];
```

## [testes/fixtures/DES.md](../testes/fixtures/DES.md)

Linhas: 273.

## [testes/fixtures/instagram.html](../testes/fixtures/instagram.html)

Linhas: 36.

```text
6: const area = () => document.querySelector('main');
7: function criar() {
17: function editar() {
26: function legendar() {
```

## [testes/gpu.test.ts](../testes/gpu.test.ts)

Linhas: 21.

## [testes/graphql.test.ts](../testes/graphql.test.ts)

Linhas: 308.

```text
17: type Chamada = { query: string };
20: function servidor(
38: const pagina = (itens: unknown[], total = itens.length) => ({
```

## [testes/helpers/xlsx-fixture.ts](../testes/helpers/xlsx-fixture.ts)

Linhas: 97.

```text
4: type Valor = string | number | null | { data: string };
6: function crc32(buf: Uint8Array) {
15: function zip(arquivos: Record<string, string>): ArrayBuffer {
60: const esc = (s: string) =>
62: const col = (i: number) => String.fromCharCode(65 + i);
65: export async function gerarXlsx(
```

## [testes/instagram.test.mjs](../testes/instagram.test.mjs)

Linhas: 110.

## [testes/legado.test.mjs](../testes/legado.test.mjs)

Linhas: 59.

## [testes/limpeza-ia.test.ts](../testes/limpeza-ia.test.ts)

Linhas: 80.

```text
18: function criarBanco(arquivo: string, comChave: boolean) {
```

## [testes/modelos.test.ts](../testes/modelos.test.ts)

Linhas: 23.

## [testes/nucleo.test.mjs](../testes/nucleo.test.mjs)

Linhas: 173.

## [testes/publicacao.test.ts](../testes/publicacao.test.ts)

Linhas: 47.

## [testes/relatorio-frame.test.ts](../testes/relatorio-frame.test.ts)

Linhas: 48.

## [testes/relatorio-impressao.test.ts](../testes/relatorio-impressao.test.ts)

Linhas: 44.

## [testes/relatorios.test.ts](../testes/relatorios.test.ts)

Linhas: 479.

```text
11: const d = (data: string) => ({ data });
15: async function planilha(linhas: Parameters<typeof gerarXlsx>[0]) {
```

## [testes/repositorio.test.ts](../testes/repositorio.test.ts)

Linhas: 113.

## [testes/soulia.test.ts](../testes/soulia.test.ts)

Linhas: 337.

```text
23: const resposta = (corpo: unknown, status = 200) =>
29: function falso() {
```

## [testes/tempo.test.ts](../testes/tempo.test.ts)

Linhas: 17.

## [testes/utalk-api.test.ts](../testes/utalk-api.test.ts)

Linhas: 108.

```text
4: const resposta = (corpo: unknown, status = 200) =>
22: function servidor(tags = TAGS): Buscar {
```

## [testes/validacao.test.ts](../testes/validacao.test.ts)

Linhas: 255.

```text
18: const chamar = (
```

## [testes/video-motor.test.mjs](../testes/video-motor.test.mjs)

Linhas: 133.

```text
46: const emitir = () => {};
47: const iniciarLeve = () =>
49: const ultimo = () => filhos.at(-1);
50: const taskkills = () => filhos.filter((f) => f.comando === "taskkill");
```

## [testes/vitrine.test.ts](../testes/vitrine.test.ts)

Linhas: 265.

```text
11: const linha = (extra: Partial<LinhaVeiculo>): LinhaVeiculo => ({
41: const ficha = (extra: Partial<FichaMin>): FichaMin => ({
```

## [testes/xlsx.test.ts](../testes/xlsx.test.ts)

Linhas: 68.

## [tsconfig.json](../tsconfig.json)

Linhas: 7.

## [tsconfig.node.json](../tsconfig.node.json)

Linhas: 39.

## [tsconfig.web.json](../tsconfig.web.json)

Linhas: 45.

## [vitest.config.ts](../vitest.config.ts)

Linhas: 4.

```text
2: export default defineConfig({
```
