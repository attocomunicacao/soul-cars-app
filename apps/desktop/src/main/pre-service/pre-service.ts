/**
 * Pré-atendimento IA no processo principal (portado do Soul IA): o laço que atende pelo WhatsApp
 * (uTalk) os leads com a etiqueta de gatilho, o envio de fotos das pastas do ESTOQUE, os rascunhos
 * para aprovação, o simulador "Ensinar" e as configurações.
 *
 * Reaproveita o que o app já tem: o token do uTalk (crm/utalk), o estoque baixado do BNDV
 * (`dados/bndv_veiculos.csv`, só "DISPONÍVEL ESTOQUE" e ativos), as pastas `ESTOQUE/<id>_…/FOTOS` e a
 * memória das conversas da Soul IA (exemplos reais). O estado fica em `pre-atendimento.json` na pasta
 * interna do app; a chave do Groq fica cifrada (safeStorage) no config.json e nunca volta à interface.
 * O laço só roda com "ligado" marcado nas Configurações (desligado por padrão).
 *
 * Este arquivo é só a porta de entrada: reexporta a API pública (usada por `ipc/commands.ts` e pelo
 * Laboratório). O código mora em módulos pequenos, cada um dependendo só dos de cima:
 *
 *   state          estado em disco, gravar e registrar eventos
 *   secrets        ficha cifrada do lead e chave do Groq        (usa state)
 *   stock          estoque e fotos que a IA enxerga
 *   real-examples  exemplos reais da equipe                     (usa state)
 *   reply          resposta da IA a uma conversa                (usa state, secrets, stock, real-examples)
 *   turn-audit     auditoria dos turnos                         (usa reply)
 *   simulator      simulador "Ensinar" e contexto do Laboratório
 *   delivery       entrega ao uTalk                             (usa state, secrets)
 *   loop           laço que atende os leads                     (usa reply, delivery, turn-audit)
 *   panel          comandos da tela                             (usa loop, delivery e os demais)
 */
export type { Rascunho } from "./state";
export { auditoria, auditoriaParaLab } from "./turn-audit";
export { atendimentoLigado, contextoDoLab, simular } from "./simulator";
export { veiculosDisponiveis, fotosDo } from "./stock";
export { rodar, reiniciarLaco, pararLaco, iniciarPreAtendimento } from "./loop";
export {
  painel,
  salvarChaveGroq,
  salvarConfig,
  salvarLoja,
  salvarPersona,
  salvarResposta,
  removerResposta,
  salvarExemplo,
  removerExemplo,
  aprovar,
  descartar,
  esquecerChat,
  reativar,
  etiquetasUtalk,
  importarRespostas,
  modelos,
  recalcularExemplos,
} from "./panel";
