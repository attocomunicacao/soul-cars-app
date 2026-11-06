// Instagram simulado em uma sessão temporária. Nenhum acesso à conta real.
const { app, BrowserWindow, nativeImage, session } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-ig-smoke-"));
app.setPath("userData", raiz);
fs.writeFileSync(
  path.join(raiz, "config.json"),
  JSON.stringify({ raizDados: raiz }),
);
const timeout = setTimeout(() => {
  console.error("SMOKE INSTAGRAM: tempo excedido");
  app.exit(1);
}, 120000);
app.on("browser-window-created", (_e, w) => {
  w.webContents.setBackgroundThrottling(false);
  w.on("show", () => w.hide());
});
app.whenReady().then(async () => {
  const modulo = require("../.tmp/instagram-smoke.cjs");
  const pai = new BrowserWindow({ show: false });
  const html = fs.readFileSync(
    path.resolve(__dirname, "../tests/fixtures/instagram.html"),
    "utf8",
  );
  await session
    .fromPartition("persist:instagram")
    .protocol.handle("https", (req) => {
      assert.equal(new URL(req.url).hostname, "www.instagram.com");
      return new Response(html, {
        headers: { "content-type": "text/html;charset=utf-8" },
      });
    });
  const logs = [];
  const emitir = (nome, dados) => {
    if (nome === "instagram:log") logs.push(dados);
  };
  const pasta = path.join(raiz, "RENEGADE");
  fs.mkdirSync(path.join(pasta, "CRIATIVO"), { recursive: true });
  const png = nativeImage
    .createFromBitmap(Buffer.alloc(32 * 32 * 4, 255), { width: 32, height: 32 })
    .toPNG();
  for (const nome of [1, 2, 3]
    .map((n) => `jeep-renegade-2020-carrossel-${n}.png`)
    .concat("jeep-renegade-2020-trafego-pago.png"))
    fs.writeFileSync(path.join(pasta, "CRIATIVO", nome), png);
  fs.writeFileSync(path.join(pasta, "VIDEO_RENEGADE.mp4"), "video sintético");
  const des =
    "# ANUNCIO\n## 1. TEXTO PRINCIPAL\nLegenda do carrossel\nLinha 2 #soul\n## 2. TEXTO PRINCIPAL\nLegenda do Reels";
  let numeroVeiculo = 0;
  const criarVeiculo = () => {
    const copia = path.join(raiz, `RENEGADE_${++numeroVeiculo}`);
    fs.cpSync(pasta, copia, { recursive: true });
    return modulo.executar(
      "INSERT INTO veiculos(nome,ano,pasta,des_md) VALUES($1,$2,$3,$4)",
      ["Jeep Renegade", "2020", copia, des],
    ).lastInsertId;
  };
  try {
    fs.mkdirSync(path.join(raiz, "dados"), { recursive: true });
    fs.writeFileSync(
      path.join(raiz, "dados", "bndv_veiculos.csv"),
      "idVehicle;active;plate;purchasePrice;salePrice;dateRegister\n1;true;ABC1D23;10000;15000;2023-01-01",
    );
    fs.writeFileSync(
      path.join(raiz, "dados", "bndv_vendas.csv"),
      "idVehicle;idSale;date;price\n1;1;2024-01-15;15000",
    );
    await pai.loadFile(modulo.gerarHtml());
    const grafico = await pai.webContents.executeJavaScript(`(() => {
      const antes = document.querySelector('#mes-periodo').textContent;
      const meses = document.querySelector('.mes-janela:not([hidden])').querySelectorAll('svg .eixo').length;
      if (!document.querySelector('#mes-proximo').disabled) throw Error('Gráfico não começa nos últimos meses');
      document.querySelector('#mes-anterior').click();
      const anterior = document.querySelector('#mes-periodo').textContent;
      document.querySelector('#mes-proximo').click();
      return { meses, mudou: antes !== anterior, voltou: antes === document.querySelector('#mes-periodo').textContent };
    })()`);
    assert.deepEqual(grafico, { meses: 12, mudou: true, voltou: true });
    modulo.salvarContaInstagram("@soulcars_teste");
    await modulo.abrirInstagram(pai, emitir);
    const wc = BrowserWindow.getAllWindows().find((w) => w !== pai).webContents;
    assert.equal(
      await wc.executeJavaScript(
        "typeof window.soul === 'undefined' && typeof require === 'undefined'",
      ),
      true,
    );
    const id = criarVeiculo();
    modulo.salvarContaInstagram("conta_errada");
    await assert.rejects(
      () => modulo.publicarInstagram(id, emitir),
      /a conta salva/,
    );
    assert.equal(await wc.executeJavaScript("window.posts.length"), 0);
    modulo.salvarContaInstagram("soulcars_teste");
    const registro = await modulo.publicarInstagram(id, emitir);
    assert.equal(registro.carrossel, "publicado");
    assert.equal(registro.reels, "publicado");
    const posts = await wc.executeJavaScript("window.posts");
    assert.deepEqual(
      posts[0].files,
      [2, 1, 3].map((n) => `jeep-renegade-2020-carrossel-${n}.png`),
    );
    assert.equal(posts[0].caption, "Legenda do carrossel\nLinha 2 #soul");
    assert.deepEqual(posts[1].files, ["VIDEO_RENEGADE.mp4"]);
    assert.equal(posts[1].caption, "Legenda do Reels");
    assert.equal(posts[1].cover, "jeep-renegade-2020-trafego-pago.png");
    // Já publicado: uma nova execução publica de novo (o post pode ter sido apagado).
    await modulo.publicarInstagram(id, emitir);
    assert.equal((await wc.executeJavaScript("window.posts")).length, 4);
    // Sem capa não compartilha o Reels, e a retomada não duplica o carrossel.
    const segundo = criarVeiculo();
    await wc.executeJavaScript("window.omitirCapa=true");
    await assert.rejects(
      () => modulo.publicarInstagram(segundo, emitir),
      /não ofereceu o envio da capa/,
    );
    assert.equal(modulo.registroInstagram(segundo).carrossel, "publicado");
    assert.equal((await wc.executeJavaScript("window.posts")).length, 5);
    await wc.executeJavaScript(
      "window.omitirCapa=false;document.querySelector('main').innerHTML=''",
    );
    await modulo.publicarInstagram(segundo, emitir);
    assert.equal((await wc.executeJavaScript("window.posts")).length, 6);
    // Interrupção após Share não exige consulta: a etapa volta a pendente.
    const terceiro = criarVeiculo();
    await wc.executeJavaScript("window.omitirConfirmacao=true");
    const publicando = modulo.publicarInstagram(terceiro, emitir);
    const timer = setInterval(async () => {
      if ((await wc.executeJavaScript("window.posts.length")) === 7) {
        clearInterval(timer);
        modulo.cancelarInstagram();
      }
    }, 200);
    await assert.rejects(() => publicando, /interrompida/);
    clearInterval(timer);
    assert.equal(modulo.registroInstagram(terceiro).carrossel, "pendente");
    const resultado = {
      carrosselOrdem: [2, 1, 3],
      duasLegendas: true,
      capaReels: true,
      retomadaSemDuplicatas: true,
      interrupcaoConservaHistorico: true,
      redeReal: false,
      lucro12MesesComSetas: true,
      contaConferida: true,
      paginaRemotaSemNode: true,
    };
    fs.writeFileSync(
      path.resolve(__dirname, "../.tmp/smoke-instagram.json"),
      JSON.stringify(resultado, null, 2),
    );
    console.log("SMOKE INSTAGRAM OK " + JSON.stringify(resultado));
    modulo.banco().close();
    clearTimeout(timeout);
    app.exit(0);
  } catch (e) {
    console.error(e);
    clearTimeout(timeout);
    app.exit(1);
  }
});
