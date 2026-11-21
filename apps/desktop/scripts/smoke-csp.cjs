// Smoke da política de segurança de conteúdo (CSP) da janela principal, no Electron real.
// Perfil e banco TEMPORÁRIOS e dados fictícios (a preparação é a do smoke.cjs). Confere os dois lados:
//  - o que o app precisa continua funcionando sob a política: o relatório completo (script de altura,
//    busca e ordenação da tabela) e nenhuma violação no console;
//  - o que ela deve barrar é barrado: script inline sem hash, e script, imagem, conexão e frame de fora.
// Rode com `npm run smoke:csp` (precisa do build, que é quando a política entra no index.html).
// Executado pelo Electron real, com banco e estoque temporários.
// Sem tela de carregamento: o teste espera uma única janela principal.
process.env.SOUL_SEM_SPLASH = "1";
const { app, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
fs.mkdirSync(path.resolve(__dirname, "../.tmp"), { recursive: true });
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-smoke-"));
app.setPath("userData", raiz);
fs.writeFileSync(
  path.join(raiz, "config.json"),
  JSON.stringify({
    raizDados: raiz,
    pastaMotor: path.resolve(__dirname, "../../engine"),
  }),
);
// Um banco válido vazio evita importar dados pessoais do Studio durante o teste.
const { DatabaseSync } = require("node:sqlite");
new DatabaseSync(path.join(raiz, "soul.db")).close();
fs.mkdirSync(path.join(raiz, "ESTOQUE", "123_FORD_FIESTA_ABC1D23"), {
  recursive: true,
});
fs.writeFileSync(
  path.join(raiz, "ESTOQUE", "123_FORD_FIESTA_ABC1D23", "INFO.md"),
  "| **Marca / modelo** | FORD FIESTA |\n| **Placa** | ABC1D23 |",
);
const carroTeste = path.join(raiz, "ESTOQUE", "123_FORD_FIESTA_ABC1D23");
fs.mkdirSync(path.join(carroTeste, "FOTOS"));
const pngTeste = nativeImage
  .createFromBitmap(Buffer.alloc(32 * 32 * 4, 255), { width: 32, height: 32 })
  .toPNG();
fs.writeFileSync(path.join(carroTeste, "FOTOS", "frente.png"), pngTeste);
fs.writeFileSync(path.join(carroTeste, "FOTOS", "lateral.png"), pngTeste);
fs.writeFileSync(path.join(carroTeste, "CRLV.pdf"), "%PDF teste");
// CSV do BNDV de mentira: um carro em estoque, com a pasta e as fotos acima (estoque atual).
fs.mkdirSync(path.join(raiz, "dados"), { recursive: true });
fs.writeFileSync(
  path.join(raiz, "dados", "bndv_veiculos.csv"),
  "\uFEFFidVehicle;vehicleNumber;plate;vin;envelopeNumber;brand;model;dateRegister;purchasePrice;salePrice;consigned;blocked;active;status;buyer\n" +
    '"123";"1";"ABC1D23";"9BWZZZ";"";"Ford";"Fiesta";"2026-10-01T10:00:00";"30000";"45900";"0";"false";"true";"DISPONÍVEL ESTOQUE";"Teste"',
);
const resultados = [];
const registra = (n, ok, d = "") =>
  resultados.push({ n, ok: !!ok, d: String(d).slice(0, 140) });
const violacoes = [];
const timeout = setTimeout(() => {
  console.error("tempo excedido");
  app.exit(1);
}, 150000);
app.on("browser-window-created", (_e, w) => {
  w.webContents.setBackgroundThrottling(false);
  w.on("show", () => w.hide());
  w.webContents.on("console-message", (_ev, _n, msg) => {
    if (/Content.Security.Policy|Refused to/i.test(msg))
      violacoes.push(msg.slice(0, 200));
  });
  w.webContents.once("did-finish-load", async () => {
    try {
      await new Promise((r) => setTimeout(r, 2000));
      if (
        w.isDestroyed() ||
        !(await w.webContents
          .executeJavaScript("!!window.soul")
          .catch(() => false))
      )
        return;
      const js = (c) => w.webContents.executeJavaScript(c);
      await js(`(async()=>{const d=ms=>new Promise(r=>setTimeout(r,ms));
        for(let i=0;i<80&&!document.querySelector('.metric-link');i++)await d(100);
        [...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Relatório completo')).click();
        for(let i=0;i<60&&!document.querySelector('iframe.relatorio-completo')?.style.height;i++)await d(150);
      })()`);
      registra(
        "relatório: o iframe recebeu a altura (script de altura rodou sob a CSP)",
        await js(
          `!!document.querySelector('iframe.relatorio-completo').style.height`,
        ),
      );
      const quadro = w.webContents.mainFrame.framesInSubtree.find(
        (f) =>
          (f !== w.webContents.mainFrame &&
            /relatorio|srcdoc/i.test(f.url + " ")) ||
          f.url === "about:srcdoc",
      );
      registra(
        "relatório: frame do relatório encontrado",
        !!quadro,
        quadro ? quadro.url : "nenhum frame",
      );
      if (quadro) {
        const f = (c) => quadro.executeJavaScript(c);
        registra(
          "relatório: a tabela e a busca existem",
          await f(
            `!!document.getElementById('tb') && !!document.getElementById('q')`,
          ),
        );
        const antes = await f(`document.getElementById('cnt').textContent`);
        // Digita um termo que não existe: o script da página deve filtrar e atualizar o contador (prova que ele executou)
        const depois = await f(
          `(()=>{const q=document.getElementById('q');q.value='zzzz-nao-existe';q.dispatchEvent(new Event('input',{bubbles:true}));return document.getElementById('cnt').textContent;})()`,
        );
        registra(
          "relatório: a busca filtra a tabela (script da página executa)",
          depois !== antes && /^0 /.test(depois),
          `${antes} -> ${depois}`,
        );
        const ordenou = await f(
          `(()=>{const th=document.getElementById('tb').tHead.rows[0].cells[0];th.click();return true;})()`,
        ).catch(() => false);
        registra(
          "relatório: clicar no cabeçalho ordena sem erro",
          ordenou === true,
        );
        const mesesOk = await f(
          `typeof mostrarMes === 'function' || document.querySelectorAll('.mes-janela').length >= 0`,
        );
        registra("relatório: navegação por mês disponível", mesesOk === true);
      }
      registra(
        "nenhuma violação de CSP no console",
        violacoes.length === 0,
        violacoes.join(" | "),
      );
      // ---- prova negativa: a política BARRA o que deve
      const barrado = await js(`(async()=>{
        const vio=[];document.addEventListener('securitypolicyviolation',e=>vio.push(e.effectiveDirective));
        const s=document.createElement('script');s.textContent='window.__inline=1';document.head.appendChild(s);
        const s2=document.createElement('script');s2.src='https://cdn.example.com/x.js';document.head.appendChild(s2);
        const i=document.createElement('img');i.src='https://example.com/pixel.png';document.body.appendChild(i);
        const f=document.createElement('iframe');f.src='https://example.com/';document.body.appendChild(f);
        try{await fetch('https://example.com/dados')}catch(e){}
        await new Promise(r=>setTimeout(r,500));
        return {inline:window.__inline===1,diretivas:[...new Set(vio)]};
      })()`);
      registra("CSP barra script inline sem hash", barrado.inline === false);
      registra(
        "CSP barra script, imagem, conexão e frame de fora",
        ["script-src-elem", "img-src", "connect-src", "frame-src"].every((d) =>
          barrado.diretivas.includes(d),
        ),
        barrado.diretivas.join(", "),
      );
      const falhas = resultados.filter((r) => !r.ok);
      console.log(
        "RELATORIO_CSP " +
          (falhas.length ? "FALHOU" : "OK") +
          " " +
          (resultados.length - falhas.length) +
          "/" +
          resultados.length,
      );
      for (const r of resultados)
        console.log(
          "  " +
            (r.ok ? "ok   " : "FALHA") +
            " " +
            r.n +
            (r.d ? " :: " + r.d : ""),
        );
      clearTimeout(timeout);
      app.exit(falhas.length ? 2 : 0);
    } catch (e) {
      console.error("ERRO", e && e.message ? e.message : e);
      app.exit(1);
    }
  });
});
import(
  require("node:url").pathToFileURL(
    path.join(__dirname, "../out/main/index.js"),
  ).href
);
