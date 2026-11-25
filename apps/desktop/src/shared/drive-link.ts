/**
 * Interpreta o link de uma pasta do Google Drive e devolve o ID dela.
 *
 * Regra pura (sem Electron): usada pela tela de configuração e pela busca da pasta
 * sincronizada pelo Google Drive para Desktop.
 */

const ID_PASTA = /^[A-Za-z0-9_-]{10,}$/;

/**
 * Extrai o ID da pasta de um link do Drive (`/folders/<id>`, `?id=<id>`, `/u/0/folders/<id>`)
 * ou aceita o próprio ID colado. Devolve `null` se não parecer uma pasta do Drive.
 */
export function extrairIdPastaDrive(entrada: string): string | null {
  const texto = entrada.trim();
  if (!texto) return null;
  if (ID_PASTA.test(texto)) return texto;
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "drive.google.com")
    return null;
  const dePasta = /\/folders\/([A-Za-z0-9_-]+)/.exec(url.pathname)?.[1];
  const id = dePasta ?? url.searchParams.get("id");
  return id && ID_PASTA.test(id) ? id : null;
}
