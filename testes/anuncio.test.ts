import { describe, expect, it } from "vitest";
import {
  anunciosParaPausar,
  cartaoCampanha,
  checklist,
  dadosDoBndvAntigos,
  fotoDoAnuncio,
  fotosNumeradas,
  hoje,
  nomeComPrefixoVenda,
  prontoParaAnunciar,
  type AnuncioRegistrado,
  type EntradaChecklist,
} from "../src/compartilhado/anuncio";
import { gerarDes, type FichaDes } from "../src/renderer/src/lib/des";

const loja = {
  contato: "11965952083",
  horario: "Segunda a sexta, das 8h às 17h",
  loja: "Soul Cars Veículos",
  endereco: "Av. São Miguel, 8999 - Vila Norma, São Paulo/SP",
};

const fiesta: FichaDes = {
  nome: "FORD FIESTA",
  ano: "2016",
  marca_modelo: "FORD/FIESTA HA 1.5L SB",
  cor: "BRANCA",
  combustivel: "Flex",
  preco: 48900,
  km: 84000,
  versao: "S 1.5 16V",
  configuracao: "HATCHBACK",
  lugares: "5",
  portas: "4",
  cambio: "MANUAL DE 5 MARCHAS",
  direcao: "ELÉTRICA",
  seguranca: "Freios ABS\nAirbags frontais\nTravamento central das portas",
  conforto: "Ar-condicionado\nDireção assistida\nAjuste do volante em altura",
  infotenimento: "Rádio FM\nConexão Bluetooth\nPorta USB",
};

const completo: EntradaChecklist = {
  nome: "FORD FIESTA",
  ano: "2016",
  doc_pdf: true,
  doc_md: true,
  des_md: true,
  fotos: ["1.jpg", "1_sem_fundo.png", "2.jpg", "3.jpeg", "3_sem_fundo.png"],
  video_final: "C:\\x\\VIDEO_FORD.mp4",
  video_leve: "C:\\x\\ANUNCIO\\ANUNCIO_FORD.mp4",
  video_leve_bytes: 72 * 1024 * 1024,
  criativos: [
    "ford-fiesta-2016-trafego-pago.png",
    "ford-fiesta-2016-carrossel-1.png",
  ],
};
const estado = (e: Partial<EntradaChecklist>) =>
  checklist({ ...completo, ...e });
const item = (id: string, e: Partial<EntradaChecklist>) =>
  estado(e).find((i) => i.id === id)!;

describe("checklist de prontidão", () => {
  it("fica pronto quando tudo existe", () => {
    expect(prontoParaAnunciar(estado({}))).toBe(true);
  });
  it("cada pendência aponta para onde resolver", () => {
    expect(item("documento", { doc_md: false })).toMatchObject({
      ok: false,
      destino: "producao",
    });
    expect(item("video", { video_final: null })).toMatchObject({
      ok: false,
      destino: "producao",
    });
    expect(item("leve", { video_leve: null })).toMatchObject({
      ok: false,
      destino: "producao",
    });
    expect(item("descricao", { des_md: false })).toMatchObject({
      ok: false,
      destino: "ficha",
    });
    expect(item("criativos", { criativos: [] })).toMatchObject({
      ok: false,
      destino: "criativos",
    });
    expect(prontoParaAnunciar(estado({ video_leve: null }))).toBe(false);
  });
  it("o criativo da foto precisa ser o Tráfego Pago do mesmo veículo", () => {
    expect(
      fotoDoAnuncio(["outro-carro-trafego-pago.png"], "FORD FIESTA", "2016"),
    ).toBeNull();
    expect(
      fotoDoAnuncio(
        ["FORD-FIESTA-2016-TRAFEGO-PAGO.PNG"],
        "FORD FIESTA",
        "2016",
      ),
    ).not.toBeNull();
    expect(
      item("criativos", { criativos: ["ford-fiesta-2016-carrossel-1.png"] }).ok,
    ).toBe(false);
  });
  it("avisa quando a versão leve passa de 100 MB, sem bloquear", () => {
    const i = item("leve", { video_leve_bytes: 120 * 1024 * 1024 });
    expect(i.ok).toBe(true);
    expect(i.detalhe).toContain("passa de 100 MB");
  });
});

describe("fotos na ordem", () => {
  it("aceita 1..n e ignora os recortes", () => {
    expect(
      fotosNumeradas(["2.jpg", "1.jpg", "1_sem_fundo.png", "3.png"]).ok,
    ).toBe(true);
  });
  it("rejeita sem fotos, nomes soltos, buraco e repetição", () => {
    expect(fotosNumeradas([]).ok).toBe(false);
    expect(fotosNumeradas(["IMG_1234.jpg", "1.jpg"]).detalhe).toContain(
      "sem número",
    );
    expect(fotosNumeradas(["1.jpg", "3.jpg"]).ok).toBe(false);
    expect(fotosNumeradas(["1.jpg", "1.png"]).ok).toBe(false);
  });
});

describe("cartão da campanha", () => {
  it("mostra as 5 lacunas de texto, título e descrição, com [VENDA] no nome", () => {
    const md = gerarDes(fiesta, loja);
    expect(md).toContain("[LEAD] FORD FIESTA 2016");
    const c = cartaoCampanha(md);
    expect(c.nomeCampanha).toBe("[VENDA] FORD FIESTA 2016");
    expect(c.textos.map((t) => t.label)).toEqual(
      [1, 2, 3, 4, 5].map((n) => `${n}. TEXTO PRINCIPAL`),
    );
    expect(c.titulos).toHaveLength(5);
    expect(c.descricoes).toHaveLength(5);
    expect(c.mensagens.length).toBeGreaterThanOrEqual(2);
  });
  it("sem DES.md devolve o cartão vazio", () => {
    expect(cartaoCampanha("")).toEqual({
      nomeCampanha: null,
      textos: [],
      titulos: [],
      descricoes: [],
      mensagens: [],
    });
  });
  it("troca qualquer prefixo por [VENDA] e acrescenta se não houver", () => {
    expect(nomeComPrefixoVenda("[LEAD] A 2020")).toBe("[VENDA] A 2020");
    expect(nomeComPrefixoVenda("[VENDA] A 2020")).toBe("[VENDA] A 2020");
    expect(nomeComPrefixoVenda("A 2020")).toBe("[VENDA] A 2020");
  });
});

const anuncio = (p: Partial<AnuncioRegistrado> = {}): AnuncioRegistrado => ({
  id: 1,
  veiculo_id: 10,
  estoque_id: 1000001,
  modelo: "Jeep Renegade",
  campanha: "[VENDA] JEEP RENEGADE 2020",
  criado_dia: "2026-10-05",
  pausado_dia: null,
  ...p,
});

describe("lembrete de pausa", () => {
  const vendas = { "1000001": "2026-10-09T00:00:00.000" };
  it("avisa quando o veículo foi vendido depois do anúncio", () => {
    const r = anunciosParaPausar([anuncio()], vendas);
    expect(r).toHaveLength(1);
    expect(r[0].vendidoEm).toBe("2026-10-09");
  });
  it("avisa quando a venda é no mesmo dia do anúncio", () => {
    expect(
      anunciosParaPausar([anuncio({ criado_dia: "2026-10-09" })], vendas),
    ).toHaveLength(1);
  });
  it("não avisa de venda antiga, de veículo sem venda, sem id do BNDV ou já pausado", () => {
    expect(
      anunciosParaPausar([anuncio({ criado_dia: "2026-10-10" })], vendas),
    ).toEqual([]);
    expect(anunciosParaPausar([anuncio({ estoque_id: 999 })], vendas)).toEqual(
      [],
    );
    expect(anunciosParaPausar([anuncio({ estoque_id: null })], vendas)).toEqual(
      [],
    );
    expect(
      anunciosParaPausar([anuncio({ pausado_dia: "2026-10-09" })], vendas),
    ).toEqual([]);
  });
  it("cada anúncio aberto de um veículo vendido gera um aviso", () => {
    const r = anunciosParaPausar([anuncio(), anuncio({ id: 2 })], vendas);
    expect(r.map((a) => a.anuncio.id)).toEqual([1, 2]);
  });
});

describe("dados do BNDV antigos", () => {
  const agora = Date.parse("2026-10-11T12:00:00Z");
  it("só importa quando há anúncio aberto", () => {
    expect(dadosDoBndvAntigos(0, null, agora)).toBe(false);
  });
  it("avisa sem arquivo, com mais de 24 h ou data inválida", () => {
    expect(dadosDoBndvAntigos(1, null, agora)).toBe(true);
    expect(dadosDoBndvAntigos(1, "2026-10-10T11:00:00Z", agora)).toBe(true);
    expect(dadosDoBndvAntigos(1, "lixo", agora)).toBe(true);
  });
  it("não avisa com dados de hoje", () => {
    expect(dadosDoBndvAntigos(2, "2026-10-11T08:00:00Z", agora)).toBe(false);
  });
});

describe("data local", () => {
  it("formata AAAA-MM-DD", () => {
    expect(hoje(new Date(2026, 9, 5, 23, 59))).toBe("2026-10-05");
  });
});
