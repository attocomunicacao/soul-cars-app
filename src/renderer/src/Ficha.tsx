import { useEffect, useState } from "react";
import {
  atualizarVeiculo,
  obterLoja,
  obterConfig,
  type Veiculo,
  type Editavel,
} from "./lib/db";
import { gerarDes, type FichaDes, type TextosIA } from "./lib/des";
import { invoke, open, openPath } from "./lib/desktop";
import {
  buscarCnw,
  fichaCnw,
  ocrEquipamentos,
  engine,
  type VersaoCnw,
} from "./lib/engine";
import {
  gerarDocMd,
  gravarNaPasta,
  gerarVideo,
  gerarVideoLeve,
  tarjas,
} from "./lib/producao";
import { Producao } from "./Producao";
import { blocosDeCopia } from "./lib/publicacao";
import { Criativos } from "./Criativos";
import { Instagram } from "./Instagram";
import { PromptAnuncio } from "./PromptAnuncio";
import { Anunciar } from "./Anunciar";

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
export function Ficha({
  veiculo,
  voltar,
}: {
  veiculo: Veiculo;
  voltar: () => void;
}) {
  const [v, setV] = useState(veiculo),
    [aba, setAba] = useState("producao"),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const [versoes, setVersoes] = useState<VersaoCnw[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiaNumero, setCopiaNumero] = useState<Record<string, number>>({});
  const [baixarInstagram, setBaixarInstagram] = useState(false);
  const [copiados, setCopiados] = useState<Record<string, string>>({});
  const [modoApi, setModoApi] = useState(false);
  const [mostrarPrompt, setMostrarPrompt] = useState(false);
  function ficha(): FichaDes {
    return Object.fromEntries(
      Object.entries(v).map(([k, value]) => [
        k,
        value ?? (["preco", "km"].includes(k) ? 0 : ""),
      ]),
    ) as FichaDes;
  }
  useEffect(() => {
    let ativo = true;
    void obterConfig("ia_modo_api")
      .then((c) => ativo && setModoApi(c === "1"))
      .catch((e) => ativo && setAviso(String(e)));
    return () => {
      ativo = false;
    };
  }, []);
  /** `ia`: false = só a ficha; true = modo API (se ligado); ou textos já validados do prompt pronto. */
  async function descricao(ia: boolean | TextosIA = false) {
    if (
      v.des_md &&
      !window.confirm("Substituir o DES.md atual pelos textos gerados?")
    )
      return;
    await salvar();
    const loja = await obterLoja();
    let textos: TextosIA | null = typeof ia === "object" ? ia : null;
    if (ia === true) {
      if ((await obterConfig("ia_modo_api")) !== "1")
        throw new Error(
          "O modo API está desligado. Use o prompt pronto ou ative o modo API em Configurações.",
        );
      textos = await engine<TextosIA>("gerar_textos", {
        ficha: ficha(),
        loja: loja.loja,
      });
    }
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
  useEffect(
    () =>
      window.soul.ouvir<string>("video:log", (l) =>
        setLogs((prev) => [...prev.slice(-199), l]),
      ),
    [],
  );
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
  return (
    <section>
      <div className="actions">
        <button disabled={ocupado} onClick={voltar}>
          ← Veículos
        </button>
        <h2>{v.nome}</h2>
        {v.pasta && (
          <button onClick={() => tarefa(() => openPath(v.pasta!))}>
            Abrir pasta
          </button>
        )}
        <button
          className="primary"
          disabled={ocupado}
          onClick={() => tarefa(salvar)}
        >
          Salvar ficha
        </button>
      </div>
      <nav>
        {[
          "producao",
          "ficha",
          "criativos",
          "anunciar",
          "publicacao",
          "instagram",
        ].map((a) => (
          <button
            key={a}
            disabled={ocupado}
            className={aba === a ? "selected" : ""}
            onClick={() => {
              setBaixarInstagram(false);
              if (a === "instagram")
                void tarefa(async () => {
                  await salvar();
                  setAba(a);
                });
              else setAba(a);
            }}
          >
            {a === "producao"
              ? "Produção"
              : a === "anunciar"
                ? "Pronto para anunciar"
                : a === "publicacao"
                  ? "Publicação"
                  : a === "ficha"
                    ? "Ficha"
                    : a === "instagram"
                      ? "Instagram"
                      : "Criativos"}
          </button>
        ))}
      </nav>
      {aviso && (
        <p role="status" className="notice">
          {aviso}
        </p>
      )}
      {aba === "ficha" && (
        <div className="panel">
          <div className="grid">
            {CAMPOS.map(([k, label]) => (
              <label key={k}>
                {label}
                {["seguranca", "conforto", "infotenimento"].includes(k) ? (
                  <textarea
                    value={String(v[k] ?? "")}
                    onChange={(e) => setV({ ...v, [k]: e.target.value })}
                  />
                ) : (
                  <input
                    value={String(v[k] ?? "")}
                    type={["preco", "km"].includes(k) ? "number" : "text"}
                    onChange={(e) =>
                      setV({
                        ...v,
                        [k]: ["preco", "km"].includes(k)
                          ? e.target.value === ""
                            ? null
                            : Number(e.target.value)
                          : e.target.value,
                      })
                    }
                  />
                )}
              </label>
            ))}
          </div>
          <label>
            Status
            <select
              value={v.status}
              onChange={(e) =>
                setV({ ...v, status: e.target.value as Veiculo["status"] })
              }
            >
              <option value="rascunho">Rascunho</option>
              <option value="criativos">Criativos</option>
              <option value="publicado">Publicado</option>
            </select>
          </label>
          <div className="actions">
            <button
              disabled={ocupado}
              onClick={() => tarefa(() => descricao())}
            >
              Gerar e salvar DES.md
            </button>
            <button
              disabled={ocupado}
              onClick={() => setMostrarPrompt((m) => !m)}
            >
              Textos pelo chat (prompt pronto)
            </button>
            {modoApi && (
              <button
                disabled={ocupado}
                onClick={() => tarefa(() => descricao(true))}
              >
                Gerar textos com IA (API paga)
              </button>
            )}
            <button
              disabled={ocupado}
              onClick={() =>
                tarefa(async () =>
                  setVersoes((await buscarCnw(v.nome, v.ano)).versoes),
                )
              }
            >
              Buscar ficha Carros na Web
            </button>
            <label className="file-button">
              OCR de equipamentos
              <input
                type="file"
                accept="image/*"
                disabled={ocupado}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f)
                    void tarefa(async () => {
                      const r = await ocrEquipamentos(f);
                      setV({
                        ...v,
                        ...Object.fromEntries(
                          Object.entries(r.itens).map(([k, items]) => [
                            k,
                            items.join("\n"),
                          ]),
                        ),
                      });
                    });
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {mostrarPrompt && (
            <PromptAnuncio
              ficha={v}
              ocupado={ocupado}
              aplicar={(textos) =>
                tarefa(async () => {
                  await descricao(textos);
                })
              }
            />
          )}
          {versoes.map((item) => (
            <button
              key={item.codigo}
              disabled={ocupado}
              onClick={() =>
                tarefa(async () => {
                  const f = await fichaCnw(item.codigo);
                  setV({
                    ...v,
                    ...f.tecnicos,
                    ...Object.fromEntries(
                      Object.entries(f.equipamentos).map(([k, itens]) => [
                        k,
                        itens.join("\n"),
                      ]),
                    ),
                  });
                })
              }
            >
              {item.titulo} · {item.ano}
            </button>
          ))}
          <label>
            Descrição e anúncio
            <textarea
              className="markdown"
              value={v.des_md || ""}
              onChange={(e) => setV({ ...v, des_md: e.target.value })}
            />
          </label>
        </div>
      )}
      {aba === "producao" && (
        <>
          <Producao
            onBusy={setOcupado}
            pasta={v.pasta}
            documento={documento}
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
              await gerarVideo(v.pasta!, t.veiculo, t.motor, t.preco);
            }}
            videoLeve={async () => {
              await gerarVideoLeve(v.pasta!);
            }}
          />
          {!!logs.length && <pre>{logs.join("\n")}</pre>}
        </>
      )}
      {aba === "criativos" && (
        <Criativos
          veiculo={v}
          onChange={setV}
          onBack={() => {
            setBaixarInstagram(false);
            setAba("ficha");
          }}
          prepararInstagram={baixarInstagram}
          onInstagramPronto={() => {
            setBaixarInstagram(false);
            setAba("instagram");
          }}
        />
      )}
      {aba === "instagram" && (
        <Instagram
          veiculo={v}
          onBusy={setOcupado}
          baixar={() => {
            void tarefa(async () => {
              await salvar();
              setBaixarInstagram(true);
              setAba("criativos");
            });
          }}
        />
      )}
      {aba === "anunciar" && <Anunciar veiculo={v} irPara={setAba} />}
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
          {!v.des_md && <p>Gere DES.md na ficha antes de publicar.</p>}
          <button
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
