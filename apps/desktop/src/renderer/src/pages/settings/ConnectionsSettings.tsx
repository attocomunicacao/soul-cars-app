/**
 * Configurações › Conexões e dados (vindas do Soul APP): token do uTalk (CRM) e do Meta Ads,
 * importação do Soul APP, preferências do CRM · Leads (janela, intervalo, aviso de lead novo
 * e o papel de cada etiqueta no Kanban) e alertas do Meta Ads. Os tokens vão direto para o
 * main, que os cifra; a interface nunca recebe um token de volta.
 */
import { useCallback, useEffect, useState } from "react";
import type {
  CategoriaEtiqueta,
  ConfigLeads,
  SnapshotCrm,
} from "../../../../shared/crm-leads";
import type { ConfigMeta } from "../../../../shared/meta-ads";
import { invoke } from "../../lib/desktop-bridge";

type DadosLeads = {
  snapshot: SnapshotCrm | null;
  config: ConfigLeads;
  conectado: boolean;
  organizacao: { id: string; nome: string } | null;
};
type EstadoMeta = { configurado: boolean; conta: string; versao: string };
type Validade = {
  valido: boolean | null;
  venceEm: string | null;
  permissoes: string[];
} | null;

const msg = (e: unknown) =>
  String(e)
    .replace(/^Error:\s*/, "")
    .replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

export function ConnectionsSettings() {
  const [leads, setLeads] = useState<DadosLeads | null>(null);
  const [meta, setMeta] = useState<EstadoMeta | null>(null);
  const [validade, setValidade] = useState<Validade>(null);
  const [soulApp, setSoulApp] = useState(false);
  const [cfgMeta, setCfgMeta] = useState<ConfigMeta | null>(null);
  const [tokenUtalk, setTokenUtalk] = useState("");
  const [tokenMeta, setTokenMeta] = useState("");
  const [conta, setConta] = useState("");
  const [aviso, setAviso] = useState<{
    tom: "ok" | "erro";
    texto: string;
  } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const [l, m, s] = await Promise.all([
      invoke<DadosLeads>("crm_leads_dados"),
      invoke<EstadoMeta>("meta_estado"),
      invoke<{ encontrado: boolean }>("soulapp_estado"),
    ]);
    setLeads(l);
    setMeta(m);
    setConta(m.conta);
    setSoulApp(s.encontrado);
    if (m.configurado)
      invoke<Validade>("meta_token_validade")
        .then(setValidade)
        .catch(() => setValidade(null));
  }, []);

  useEffect(() => {
    recarregar().catch((e) => setAviso({ tom: "erro", texto: msg(e) }));
    invoke<ConfigMeta>("meta_config_ler")
      .then(setCfgMeta)
      .catch(() => setCfgMeta(null));
  }, [recarregar]);

  async function fazer(fn: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    setAviso(null);
    try {
      await fn();
      await recarregar();
      setAviso({ tom: "ok", texto: ok });
    } catch (e) {
      setAviso({ tom: "erro", texto: msg(e) });
    } finally {
      setOcupado(false);
    }
  }

  const salvarLeads = (patch: Partial<ConfigLeads>) =>
    fazer(
      () => invoke("crm_leads_config_salvar", { patch }),
      "Preferências do CRM salvas.",
    );
  const salvarMetaCfg = (patch: Partial<ConfigMeta>) =>
    fazer(
      async () =>
        setCfgMeta(await invoke<ConfigMeta>("meta_config_salvar", { patch })),
      "Alertas do Meta Ads salvos.",
    );

  const vence = validade?.venceEm
    ? (Date.parse(validade.venceEm) - Date.now()) / 864e5
    : null;

  return (
    <>
      <section>
        <h3>Conexões</h3>
        <p>
          Os painéis de Leads, Campanhas e Funil leem o uTalk e o Meta Ads. Os
          tokens ficam só neste computador, cifrados pelo Windows, e o app só
          lê: nada muda no CRM nem nas campanhas.
        </p>
        {soulApp && (
          <div className="notice com-fechar">
            <span>
              Encontrei o Soul APP neste computador. Dá para trazer tokens,
              organização, etiquetas e regras de lá.
            </span>
            <button
              className="primary small"
              disabled={ocupado}
              onClick={() =>
                fazer(async () => {
                  const r = await invoke<string[]>("soulapp_importar");
                  setAviso({
                    tom: "ok",
                    texto: `Importado: ${r.join(", ") || "nada encontrado"}.`,
                  });
                }, "Importação do Soul APP concluída.")
              }
            >
              Importar do Soul APP
            </button>
          </div>
        )}
        <div className="conexao">
          <div className="conexao-topo">
            <b>uTalk (CRM)</b>
            <span className={`pilula ${leads?.conectado ? "ok" : ""}`}>
              <i />
              {leads?.conectado
                ? `Conectado${leads.organizacao?.nome ? ` · ${leads.organizacao.nome}` : ""}`
                : "Não conectado"}
            </span>
          </div>
          <div className="campo-com-botao">
            <label>
              Token pessoal (account.umbler.com › Perfil › Token)
              <input
                type="password"
                autoComplete="off"
                value={tokenUtalk}
                placeholder={
                  leads?.conectado ? "•••••••• (salvo)" : "Cole o token"
                }
                onChange={(e) => setTokenUtalk(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={ocupado || tokenUtalk.trim().length < 10}
              onClick={() =>
                fazer(async () => {
                  await invoke("utalk_token_salvar", { token: tokenUtalk });
                  setTokenUtalk("");
                }, "Token do uTalk salvo.")
              }
            >
              Salvar
            </button>
            {leads?.conectado && (
              <button
                className="plain"
                disabled={ocupado}
                onClick={() =>
                  fazer(
                    () => invoke("utalk_token_remover"),
                    "Token do uTalk removido.",
                  )
                }
              >
                Remover
              </button>
            )}
          </div>
        </div>
        <div className="conexao">
          <div className="conexao-topo">
            <b>Meta Ads</b>
            <span
              className={`pilula ${meta?.configurado ? (validade?.valido === false ? "erro" : "ok") : ""}`}
            >
              <i />
              {!meta?.configurado
                ? "Não conectado"
                : validade?.valido === false
                  ? "Token inválido"
                  : vence != null
                    ? vence <= 0
                      ? "Token vencido"
                      : `Conectado · vence em ${Math.ceil(vence)} dia(s)`
                    : "Conectado"}
            </span>
          </div>
          <div className="grid grid-2">
            <label>
              Token de acesso (permissão ads_read)
              <input
                type="password"
                autoComplete="off"
                value={tokenMeta}
                placeholder={
                  meta?.configurado ? "•••••••• (salvo)" : "Cole o token"
                }
                onChange={(e) => setTokenMeta(e.target.value)}
              />
            </label>
            <label>
              ID da conta de anúncios
              <input
                value={conta}
                placeholder="act_123456789"
                onChange={(e) => setConta(e.target.value)}
              />
            </label>
          </div>
          {vence != null && vence < 10 && (
            <p className="hint">
              Prefira um token de Usuário do Sistema, que não vence (Gerenciador
              de Negócios › Usuários do sistema).
            </p>
          )}
          <div className="actions">
            <button
              className="primary"
              disabled={
                ocupado ||
                (!tokenMeta.trim() && conta.trim() === (meta?.conta ?? ""))
              }
              onClick={() =>
                fazer(async () => {
                  await invoke("meta_salvar", { token: tokenMeta, conta });
                  setTokenMeta("");
                }, "Conexão do Meta salva.")
              }
            >
              Salvar
            </button>
            <button
              disabled={ocupado || (!tokenMeta.trim() && !meta?.configurado)}
              onClick={() =>
                fazer(async () => {
                  const r = await invoke<{
                    conta: { nome: string } | null;
                    faltando: string[];
                  }>("meta_testar", { token: tokenMeta, conta });
                  setAviso({
                    tom: r.faltando.length ? "erro" : "ok",
                    texto: r.faltando.length
                      ? `Token sem a permissão ${r.faltando.join(", ")}.`
                      : `Tudo certo${r.conta ? `: conta ${r.conta.nome}` : ""}.`,
                  });
                }, "Teste concluído.")
              }
            >
              Testar
            </button>
            {meta?.configurado && (
              <button
                className="plain"
                disabled={ocupado}
                onClick={() =>
                  fazer(
                    () => invoke("meta_token_remover"),
                    "Token do Meta removido.",
                  )
                }
              >
                Remover token
              </button>
            )}
          </div>
        </div>
        {aviso && (
          <p
            role="status"
            className={aviso.tom === "ok" ? "status-texto" : "texto-erro"}
          >
            {aviso.texto}
          </p>
        )}
      </section>
      {leads && (
        <section>
          <h3>CRM · Leads</h3>
          <p>Quanto buscar no uTalk e como ler as etiquetas.</p>
          <div className="grid">
            <label>
              Contatos ativos nos últimos (dias, 0 = todos)
              <input
                type="number"
                min={0}
                max={365}
                defaultValue={leads.config.windowDays}
                onBlur={(e) =>
                  Number(e.target.value) !== leads.config.windowDays &&
                  void salvarLeads({ windowDays: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Atualizar a cada (segundos)
              <input
                type="number"
                min={30}
                max={3600}
                defaultValue={leads.config.intervalSec}
                onBlur={(e) =>
                  Number(e.target.value) !== leads.config.intervalSec &&
                  void salvarLeads({ intervalSec: Number(e.target.value) })
                }
              />
            </label>
            <label className="linha-opcao">
              <input
                type="checkbox"
                checked={leads.config.notifyNewLeads}
                onChange={(e) =>
                  void salvarLeads({ notifyNewLeads: e.target.checked })
                }
              />
              Avisar no Windows quando chegar lead novo
            </label>
          </div>
          <EtiquetasCrm leads={leads} salvar={salvarLeads} />
        </section>
      )}
      {cfgMeta && (
        <section>
          <h3>Alertas do Meta Ads</h3>
          <p>
            A campanha fica marcada quando passa de um limite (0 = sem alerta).
          </p>
          <div className="grid">
            <label>
              Custo por resultado acima de (R$)
              <input
                type="number"
                min={0}
                step="0.5"
                defaultValue={cfgMeta.alertCpr}
                onBlur={(e) =>
                  void salvarMetaCfg({ alertCpr: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Gasto no período acima de (R$)
              <input
                type="number"
                min={0}
                step="10"
                defaultValue={cfgMeta.alertSpend}
                onBlur={(e) =>
                  void salvarMetaCfg({ alertSpend: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Meta de ROAS (vendas rastreadas)
              <input
                type="number"
                min={0.1}
                step="0.1"
                defaultValue={cfgMeta.roasTarget}
                onBlur={(e) =>
                  void salvarMetaCfg({ roasTarget: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </section>
      )}
    </>
  );
}

/** Tipo de cada etiqueta (carro, status ou ignorar) e a ordem das colunas do Kanban. */
function EtiquetasCrm({
  leads,
  salvar,
}: {
  leads: DadosLeads;
  salvar: (p: Partial<ConfigLeads>) => Promise<void>;
}) {
  const tags = leads.snapshot?.tags ?? [];
  if (!tags.length)
    return (
      <p className="hint">
        As etiquetas aparecem depois da primeira leitura do uTalk.
      </p>
    );
  const cfg = leads.config;
  const porId = new Map(tags.map((t) => [t.id, t]));
  const mudarTipo = (id: string, c: CategoriaEtiqueta) => {
    const ordem = cfg.statusOrder.filter((x) => x !== id);
    if (c === "status") ordem.push(id);
    void salvar({
      tagCategories: { ...cfg.tagCategories, [id]: c },
      statusOrder: ordem,
    });
  };
  const mover = (i: number, d: -1 | 1) => {
    const o = [...cfg.statusOrder];
    [o[i], o[i + d]] = [o[i + d], o[i]];
    void salvar({ statusOrder: o });
  };
  return (
    <details className="etiquetas-config">
      <summary>Ajustar etiquetas ({tags.length})</summary>
      <h4>Colunas do Kanban (status, na ordem do atendimento)</h4>
      <ol className="ordem-status">
        {cfg.statusOrder.map((id, i) => (
          <li key={id}>
            <span>{porId.get(id)?.name ?? id}</span>
            <button
              className="small"
              aria-label="Subir"
              disabled={i === 0}
              onClick={() => mover(i, -1)}
            >
              ↑
            </button>
            <button
              className="small"
              aria-label="Descer"
              disabled={i === cfg.statusOrder.length - 1}
              onClick={() => mover(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <h4>Tipo de cada etiqueta</h4>
      <div className="grade-regras">
        {[...tags]
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
          .map((t) => (
            <label key={t.id} className="campo-inline">
              <span className="regra-nome">{t.name}</span>
              <select
                value={cfg.tagCategories[t.id] ?? "car"}
                onChange={(e) =>
                  mudarTipo(t.id, e.target.value as CategoriaEtiqueta)
                }
              >
                <option value="car">Carro</option>
                <option value="status">Status (coluna do Kanban)</option>
                <option value="ignore">Ignorar</option>
              </select>
            </label>
          ))}
      </div>
    </details>
  );
}
