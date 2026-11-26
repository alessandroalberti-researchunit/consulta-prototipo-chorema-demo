import {POINTS,SCENARIOS,RANGES,THRESHOLD,records,metrics,time,it} from './data.js';
import {comparativeEvidence,replayFrame,pointProfiles,evidenceText} from './analytics.js';

const $=selector=>document.querySelector(selector);
const svgNS='http://www.w3.org/2000/svg';
const icons={play:'<path d="m7 4 10 6-10 6Z" fill="currentColor"/>',pause:'<path d="M7 4h3v12H7zm6 0h3v12h-3z" fill="currentColor"/>',reset:'<path d="M6 6a6 6 0 1 1-1 7M6 2v5H1" fill="none" stroke="currentColor" stroke-width="1.6"/>'};
const icon=name=>'<svg viewBox="0 0 22 20" aria-hidden="true">'+icons[name]+'</svg>';
const sectionHead=(title,sub,tag)=>'<div class="card-head"><div><h2>'+title+'</h2><p>'+sub+'</p></div>'+(tag?'<span class="mini-tag">'+tag+'</span>':'')+'</div>';
let active,clock=10,playing=false,timer,speed=2,started=false,analysis='giornate',previousKey='';

function periodCaption(ctx){
 const range=RANGES.find(x=>x.id===ctx.state.range);
 let caption=$('#period-caption');
 if(!caption){caption=document.createElement('div');caption.id='period-caption';caption.className='period-caption';$('#metrics').before(caption);}
 caption.innerHTML='<span>KPI del periodo <strong>'+time(range.start)+'–'+time(range.end)+'</strong></span><span>'+ctx.p.name+' · '+SCENARIOS.find(x=>x.id===ctx.state.scenario).name+'</span>';
}
function cursorChart(ctx){
 const range=RANGES.find(x=>x.id===ctx.state.range);
 const band=543/ctx.h.length,barX=44+(Math.floor(clock)-range.start)*band,x=44+(clock-range.start)/(range.end-range.start)*543;
 const base=ctx.barChart(ctx.h,ctx.m);
 return base.replace('</svg>','<rect class="time-focus" x="'+barX+'" y="16" width="'+band+'" height="192"/><line class="time-cursor" x1="'+x+'" x2="'+x+'" y1="17" y2="208"/><circle cx="'+x+'" cy="18" r="3" fill="#bb801b"/></svg>');
}
function timeline(ctx){
 const slots=ctx.rows,highest=Math.max(...slots.map(x=>x.count)),current=slots.findIndex(x=>x.hour===clock);
 let bars='';
 slots.forEach((s,i)=>{bars+='<span class="'+(i===current?'selected':'')+'" style="height:'+(7+22*s.count/highest)+'px" title="'+time(s.hour)+': '+it(s.count)+' passaggi"></span>';});
 const r=RANGES.find(x=>x.id===ctx.state.range);
 return '<div class="replay-controls" role="group" aria-label="Riproduzione della giornata">'+
 '<div class="transport-row"><button class="play-button" id="replay-toggle" aria-label="Riproduci giornata" aria-pressed="false">'+icon('play')+'<span>Riproduci giornata</span></button><button class="reset-button" id="replay-reset" aria-label="Ricomincia il replay" title="Ricomincia">'+icon('reset')+'</button>'+
 '<output id="replay-time" aria-live="off">'+time(clock)+'<small>–'+time(clock+.25)+'</small></output><label class="speed-control"><span class="sr-only">Velocità del replay</span><select id="replay-speed" aria-label="Velocità del replay"><option value="1">1×</option><option value="2" selected>2×</option><option value="4">4×</option></select></label></div>'+
 '<div class="timeline"><div class="timeline-bars" id="timeline-bars" aria-hidden="true">'+bars+'</div><input id="replay-position" type="range" min="0" max="'+(slots.length-1)+'" step="1" value="'+current+'" aria-label="Ora del replay" aria-valuetext="'+time(clock)+'–'+time(clock+.25)+'"><div class="timeline-ticks"><span>'+time(r.start)+'</span><span>'+time((r.start+r.end)/2)+'</span><span>'+time(r.end)+'</span></div></div></div>';
}
function overview(ctx){
 const m=ctx.m;
 return '<div class="replay-grid">'+
 '<article class="card replay-card">'+sectionHead('L’area lungo la giornata','Densità nei punti e direttrici dell’intervallo selezionato','Replay simulato')+
 '<div class="replay-map map-wrap" id="replay-map">'+ctx.map(ctx.p,m)+'</div>'+timeline(ctx)+
 '<div class="map-meta replay-legend"><div class="legend"><span><i class="dot"></i>Densità più contenuta</span><span><i class="dot" style="background:var(--amber)"></i>Oltre soglia dimostrativa</span></div><span>Schema e copertura indicativi</span></div></article>'+
 '<article class="card replay-chart-card">'+sectionHead('Il periodo e l’intervallo',ctx.p.name+' · passaggi per ora','KPI sul periodo completo')+
 '<div class="chart-wrap" id="replay-chart">'+cursorChart(ctx)+'</div>'+
 '<div class="frame-summary" id="frame-summary"></div>'+
 '<div class="card-note"><strong>'+it(m.peakCount)+' passaggi</strong> nella finestra di picco '+time(m.peakStart)+'–'+time(m.peakEnd)+'. Il cursore evidenzia l’ora del replay.</div></article></div>'+
 '<div class="executive-reading"><div><div class="reading-label">EVIDENZA PER IL TURISMO</div><h2>'+it(m.concentration,1)+'% dei passaggi tra le '+time(m.peakStart)+' e le '+time(m.peakEnd)+'</h2><p>Una base per valutare le fasce da valorizzare nelle iniziative e nelle proposte di visita.</p></div><button class="reading-link" data-go="programmazione">Esplora confronti ed evidenze <span aria-hidden="true">↗</span></button></div>';
}
function paintFrame(){
 if(!active||active.state.view!=='area'||!$('#replay-map'))return;
 const frame=replayFrame(active.state.point,active.state.scenario,active.state.range,clock),s=frame.sample;
 const map=$('#replay-map');
 frame.points.forEach(({p,sample})=>{
  const node=map.querySelector('[data-point="'+p.id+'"]');if(!node)return;
  const ratio=sample.density/THRESHOLD;
  const halo=node.querySelector('.halo');
  halo.style.setProperty('--halo-r',(17+Math.min(2,ratio)*14)+'px');
  halo.style.fill=ratio>=1?'rgba(187,128,27,'+(.09+Math.min(2,ratio)*.07)+')':'rgba(87,28,226,'+(.06+ratio*.09)+')';
  halo.style.stroke=ratio>=1?'#e2a23360':'#885deb5a';
  let value=node.querySelector('.point-density');
  if(!value){value=document.createElementNS(svgNS,'text');value.setAttribute('class','point-density');value.setAttribute('x',String(p.map[0]+35));value.setAttribute('y',String(p.map[1]+29));node.append(value);}
  value.textContent=it(sample.density,2)+' pers./m²';
  node.setAttribute('aria-label','Seleziona '+p.name+', densità simulata '+it(sample.density,2)+' persone per metro quadro, ore '+time(clock));
 });
 const arrows=map.querySelectorAll('.flow-arrow');
 if(arrows[0])arrows[0].setAttribute('stroke-width',String(2+6*s.a/s.count));
 if(arrows[1])arrows[1].setAttribute('stroke-width',String(2+6*s.b/s.count));
 $('#replay-chart').innerHTML=cursorChart(active);
 $('#frame-summary').innerHTML='<div class="frame-when"><span>INTERVALLO DEL REPLAY</span><strong>'+time(clock)+'–'+time(clock+.25)+'</strong></div><div><span>Passaggi in 15 minuti</span><strong>'+it(s.count)+'</strong></div><div><span>Densità nel punto</span><strong>'+it(s.density,2)+'<small> pers./m²</small></strong></div>';
 const slider=$('#replay-position');slider.value=String(frame.index);slider.setAttribute('aria-valuetext',time(clock)+'–'+time(clock+.25));
 $('#replay-time').innerHTML=time(clock)+'<small>–'+time(clock+.25)+'</small>';
 for(const [i,bar] of [...$('#timeline-bars').children].entries())bar.classList.toggle('selected',i===frame.index);
 $('#replay-speed').value=String(speed);
 paintPlayButton();
}
function paintPlayButton(){
 const b=$('#replay-toggle');if(!b)return;
 const name=playing?'Pausa':started?'Riprendi replay':'Riproduci giornata';
 b.innerHTML=icon(playing?'pause':'play')+'<span>'+name+'</span>';b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',String(playing));b.classList.toggle('playing',playing);
}
function pause(){playing=false;clearTimeout(timer);paintPlayButton();}
function tick(){
 if(!playing||!active||active.state.view!=='area')return;
 const i=active.rows.findIndex(x=>x.hour===clock);
 if(i>=active.rows.length-1){pause();const b=$('#replay-toggle');b.innerHTML=icon('play')+'<span>Rivedi giornata</span>';b.setAttribute('aria-label','Rivedi giornata');return;}
 clock=active.rows[i+1].hour;paintFrame();timer=setTimeout(tick,700/speed);
}
function play(){
 if(playing){pause();return;}
 const last=active.rows.at(-1).hour;
 if(!started||clock>=last)clock=active.rows[0].hour;
 started=true;playing=true;paintFrame();timer=setTimeout(tick,700/speed);
}
function evidenceBoard(ctx){
 const items=evidenceText(ctx.state.point,ctx.state.range,ctx.state.scenario);
 return '<article class="card evidence-board">'+sectionHead('Che cosa suggeriscono i dati','Lettura descrittiva e piste da valutare con il Turismo')+'<div class="evidence-items">'+items.map((e,i)=>'<section class="evidence-item"><span class="evidence-index">0'+(i+1)+'</span><div><small>'+e.key+'</small><h3>'+e.title+'</h3><p class="evidence-fact">'+e.fact+'</p><p class="evidence-action"><span>Da valutare</span>'+e.implication+'</p></div></section>').join('')+'</div></article>';
}
function matrixCard(ctx,model){
 const w=690,h=370,L=62,R=28,T=36,B=53,pw=w-L-R,ph=h-T-B;
 const rates=model.profiles.map(x=>x.rate),xmin=Math.max(0,Math.floor(Math.min(...rates)*.75/150)*150),xmax=Math.ceil(Math.max(...rates)*1.16/150)*150;
 const ymax=Math.min(100,Math.ceil(Math.max(...model.profiles.map(x=>x.m.pressurePct))*1.18/20)*20);
 const x=v=>L+(v-xmin)/(xmax-xmin)*pw,y=v=>T+ph-v/ymax*ph;
 let c='<rect x="'+L+'" y="'+T+'" width="'+pw+'" height="'+ph+'" fill="#f5f1fd"/>';
 for(let i=0;i<=4;i++){
  const xx=L+pw*i/4,yy=T+ph*i/4;
  c+='<line x1="'+xx+'" x2="'+xx+'" y1="'+T+'" y2="'+(T+ph)+'" class="gridline"/><text x="'+xx+'" y="'+(T+ph+22)+'" text-anchor="middle">'+it(xmin+(xmax-xmin)*i/4)+'</text>';
  c+='<line x1="'+L+'" x2="'+(L+pw)+'" y1="'+yy+'" y2="'+yy+'" class="gridline"/><text x="'+(L-10)+'" y="'+(yy+4)+'" text-anchor="end">'+it(ymax*(1-i/4))+'%</text>';
 }
 c+='<line x1="'+x(model.referenceRate)+'" x2="'+x(model.referenceRate)+'" y1="'+T+'" y2="'+(T+ph)+'" class="matrix-reference"/><line x1="'+L+'" x2="'+(L+pw)+'" y1="'+y(model.referencePressure)+'" y2="'+y(model.referencePressure)+'" class="matrix-reference"/>';
 c+='<text x="'+(L+pw/2)+'" y="'+(h-6)+'" text-anchor="middle" class="matrix-axis">Afflusso locale · passaggi/ora</text><text x="'+L+'" y="18" class="matrix-axis">Tempo oltre soglia (%)</text>';
 model.profiles.forEach(p=>{
  const xx=x(p.rate),yy=y(p.m.pressurePct),selected=p.point===ctx.state.point&&p.scenario===ctx.state.scenario,colour=p.scenario==='ordinaria'?'#571ce2':'#A86A00';
  c+='<g class="profile-node '+(selected?'selected':'')+'" tabindex="0" role="button" aria-pressed="'+selected+'" data-profile="'+p.id+'" aria-label="'+p.name+', '+p.scenarioName+', '+it(p.rate,1)+' passaggi per ora, '+it(p.m.pressurePct,1)+'% del tempo oltre soglia"><title>'+p.name+' · '+p.scenarioName+'</title><circle cx="'+xx+'" cy="'+yy+'" r="'+(selected?20:15)+'" fill="'+colour+'" fill-opacity="'+(selected?.25:.13)+'" stroke="'+colour+'" stroke-width="'+(selected?2:1)+'"/><text x="'+xx+'" y="'+(yy+4)+'" text-anchor="middle" class="profile-number" fill="'+colour+'">'+p.pointNumber+'</text></g>';
 });
 const plot='<svg class="chart matrix-chart" viewBox="0 0 '+w+' '+h+'" role="group" aria-label="Matrice dei sei profili simulati, selezionabili per punto e scenario">'+c+'</svg>';
 return '<article class="card matrix-card">'+sectionHead('Afflusso e persistenza a confronto','Seleziona un punto per leggere il suo profilo','6 profili simulati')+'<div class="matrix-legend"><span><i class="dot"></i>Giornata ordinaria</span><span><i class="dot" style="background:#A86A00"></i>Giornata con evento</span></div><div class="matrix-plot">'+plot+'</div><div class="point-key">'+POINTS.map((p,i)=>'<span><b>'+(i+1)+'</b>'+p.short+'</span>').join('')+'</div><details class="matrix-method"><summary>Come leggere la matrice</summary><p>L’asse orizzontale mostra i passaggi medi per ora. Quello verticale la quota del tempo oltre la soglia di densità. Le linee tratteggiate sono le mediane dei sei profili nel periodo selezionato: riferimenti relativi per la lettura, senza valore normativo o di sicurezza.</p></details></article>';
}
function profileBoard(ctx,model){
 const p=model.profiles.find(x=>x.point===ctx.state.point&&x.scenario===ctx.state.scenario);
 const rateHigh=p.rate>=model.referenceRate,pressureHigh=p.m.pressurePct>=model.referencePressure;
 const readings={
  'true-true':['Afflusso e persistenza sopra il riferimento','Approfondire le condizioni delle fasce più intense nella programmazione delle proposte turistiche.'],
  'true-false':['Più passaggi, minore persistenza relativa','Leggere insieme l’intensità dell’attraversamento e la durata delle concentrazioni prima di valutare gli itinerari.'],
  'false-true':['Meno passaggi, maggiore persistenza relativa','Approfondire le concentrazioni anche dove il volume dei passaggi è più contenuto.'],
  'false-false':['Afflusso e persistenza sotto il riferimento','Confrontare questo profilo con gli altri periodi osservati, verificando orari, copertura e calendario.']
 };
 let read=readings[String(rateHigh)+'-'+String(pressureHigh)];
 if(Math.abs(p.m.pressurePct-model.referencePressure)<1e-8)read=[rateHigh?'Più passaggi, persistenza sul riferimento':'Meno passaggi, persistenza sul riferimento','Confrontare le fasce e le condizioni osservate: la durata relativa delle concentrazioni coincide con la mediana dei profili.'];
 return '<article class="card profile-board">'+sectionHead('Il profilo selezionato',p.name,p.scenarioName)+'<div class="profile-reading"><h3>'+read[0]+'</h3><p>'+read[1]+'</p></div><div class="profile-values"><div><span>Intensità locale</span><strong>'+it(p.rate,1)+'<small> passaggi/ora</small></strong><p>Riferimento del confronto: '+it(model.referenceRate,1)+'</p></div><div><span>Persistenza oltre soglia</span><strong>'+it(p.m.pressurePct,1)+'<small>% del tempo</small></strong><p>'+it(p.m.pressureMinutes)+' minuti su '+it(p.m.hours*60)+' osservati</p></div><div><span>Finestra di massima affluenza</span><strong>'+time(p.m.peakStart)+'–'+time(p.m.peakEnd)+'</strong><p>'+it(p.m.concentration,1)+'% dei passaggi del periodo</p></div></div><div class="profile-foot">Il confronto descrive condizioni relative nei punti simulati. Una posizione nella matrice non indica automaticamente un risultato positivo o negativo.</div></article>';
}
function programming(ctx){
 const oldGrid=$('#view > .grid'),comparison=oldGrid?.children[0]?.outerHTML;
 if(!comparison)return;
 const model=pointProfiles(ctx.state.range);
 $('#view').innerHTML='<div class="analysis-toolbar"><div class="analysis-tabs" role="group" aria-label="Tipo di analisi"><button data-analysis="giornate" aria-pressed="'+(analysis==='giornate')+'">Giornate a confronto</button><button data-analysis="profili" aria-pressed="'+(analysis==='profili')+'">Profili dei punti</button></div><span>Stesso periodo, letture confrontabili</span></div><div class="grid program-grid">'+(analysis==='giornate'?comparison+evidenceBoard(ctx):matrixCard(ctx,model)+profileBoard(ctx,model))+'</div><div class="method-callout">Dati interamente simulati. Le evidenze descrivono gli andamenti e le indicazioni sono piste da valutare con il Dipartimento. Un confronto tra giornate non dimostra da solo un effetto causale.</div>';
}
export function installEnhancements(){
 document.addEventListener('click',e=>{
  const b=e.target.closest('#replay-toggle,#replay-reset,[data-analysis],[data-profile]');if(!b||!active)return;
  if(b.id==='replay-toggle')play();
  else if(b.id==='replay-reset'){pause();started=false;clock=active.rows[0].hour;paintFrame();}
  else if(b.dataset.analysis){analysis=b.dataset.analysis;active.refresh();}
  else if(b.dataset.profile)selectProfile(b.dataset.profile);
 });
 document.addEventListener('input',e=>{
  if(e.target.id!=='replay-position'||!active)return;pause();started=true;clock=active.rows[Number(e.target.value)].hour;paintFrame();
 });
 document.addEventListener('change',e=>{if(e.target.id==='replay-speed'){speed=Number(e.target.value);if(playing){clearTimeout(timer);timer=setTimeout(tick,700/speed);}}});
 document.addEventListener('keydown',e=>{const p=e.target.closest('[data-profile]');if(p&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectProfile(p.dataset.profile);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 return ctx=>{
  const key=[ctx.state.point,ctx.state.scenario,ctx.state.range,ctx.state.view].join('|');
  if(key!==previousKey){pause();previousKey=key;}
  active=ctx;
  if(!ctx.rows.some(x=>x.hour===clock))clock=ctx.rows[0].hour;
  periodCaption(ctx);
  if(ctx.state.view==='area'){$('#view').innerHTML=overview(ctx);paintFrame();}
  else if(ctx.state.view==='programmazione')programming(ctx);
 };
}
function selectProfile(id){
 const found=pointProfiles(active.state.range).profiles.find(x=>x.id===id);if(!found)return;
 active.select(found.point,found.scenario);
 document.querySelector('[data-profile="'+id+'"]')?.focus();
}
