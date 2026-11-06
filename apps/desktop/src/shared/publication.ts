/** Blocos de cópia a partir do "# ANUNCIO" do DES.md. Porta do publish.js do sistema HTML anterior. */

export type BlocoCopia = { label: string; text: string };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const SPLIT = new Set(["TITULOS", "DESCRICOES"]);
const SINGLE = new Set([
  "MENSAGEM DE BOAS-VINDAS",
  "MENSAGEM PRONTA",
  "MENSAGEM PARA O WHATSAPP",
]);
const LABELS: Record<string, string> = {
  TITULOS: "Título",
  DESCRICOES: "Descrição",
};

function sections(markdown: string) {
  const found: { name: string; body: string }[] = [];
  let inside = false;
  let current: { name: string; body: string[] } | null = null;
  const close = () => {
    if (current) {
      const body = current.body.join("\n").replace(/^\s+|\s+$/g, "");
      if (body) found.push({ name: current.name, body });
    }
    current = null;
  };
  for (const line of markdown.split(/\r?\n/)) {
    if (/^#\s+/.test(line)) {
      close();
      inside = norm(line.replace(/^#\s+/, "")) === "ANUNCIO";
      continue;
    }
    if (!inside) continue;
    if (/^##\s+/.test(line)) {
      close();
      current = { name: norm(line.replace(/^##\s+/, "")), body: [] };
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      close();
      continue;
    }
    current?.body.push(line);
  }
  close();
  return found;
}

export function blocosDeCopia(markdown: string): BlocoCopia[] {
  const list: BlocoCopia[] = [];
  for (const section of sections(markdown)) {
    if (/^\d+\.\s*TEXTO PRINCIPAL$/.test(section.name)) {
      list.push({
        label: section.name.replace(/\.\s*/, ". "),
        text: section.body,
      });
      continue;
    }
    if (section.name === "NOME DA CAMPANHA") {
      const first = section.body.split(/\n\s*\n/)[0].trim();
      if (first) list.push({ label: "Nome da campanha", text: first });
      continue;
    }
    if (SPLIT.has(section.name)) {
      section.body
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((text, i) =>
          list.push({ label: `${LABELS[section.name]} ${i + 1}`, text }),
        );
      continue;
    }
    if (SINGLE.has(section.name))
      list.push({ label: section.name, text: section.body });
  }
  return list;
}
