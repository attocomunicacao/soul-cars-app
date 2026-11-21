/**
 * Script da página do relatório completo do estoque (busca na tabela, ordenação por coluna e navegação
 * entre meses). Fica num módulo sem dependências porque duas partes precisam do MESMO texto:
 * `main/inventory/report.ts`, que o coloca no HTML, e `main/core/csp.ts`, que calcula o hash SHA-256
 * liberado na política de segurança de conteúdo (o relatório roda num iframe que herda a política).
 * O texto é exatamente o que estava dentro do template do relatório; o hash muda sozinho se ele mudar.
 */
export const SCRIPT_DA_PAGINA_DO_RELATORIO = `
var janelasMes=[].slice.call(document.querySelectorAll('.mes-janela')),indiceMes=janelasMes.length-1;
var anteriorMes=document.getElementById('mes-anterior'),proximoMes=document.getElementById('mes-proximo');
function mostrarMes(indice){
  if(!janelasMes.length)return;
  indiceMes=Math.max(0,Math.min(indice,janelasMes.length-1));
  janelasMes.forEach(function(p,i){p.hidden=i!==indiceMes;});
  document.getElementById('mes-periodo').textContent=janelasMes[indiceMes].dataset.periodo;
  anteriorMes.disabled=indiceMes===0;proximoMes.disabled=indiceMes===janelasMes.length-1;
}
if(anteriorMes){anteriorMes.addEventListener('click',function(){mostrarMes(indiceMes-1);});proximoMes.addEventListener('click',function(){mostrarMes(indiceMes+1);});mostrarMes(indiceMes);}
var q=document.getElementById('q'),tb=document.getElementById('tb'),
    cnt=document.getElementById('cnt'),
    ls=[].slice.call(tb.tBodies[0].rows);
q.addEventListener('input',function(){
  var t=q.value.toLowerCase().trim(),n=0;
  ls.forEach(function(r){
    var ok=!t||r.dataset.b.indexOf(t)>=0;
    r.style.display=ok?'':'none'; if(ok)n++;
  });
  cnt.textContent=n+' veículo'+(n==1?'':'s');
});
// ordenar clicando no cabecalho
[].forEach.call(tb.tHead.rows[0].cells,function(th,i){
  var desc=false;
  th.addEventListener('click',function(){
    desc=!desc;
    var val=function(tr){
      var c=tr.cells[i],s=c.textContent.trim();
      var num=s.replace(/[^0-9,\\-]/g,'').replace(/\\./g,'').replace(',','.');
      if(/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(s))
        return s.slice(6)+s.slice(3,5)+s.slice(0,2);
      return (num!==''&&!isNaN(parseFloat(num)))?parseFloat(num):s.toLowerCase();
    };
    ls.sort(function(a,b){
      var x=val(a),y=val(b);
      if(x<y)return desc?1:-1; if(x>y)return desc?-1:1; return 0;
    });
    ls.forEach(function(r){tb.tBodies[0].appendChild(r)});
  });
});
`;
