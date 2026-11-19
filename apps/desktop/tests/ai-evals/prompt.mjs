/**
 * Prompt do eval do Pré-atendimento IA: usa a MESMA montagem do app (shared/pre-service.ts),
 * com loja padrão e estoque fictício, para o promptfoo testar o modelo local.
 */
import {
  montarMensagens,
  PERSONA_PADRAO,
  LOJA_PADRAO,
  RESPOSTAS_PADRAO,
} from "../../src/shared/pre-service.ts";
import { fichaDaConversa } from "../../src/shared/lead-profile.ts";

/** Estoque fictício (nunca dados reais da loja). */
const ESTOQUE = [
  {
    id: "t1",
    marca: "Honda",
    modelo: "Civic EXL 2.0 2019",
    placa: "ABC1D23",
    preco: "R$ 109.900",
    km: "84.000",
  },
  {
    id: "t2",
    marca: "Toyota",
    modelo: "Corolla XEi 2.0 2020",
    placa: "EFG4H56",
    preco: "R$ 124.900",
  },
  {
    id: "t3",
    marca: "Volkswagen",
    modelo: "T-Cross Comfortline 1.0 TSI 2021",
    placa: "IJK7L89",
    preco: "R$ 112.500",
  },
  {
    id: "t4",
    marca: "Chevrolet",
    modelo: "Onix LT 1.0 Turbo 2022",
    placa: "MNO0P12",
    preco: "R$ 79.900",
  },
];

/** Monta as mensagens a partir de vars.conversa (array JSON de {role, content}). */
export default async function ({ vars }) {
  const conversa =
    typeof vars.conversa === "string"
      ? JSON.parse(vars.conversa)
      : vars.conversa;
  const { mensagens } = montarMensagens({
    persona: PERSONA_PADRAO,
    loja: LOJA_PADRAO,
    config: { nomeAgente: "Sofia" },
    veiculos: ESTOQUE,
    respostas: RESPOSTAS_PADRAO,
    exemplos: [],
    reais: [],
    conversa,
    nomeLead: vars.nome ?? "Carlos",
    ficha: fichaDaConversa(conversa),
  });
  return mensagens;
}
