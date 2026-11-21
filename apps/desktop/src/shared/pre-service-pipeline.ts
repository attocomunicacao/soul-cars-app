/**
 * Pós-processamento da resposta do modelo no Pré-atendimento IA (puro, sem Electron): transforma o
 * texto bruto do LLM no texto final que vai ao cliente (tags, transferência forçada, pergunta do
 * sistema, lista completa, limpeza anti-duplicação). É o mesmo código usado pelo laço do app, pelo
 * simulador "Ensinar" e pelo Laboratório de testes, para que os testes valham para a produção.
 */
import {
  interpretarResposta,
  listaDeVeiculos,
  normalizar,
  pediuLista,
  type MensagemIa,
  type VeiculoIa,
} from "./pre-service";
import {
  anexarPergunta,
  coletaAtiva,
  coletaCompleta,
  fecharTransferencia,
  pediuHumano,
  podeTransferir,
  proximaPergunta,
  type FichaLead,
} from "./lead-profile";
import {
  JANELA_REPETICAO,
  guardarTexto,
  respostaRepetida,
} from "./pre-service-guard";

export type EntradaPosProcesso = {
  /** Texto cru devolvido pelo modelo. */
  bruto: string;
  conversa: MensagemIa[];
  ficha?: FichaLead;
  veiculos: VeiculoIa[];
  /** Quantas fotos serão enviadas depois do texto (0 se nenhuma). */
  fotos: number;
  /** Respostas anteriores da IA nesta conversa, da mais antiga para a mais nova. */
  anteriores: string[];
};

/** Resultado do pós-processamento: o texto final e as decisões de transferência/encerramento. */
export type SaidaPosProcesso = {
  texto: string;
  transferir: boolean;
  encerrar: boolean;
  /** Próxima pergunta do sistema (null quando a coleta acabou ou não começou). */
  proximaFrase: string | null;
};

/**
 * Aplica as regras do sistema sobre a resposta do modelo, na ordem de produção:
 * interpretar tags → decidir transferência → montar o texto → limpar repetições.
 */
export function posProcessar(e: EntradaPosProcesso): SaidaPosProcesso {
  const { conversa, ficha: f, veiculos } = e;
  const ultimaDoLead =
    conversa.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const humano = pediuHumano(ultimaDoLead);
  const lido = interpretarResposta(e.bruto, conversa, {
    bloquearTransferencia: !!f && !podeTransferir(f, { pediuHumano: humano }),
  });
  // Qualificação completa, cliente que recusa ou que pede alguém: a transferência não depende de o modelo lembrar da tag.
  const proxima =
    f && !f.entregue && coletaAtiva(f) ? proximaPergunta(f) : null;
  // O modelo prometeu "um consultor vai ligar" e não há mais nada a perguntar: transfere de verdade.
  const prometeu =
    /consultor (vai|ira|entrara|continua)/.test(normalizar(lido.texto)) &&
    !proxima;
  const forcar =
    !!f &&
    !f.entregue &&
    (coletaCompleta(f) || f.recusou || humano || prometeu);
  const transferir = lido.transferir || (forcar && !lido.encerrar);
  // O texto do modelo passa pelo guarda antes de receber a pergunta do sistema (que pode repetir de propósito).
  let texto = guardarTexto(lido.texto, e.anteriores);
  const pediuTodos =
    pediuLista(ultimaDoLead) && veiculos.length > 0 && e.fotos === 0;
  if (f && transferir) texto = fecharTransferencia(texto, f);
  else if (pediuTodos && !lido.encerrar) {
    const lista = listaDeVeiculos(veiculos);
    // A lista já foi enviada há pouco: não manda de novo, só lembra e segue a conversa.
    const cabecalho = lista.split("\n")[0];
    const jaEnviada = e.anteriores
      .slice(-JANELA_REPETICAO)
      .some((a) => a.includes(cabecalho));
    texto = jaEnviada
      ? "Essa é a nossa lista completa, que acabei de te enviar acima. Algum desses carros te interessou?"
      : lista + (proxima ? `\n\n${proxima.frase}` : "");
  } else if (proxima && !lido.encerrar && e.fotos === 0)
    texto = anexarPergunta(
      texto,
      proxima.frase,
      proxima.campos,
      // Modelo calado e o cliente só deu o dado (sem perguntar nada): confirma com "Anotado!".
      !ultimaDoLead.includes("?"),
    );
  return {
    texto,
    transferir,
    encerrar: lido.encerrar,
    proximaFrase: proxima?.frase ?? null,
  };
}

/**
 * A resposta deve ser omitida por repetir as últimas da IA? Transferência e envio de fotos nunca
 * são omitidos (têm efeito além do texto).
 */
export function deveOmitir(
  texto: string,
  anteriores: string[],
  opcoes: { transferir: boolean; fotos: number },
): boolean {
  if (opcoes.transferir || opcoes.fotos > 0) return false;
  return respostaRepetida(texto, anteriores);
}
