import { BrowserWindow, nativeImage, session } from "electron";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { userData } from "../caminhos";
import { selecionar } from "./banco";
import { montarPlanoInstagram } from "./instagram-plano";
import { InstagramBrowser } from "./instagram-browser";
import {
  contaInstagram,
  type PlanoInstagram,
  type RegistroInstagram,
  type EstadoInstagram,
} from "../../compartilhado/instagram";

let janela: BrowserWindow | null = null;
let trabalho: AbortController | null = null;
type Emitir = (nome: string, dados: unknown) => void;
const diretorio = () => path.join(userData(), "instagram");
const arquivoConta = () => path.join(diretorio(), "conta.json");
export function lerContaInstagram(): string {
  try {
    return JSON.parse(fs.readFileSync(arquivoConta(), "utf8")).conta || "";
  } catch {
    return "";
  }
}
export function salvarContaInstagram(valor: string) {
  if (trabalho)
    throw new Error(
      "Aguarde ou interrompa a publicação antes de trocar a conta.",
    );
  const conta = contaInstagram(valor);
  if (!/^[a-z0-9._]{1,30}$/.test(conta))
    throw new Error("Informe o nome de usuário do Instagram, sem URL.");
  fs.mkdirSync(diretorio(), { recursive: true });
  fs.writeFileSync(arquivoConta(), JSON.stringify({ conta }));
  return conta;
}
function caminhoRegistro(id: number, conta: string) {
  if (!Number.isSafeInteger(id) || id <= 0 || !/^[a-z0-9._]{1,30}$/.test(conta))
    throw new Error("Veículo ou conta inválidos.");
  return path.join(diretorio(), `${id}-${conta}.json`);
}
export function registroInstagram(
  id: number,
  conta = lerContaInstagram(),
): RegistroInstagram | null {
  if (!conta) return null;
  const arquivo = caminhoRegistro(id, conta);
  if (!fs.existsSync(arquivo)) return null;
  let registro: RegistroInstagram;
  try {
    registro = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    throw new Error(
      "O histórico do Instagram está ilegível. Confira o backup antes de publicar novamente.",
    );
  }
  const estados = [
    "pendente",
    "preparando",
    "publicando",
    "publicado",
    "conferir",
  ];
  if (
    !registro ||
    registro.veiculoId !== id ||
    registro.conta !== conta ||
    !estados.includes(registro.carrossel) ||
    !estados.includes(registro.reels) ||
    !/^[a-f0-9]{64}$/.test(registro.assinatura || "")
  ) {
    throw new Error(
      "O histórico do Instagram está inconsistente. Confira o backup antes de publicar novamente.",
    );
  }
  if (!trabalho) {
    for (const etapa of ["carrossel", "reels"] as const) {
      if (registro[etapa] === "publicando") registro[etapa] = "conferir";
      else if (registro[etapa] === "preparando") registro[etapa] = "pendente";
    }
  }
  return registro;
}
function gravarRegistro(registro: RegistroInstagram) {
  const alvo = caminhoRegistro(registro.veiculoId, registro.conta);
  fs.mkdirSync(diretorio(), { recursive: true });
  registro.atualizado = new Date().toISOString();
  const temporario = `${alvo}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(registro, null, 2));
  fs.renameSync(temporario, alvo);
}
export function planoInstagram(id: number, previas = true): PlanoInstagram {
  const v = selecionar(
    "SELECT id,nome,ano,pasta,des_md FROM veiculos WHERE id=$1",
    [id],
  )[0];
  if (!v) throw new Error("Veículo não encontrado.");
  const plano = montarPlanoInstagram(
    v as Parameters<typeof montarPlanoInstagram>[0],
  );
  if (previas)
    for (const midia of plano.arquivos) {
      if (midia.tipo === "video") continue;
      const imagem = nativeImage.createFromPath(midia.caminho);
      if (imagem.isEmpty())
        plano.pendencias.push(
          `O criativo ${midia.nome} não é uma imagem válida.`,
        );
      else midia.miniatura = imagem.resize({ width: 280 }).toDataURL();
    }
  return plano;
}
export function estadoInstagram(id: number): EstadoInstagram {
  return {
    aberto: !!janela && !janela.isDestroyed(),
    ocupado: !!trabalho,
    conta: lerContaInstagram(),
    registro: registroInstagram(id),
  };
}
function origemPermitida(url: string) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      ["instagram.com", "facebook.com", "meta.com"].some(
        (host) => u.hostname === host || u.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}
export async function abrirInstagram(pai: BrowserWindow, emitir: Emitir) {
  if (janela && !janela.isDestroyed()) {
    janela.show();
    janela.focus();
    return;
  }
  const particao = session.fromPartition("persist:instagram");
  particao.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
  janela = new BrowserWindow({
    width: 1200,
    height: 850,
    parent: pai,
    title: "Instagram — SOUL Cars",
    autoHideMenuBar: true,
    webPreferences: {
      partition: "persist:instagram",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  janela.webContents.setUserAgent(
    janela.webContents
      .getUserAgent()
      .replace(/\sElectron\/[^\s]+/g, "")
      .replace(/\ssoul-cars-app\/[^\s]+/g, ""),
  );
  const wc = janela.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (origemPermitida(url)) void wc.loadURL(url).catch(() => {});
    return { action: "deny" };
  });
  wc.on("will-navigate", (e, url) => {
    if (!origemPermitida(url)) e.preventDefault();
  });
  wc.on("will-redirect", (e, url) => {
    if (!origemPermitida(url)) e.preventDefault();
  });
  janela.on("closed", () => {
    trabalho?.abort();
    janela = null;
    emitir("instagram:log", "Janela do Instagram fechada.");
  });
  await janela.loadURL("https://www.instagram.com/");
  emitir(
    "instagram:log",
    "Entre no Instagram e confirme os avisos de login. Depois volte ao Studio e inicie a publicação.",
  );
}
export function cancelarInstagram() {
  trabalho?.abort();
}
export function encerrarInstagram() {
  trabalho?.abort();
  if (janela && !janela.isDestroyed()) janela.destroy();
}
function verificarPagina() {
  const url = new URL(janela!.webContents.getURL());
  if (
    url.protocol !== "https:" ||
    !["www.instagram.com", "instagram.com"].includes(url.hostname)
  )
    throw new Error(
      "Faça o login e volte para a página do Instagram antes de publicar.",
    );
}
export async function publicarInstagram(id: number, emitir: Emitir) {
  if (trabalho)
    throw new Error("Uma publicação do Instagram já está em andamento.");
  if (!janela || janela.isDestroyed())
    throw new Error("Abra o Instagram no app e faça o login primeiro.");
  const conta = lerContaInstagram();
  if (!conta)
    throw new Error("Informe e salve a conta do Instagram na etapa Instagram.");
  const plano = planoInstagram(id);
  if (plano.pendencias.length) throw new Error(plano.pendencias.join("\n"));
  const assinatura = createHash("sha256")
    .update(
      JSON.stringify({
        carrossel: plano.carrossel,
        reels: plano.reels,
        arquivos: plano.arquivos.map((f) => ({
          nome: f.nome,
          tamanho: fs.statSync(f.caminho).size,
          modificado: fs.statSync(f.caminho).mtimeMs,
        })),
      }),
    )
    .digest("hex");
  const registro = registroInstagram(id, conta) ?? {
    veiculoId: id,
    conta,
    carrossel: "pendente",
    reels: "pendente",
    atualizado: "",
    detalhe: "",
    assinatura,
  };
  if (registro.carrossel === "conferir" || registro.reels === "conferir")
    throw new Error(
      "Uma publicação anterior está sem confirmação. Confira o perfil e marque se ela foi publicada antes de retomar.",
    );
  if (registro.carrossel === "publicado" && registro.reels === "publicado")
    throw new Error(
      "O carrossel e o Reels deste veículo já foram publicados nesta conta.",
    );
  if (registro.assinatura !== assinatura && registro.carrossel === "publicado")
    throw new Error(
      "Os arquivos ou legendas mudaram após publicar o carrossel. Restaure o conjunto original para retomar o Reels.",
    );
  registro.assinatura = assinatura;
  const controller = new AbortController();
  trabalho = controller;
  const log = (texto: string) => emitir("instagram:log", texto);
  const navegador = new InstagramBrowser(
    janela.webContents,
    controller.signal,
    log,
    verificarPagina,
  );
  try {
    // O pacote aprovado permanece estável mesmo se o editor exportar novamente.
    const pacote = path.join(
      diretorio(),
      "pacotes",
      `${id}-${conta}-${assinatura.slice(0, 16)}`,
    );
    fs.mkdirSync(pacote, { recursive: true });
    for (const midia of plano.arquivos) {
      if (controller.signal.aborted) throw new Error("Automação interrompida.");
      const destino = path.join(pacote, midia.nome);
      await fs.promises.copyFile(midia.caminho, destino);
      midia.caminho = destino;
    }
    janela.show();
    janela.focus();
    const atual = await navegador.conta();
    if (!atual)
      throw new Error(
        "Não identifiquei a conta conectada. Faça login e deixe a página inicial do Instagram aberta, com o botão Perfil visível.",
      );
    if (atual !== conta)
      throw new Error(
        `A janela está conectada a @${atual}; a conta salva é @${conta}. Confira a conta antes de publicar.`,
      );
    log(`Conta conferida: @${conta}.`);
    for (const etapa of ["carrossel", "reels"] as const) {
      if (registro[etapa] === "publicado") {
        log("Carrossel já publicado; retomando somente o Reels.");
        continue;
      }
      registro[etapa] = "preparando";
      registro.detalhe = `Preparando ${etapa}.`;
      gravarRegistro(registro);
      const arquivos =
        etapa === "carrossel"
          ? plano.arquivos
              .filter((f) => f.tipo === "carrossel")
              .map((f) => f.caminho)
          : [plano.arquivos.find((f) => f.tipo === "video")!.caminho];
      log(
        etapa === "carrossel"
          ? "Publicando carrossel na ordem 2 → 1 → 3."
          : "Publicando vídeo editado como Reels com a capa de Tráfego Pago.",
      );
      await navegador.publicar(
        arquivos,
        etapa === "carrossel" ? plano.carrossel : plano.reels,
        etapa === "reels"
          ? plano.arquivos.find((f) => f.tipo === "capa")!.caminho
          : null,
        async () => {
          if ((await navegador.conta()) !== conta)
            throw new Error(
              "A conta conectada mudou durante a preparação. Não publiquei.",
            );
          registro[etapa] = "publicando";
          registro.detalhe = `Aguardando confirmação de ${etapa}.`;
          gravarRegistro(registro);
        },
      );
      registro[etapa] = "publicado";
      registro.detalhe = `${etapa} publicado e confirmado pelo Instagram.`;
      gravarRegistro(registro);
      emitir("instagram:registro", registro);
    }
    log("Carrossel e Reels publicados. Etapa Instagram concluída.");
    return registro;
  } catch (erro) {
    for (const etapa of ["carrossel", "reels"] as const) {
      if (registro[etapa] === "publicando") registro[etapa] = "conferir";
      else if (registro[etapa] === "preparando") registro[etapa] = "pendente";
    }
    registro.detalhe = String(erro);
    gravarRegistro(registro);
    emitir("instagram:registro", registro);
    throw erro;
  } finally {
    trabalho = null;
  }
}
export function confirmarInstagram(
  id: number,
  etapa: "carrossel" | "reels",
  publicado: boolean,
) {
  if (trabalho) throw new Error("Aguarde ou interrompa a publicação atual.");
  const registro = registroInstagram(id);
  if (
    !registro ||
    !["carrossel", "reels"].includes(etapa) ||
    registro[etapa] !== "conferir"
  )
    throw new Error("Não há publicação sem confirmação nesta etapa.");
  registro[etapa] = publicado ? "publicado" : "pendente";
  registro.detalhe = `${etapa}: resultado conferido manualmente no Instagram.`;
  gravarRegistro(registro);
  return registro;
}
