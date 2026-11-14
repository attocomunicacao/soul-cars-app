/**
 * Ficha do veículo (Studio): abas Ficha → Produção → Criativos → Pronto para anunciar →
 * Publicação → Instagram. Lê CRLV, busca ficha técnica e gera DOC.md/DES.md.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../../app/icons";
import {
  atualizarVeiculo,
  obterLoja,
  type Veiculo,
  type Editavel,
} from "../../lib/database";
import {
  camposVazios,
  gerarDes,
  type FichaDes,
  type TextosIA,
} from "../../lib/description-generator";
import { invoke, open } from "../../lib/desktop-bridge";
import { cartaoDaFicha, type CartaoVitrine } from "../../../../shared/showcase";
import { type VersaoCnw } from "../../lib/engine-client";
import {
  gerarDocMd,
  gravarNaPasta,
  gerarVideo,
  tarjas,
} from "../../lib/production-status";
import {
  buscarCnwComBanco,
  fichaCnwComBanco,
  versaoDoTitulo,
} from "../../lib/web-specs-cache";
import { Production } from "./production/Production";
import {
  VideoProgress,
  aplicarLinha,
  type Andamento,
} from "./production/VideoProgress";
import { CrlvDocument } from "./sheet/CrlvDocument";
import { blocosDeCopia } from "../../lib/publication";
import { Creatives } from "./creatives/Creatives";

/** Mantém a digitação em reais inteiros; a vírgula permite informar centavos. */
/** Textarea que cresce com o conteúdo: nunca cria barra de rolagem própria. */
function CampoTexto({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (valor: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const ajustar = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  useLayoutEffect(ajustar, [value]);
  useEffect(() => {
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      style={{ overflow: "hidden", resize: "none" }}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CampoNumerico({
  valor,
  moeda,
  alterar,
}: {
  valor: number | null;
  moeda: boolean;
  alterar: (valor: number | null) => void;
}) {
  const formatar = (numero: number | null) =>
    numero == null
      ? ""
      : numero.toLocaleString("pt-BR", {
          minimumFractionDigits: moeda ? 2 : 0,
          maximumFractionDigits: moeda ? 2 : 0,
        });
  const [edicao, setEdicao] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (cursor.current != null) {
      entrada.current?.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });
  return (
    <span className="campo-numerico">
      {moeda && <span aria-hidden="true">R$</span>}
      <input
        ref={entrada}
        type="text"
        inputMode={moeda ? "decimal" : "numeric"}
        placeholder={moeda ? "0,00" : "Não informada"}
        value={edicao ?? formatar(valor)}
        onFocus={() =>
          setEdicao(
            valor == null
              ? ""
              : valor.toLocaleString("pt-BR", {
                  maximumFractionDigits: moeda ? 2 : 0,
                }),
          )
        }
        onBlur={() => setEdicao(null)}
        onChange={(evento) => {
          const bruto = evento.target.value;
          const antes = bruto.slice(
            0,
            evento.target.selectionStart ?? bruto.length,
          );
          const quantidade = antes.replace(/[^0-9,]/g, "").length;
          const limpo = bruto.replace(moeda ? /[^0-9,]/g : /[^0-9]/g, "");
          const [inteiro, ...decimais] = limpo.split(",");
          const parteInteira = inteiro.replace(/^0+(?=\d)/, "");
          const agrupado = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          const texto =
            agrupado +
            (moeda && decimais.length
              ? "," + decimais.join("").slice(0, 2)
              : "");
          let posicao = 0;
          let vistos = 0;
          while (posicao < texto.length && vistos < quantidade) {
            if (/[0-9,]/.test(texto[posicao])) vistos++;
            posicao++;
          }
          cursor.current = posicao;
          setEdicao(texto);
          alterar(
            texto.replace(/[^0-9]/g, "") === ""
              ? null
              : Number(texto.replace(/\./g, "").replace(",", ".")),
          );
        }}
      />
      {!moeda && <span aria-hidden="true">km</span>}
    </span>
  );
}

const CAMPOS: [Editavel, string][] = [
  ["nome", "Nome comercial"],
  ["ano", "Ano"],
  ["versao", "Motor / versão"],
  ["placa", "Placa"],
  ["preco", "Preço (R$)"],
  ["km", "Quilometragem"],
  ["cambio", "Câmbio"],
  ["combustivel", "Combustível"],
  ["marca_modelo", "Marca / modelo CRLV"],
  ["cor", "Cor"],
  ["renavam", "Renavam"],
  ["chassi", "Chassi"],
  ["configuracao", "Configuração"],
  ["lugares", "Lugares"],
  ["portas", "Portas"],
  ["direcao", "Direção"],
  ["seguranca", "Segurança"],
  ["conforto", "Conforto"],
  ["infotenimento", "Infotenimento"],
];
/** Mensagem curta do erro, sem o prefixo "Error:" que o IPC acrescenta. */
const erroLegivel = (e: unknown) =>
  String(e instanceof Error ? e.message : e)
    .replace(/^(Error:\s*)?Error invoking remote method '[^']*':\s*/, "")
    .replace(/^(Error:\s*)+/, "");
/** Campos que vêm do documento (CRLV); os demais são dados comerciais e do anúncio. */
/** Primeiros dados a informar, antes do documento: preço de venda e quilometragem. */
const CAMPOS_INICIAIS: Editavel[] = ["preco", "km"];
const CAMPOS_CRLV: Editavel[] = [
  "marca_modelo",
  "placa",
  "ano",
  "combustivel",
  "cor",
  "renavam",
  "chassi",
];
/** Etapas da ficha, na ordem do fluxo de trabalho. */
const ABAS = [
  ["ficha", "Ficha"],
  ["producao", "Produção"],
  ["criativos", "Criativos"],
  ["publicacao", "Publicação"],
] as const;

/** Ficha do veículo (Studio) com as etapas Ficha, Produção, Criativos e Publicação. */
export function VehiclePage({
  veiculo,
  voltar,
}: {
  veiculo: Veiculo;
  voltar: () => void;
}) {
  const [v, setV] = useState(veiculo),
    [aba, setAbaAtual] = useState("ficha"),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  /** Troca de etapa e volta ao topo (antes a nova aba abria no meio da página). */
  const setAba = (a: string) => {
    setAbaAtual(a);
    window.scrollTo({ top: 0 });
  };
  const [versoes, setVersoes] = useState<VersaoCnw[]>([]);
  const [avisoCnw, setAvisoCnw] = useState("");
  /** Equipamentos de uma fonte que não separa série de opcional: só entram se a pessoa confirmar. */
  const [sugestaoEquip, setSugestaoEquip] = useState<{
    fonte: string;
    itens: Record<string, string[]>;
  } | null>(null);
  const [modeloWeb, setModeloWeb] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const [copiaNumero, setCopiaNumero] = useState<Record<string, number>>({});
  const [copiados, setCopiados] = useState<Record<string, string>>({});
  /** Quilometragem preenchida a partir do BNDV (ainda não salva na ficha). */
  const [kmDoBndv, setKmDoBndv] = useState(false);
  // Ficha sem quilometragem: usa a do BNDV (mesma da vitrine) até o usuário salvar.
  useEffect(() => {
    if (veiculo.km != null) return;
    let ativo = true;
    invoke<CartaoVitrine[]>("estoque_vitrine")
      .then((cartoes) => {
        const km = cartaoDaFicha(cartoes, veiculo)?.detalhes.km;
        if (!ativo || km == null) return;
        setV((atual) => (atual.km == null ? { ...atual, km } : atual));
        setKmDoBndv(true);
      })
      .catch(() => {
        /* sem BNDV: o campo fica vazio e o usuário digita */
      });
    return () => {
      ativo = false;
    };
  }, [veiculo]);
  function ficha(): FichaDes {
    return Object.fromEntries(
      Object.entries(v).map(([k, value]) => [
        k,
        value ?? (["preco", "km"].includes(k) ? 0 : ""),
      ]),
    ) as FichaDes;
  }
  /** `ia`: sem valor = só a ficha; ou os textos já validados do prompt pronto (chat do usuário, sem custo). */
  async function descricao(ia: TextosIA | false = false) {
    if (
      v.des_md &&
      !window.confirm("Substituir o DES.md atual pelos textos gerados?")
    )
      return;
    const vazios = [
      ...(v.km == null ? ["Quilometragem"] : []),
      ...camposVazios(ficha()),
    ];
    if (
      vazios.length &&
      !window.confirm(
        `Estes campos estão vazios e saem como "NÃO INFORMADO" no DES.md: ${vazios.join(", ")}.` +
          (sugestaoEquip
            ? '\n\nA pesquisa na web trouxe equipamentos sugeridos que ainda não foram incluídos (botão "Incluir equipamentos sugeridos").'
            : "") +
          "\n\nGerar assim mesmo?",
      )
    )
      return;
    await salvar();
    const loja = await obterLoja();
    const textos: TextosIA | null = ia || null;
    const md = gerarDes(ficha(), loja, textos);
    const patch = {
      des_md: md,
      des_base: md,
      ...(textos ? { des_ia: JSON.stringify(textos) } : {}),
    };
    await atualizarVeiculo(v.id, patch);
    if (v.pasta) await gravarNaPasta(v.pasta, "DES.md", md);
    setV({ ...v, ...patch });
  }
  // Só linhas de uma geração em curso mexem na barra: depois de cancelar ou falhar, o motor ainda
  // pode soltar uma última linha, que não pode trazer a barra de volta.
  const gerandoVideo = useRef(false);
  useEffect(
    () =>
      window.soul.ouvir<string>("video:log", (l) => {
        if (gerandoVideo.current)
          setAndamento((atual) => aplicarLinha(atual, l));
      }),
    [],
  );
  /** Roda uma geração de vídeo mostrando a barra; cancelamento ou erro tiram a barra da tela. */
  async function comAndamento(geracao: () => Promise<unknown>) {
    gerandoVideo.current = true;
    setAndamento(null);
    try {
      await geracao();
    } catch (e) {
      setAndamento(null);
      throw e;
    } finally {
      gerandoVideo.current = false;
    }
  }
  async function tarefa(fn: () => Promise<unknown>) {
    setOcupado(true);
    setAviso("");
    try {
      await fn();
      setAviso("Concluído.");
    } catch (e) {
      setAviso(String(e));
    } finally {
      setOcupado(false);
    }
  }
  async function salvar() {
    const patch = Object.fromEntries(CAMPOS.map(([k]) => [k, v[k]]));
    await atualizarVeiculo(v.id, {
      ...patch,
      des_md: v.des_md,
      status: v.status,
    });
    setKmDoBndv(false);
  }
  async function documento(origem: string, senha: string) {
    if (!v.pasta) throw new Error("Vincule a pasta do veículo.");
    await invoke("producao_doc_copiar", { pasta: v.pasta, origem });
    const r = await gerarDocMd({ origem }, senha || undefined);
    if ("senha" in r)
      throw new Error(
        "Documento protegido: informe a senha e tente novamente.",
      );
    await gravarNaPasta(v.pasta, "DOC.md", r.markdown);
    const patch = {
      marca_modelo: r.values.marca,
      placa: r.values.placa,
      cor: r.values.cor,
      renavam: r.values.renavam,
      chassi: r.values.chassi,
      combustivel: r.values.combustivel,
      ano: r.values.modelo,
    };
    await atualizarVeiculo(v.id, patch);
    setV({ ...v, ...patch });
    if (r.conflicts.length) setLogs(r.conflicts);
  }
  /** Um campo da ficha. Documento (CRLV) e dados do anúncio são só duas seções visuais do mesmo cadastro. */
  const campo = ([k, label]: [Editavel, string]) => (
    <label key={k}>
      {label}
      {["seguranca", "conforto", "infotenimento"].includes(k) ? (
        <CampoTexto
          value={String(v[k] ?? "")}
          onChange={(valor) => setV({ ...v, [k]: valor })}
        />
      ) : k === "preco" || k === "km" ? (
        <>
          <CampoNumerico
            valor={v[k] ?? null}
            moeda={k === "preco"}
            alterar={(valor) => {
              if (k === "km") setKmDoBndv(false);
              setV({ ...v, [k]: valor });
            }}
          />
          {k === "km" && kmDoBndv && (
            <small className="dica-campo">
              Trazida do BNDV. Confira e clique em Salvar ficha.
            </small>
          )}
        </>
      ) : (
        <input
          value={String(v[k] ?? "")}
          type="text"
          onChange={(e) =>
            setV({
              ...v,
              [k]: e.target.value,
            })
          }
        />
      )}
    </label>
  );
  return (
    <section>
      <div className="vehicle-head">
        <button
          className="plain"
          disabled={ocupado}
          onClick={voltar}
          aria-label="Voltar para a lista de veículos"
        >
          <Icon nome="voltar" />
          Veículos
        </button>
        <h2>{v.nome}</h2>
        <nav className="segmented" aria-label="Etapas da ficha">
          {ABAS.map(([a, rotulo]) => (
            <button
              key={a}
              disabled={ocupado}
              className={aba === a ? "selected" : ""}
              aria-pressed={aba === a}
              onClick={() => setAba(a)}
            >
              {rotulo}
            </button>
          ))}
        </nav>
        <button
          className="primary"
          disabled={ocupado}
          onClick={() => tarefa(salvar)}
        >
          Salvar ficha
        </button>
      </div>
      {aviso && (
        <p role="status" className="notice">
          {aviso}
        </p>
      )}
      {aba === "ficha" && (
        <div className="panel">
          <div className="grid dados-iniciais">
            {CAMPOS.filter(([k]) => CAMPOS_INICIAIS.includes(k)).map(campo)}
          </div>
          <CrlvDocument
            pasta={v.pasta}
            documento={documento}
            onBusy={setOcupado}
          >
            <div className="grid">
              {CAMPOS.filter(([k]) => CAMPOS_CRLV.includes(k)).map(campo)}
            </div>
          </CrlvDocument>
          <fieldset className="dados-anuncio">
            <legend>Dados do veículo e do anúncio</legend>
            <div className="actions">
              <button
                disabled={ocupado}
                onClick={() => {
                  setVersoes([]);
                  setAvisoCnw("Consultando a web…");
                  setSugestaoEquip(null);
                  void tarefa(async () => {
                    try {
                      const { busca: r, origem } = await buscarCnwComBanco(
                        v.nome,
                        v.ano,
                      );
                      setVersoes(r.versoes);
                      setModeloWeb(r.modelo);
                      setAvisoCnw(
                        `${r.versoes.length} versão(ões) encontrada(s) para ${r.modelo} · fonte: ${r.fonte}` +
                          (r.ignoradas?.length
                            ? ` (palavras do nome que a fonte não usa: ${r.ignoradas.join(", ")})`
                            : "") +
                          (r.avisos.length
                            ? ` (antes: ${r.avisos.join("; ")})`
                            : "") +
                          (origem === "banco"
                            ? " (guardadas no app, sem consultar o site)"
                            : "") +
                          ". Escolha uma abaixo para preencher a ficha.",
                      );
                    } catch (e) {
                      setAvisoCnw(`Consulta na web: ${erroLegivel(e)}`);
                      throw e;
                    }
                  });
                }}
              >
                Buscar ficha na web
              </button>
            </div>
            {sugestaoEquip && (
              <div className="notice" role="status">
                <p>
                  <strong>
                    Equipamentos sugeridos ({sugestaoEquip.fonte}).
                  </strong>{" "}
                  Esta fonte lista os itens do modelo sem separar o que é de
                  série do que é opcional. Só os de série podem ir para o
                  anúncio: inclua e remova na ficha o que o carro não tem.
                </p>
                <p>
                  {Object.values(sugestaoEquip.itens).reduce(
                    (n, l) => n + l.length,
                    0,
                  )}{" "}
                  itens em segurança, conforto e infotenimento.
                </p>
                <button
                  onClick={() => {
                    setV({
                      ...v,
                      ...Object.fromEntries(
                        Object.entries(sugestaoEquip.itens).map(
                          ([k, itens]) => [k, itens.join("\n")],
                        ),
                      ),
                    });
                    setSugestaoEquip(null);
                    setAvisoCnw(
                      "Equipamentos sugeridos incluídos. Revise cada lista e apague o que o carro não tem de série.",
                    );
                  }}
                >
                  Incluir equipamentos sugeridos
                </button>
              </div>
            )}
            {avisoCnw && (
              <p
                role="status"
                className={
                  avisoCnw.startsWith("Consulta na web:")
                    ? "notice error"
                    : "notice"
                }
              >
                {avisoCnw}
              </p>
            )}
            {versoes.map((item) => (
              <button
                key={item.codigo}
                disabled={ocupado}
                onClick={() =>
                  tarefa(async () => {
                    setAvisoCnw(`Lendo a ficha de ${item.titulo}…`);
                    let f;
                    try {
                      f = (await fichaCnwComBanco(item.codigo)).ficha;
                    } catch (e) {
                      setAvisoCnw(`Consulta na web: ${erroLegivel(e)}`);
                      throw e;
                    }
                    const deSerie = f.equipamentos_de_serie;
                    const versao = versaoDoTitulo(item.titulo, modeloWeb);
                    setAvisoCnw(
                      `Ficha de ${item.titulo} aplicada (fonte: ${f.fonte}). Confira os campos acima e salve a ficha.`,
                    );
                    if (deSerie) {
                      setSugestaoEquip(null);
                      setV({
                        ...v,
                        versao,
                        ...Object.fromEntries(
                          Object.entries(f.tecnicos).filter(
                            ([, valor]) => valor,
                          ),
                        ),
                        ...Object.fromEntries(
                          Object.entries(f.equipamentos).map(([k, itens]) => [
                            k,
                            itens.join("\n"),
                          ]),
                        ),
                      });
                    } else {
                      // Esta fonte não separa série de opcional: só os dados técnicos entram.
                      setV({
                        ...v,
                        versao,
                        ...Object.fromEntries(
                          Object.entries(f.tecnicos).filter(
                            ([, valor]) => valor,
                          ),
                        ),
                      });
                      setSugestaoEquip({
                        fonte: f.fonte,
                        itens: f.equipamentos,
                      });
                    }
                  })
                }
              >
                {item.titulo} · {item.ano}
              </button>
            ))}
            <div className="grid">
              {CAMPOS.filter(
                ([k]) =>
                  !CAMPOS_CRLV.includes(k) && !CAMPOS_INICIAIS.includes(k),
              ).map(campo)}
            </div>
            <div className="actions">
              <button
                disabled={ocupado}
                onClick={() => tarefa(() => descricao())}
              >
                Gerar e salvar DES.md
              </button>
            </div>
          </fieldset>
          <label>
            Descrição e anúncio
            <CampoTexto
              className="markdown"
              value={v.des_md || ""}
              onChange={(valor) => setV({ ...v, des_md: valor })}
            />
          </label>
        </div>
      )}
      {aba === "producao" && (
        <>
          <Production
            onBusy={setOcupado}
            pasta={v.pasta}
            vincular={async () => {
              const p = await open({ directory: true });
              if (typeof p === "string") {
                await atualizarVeiculo(v.id, { pasta: p });
                setV({ ...v, pasta: p });
              }
            }}
            video={async () => {
              await salvar();
              const t = tarjas(v);
              await comAndamento(() =>
                gerarVideo(v.pasta!, t.veiculo, t.motor, t.preco),
              );
            }}
          />
          <VideoProgress andamento={andamento} />
          {!!logs.length && <pre>{logs.join("\n")}</pre>}
        </>
      )}
      {aba === "criativos" && (
        <Creatives veiculo={v} onChange={setV} onBack={() => setAba("ficha")} />
      )}
      {aba === "publicacao" && (
        <div className="panel">
          <h2>Textos para publicação</h2>
          {blocosDeCopia(v.des_md || "").map((b, i) => (
            <article key={i}>
              <div className="actions">
                <h3>{b.label}</h3>
                <button
                  key={`${b.label}-${copiaNumero[b.label] ?? 0}`}
                  className={copiados[b.label] === b.text ? "copiado" : ""}
                  onClick={() =>
                    tarefa(async () => {
                      await invoke("copiar_texto", { texto: b.text });
                      setCopiaNumero((n) => ({
                        ...n,
                        [b.label]: (n[b.label] ?? 0) + 1,
                      }));
                      setCopiados((prev) => ({ ...prev, [b.label]: b.text }));
                    })
                  }
                >
                  {copiados[b.label] === b.text ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <pre>{b.text}</pre>
            </article>
          ))}
          {!v.des_md && (
            <div className="empty">
              <h3>Ainda não há textos para publicar</h3>
              <p>
                Os textos saem do DES.md. Preencha a ficha e clique em “Gerar e
                salvar DES.md”.
              </p>
              <button className="primary" onClick={() => setAba("ficha")}>
                Ir para a ficha
              </button>
            </div>
          )}
          <button
            className={v.des_md ? "primary" : ""}
            disabled={ocupado}
            onClick={() =>
              tarefa(async () => {
                await atualizarVeiculo(v.id, { status: "publicado" });
                setV({ ...v, status: "publicado" });
              })
            }
          >
            Marcar como publicado
          </button>
        </div>
      )}
    </section>
  );
}
