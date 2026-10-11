import { useEffect, useState } from "react";
import { obterConfig, salvarConfig } from "./lib/db";
import { ask, invoke, open, revealItemInDir } from "./lib/desktop";

type Estado = {
  pasta: string | null;
  pausado: boolean;
  verificando: boolean;
  copiando: { arquivo: string; bytes: number; total: number } | null;
  ultimaVerificacao: string | null;
  erro: string | null;
  copiadosNoCiclo: number;
};
type Pendencia = {
  id: number;
  origem: string;
  tamanho: number;
  situacao: "pendente" | "erro";
  detalhe: string | null;
};
type Aviso = {
  id: number;
  origem: string;
  destino: string | null;
  detalhe: string | null;
};
type Liberavel = {
  pasta: string;
  arquivos: number;
  bytes: number;
  veiculo: string | null;
};
type Resposta = {
  estado: Estado;
  pendencias: Pendencia[];
  avisos: Aviso[];
  liberaveis: Liberavel[];
};
type Liberado = {
  liberados: number;
  bytes: number;
  ignorados: { arquivo: string; motivo: string }[];
};

const mb = (b: number) =>
  (b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) +
  " MB";
const nome = (caminho: string) => caminho.split(/[\\/]/).at(-1) ?? caminho;

/** Painel "Entrada": acompanha a pasta sincronizada e mostra o que ficou pendente. */
export function Entrada() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;
    const buscar = () =>
      void invoke<Resposta>("entrada_estado")
        .then((r) => ativo && setDados(r))
        .catch((e) => ativo && setErro(String(e)));
    buscar();
    const timer = setInterval(buscar, 10_000);
    const desligar = [
      window.soul.ouvir<Resposta>("entrada:estado", (r) => setDados(r)),
      window.soul.ouvir<Resposta>("entrada:fim", (r) => setDados(r)),
      window.soul.ouvir<Estado["copiando"]>("entrada:progresso", (c) =>
        setDados((d) =>
          d ? { ...d, estado: { ...d.estado, copiando: c } } : d,
        ),
      ),
    ];
    return () => {
      ativo = false;
      clearInterval(timer);
      desligar.forEach((fn) => fn());
    };
  }, []);

  async function tarefa(fn: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      await fn();
    } catch (e) {
      setErro(String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function escolherPasta() {
    const atual = await obterConfig("entrada_pasta");
    const r = await open({
      directory: true,
      title: "Pasta sincronizada com a equipe (Google Drive)",
      defaultPath: atual ?? undefined,
    });
    if (typeof r !== "string") return;
    await salvarConfig("entrada_pasta", r);
    setDados(await invoke<Resposta>("entrada_verificar"));
  }

  async function liberar() {
    const escolhidas = dados?.liberaveis.filter((l) => marcadas.has(l.pasta));
    if (!escolhidas?.length) return;
    const total = escolhidas.reduce((s, l) => s + l.bytes, 0);
    const ok = await ask(
      `Enviar para a Lixeira ${escolhidas.length} pasta(s) da entrada (${mb(total)})?\n` +
        "Só saem os arquivos cuja cópia no veículo foi conferida (tamanho e hash).",
    );
    if (!ok) return;
    const r = await invoke<Liberado>("entrada_liberar", {
      subpastas: escolhidas.map((l) => l.pasta),
    });
    setMarcadas(new Set());
    setAviso(
      `${r.liberados} arquivo(s) enviados para a Lixeira (${mb(r.bytes)}).` +
        (r.ignorados.length
          ? ` ${r.ignorados.length} mantido(s): ${r.ignorados
              .slice(0, 3)
              .map((i) => `${nome(i.arquivo)} (${i.motivo})`)
              .join("; ")}`
          : ""),
    );
    setDados(await invoke<Resposta>("entrada_estado"));
  }

  const e = dados?.estado;
  const pct = e?.copiando?.total
    ? Math.min(100, Math.round((e.copiando.bytes / e.copiando.total) * 100))
    : 0;
  const situacao = !e?.pasta
    ? "Sem pasta configurada"
    : e.pausado
      ? "Pausado"
      : e.copiando
        ? `Copiando ${e.copiando.arquivo} (${pct}%)`
        : e.verificando
          ? "Verificando…"
          : "Observando";

  return (
    <section className="panel">
      <h2>Entrada de arquivos</h2>
      <p>
        A equipe sobe fotos, vídeo e documento numa subpasta com a placa no nome
        (por exemplo, <code>TORO - ABC1D23</code>). O app copia para a pasta do
        veículo. A pasta da nuvem nunca é alterada, e arquivos novos só são
        copiados depois de pararem de mudar de tamanho.
      </p>
      <p>
        <strong>Pasta:</strong> {e?.pasta ?? "não escolhida"}
      </p>
      <div className="actions">
        <button disabled={ocupado} onClick={() => void tarefa(escolherPasta)}>
          Escolher pasta
        </button>
        <button
          className="primary"
          disabled={ocupado || !e?.pasta || e.pausado || e.verificando}
          onClick={() =>
            void tarefa(async () =>
              setDados(await invoke<Resposta>("entrada_verificar")),
            )
          }
        >
          Verificar agora
        </button>
        <button
          disabled={ocupado || !e?.pasta}
          onClick={() =>
            void tarefa(async () =>
              setDados(
                await invoke<Resposta>("entrada_pausar", {
                  pausar: !e?.pausado,
                }),
              ),
            )
          }
        >
          {e?.pausado ? "Retomar" : "Pausar"}
        </button>
      </div>
      <p role="status">
        <strong>{situacao}</strong>
        {e?.ultimaVerificacao &&
          ` · última verificação ${new Date(e.ultimaVerificacao).toLocaleTimeString("pt-BR")}`}
        {e?.copiadosNoCiclo ? ` · ${e.copiadosNoCiclo} copiado(s)` : ""}
      </p>
      {e?.copiando && <progress max={100} value={pct} />}
      {(erro || e?.erro) && (
        <p role="alert" className="notice">
          {erro || e?.erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="notice">
          {aviso}
        </p>
      )}

      <h3>Pendências ({dados?.pendencias.length ?? 0})</h3>
      {dados?.pendencias.length ? (
        <ul>
          {dados.pendencias.map((p) => (
            <li key={p.id}>
              <strong>{nome(p.origem)}</strong> ({mb(p.tamanho)})
              {p.situacao === "erro" ? " · erro: " : " · "}
              {p.detalhe}{" "}
              <button
                onClick={() =>
                  void revealItemInDir(p.origem).catch((x) =>
                    setErro(String(x)),
                  )
                }
              >
                Mostrar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhuma pendência.</p>
      )}

      {!!dados?.avisos.length && (
        <>
          <h3>Avisos ({dados.avisos.length})</h3>
          <ul>
            {dados.avisos.map((a) => (
              <li key={a.id}>
                <strong>{nome(a.origem)}</strong> · {a.detalhe}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Liberar espaço na nuvem</h3>
      {dados?.liberaveis.length ? (
        <>
          <p>
            Marque só os veículos já conferidos. Os arquivos vão para a Lixeira
            (recuperáveis), nunca são apagados em definitivo.
          </p>
          <ul>
            {dados.liberaveis.map((l) => (
              <li key={l.pasta}>
                <label>
                  <input
                    type="checkbox"
                    checked={marcadas.has(l.pasta)}
                    onChange={(ev) => {
                      const novo = new Set(marcadas);
                      if (ev.target.checked) novo.add(l.pasta);
                      else novo.delete(l.pasta);
                      setMarcadas(novo);
                    }}
                  />
                  {l.pasta} · {l.arquivos} arquivo(s) · {mb(l.bytes)}
                  {l.veiculo ? ` → ${l.veiculo}` : ""}
                </label>
              </li>
            ))}
          </ul>
          <button
            disabled={ocupado || !marcadas.size}
            onClick={() => void tarefa(liberar)}
          >
            Liberar espaço dos marcados
          </button>
        </>
      ) : (
        <p>Nada copiado e ainda presente na nuvem.</p>
      )}
    </section>
  );
}
