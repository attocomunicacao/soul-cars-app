/**
 * Laço do Pré-atendimento: a cada intervalo lê os chats com a etiqueta de gatilho e responde.
 *
 * `rodar` faz uma rodada (ficha do lead, detecção do carro, resposta, auditoria e rascunho ou envio);
 * `reiniciarLaco` liga ou desliga o intervalo conforme as configurações. Só roda com "ligado" marcado
 * (desligado por padrão).
 */
import {
  doContato,
  veiculoMencionado,
  voltouParaIa,
  type MensagemIa,
} from "../../shared/pre-service";
import { mascararConversa } from "../../shared/lead-profile";
import { deveOmitir } from "../../shared/pre-service-pipeline";
import { gravarDesfecho } from "./audit";
import { cliente, entregar } from "./delivery";
import { responder, type RespostaIa } from "./reply";
import { atualizarFicha } from "./secrets";
import {
  carregar,
  definirEmissor,
  gravar,
  novoId,
  registrar,
  type Emitir,
  type Rascunho,
} from "./state";
import { veiculosDisponiveis } from "./stock";
import { ARQUIVO_AUDITORIA, auditarTurno } from "./turn-audit";
import { horaDa, textoDa } from "./utalk-writer";

let ocupado = false;
let ultimaRodada: string | null = null;
let ultimoErro: string | null = null;

/** Uma rodada do atendimento: lê os chats com a etiqueta de gatilho e responde quem escreveu. */
export async function rodar() {
  if (ocupado) return { pulou: true, chats: 0, atendidos: 0 };
  ocupado = true;
  const e = carregar();
  const cfg = e.config;
  let atendidos = 0;
  try {
    if (!cfg.etiquetaGatilhoId)
      throw new Error("Escolha a etiqueta de gatilho nas Configurações.");
    const c = await cliente();
    const chats = await c.chatsComEtiqueta(cfg.etiquetaGatilhoId);
    for (const chat of chats) {
      const st = (e.chats[chat.id] ??= {
        chatId: chat.id,
        contatoId: chat.contact?.id ?? null,
        nome: chat.contact?.name || chat.contact?.phoneNumber || "Lead",
        telefone: chat.contact?.phoneNumber ?? null,
        historico: [],
        status: "ativo",
        vistoAte: 0,
        ultimaIaEm: null,
        fotosEnviadas: {},
      });
      if (chat.contact?.id) st.contatoId = chat.contact.id;
      // Etiqueta de gatilho de volta num lead entregue à equipe = a equipe devolveu à IA.
      if (voltouParaIa(st)) {
        st.status = "ativo";
        st.vistoAte = Date.now(); // só responde o que chegar daqui em diante
        st.ficha = undefined; // novo ciclo: a ficha do atendimento anterior não vale
        st.fichaDesde = Date.now();
        registrar(
          "crm",
          `${st.nome}: voltou para a IA (etiqueta de gatilho recolocada)`,
        );
      }
      if (
        st.status !== "ativo" ||
        e.rascunhos.some((d) => d.chatId === chat.id)
      )
        continue;
      const msgs = (await c.mensagens(chat.id))
        .filter((m) => !m.isPrivate && textoDa(m))
        .sort((a, b) => horaDa(a) - horaDa(b));
      const novas = msgs.filter((m) => doContato(m) && horaDa(m) > st.vistoAte);
      const nuncaFalou = !st.historico.length && !st.ultimaIaEm;
      if (!novas.length && !(nuncaFalou && cfg.enviarAbertura)) continue;

      // Conversa vista pelo modelo = histórico real do chat (equipe e celular "External" contam como nós).
      const conversa: MensagemIa[] = novas.length
        ? msgs.map((m) => ({
            role: doContato(m) ? "user" : "assistant",
            content: textoDa(m),
          }))
        : [];
      if (novas.length) st.vistoAte = horaDa(novas[novas.length - 1]);
      // O CPF e a data de nascimento ficam só na ficha (cifrada): o modelo, o histórico e a auditoria veem a versão mascarada.
      const doCiclo = msgs.filter((m) => horaDa(m) > (st.fichaDesde ?? 0));
      st.ficha = atualizarFicha(
        st.ficha,
        novas.length
          ? doCiclo.map((m) => ({
              role: doContato(m) ? ("user" as const) : ("assistant" as const),
              content: textoDa(m),
            }))
          : [],
      );
      const mascaradas = mascararConversa(
        msgs.map((m) => ({
          role: doContato(m) ? ("user" as const) : ("assistant" as const),
          content: textoDa(m),
        })),
      );
      const doCliente = novas.map((m) => mascaradas[msgs.indexOf(m)].content);
      for (const m of novas)
        st.historico.push({
          role: "user",
          content: mascaradas[msgs.indexOf(m)].content,
          em: horaDa(m),
        });

      const etiquetas = (chat.contact?.tags ?? [])
        .map((t) => t.name ?? t.tag?.name ?? "")
        .filter(Boolean);
      const base = {
        origem: "laco" as const,
        chatId: chat.id,
        nome: st.nome,
        telefone: st.telefone,
        recebidas: doCliente,
        ficha: st.ficha,
        anteriores: st.historico
          .filter((m) => m.role === "assistant")
          .slice(-2)
          .map((m) => m.content),
      };
      // O carro é detectado antes de responder: a mesma mensagem que cita o carro já avança a pergunta.
      const estoque = veiculosDisponiveis();
      for (const m of novas) {
        const i = msgs.indexOf(m);
        const anteriorIa = msgs
          .slice(0, i)
          .reverse()
          .find((x) => !doContato(x));
        const carro = veiculoMencionado(
          estoque,
          textoDa(m),
          anteriorIa ? textoDa(anteriorIa) : "",
          st.ficha?.veiculo ?? "",
        );
        if (carro && st.ficha)
          st.ficha.veiculo = carro.marca + " " + carro.modelo;
      }
      let r: RespostaIa;
      try {
        r = await responder(
          novas.length
            ? mascaradas.filter(
                (_, i) => horaDa(msgs[i]) > (st.fichaDesde ?? 0),
              )
            : conversa,
          {
            veiculos: estoque,
            nome: st.nome,
            etiquetas,
            fotosEnviadas: st.fotosEnviadas,
            ficha: st.ficha,
          },
        );
      } catch (erro) {
        auditarTurno({
          ...base,
          id: novoId(),
          desfecho: "erro",
          erro: (erro as Error).message.slice(0, 300),
        });
        throw erro;
      }
      if (r.plano?.semFotos && r.plano.veiculo)
        registrar(
          "foto",
          `${st.nome} pediu fotos do ${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}, mas ele não tem fotos na pasta FOTOS`,
        );
      if (!r.texto) {
        auditarTurno({ ...base, id: novoId(), desfecho: "descartado", r });
        continue;
      }
      // Resposta igual (ou quase) a uma das últimas da IA (ex.: o cliente mandou a mesma mensagem duas vezes): não repete.
      if (
        deveOmitir(
          r.texto,
          st.historico
            .filter((m) => m.role === "assistant")
            .map((m) => m.content),
          { transferir: r.transferir, fotos: r.plano?.fotos.length ?? 0 },
        )
      ) {
        registrar("crm", `${st.nome}: resposta repetida omitida`);
        auditarTurno({ ...base, id: novoId(), desfecho: "descartado", r });
        continue;
      }
      const rascunho: Rascunho = {
        id: novoId(),
        chatId: chat.id,
        nome: st.nome,
        pergunta: doCliente.join("\n"),
        texto: r.texto,
        transferir: r.transferir,
        encerrar: r.encerrar,
        fotos: r.plano?.fotos ?? [],
        veiculoFotos: r.plano?.veiculo
          ? `${r.plano.veiculo.marca} ${r.plano.veiculo.modelo}`
          : null,
        veiculoFotosId: r.plano?.veiculo?.id ?? null,
        inicioFotos: r.plano?.inicio ?? 0,
        em: Date.now(),
      };
      auditarTurno({
        ...base,
        id: rascunho.id,
        desfecho: cfg.enviarSemAprovacao ? "enviado" : "rascunho",
        r,
      });
      if (cfg.enviarSemAprovacao) {
        try {
          await entregar(rascunho);
        } catch (erro) {
          gravarDesfecho(ARQUIVO_AUDITORIA(), rascunho.id, "erro");
          throw erro;
        }
      } else {
        e.rascunhos.unshift(rascunho);
        registrar("rascunho", `${st.nome}: aguardando aprovação`);
      }
      atendidos++;
      // Grava já: se o app fechar na rodada, `vistoAte` e o histórico não voltam atrás (evita resposta repetida).
      gravar();
    }
    ultimaRodada = new Date().toISOString();
    ultimoErro = null;
    gravar();
    return { pulou: false, chats: chats.length, atendidos };
  } catch (erro) {
    const msg = (erro as Error).message;
    if (msg !== ultimoErro) registrar("erro", msg);
    ultimoErro = msg;
    throw erro;
  } finally {
    ocupado = false;
  }
}

let laco: ReturnType<typeof setInterval> | null = null;
/** Liga ou desliga o laço conforme as configurações. Chamado ao abrir o app e ao salvar. */
export function reiniciarLaco() {
  if (laco) clearInterval(laco);
  laco = null;
  const cfg = carregar().config;
  if (cfg.ligado && cfg.etiquetaGatilhoId)
    laco = setInterval(
      () => void rodar().catch(() => {}),
      Math.max(5, cfg.intervaloSeg) * 1000,
    );
}
/** Para o laço (ao fechar o app). */
export function pararLaco() {
  if (laco) clearInterval(laco);
  laco = null;
}
/** Liga os eventos para a tela e o laço, se estiver ligado nas configurações. */
export function iniciarPreAtendimento(emitir: Emitir) {
  definirEmissor(emitir);
  reiniciarLaco();
}

/** Situação do laço para o painel: rodando, última rodada e último erro. */
export function estadoDoLaco() {
  return { rodando: !!laco, ultimaRodada, ultimoErro };
}
