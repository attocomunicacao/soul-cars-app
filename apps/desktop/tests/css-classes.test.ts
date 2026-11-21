/**
 * Guarda (Vitest): toda classe CSS escrita como texto fixo em `className="..."` no renderer precisa ter
 * um seletor nas folhas de estilo. Pega o erro de marcar um componente e esquecer de estilizá-lo
 * (aconteceu com a barra de progresso do vídeo, que ficou sem nenhum estilo).
 * Classes montadas dinamicamente (`className={...}`) ficam de fora: o teste só vê texto fixo.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "../src/renderer");

function arquivos(pasta: string, ext: RegExp, saida: string[] = []): string[] {
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isDirectory()) {
      if (e.name !== "creative-editor") arquivos(p, ext, saida);
    } else if (ext.test(e.name)) saida.push(p);
  }
  return saida;
}

/** Classes que existem só como marcador (sem estilo próprio, de propósito). */
const SEM_ESTILO_DE_PROPOSITO = new Set<string>([
  "funil", // contêiner do painel Funil; os filhos (`funil-*`) têm estilo
  "saude", // contêiner do painel de saúde das campanhas; os filhos (`saude-*`) têm estilo
]);

describe("classes CSS do renderer", () => {
  it("toda classe fixa de className tem seletor em alguma folha de estilo", () => {
    const css = arquivos(RAIZ, /\.css$/)
      .map((f) => fs.readFileSync(f, "utf8"))
      .join("\n");
    const seletores = new Set(
      [...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]),
    );
    const faltando = new Map<string, string>();
    for (const f of arquivos(RAIZ, /\.tsx$/)) {
      const fonte = fs.readFileSync(f, "utf8");
      for (const m of fonte.matchAll(/className="([^"{}$]+)"/g))
        for (const classe of m[1].trim().split(/\s+/))
          if (!seletores.has(classe) && !SEM_ESTILO_DE_PROPOSITO.has(classe))
            faltando.set(classe, path.relative(RAIZ, f));
    }
    expect(
      [...faltando].map(([c, f]) => `${c} (${f})`),
      "classes sem seletor",
    ).toEqual([]);
  });
});
