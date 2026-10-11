// Executado pelo Electron real, com banco e estoque temporários.
const { app, BrowserWindow, nativeImage, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "soul-smoke-"));
app.setPath("userData", raiz);
fs.writeFileSync(
  path.join(raiz, "config.json"),
  JSON.stringify({
    raizDados: raiz,
    pastaMotor: path.resolve(__dirname, "../engine"),
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
const timeout = setTimeout(() => {
  console.error("SMOKE: tempo excedido");
  app.exit(1);
}, 90000);
app.on("browser-window-created", (_e, w) => {
  w.webContents.setBackgroundThrottling(false);
  w.on("show", () => w.hide());
  w.webContents.once("did-finish-load", async () => {
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const r = await w.webContents.executeJavaScript(`(async()=>{
        if(!window.soul)throw Error('Ponte preload ausente');
        if(document.querySelector('h1')?.textContent!=='Estoque')throw Error('Página inicial incorreta');
        const novoId=await window.soul.invocar('db_veiculo_criar',{veiculo:{nome:'SMOKE'}});
        const veiculo=await window.soul.invocar('db_veiculo_obter',{id:novoId});
        if(veiculo?.nome!=='SMOKE')throw Error('SQLite/IPC falhou');
        const livre=await window.soul.invocar('sql_execute',{sql:'DELETE FROM veiculos'}).then(()=>true,()=>false);
        if(livre)throw Error('SQL livre ainda está disponível');
        const manutencao=await window.soul.invocar('db_manutencao');
        if(!manutencao.ok||!manutencao.backup)throw Error('Backup do banco falhou');
        const motor=await window.soul.invocar('engine_call',{method:'ping'});
        if(!motor.python)throw Error('Motor Python não respondeu');
        const relatorioBotao=[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Abrir relatório completo'));
        relatorioBotao.click(); await new Promise(r=>setTimeout(r,400));
        const relatorioFrame=document.querySelector('iframe.relatorio-completo');
        if(!relatorioFrame || !relatorioFrame.srcdoc.includes('<html'))throw Error('Relatório interno não carregou');
        const botao=[...document.querySelectorAll('aside button')].find(b=>b.textContent.includes('Studio'));botao.click();
        await new Promise(r=>setTimeout(r,100));
        if(document.querySelector('h1')?.textContent!=='Studio')throw Error('Navegação para Studio falhou');
        const abrir=[...document.querySelectorAll('td button')][0];if(!abrir)throw Error('Importação das pastas falhou');abrir.click();
        await new Promise(r=>setTimeout(r,100));
        await new Promise(r=>setTimeout(r,500));
        const anexar=[...document.querySelectorAll('button')].find(b=>b.textContent==='Anexar documento');
        if(!anexar || anexar.disabled)throw Error('Botão anexar documento indisponível');
        const painel=document.querySelector('.foto-painel');
        if(painel?.querySelectorAll('article').length!==2)throw Error('Painel de fotos ausente');
        painel.querySelector('article button[aria-label*="depois"]').click();
        await new Promise(r=>setTimeout(r,100));
        [...document.querySelectorAll('button')].find(b=>b.textContent==='Renomear pela ordem do painel').click();
        await new Promise(r=>setTimeout(r,400));
        if(!document.querySelector('.foto-painel')?.textContent.includes('1.png'))throw Error('Renomeação pelo painel falhou');
        const ficha=[...document.querySelectorAll('nav button')].find(b=>b.textContent==='Ficha');ficha.click();
        await new Promise(r=>setTimeout(r,100));
        [...document.querySelectorAll('button')].find(b=>b.textContent==='Gerar e salvar DES.md').click();
        await new Promise(r=>setTimeout(r,400));
        [...document.querySelectorAll('nav button')].find(b=>b.textContent==='Publicação').click();
        await new Promise(r=>setTimeout(r,100));
        const copiar=[...document.querySelectorAll('button')].find(b=>b.textContent==='Copiar');
        if(!copiar)throw Error('Blocos de publicação ausentes');copiar.click();
        await new Promise(r=>setTimeout(r,200));
        if(!document.querySelector('button.copiado')?.textContent.includes('Copiado'))throw Error('Confirmação de cópia ausente');
        const criativos=[...document.querySelectorAll('nav button')].find(b=>b.textContent==='Criativos');criativos.click();
        await new Promise(r=>setTimeout(r,2500));
        const frame=document.querySelector('iframe');if(!frame?.contentDocument?.querySelector('#app') && !frame?.contentDocument?.querySelector('[data-layout]'))throw Error('Editor não carregou');
        if(frame.contentDocument.querySelector('#editor-form').elements.namedItem('titulo').value!=='FORD FIESTA')throw Error('Ficha não chegou ao editor');
        const form=frame.contentDocument.querySelector('#editor-form');
        for(const [key,value] of Object.entries({titulo:'FORD FIESTA 2016',subtitulo:'S 1.5','terceiro-titulo':'MANUAL',valor:'45.900',ano:'2016',km:'84.000',fuel:'Flex'})) {
          const input=form.elements.namedItem(key);if(!input)continue;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
        }
        const canvas=document.createElement('canvas');canvas.width=400;canvas.height=200;const ctx=canvas.getContext('2d');ctx.fillStyle='#686868';ctx.fillRect(30,40,340,100);ctx.fillStyle='#202020';ctx.beginPath();ctx.arc(100,145,30,0,Math.PI*2);ctx.arc(300,145,30,0,Math.PI*2);ctx.fill();
        const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
        const foto=new File([blob],'foto-teste.png',{type:'image/png'});
        frame.contentWindow.postMessage({type:'soul:photos',photos:[{slot:'main',file:foto}]},'*');
        await new Promise(r=>setTimeout(r,1000));
        frame.contentDocument.querySelector('#export-resolution').value='1';
        frame.contentDocument.querySelector('#export-button').click();
        const {estoque}=await window.soul.invocar('caminhos_app');
        const saved=await window.soul.invocar('criativo_salvar',{}, {'x-pasta':encodeURIComponent('FIESTA 2016'),'x-nome':encodeURIComponent('ARTE TESTE.png'),'x-destino':encodeURIComponent(estoque+'/123_FORD_FIESTA_ABC1D23')},new Uint8Array([1,2,3]));
        if(!saved.endsWith('ARTE TESTE.png'))throw Error('Nome da exportação não decodificado');
        let artes=[];
        for(let i=0;i<40;i++){
          const status=await window.soul.invocar('producao_status',{pasta:estoque+'/123_FORD_FIESTA_ABC1D23'});
          artes=status.criativos.filter(n=>n!=='ARTE TESTE.png');
          if(artes.length)break;
          await new Promise(r=>setTimeout(r,500));
        }
        if(!artes.length)throw Error('Exportação PNG falhou: '+frame.contentDocument.querySelector('#status').textContent);
        frame.contentWindow.postMessage({type:'soul:vitrine-photos',photos:[1,2,4].map(numero=>({numero,file:foto}))},'*');
        frame.contentWindow.postMessage({type:'soul:instagram-export'},'*');
        let pacote=[];
        for(let i=0;i<100;i++){
          const status=await window.soul.invocar('producao_status',{pasta:estoque+'/123_FORD_FIESTA_ABC1D23'});
          pacote=status.criativos.filter(n=>/-(carrossel-[123]|trafego-pago)\\.png$/.test(n));
          if(pacote.length===4)break;
          await new Promise(r=>setTimeout(r,500));
        }
        if(pacote.length!==4)throw Error('Exportação do pacote Instagram falhou: '+frame.contentDocument.querySelector('#status').textContent);
        [...document.querySelectorAll('nav button')].find(b=>b.textContent==='Instagram').click();
        await new Promise(r=>setTimeout(r,300));
        if(!document.querySelector('.instagram'))throw Error('Aba Instagram não abriu');
        return {pagina:document.querySelector('h1').textContent,sqlite:true,relatorioInterno:true,painelFotos:true,copia:true,editor:true,instagramAba:true,pacoteInstagram:true,motor:motor.python,exportacao:saved,png:estoque+'/123_FORD_FIESTA_ABC1D23/CRIATIVO/'+artes[0],versoes:window.soul.versoes};
      })()`);
      // Botão "Entrar no BNDV": uma única janela, na sessão do BNDV (persist:bndv), sem preload.
      const antes = BrowserWindow.getAllWindows().length;
      await w.webContents.executeJavaScript(
        "window.soul.invocar('bndv_abrir')",
      );
      const segunda = await w.webContents.executeJavaScript(
        "window.soul.invocar('bndv_abrir')",
      );
      const janelas = BrowserWindow.getAllWindows();
      if (janelas.length !== antes + 1 || !segunda.jaAberta)
        throw new Error("A janela de login do BNDV deveria ser única.");
      const login = janelas.find((j) => j !== w);
      if (login.webContents.session !== session.fromPartition("persist:bndv"))
        throw new Error("A janela de login não usa a sessão do BNDV.");
      r.loginBndv = true;
      login.destroy();
      console.log("SMOKE OK " + JSON.stringify(r));
      const png = fs.readFileSync(r.png);
      if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
        throw new Error("Arquivo exportado não é PNG.");
      fs.writeFileSync(
        path.resolve(__dirname, "../docs/smoke.json"),
        JSON.stringify(r, null, 2),
      );
      clearTimeout(timeout);
      app.exit(0);
    } catch (e) {
      console.error(e);
      fs.writeFileSync(
        path.resolve(__dirname, "../docs/smoke-error.txt"),
        String(e),
      );
      clearTimeout(timeout);
      app.exit(1);
    }
  });
});
import("../out/main/index.js");
