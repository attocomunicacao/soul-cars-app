// Executado pelo Electron real, com banco e estoque temporários.
// Sem tela de carregamento: o teste espera uma única janela principal.
process.env.SOUL_SEM_SPLASH = "1";
const { app, nativeImage, session } = require("electron");
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
// CSV do BNDV de mentira: um carro em estoque, com a pasta e as fotos acima (estoque atual).
fs.mkdirSync(path.join(raiz, "dados"), { recursive: true });
fs.writeFileSync(
  path.join(raiz, "dados", "bndv_veiculos.csv"),
  "\uFEFFidVehicle;vehicleNumber;plate;vin;envelopeNumber;brand;model;dateRegister;purchasePrice;salePrice;consigned;blocked;active;status;buyer\n" +
    '"123";"1";"ABC1D23";"9BWZZZ";"";"Ford";"Fiesta";"2026-10-01T10:00:00";"30000";"45900";"0";"false";"true";"DISPONÍVEL ESTOQUE";"Teste"',
);
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
        const cartoes=await window.soul.invocar('estoque_vitrine');
        if(cartoes.length!==1||cartoes[0].placa!=='ABC1D23'||cartoes[0].tabela!==45900||!cartoes[0].foto)throw Error('Vitrine do estoque atual incorreta: '+JSON.stringify(cartoes).slice(0,200));
        document.querySelector('.metric-link').click();
        for(let i=0;i<30&&!document.querySelector('.vitrine-cartao');i++)await new Promise(r=>setTimeout(r,100));
        const cartao=document.querySelector('.vitrine-cartao');
        if(!cartao||!cartao.querySelector('img')||!cartao.textContent.includes('Ford')||!cartao.textContent.includes('45.900'))throw Error('Página do estoque atual não abriu o cartão do veículo');
        [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Voltar ao estoque')).click();
        await new Promise(r=>setTimeout(r,200));
        const motor=await window.soul.invocar('engine_call',{method:'ping'});
        if(!motor.python)throw Error('Motor Python não respondeu');
        const relatorioBotao=[...document.querySelectorAll('nav button')].find(b=>b.textContent.includes('Abrir relatório completo'));
        relatorioBotao.click(); await new Promise(r=>setTimeout(r,400));
        const relatorioFrame=document.querySelector('iframe.relatorio-completo');
        if(!relatorioFrame || !relatorioFrame.srcdoc.includes('<html'))throw Error('Relatório interno não carregou');
        for(let i=0;i<40&&!relatorioFrame.style.height;i++)await new Promise(r=>setTimeout(r,150));
        if(!relatorioFrame.style.height)throw Error('O relatório ficou sem altura definida (segunda barra de rolagem)');
        const botaoPdf=[...document.querySelectorAll('button')].find(b=>b.textContent==='PDF'||b.textContent==='Gerando PDF…');if(!botaoPdf)throw Error('Falta o botão PDF no relatório completo');
        const botao=[...document.querySelectorAll('aside button')].find(b=>b.textContent.includes('Estoque'));botao.click();
        await new Promise(r=>setTimeout(r,100));
        if(document.querySelector('h1')?.textContent!=='Estoque')throw Error('Volta à lista do Estoque falhou');
        const abrir=[...document.querySelectorAll('td button')][0];if(!abrir)throw Error('Importação das pastas falhou');abrir.click();
        await new Promise(r=>setTimeout(r,100));
        await new Promise(r=>setTimeout(r,500));
        const anexar=[...document.querySelectorAll('button')].find(b=>b.textContent==='Anexar documento');
        if(!anexar || anexar.disabled)throw Error('Botão anexar documento indisponível');
        [...document.querySelectorAll('nav button')].find(b=>b.textContent==='Produção').click();
        await new Promise(r=>setTimeout(r,500));
        const painel=document.querySelector('.foto-painel');
        if(painel?.querySelectorAll('article').length!==2)throw Error('Painel de fotos ausente');
        painel.querySelector('article button[aria-label*="depois"]').click();
        await new Promise(r=>setTimeout(r,100));
        [...document.querySelectorAll('button')].find(b=>b.textContent==='Renomear pela ordem do painel').click();
        await new Promise(r=>setTimeout(r,400));
        if(!document.querySelector('.foto-painel')?.textContent.includes('1.png'))throw Error('Renomeação pelo painel falhou');
        const ficha=[...document.querySelectorAll('nav button')].find(b=>b.textContent==='Ficha');ficha.click();
        await new Promise(r=>setTimeout(r,100));
        window.confirm=()=>true;[...document.querySelectorAll('button')].find(b=>b.textContent==='Gerar e salvar DES.md').click();
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
      // BNDV embutido: uma vista na janela principal, na sessão do BNDV (persist:bndv), sem preload.
      await w.webContents.executeJavaScript(
        "window.soul.invocar('embutida_mostrar',{id:'bndv',x:240,y:0,largura:600,altura:400})",
      );
      const vista = w.contentView.children[0];
      if (
        !vista ||
        vista.webContents.session !== session.fromPartition("persist:bndv")
      )
        throw new Error("O BNDV embutido não usa a sessão do BNDV.");
      r.bndvEmbutido = true;
      await w.webContents.executeJavaScript(
        "window.soul.invocar('embutida_esconder')",
      );
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
