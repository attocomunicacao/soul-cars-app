/**
 * Entrega ao uTalk: envia a resposta, as fotos e atualiza as etiquetas do contato.
 *
 * Junto com `utalk-writer.ts`, é o único ponto do app que escreve no uTalk: texto, fotos, etiquetas
 * de gatilho e transferência e a nota privada do cliente para o SDR.
 */
import fs from "node:fs";
import path from "node:path";
import { tokenUtalk } from "../crm/utalk";
import { descobrirOrganizacao } from "../crm/utalk-api";
import {
  FICHA_VAZIA,
  motivoDaTransferencia,
  pediuHumano,
  resumoParaSdr,
} from "../../shared/lead-profile";
import { lerSegredo } from "./secrets";
import {
  buscar,
  carregar,
  registrar,
  type EstadoChat,
  type Rascunho,
} from "./state";
import { clienteEscrita, type ClienteEscrita } from "./utalk-writer";

// ------------------------------------------------------------ uTalk
let org: { token: string; id: string } | null = null;
export async function cliente(): Promise<ClienteEscrita> {
  const token = tokenUtalk();
  if (!token)
    throw new Error("Cadastre o token do uTalk em Configurações → Conexões.");
  if (!org || org.token !== token)
    org = { token, id: (await descobrirOrganizacao(buscar, token)).id };
  return clienteEscrita(buscar, token, org.id);
}

export async function contatoDo(c: ClienteEscrita, st: EstadoChat) {
  if (!st.contatoId)
    st.contatoId = (await c.chat(st.chatId))?.contact?.id ?? null;
  if (!st.contatoId) throw new Error("contato do chat não encontrado");
  return st.contatoId;
}
/** Tira a etiqueta onde ela estiver (contato e/ou chat); só falha se não sair de nenhum. */
export async function tirarEtiqueta(
  c: ClienteEscrita,
  st: EstadoChat,
  etiquetaId: string,
) {
  const erros: unknown[] = [];
  await c
    .tirarEtiqueta(await contatoDo(c, st), etiquetaId)
    .catch((e) => erros.push(e));
  await c
    .tirarEtiquetaDoChat(st.chatId, etiquetaId)
    .catch((e) => erros.push(e));
  if (erros.length === 2) throw erros[0];
}

/** Nota do cliente: sempre que a IA transfere, vai ao SDR em nota privada no chat (e fica no painel, sem CPF). */
async function entregarResumo(c: ClienteEscrita, st: EstadoChat) {
  const f = (st.ficha ??= FICHA_VAZIA);
  const ultimo = st.historico.filter((m) => m.role === "user").at(-1)?.content;
  const nota = resumoParaSdr(f, {
    nome: st.nome,
    motivo: motivoDaTransferencia(f, {
      pediuHumano: pediuHumano(ultimo ?? ""),
    }),
    cpfPlano: lerSegredo(f.cpf) || undefined,
    nascimentoPlano: lerSegredo(f.nascimento) || undefined,
  });
  try {
    await c.notaPrivada(st.chatId, nota);
    registrar(
      "crm",
      st.nome + ": nota do cliente enviada ao SDR (nota privada)",
    );
  } catch (erro) {
    registrar(
      "erro",
      st.nome +
        ": nota privada não criada — " +
        (erro as Error).message.slice(0, 120),
    );
  }
  f.entregue = true;
}

/** Envia o texto, depois as fotos em ordem, e aplica transferência/encerramento nas etiquetas do contato. */
export async function entregar(r: Rascunho) {
  const e = carregar();
  const c = await cliente();
  const st = e.chats[r.chatId];
  if (!st) throw new Error("Lead não encontrado.");
  // Não transfere na primeira mensagem da IA (o lead precisa ter conversado antes), salvo se ele mesmo pediu para falar com alguém.
  const ultimoDoLead = st.historico.filter((m) => m.role === "user").at(-1);
  const transferir =
    r.transferir &&
    (st.historico.some((m) => m.role === "assistant") ||
      pediuHumano(ultimoDoLead?.content ?? ""));
  // Texto primeiro: as imagens demoram mais no uTalk e chegariam na frente.
  await c.enviar(r.chatId, r.texto);
  let enviadas = 0;
  for (const f of r.fotos) {
    try {
      await c.enviarArquivo(r.chatId, path.basename(f), fs.readFileSync(f));
      enviadas++;
    } catch (erro) {
      registrar(
        "erro",
        `${st.nome}: foto não enviada (${path.basename(f)}) — ${(erro as Error).message.slice(0, 120)}`,
      );
    }
  }
  if (enviadas && r.veiculoFotosId) {
    st.fotosEnviadas[r.veiculoFotosId] = r.inicioFotos + enviadas; // "mais fotos" continua daqui
    registrar(
      "foto",
      `${st.nome}: ${enviadas} fotos do ${r.veiculoFotos} enviadas`,
    );
  }
  st.historico.push({ role: "assistant", content: r.texto, em: Date.now() });
  st.ultimaIaEm = Date.now();
  if (transferir || r.encerrar) {
    const falha = (erro: unknown) =>
      registrar(
        "erro",
        `${st.nome}: etiqueta não atualizada — ${(erro as Error).message}`,
      );
    if (transferir && e.config.etiquetaTransferenciaId)
      await c
        .porEtiqueta(await contatoDo(c, st), e.config.etiquetaTransferenciaId)
        .catch(falha);
    st.gatilhoRetirado = await tirarEtiqueta(c, st, e.config.etiquetaGatilhoId)
      .then(() => true)
      .catch((erro) => {
        falha(erro);
        return false;
      });
    if (transferir) await entregarResumo(c, st);
    st.status = r.encerrar ? "encerrado" : "humano";
  }
  registrar("envio", `→ ${st.nome}: ${r.texto}`);
}
