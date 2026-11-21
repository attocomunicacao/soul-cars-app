/**
 * Página Pré-atendimento IA (portada do Soul IA): a IA atende pelo WhatsApp (uTalk) os leads com a
 * etiqueta de gatilho, envia fotos das pastas do ESTOQUE e passa para a equipe quando o lead quer
 * visitar ou falar com alguém. Abas: Visão geral, Aprovação, Auditoria, Ensinar (simulador), Laboratório (testes), Respostas-rápidas,
 * Loja e Configurações. Tudo passa pelos comandos `pre_*` do processo principal; a chave do Groq e o
 * token do uTalk nunca chegam aqui.
 *
 * Este arquivo guarda o painel, a troca de abas e o comando `agir`; cada aba mora em seu arquivo
 * (Visao, Aprovacao, Auditoria, Ensinar, Respostas, Loja, Configuracoes) e os tipos comuns em shared.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { Segmentado, textoDoErro } from "../../app/components";
import { Icon } from "../../app/icons";
import { invoke, listen } from "../../lib/desktop-bridge";
import { LabTab } from "./lab/LabTab";
import { type Painel } from "./shared";
import { OverviewTab } from "./OverviewTab";
import { AuditTab } from "./AuditTab";
import { ApprovalTab } from "./ApprovalTab";
import { TeachTab } from "./TeachTab";
import { RepliesTab } from "./RepliesTab";
import { StoreTab } from "./StoreTab";
import { SettingsTab } from "./SettingsTab";

type Aba =
  | "visao"
  | "aprovacao"
  | "auditoria"
  | "ensinar"
  | "laboratorio"
  | "respostas"
  | "loja"
  | "config";

const ABAS = [
  ["visao", "Visão geral"],
  ["aprovacao", "Aprovação"],
  ["auditoria", "Auditoria"],
  ["ensinar", "Ensinar"],
  ["laboratorio", "Laboratório"],
  ["respostas", "Respostas-rápidas"],
  ["loja", "Loja"],
  ["config", "Configurações"],
] as const;

export function PreServicePage({
  aoErro,
  abrirConfiguracoes,
}: {
  aoErro: (m: string) => void;
  abrirConfiguracoes: () => void;
}) {
  const [p, setP] = useState<Painel | null>(null);
  const [aba, setAba] = useState<Aba>("visao");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setP(await invoke<Painel>("pre_painel"));
    } catch (e) {
      aoErro(textoDoErro(e));
    }
  }, [aoErro]);

  useEffect(() => {
    void carregar();
    let desligar: (() => void) | null = null;
    let vivo = true;
    void listen("preatendimento:mudou", () => void carregar()).then((d) => {
      if (vivo) desligar = d;
      else d();
    });
    return () => {
      vivo = false;
      desligar?.();
    };
  }, [carregar]);

  /** Roda um comando que devolve o painel novo, mostrando o erro se falhar. */
  const agir = useCallback(
    async (comando: string, args: Record<string, unknown> = {}) => {
      setOcupado(true);
      try {
        const r = await invoke<Painel | { painel: Painel }>(comando, args);
        if (r && "painel" in r) setP(r.painel);
        else if (r && "config" in r) setP(r);
        else await carregar();
        return true;
      } catch (e) {
        aoErro(textoDoErro(e));
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [aoErro, carregar],
  );

  if (!p) return <p className="empty">Carregando…</p>;

  return (
    <section className="pre-atendimento">
      <div className="page-head">
        <div>
          <p className="eyebrow">CRM · uTalk</p>
          <h1>Pré-atendimento IA</h1>
          <p>
            {p.config.ligado ? "Atendimento ligado" : "Atendimento desligado"} ·{" "}
            {p.config.enviarSemAprovacao
              ? "envia sem aprovação"
              : "pede aprovação"}{" "}
            ·{" "}
            {p.config.provedor === "groq"
              ? `Groq ${p.config.modeloGroq}`
              : `Ollama ${p.config.modeloOllama}`}
          </p>
        </div>
        <div className="actions">
          <button
            disabled={ocupado || !p.config.etiquetaGatilhoId}
            title={
              p.config.etiquetaGatilhoId
                ? "Verifica os leads agora"
                : "Escolha a etiqueta de gatilho nas Configurações"
            }
            onClick={() => void agir("pre_rodar")}
          >
            <Icon nome="recarregar" />
            Verificar agora
          </button>
        </div>
      </div>

      {!p.conexoes.utalk && (
        <div className="notice com-fechar">
          <span>
            Cadastre o token do uTalk para a IA ler e responder os leads.
          </span>
          <button className="plain small" onClick={abrirConfiguracoes}>
            Conexões
          </button>
        </div>
      )}
      {p.laco.ultimoErro && (
        <div role="alert" className="notice error">
          <span>{p.laco.ultimoErro}</span>
        </div>
      )}

      <div className="filtros">
        <Segmentado rotulo="Seção" opcoes={ABAS} valor={aba} aoMudar={setAba} />
      </div>

      {aba === "visao" && <OverviewTab p={p} agir={agir} />}
      {aba === "aprovacao" && (
        <ApprovalTab p={p} agir={agir} ocupado={ocupado} />
      )}
      {aba === "auditoria" && <AuditTab p={p} aoErro={aoErro} />}
      {aba === "ensinar" && <TeachTab p={p} agir={agir} aoErro={aoErro} />}
      {aba === "laboratorio" && <LabTab aoErro={aoErro} />}
      {aba === "respostas" && <RepliesTab p={p} agir={agir} />}
      {aba === "loja" && <StoreTab p={p} agir={agir} />}
      {aba === "config" && <SettingsTab p={p} agir={agir} aoErro={aoErro} />}
    </section>
  );
}
