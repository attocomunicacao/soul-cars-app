/**
 * Hook do Claude Code (PreToolUse, ferramenta Bash): impede `git add` e `git commit` que levariam
 * segredos, bancos, dados de loja ou relatórios internos para o repositório, que é PÚBLICO.
 *
 * Lê o JSON do hook no stdin ({ tool_input: { command } }). Se o comando não for git add/commit,
 * sai com 0 sem fazer nada. Se achar algo suspeito, sai com 2 e escreve o motivo no stderr, o que
 * bloqueia a chamada e mostra a mensagem ao agente. Sem dependências além do Node e do git.
 */
import { execFileSync } from "node:child_process";

/** Caminhos que nunca devem ser versionados. */
const CAMINHOS_PROIBIDOS = [
  [/(^|\/)\.env(\.|$)/, "arquivo .env"],
  [/\.(db|sqlite|sqlite3|pem|key|pfx|p12)$/i, "banco, chave ou certificado"],
  [/(^|\/)dados-loja\//, "pasta dados-loja (dados reais da loja)"],
  [/(^|\/)pre-atendimento[^/]*\.jsonl?$/, "estado ou auditoria do Pré-atendimento (conversas de clientes)"],
  [/(^|\/)crm-leads\/cache\.json$/, "cache de leads (telefone e e-mail de clientes)"],
  [/(^|\/)dados\/[^/]*\.csv$/i, "CSV de dados da loja"],
  [/(^|\/)soul-cars-relatorios\//, "relatórios internos (devem ficar fora do repositório)"],
  [/\.part$/, "download parcial"],
];

/** Trechos de conteúdo que parecem segredo. */
const CONTEUDO_PROIBIDO = [
  [/gsk_[A-Za-z0-9]{20,}/, "chave do Groq"],
  [/Bearer\s+[A-Za-z0-9._-]{30,}/, "token Bearer"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada"],
];

// stderr do git fica quieto: fora de um repositório o hook simplesmente não verifica nada.
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });

/** Arquivos que entrarão no commit: o que já está preparado e, se for `add` amplo, tudo que mudou. */
function arquivosCandidatos(comando) {
  const lista = new Set(git("diff", "--cached", "--name-only", "-z").split("\0").filter(Boolean));
  if (/\bgit\s+add\b[^|;&]*(\s-A\b|\s--all\b|\s\.(\s|$)|\s-u\b)/.test(comando) || /\bgit\s+commit\b[^|;&]*\s-a/.test(comando)) {
    for (const item of git("status", "--porcelain=v1", "-z").split("\0")) {
      if (item.length > 3) lista.add(item.slice(3));
    }
  }
  return [...lista];
}

let entrada = "";
for await (const parte of process.stdin) entrada += parte;

let comando = "";
try {
  comando = String(JSON.parse(entrada)?.tool_input?.command ?? "");
} catch {
  process.exit(0); // formato inesperado: não bloqueia por engano
}

if (!/\bgit\s+(add|commit)\b/.test(comando)) process.exit(0);

const problemas = [];
try {
  for (const arquivo of arquivosCandidatos(comando)) {
    for (const [regra, motivo] of CAMINHOS_PROIBIDOS) {
      if (regra.test(arquivo.replaceAll("\\", "/"))) problemas.push(`${arquivo}: ${motivo}`);
    }
  }
  if (/\bgit\s+commit\b/.test(comando)) {
    const adicionado = git("diff", "--cached", "-U0")
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .join("\n");
    for (const [regra, motivo] of CONTEUDO_PROIBIDO) {
      if (regra.test(adicionado)) problemas.push(`conteúdo preparado para commit parece conter ${motivo}`);
    }
  }
} catch {
  process.exit(0); // fora de um repositório git ou git indisponível: nada a verificar
}

if (problemas.length) {
  console.error(
    "Bloqueado: o repositório do GitHub é público e este commit levaria dados que não podem ir para lá.\n" +
      problemas.map((p) => ` - ${p}`).join("\n") +
      "\nRetire esses itens do commit (git restore --staged <arquivo>) ou, se for um falso positivo, peça ao dono para liberar.",
  );
  process.exit(2);
}
process.exit(0);
