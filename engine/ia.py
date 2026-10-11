"""Textos de anúncio com Claude (API da Anthropic).

A IA escreve só a parte criativa (chamadas, destaques escolhidos, títulos). Preço, km,
ano e demais fatos continuam vindo da ficha, montados pelo gerador do DES.md no app,
para que nenhum número seja inventado.
"""

from __future__ import annotations

import json

MODELO = "claude-opus-5"

SCHEMA = {
    "type": "object",
    "properties": {
        "textos": {
            "type": "array",
            "description": "Exatamente 5 variações do texto principal.",
            "items": {
                "type": "object",
                "properties": {
                    "chamada": {"type": "string", "description": "1 ou 2 frases curtas de abertura, com no máximo 1 emoji."},
                    "destaques": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "3 equipamentos copiados literalmente da lista fornecida.",
                    },
                    "cta": {"type": "string", "description": "Chamada para ação curta, começando com 📲."},
                },
                "required": ["chamada", "destaques", "cta"],
                "additionalProperties": False,
            },
        },
        "titulos": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Exatamente 5 títulos em MAIÚSCULAS, até 40 caracteres cada.",
        },
        "whatsapp": {"type": "string", "description": "Uma frase curta e convidativa para abrir a mensagem de WhatsApp."},
    },
    "required": ["textos", "titulos", "whatsapp"],
    "additionalProperties": False,
}

SYSTEM = """Você é redator de anúncios de veículos seminovos da loja {loja}, para Meta Ads (Facebook e Instagram) em São Paulo.
Escreva em português do Brasil, tom confiante e próximo, sem exageros nem clichês vazios.

Regras:
- Use somente informações da ficha. Não invente equipamentos, garantia, financiamento, revisões, histórico ou condição do veículo.
- Não escreva preço, quilometragem, ano ou cor nos textos: esses dados são inseridos automaticamente em outra parte.
- "destaques": escolha 3 itens COPIADOS LITERALMENTE da lista de equipamentos, variando entre os 5 textos e priorizando o que mais atrai compradores. Se a lista tiver menos de 3 itens, use os que existirem.
- Itens marcados como [OPCIONAL — confirmar no veículo] não podem ser destaques.
- Cada um dos 5 textos deve ter um ângulo diferente (ex.: economia, conforto, tecnologia, segurança, oportunidade).
- Títulos: MAIÚSCULAS, até 40 caracteres, incluindo o nome do modelo em pelo menos 3 deles.
- Evite promessas enganosas e termos proibidos em anúncios (ex.: "garantido", "o melhor do Brasil")."""


def _chave(params: dict) -> str:
    chave = (params.get("api_key") or "").strip()
    if not chave:
        raise ValueError("Configure a chave da API da Anthropic na tela Sistema.")
    return chave


def gerar_textos(params: dict) -> dict:
    import anthropic

    ficha = params["ficha"]
    loja = params.get("loja") or "Soul Cars Veículos"
    equipamentos = [
        linha.strip()
        for campo in ("seguranca", "conforto", "infotenimento")
        for linha in (ficha.get(campo) or "").splitlines()
        if linha.strip()
    ]
    dados = {
        "nome": ficha.get("nome"), "ano": ficha.get("ano"), "motor": ficha.get("versao"),
        "cambio": ficha.get("cambio"), "combustivel": ficha.get("combustivel"),
        "configuracao": ficha.get("configuracao"), "lugares": ficha.get("lugares"), "portas": ficha.get("portas"),
        "direcao": ficha.get("direcao"), "equipamentos": equipamentos,
    }

    client = anthropic.Anthropic(api_key=_chave(params), max_retries=2)
    try:
        response = client.beta.messages.create(
            model=MODELO,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
            system=SYSTEM.format(loja=loja),
            messages=[{"role": "user", "content": "Ficha do veículo (JSON):\n" + json.dumps(dados, ensure_ascii=False, indent=2)}],
        )
    except anthropic.AuthenticationError as exc:
        raise ValueError("Chave da API inválida. Confira na tela Sistema.") from exc
    except anthropic.PermissionDeniedError as exc:
        raise ValueError("A chave não tem permissão para usar o modelo.") from exc
    except anthropic.RateLimitError as exc:
        raise ValueError("Limite de uso da API atingido. Tente novamente em instantes.") from exc
    except anthropic.APIStatusError as exc:
        raise ValueError(f"Erro da API ({exc.status_code}): {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise ValueError("Sem conexão com a API da Anthropic.") from exc

    if response.stop_reason == "refusal":
        raise ValueError("A IA recusou gerar este texto. Revise a ficha e tente novamente.")
    if response.stop_reason == "max_tokens":
        raise ValueError("A resposta da IA foi cortada. Tente novamente.")
    texto = next((b.text for b in response.content if b.type == "text"), "")
    resultado = json.loads(texto)

    # Garante que destaques existem na lista (nada inventado) e ajusta quantidades.
    permitidos = {e.casefold(): e for e in equipamentos if "OPCIONAL" not in e}
    for t in resultado["textos"]:
        t["destaques"] = [permitidos[d.casefold()] for d in t["destaques"] if d.casefold() in permitidos][:3]
    resultado["textos"] = resultado["textos"][:5]
    resultado["titulos"] = [t.strip().upper() for t in resultado["titulos"]][:5]
    resultado["uso"] = {"entrada": response.usage.input_tokens, "saida": response.usage.output_tokens}
    return resultado
