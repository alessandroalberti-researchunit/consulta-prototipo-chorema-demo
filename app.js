import {POINTS,SCENARIOS,RANGES,THRESHOLD,records,metrics,hourly,time,it,exportRows} from './data.js';
import {installEnhancements} from './enhancements.js';
import {renderContesto} from './contesto.js?v=2026-11-26h';
const $=s=>document.querySelector(s);
const state={point:'piazza',scenario:'ordinaria',range:'giornata',view:['area','dinamiche','programmazione','contesto'].includes(location.hash.slice(1))?location.hash.slice(1):'area'};
const titles={area:['La fruizione dell’area, nel tempo','Evidenze locali per programmare le iniziative del Turismo.'],dinamiche:['Come si distribuiscono i flussi','Concentrazioni e direttrici nei punti osservati del pilota.'],contesto:['Il contesto territoriale dell’area','Dati Chorema attorno a Piazza Risorgimento: popolazione, ricettività, clima e aria.'],programmazione:['Evidenze per la programmazione','Confrontare giornate e condizioni per orientare le iniziative del Turismo.']};
const infoButton=id=>'<button class="info" data-info="'+id+'" aria-label="Definizione del KPI">i</button>';
const cardHead=(title,sub,tag='')=>'<div class="card-head"><div><h2>'+title+'</h2><p>'+sub+'</p></div>'+(tag?'<span class="mini-tag">'+tag+'</span>':'')+'</div>';
const svg=(content,w=600,h=240,label='Grafico dei flussi')=>'<svg class="chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+label+'">'+content+'</svg>';
const positive=(n,unit)=> (n>0?'+':'')+it(n,1)+unit;
let lastFocus,enhance;
function metricCards(m,p){
 const dominant=m.a>=m.b?0:1, share=dominant===0?m.aPct:m.bPct;
 return '<article class="metric"><div class="metric-top"><span class="metric-label">Concentrazione temporale</span>'+infoButton('concentrazione')+'</div><div class="metric-number" data-kpi="concentrazione">'+it(m.concentration,1)+'<small>%</small></div><div class="metric-detail">Passaggi tra le '+time(m.peakStart)+' e le '+time(m.peakEnd)+'</div><div class="metric-purpose">Individuare le fasce da considerare nelle proposte di visita</div></article>'+
 '<article class="metric"><div class="metric-top"><span class="metric-label">Distribuzione per direttrice</span>'+infoButton('distribuzione')+'</div><div class="metric-number" data-kpi="distribuzione">'+it(share,1)+'<small>%</small></div><div class="metric-detail">'+p.directions[dominant]+' nel punto selezionato</div><div class="metric-purpose">Leggere i collegamenti utilizzati e approfondire gli itinerari</div></article>'+
 '<article class="metric"><div class="metric-top"><span class="metric-label">Persistenza della pressione</span>'+infoButton('pressione')+'</div><div class="metric-number" data-kpi="pressione">'+it(m.pressureMinutes)+'<small>min</small></div><div class="metric-detail">'+it(m.pressurePct,1)+'% del periodo oltre la soglia dimostrativa</div><div class="metric-purpose">Individuare aree e periodi prioritari per la fruizione</div></article>';
}
function barChart(data,m,compare){
 const w=600,h=244,L=44,R=13,T=17,B=36,pw=w-L-R,ph=h-T-B;
 const max=Math.ceil(Math.max(...data.map(x=>x.count),...(compare||[]).map(x=>x.count))/250)*250;
 let c='';
 for(let t=0;t<=4;t++){const v=max*t/4,y=T+ph-ph*t/4;c+='<line class="gridline" x1="'+L+'" x2="'+(w-R)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(L-9)+'" y="'+(y+4)+'" text-anchor="end">'+it(v)+'</text>';}
 const band=pw/data.length;
 data.forEach((d,i)=>{
  const x=L+band*i+band*.16, peak=d.hour+1>m.peakStart&&d.hour<m.peakEnd;
  const bw=band*(compare?.3:.67),bh=ph*d.count/max;
  c+='<rect class="bar '+(peak?'peak':'')+'" x="'+x+'" y="'+(T+ph-bh)+'" width="'+bw+'" height="'+bh+'" rx="2"><title>'+time(d.hour)+'–'+time(d.hour+1)+': '+it(d.count)+' passaggi simulati</title></rect>';
  if(compare){const bh2=ph*compare[i].count/max;c+='<rect class="bar secondary" x="'+(x+bw+2)+'" y="'+(T+ph-bh2)+'" width="'+bw+'" height="'+bh2+'" rx="2"><title>Scenario evento '+time(d.hour)+': '+it(compare[i].count)+' passaggi simulati</title></rect>';}
  c+='<text x="'+(L+band*(i+.5))+'" y="'+(h-14)+'" text-anchor="middle">'+String(d.hour).padStart(2,'0')+'</text>';
 });
 c+='<line class="axis" x1="'+L+'" x2="'+(w-R)+'" y1="'+(T+ph)+'" y2="'+(T+ph)+'"/>';
 return svg(c,w,h,compare?'Confronto orario di due scenari simulati':'Passaggi per ora e fascia di massima affluenza');
}
function map(p,m){
 let nodes='';
 POINTS.forEach((q,i)=>{
  const selected=q.id===p.id,x=q.map[0],y=q.map[1];
  nodes+='<g class="point-hit '+(selected?'selected':'')+'" role="button" tabindex="0" data-point="'+q.id+'" aria-label="Seleziona '+q.name+'" aria-pressed="'+selected+'"><circle class="halo" cx="'+x+'" cy="'+y+'" r="25"/><circle class="node" cx="'+x+'" cy="'+y+'" r="10"/><circle cx="'+x+'" cy="'+y+'" r="3" fill="'+(selected?'#4d1ba4':'#5e25e4')+'"/><text class="point-label" x="'+(x+35)+'" y="'+(y+5)+'">'+q.short+'</text></g>';
 });
 const x=p.map[0],y=p.map[1];
 return '<svg class="map" viewBox="75 25 550 465" role="group" aria-label="Schema dell’area pilota con tre punti illustrativi selezionabili">'+
 '<defs><marker id="down" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5" fill="#3d9583"/></marker><marker id="up" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5" fill="#571ce2"/></marker></defs>'+
 '<g opacity=".75"><path class="block" d="M102 28h173v39H102zM385 28h180v39H385zM103 123h171v69H103zM385 123h178v69H385zM103 278h171v65H103zM385 278h177v65H385z"/><path class="minor" d="M86 215H579M86 256H579M286 25V355M381 25V355M92 103H582"/><path class="street" d="M335 23V350M64 373H600"/><path class="street-detail" d="M335 23V350M64 373H600"/><path fill="#dedee3" stroke="#c1c0ca" d="M186 375C200 345 266 337 340 340C431 340 496 366 489 400C485 433 401 454 322 450C231 447 174 415 186 375Z"/><path fill="none" stroke="#cacad2" stroke-width="8" d="M200 392C228 365 412 353 472 393C447 431 268 448 200 392Z"/><path class="street" d="M335 453V490"/></g>'+
 '<text class="roadlabel" x="97" y="87">Viale Giulio Cesare</text><text class="roadlabel" x="102" y="242">Via Candia</text><text class="roadlabel" x="445" y="285">Via Germanico</text><text class="roadlabel" x="95" y="361">Verso Vaticano</text><text class="roadlabel" x="471" y="361">Via Cola di Rienzo</text><text class="place" x="228" y="481">Direzione Borgo</text>'+
 '<text class="roadlabel" x="610" y="40">N</text><path d="M615 75V48l-4 7m4-7 4 7" fill="none" stroke="#6f6e83" stroke-width="1.3"/>'+
 '<path class="flow-arrow" d="M'+(x-18)+' '+(y-56)+'V'+(y+43)+'" stroke="#3d9583" stroke-width="'+(2+4*m.aPct/100)+'" marker-end="url(#down)"/><path class="flow-arrow" d="M'+(x+18)+' '+(y+56)+'V'+(y-43)+'" stroke="#571ce2" stroke-width="'+(2+4*m.bPct/100)+'" marker-end="url(#up)"/>'+nodes+'</svg>';
}
function areaView(p,rows,m,h){
 return '<div class="grid"><article class="card">'+cardHead('I punti del pilota','Seleziona un punto per leggere le sue dinamiche','Schema indicativo')+'<div class="map-wrap">'+map(p,m)+'</div><div class="map-meta"><div class="legend"><span><i class="dot red"></i>Punto selezionato</span><span><i class="dot green"></i>Direttrici osservate</span></div><span>Copertura da verificare sul posto</span></div></article>'+
 '<article class="card">'+cardHead('La concentrazione dei passaggi',p.name+' · passaggi per ora',''+it(m.hours)+' ore osservate')+'<div class="chart-wrap">'+barChart(h,m)+'</div><div class="card-note"><strong>'+it(m.peakCount)+' passaggi</strong> nella finestra '+time(m.peakStart)+'–'+time(m.peakEnd)+'. Le barre più chiare individuano la fascia di picco.</div></article></div>'+
 '<div class="evidence-strip"><div><small>LETTURA PER IL TURISMO</small><p>Il '+it(m.concentration,1)+'% dei passaggi ricade in tre ore. Questa concentrazione aiuta a individuare le fasce da approfondire nella programmazione delle proposte di visita.</p></div><button class="text-button" data-go="programmazione">Confronta le giornate</button></div>';
}
function heatmap(){
 const r=RANGES.find(x=>x.id===state.range);
 let c='<div class="heat-label">Passaggi per ora</div>';
 for(let hour=6;hour<22;hour++)c+='<div class="heat-hour">'+String(hour).padStart(2,'0')+'</div>';
 const all=POINTS.map(p=>hourly(records(p.id,state.scenario,'giornata')));
 const max=Math.max(...all.flat().map(x=>x.count));
 POINTS.forEach((p,i)=>{
  c+='<div class="heat-label">'+p.short+'</div>';
  all[i].forEach(x=>{
   const inside=x.hour>=r.start&&x.hour<r.end, a=inside?.12+.74*x.count/max:.035;
   c+='<button class="heat-cell '+(state.point===p.id&&inside?'active':'')+'" data-point="'+p.id+'" style="--heat:rgba(87,28,226,'+a+')" aria-label="'+p.name+', ore '+x.hour+': '+it(x.count)+' passaggi simulati'+(!inside?', fuori dal periodo selezionato':'')+'" title="'+p.name+' · '+time(x.hour)+' · '+it(x.count)+' passaggi"></button>';
  });
 });
 return '<article class="card heatmap-card">'+cardHead('Ricorrenza e distribuzione nell’area','Ogni riga descrive un punto. Il colore rappresenta l’intensità dei passaggi.','Dati simulati')+'<div class="heatmap">'+c+'</div><div class="tipline">I conteggi di punti diversi non identificano persone uniche e possono includere lo stesso passaggio lungo l’asse.</div></article>';
}
function densityChart(rows){
 const w=600,h=240,L=43,R=13,T=19,B=34,pw=w-L-R,ph=h-T-B,max=Math.max(1.2,Math.ceil(Math.max(...rows.map(x=>x.density))*4)/4);
 let c='';
 for(let i=0;i<=4;i++){const y=T+ph-i*ph/4;c+='<line class="gridline" x1="'+L+'" x2="'+(w-R)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(L-9)+'" y="'+(y+4)+'" text-anchor="end">'+it(i*max/4,2)+'</text>';}
 const pts=rows.map((x,i)=>[L+i*pw/(rows.length-1),T+ph-ph*x.density/max]);
 const ty=T+ph-ph*THRESHOLD/max;
 c+='<path d="M'+L+' '+(T+ph)+'L'+pts.map(p=>p[0]+','+p[1]).join('L')+'L'+(w-R)+' '+(T+ph)+'Z" fill="#bb801b10"/><path d="M'+pts.map(p=>p[0]+','+p[1]).join('L')+'" stroke="#bb801b" stroke-width="2" fill="none"/><line x1="'+L+'" x2="'+(w-R)+'" y1="'+ty+'" y2="'+ty+'" stroke="#e19f2c" stroke-dasharray="4 4" stroke-width="1"/>';
 rows.filter(x=>x.density>=THRESHOLD).forEach(x=>{const i=rows.indexOf(x),xx=L+i*pw/rows.length;c+='<rect x="'+xx+'" y="'+(T+ph+1)+'" width="'+(pw/rows.length+1)+'" height="4" fill="#bb801b"/>';});
 for(let i=0;i<rows.length;i+=8)c+='<text x="'+(L+i*pw/(rows.length-1))+'" y="'+(h-12)+'" text-anchor="middle">'+time(rows[i].hour)+'</text>';
 c+='<text x="'+(w-R-3)+'" y="'+(ty-8)+'" text-anchor="end" style="fill:#c2851c">Soglia dimostrativa '+it(THRESHOLD,2)+'</text>';
 return svg(c,w,h,'Densità simulata e periodi oltre la soglia dimostrativa');
}
function distribution(p,m){
 return '<div class="distribution"><div class="legend"><span><i class="dot green"></i>'+p.directions[0]+'</span><span><i class="dot"></i>'+p.directions[1]+'</span></div><div class="distribution-bar"><span style="width:'+m.aPct+'%"></span><span style="width:'+m.bPct+'%"></span></div><div class="direction-row"><span>'+p.directions[0]+'</span><strong>'+it(m.aPct,1)+'%<small>'+it(m.a)+' passaggi</small></strong></div><div class="direction-row"><span>'+p.directions[1]+'</span><strong>'+it(m.bPct,1)+'%<small>'+it(m.b)+' passaggi</small></strong></div></div>';
}
function dynamicsView(p,rows,m){
 return heatmap()+'<div class="grid"><article class="card">'+cardHead('Le direttrici del punto osservato',p.name+' · ripartizione dei passaggi')+distribution(p,m)+'<div class="card-note">Le direzioni descrivono il movimento nel punto. La destinazione finale della visita richiede informazioni ulteriori.</div></article><article class="card">'+cardHead('La persistenza delle concentrazioni','Densità simulata in persone/m²','Intervalli di 15 minuti')+'<div class="chart-wrap">'+densityChart(rows)+'</div><div class="card-note">'+it(m.pressureMinutes)+' minuti oltre la soglia del prototipo, su '+it(m.hours*60)+' minuti osservati. Superficie e soglia saranno calibrate nel pilota.</div></article></div>';
}
function planView(p){
 const baseRows=records(state.point,'ordinaria',state.range),eventRows=records(state.point,'evento',state.range),a=metrics(baseRows),b=metrics(eventRows), ah=hourly(baseRows),bh=hourly(eventRows);
 const rows=[['Passaggi nel punto',it(a.total),it(b.total),positive((b.total-a.total)/a.total*100,'%')],['Concentrazione in tre ore',it(a.concentration,1)+'%',it(b.concentration,1)+'%',positive(b.concentration-a.concentration,' p.p.')],['Quota nella direttrice A',it(a.aPct,1)+'%',it(b.aPct,1)+'%',positive(b.aPct-a.aPct,' p.p.')],['Minuti oltre soglia',it(a.pressureMinutes),it(b.pressureMinutes),(b.pressureMinutes>a.pressureMinutes?'+':'')+it(b.pressureMinutes-a.pressureMinutes)+' min']];
 return '<div class="grid"><article class="card">'+cardHead('Giornate a confronto',p.name+' · stesso punto e periodo')+'<div class="chart-wrap">'+barChart(ah,a,bh)+'</div><div class="card-note legend"><span><i class="dot"></i>Giornata ordinaria</span><span><i class="dot" style="background:#A86A00"></i>Giornata con evento</span></div><table class="comparison-table"><thead><tr><th>Indicatore</th><th>Ordinaria</th><th>Con evento</th><th>Variazione</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((v,i)=>'<td class="'+(i===3?'change':'')+'">'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></article>'+
 '<article class="card">'+cardHead('Le decisioni del Turismo','Evidenze da approfondire con il Dipartimento')+'<div class="plan-panel">'+
 '<div class="plan-item"><small>PROGRAMMAZIONE DELLE PROPOSTE DI VISITA</small><h3>Considerare le fasce di concentrazione</h3><p>Nello scenario ordinario il picco si colloca tra le '+time(a.peakStart)+' e le '+time(a.peakEnd)+'. Il dato aiuta a valutare le fasce da valorizzare nelle iniziative turistiche.</p></div>'+
 '<div class="plan-item"><small>LETTURA DEGLI ITINERARI</small><h3>Approfondire i collegamenti utilizzati</h3><p>'+p.directions[0]+': '+it(a.aPct,1)+'% dei passaggi nello scenario ordinario. La ripartizione supporta la lettura dell’accesso all’area e la valutazione dei percorsi osservabili.</p></div>'+
 '<div class="plan-item"><small>VALUTAZIONE DELLE INIZIATIVE</small><h3>Confrontare condizioni e periodi</h3><p>Nel confronto simulato la pressione oltre soglia varia di '+it(b.pressureMinutes-a.pressureMinutes)+' minuti. Nel pilota il confronto andrà associato al calendario reale e alle condizioni di rilevazione.</p></div></div></article></div>'+
 '<div class="method-callout">Entrambe le giornate sono scenari simulati, senza riferimento a eventi realmente rilevati. Le differenze descrivono gli andamenti e non dimostrano, da sole, un effetto causale di un’iniziativa.</div>';
}
function render(){
 const p=POINTS.find(x=>x.id===state.point),r=records(state.point,state.scenario,state.range),m=metrics(r),h=hourly(r);
 $('#page-title').textContent=titles[state.view][0];$('#page-lead').textContent=titles[state.view][1];
 $('#context-total').textContent=it(m.total)+' passaggi nel punto';
 $('#metrics').innerHTML=metricCards(m,p);
 $('#view').innerHTML=state.view==='area'?areaView(p,r,m,h):state.view==='dinamiche'?dynamicsView(p,r,m):state.view==='contesto'?'':planView(p);
 document.body.dataset.vista=state.view;if(state.view==='contesto')renderContesto($('#view'),()=>state.view==='contesto');
 for(const b of document.querySelectorAll('[data-view]')){if(b.dataset.view===state.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
 document.title='Consulta Roma · '+p.name+' · '+titles[state.view][0];
 if(enhance)enhance({state,p,rows:r,m,h,map,barChart,refresh:render,select:(point,scenario)=>{state.point=point;state.scenario=scenario;$('#point').value=point;$('#scenario').value=scenario;render();}});
}
const explanations={
 concentrazione:{title:'Concentrazione temporale',body:'<p>Indica quale quota dei passaggi ricade nella finestra di tre ore consecutive di maggiore affluenza, all’interno del periodo selezionato.</p><p class="formula">Passaggi nelle tre ore più intense / passaggi nel periodo osservato × 100</p><h3>Utilizzo per il Turismo</h3><p>Individuare le fasce da considerare nella programmazione e nella promozione delle proposte di visita. Una quota più alta segnala una maggiore concentrazione temporale.</p><h3>Confronti</h3><p>Si confrontano punti e periodi con gli stessi orari di rilevazione. La finestra di tre ore è una proposta operativa del prototipo, da concordare in avvio.</p>'},
 distribuzione:{title:'Distribuzione per direttrice',body:'<p>Ripartisce i passaggi tra le direzioni distinguibili nello stesso punto. La scheda principale mostra la quota della direttrice prevalente.</p><p class="formula">Passaggi in una direttrice / passaggi totali dello stesso punto e periodo × 100</p><h3>Utilizzo per il Turismo</h3><p>Comprendere come vengono utilizzati i collegamenti nell’area e approfondire gli itinerari osservabili.</p><h3>Perimetro della misura</h3><p>Le direzioni sono locali. Non si deducono destinazioni finali o itinerari individuali tra videocamere. Gli stessi passanti possono essere contati in punti diversi. La classificazione delle direttrici richiede una copertura adeguata da verificare nel sopralluogo.</p>'},
 pressione:{title:'Persistenza della pressione',body:'<p>Misura per quanto tempo la densità nell’area osservata supera una soglia locale di riferimento.</p><p class="formula">Somma dei minuti oltre soglia. Quota percentuale = minuti oltre soglia / minuti validi osservati × 100</p><h3>Utilizzo per il Turismo</h3><p>Distinguere una concentrazione breve da una pressione ricorrente e individuare zone e periodi da approfondire nella pianificazione della fruizione turistica.</p><h3>Calibrazione</h3><p>La soglia di '+it(THRESHOLD,2)+' persone/m² e le superfici sono dimostrative, senza valore normativo o di sicurezza. Nel pilota si verificano la superficie effettivamente osservabile, l’affidabilità del dato e una soglia concordata con gli uffici.</p>'},
 metodo:{title:'Metodo e fonti',body:'<p>Questa è una demo navigabile del cruscotto. Tutti i numeri dei flussi, le superfici e i punti di osservazione sono simulati. Non è attivo un collegamento a telecamere o sistemi comunali.</p><h3>Dati Chorema</h3><p>La vista «Contesto territoriale» usa dati Chorema (ISTAT, Corine Land Cover, OvertureMaps, ERA5, CAMS) riaggregati su griglia H3, verificati e tracciati con un id. Non sono simulati e non descrivono i flussi.</p><h3>Il dato del pilota</h3><p>Passaggi, distribuzione locale delle direzioni, densità e andamento nel tempo, nei punti effettivamente coperti e validati. L’analisi descrive persone e passaggi in un’area a vocazione turistica. Non identifica automaticamente turisti, persone uniche, provenienza o spesa.</p><h3>Fonti dell’impostazione</h3><ul><li>Progetto Consulta «Monitoraggio intelligente delle aree pedonali e flussi turistici», versione 8 novembre 2025.</li><li>«Risposte intervista RBS» e risultati originali della survey Rome Business School.</li><li>Roma Capitale, DUP 2026–2028, linea Turismo: concentrazione della fruizione e valorizzazione dell’offerta nei quartieri.</li></ul><p><a href="https://www.comune.roma.it/web-resources/cms/documents/DUP_20262028.pdf" target="_blank" rel="noopener">Documento di programmazione di Roma Capitale</a></p><h3>Verifica delle iniziative</h3><p>Le giornate reali richiederanno calendario, periodi e condizioni comparabili. Un confronto prima-dopo, da solo, non identifica un effetto causale.</p>'},
 perimetro:{title:'Il percorso del progetto',body:'<p class="scope-amount">50.000 €</p><p>Sei mesi di sperimentazione nell’area Piazza Risorgimento – Via Ottaviano. Quadro economico proposto, da confermare tecnicamente.</p><div class="step"><small>PILOTA</small><p>Monitoraggio della zona, analisi delle dinamiche, storico e cruscotto a supporto della pianificazione del Turismo.</p></div><div class="step"><small>ESTENSIONE</small><p>Ulteriori aree turistiche, con indicatori confrontabili e copertura da definire.</p></div><div class="step"><small>EVOLUZIONE</small><p>Integrazioni con strumenti comunali e successivi servizi informativi ai visitatori, da valutare separatamente.</p></div><h3>Contributi proposti</h3><p>Consulta Roma Smart City Lab: coordinamento.<br>Rome Business School: supporto alla ricerca e alla lettura dei risultati.<br>Sensoworks: acquisizione e analisi dei flussi, cruscotto.</p><p>Accesso agli impianti, perimetro e ruoli saranno concordati all’avvio. La demo non presuppone disponibilità di integrazioni già autorizzate.</p>'}
};
function openDrawer(id){
 const e=explanations[id];if(!e)return;
 lastFocus=document.activeElement;$('#drawer-title').textContent=e.title;$('#drawer-body').innerHTML=e.body;$('#drawer').hidden=false;$('#overlay').hidden=false;document.body.style.overflow='hidden';$('#close').focus();
}
function closeDrawer(){if($('#drawer').hidden)return;$('#drawer').hidden=true;$('#overlay').hidden=true;document.body.style.overflow='';lastFocus?.focus();}
for(const [key,options] of [['point',POINTS],['scenario',SCENARIOS],['range',RANGES]]){
 const el=$('#'+key);el.innerHTML=options.map(x=>'<option value="'+x.id+'">'+x.name+'</option>').join('');el.value=state[key];el.addEventListener('change',()=>{state[key]=el.value;render();});
}
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-view],[data-point],[data-info],[data-go]');if(!t)return;
 if(t.dataset.view){state.view=t.dataset.view;render();}
 if(t.dataset.go){state.view=t.dataset.go;render();$('#page-title').scrollIntoView({block:'start',behavior:'smooth'});}
 if(t.dataset.point){state.point=t.dataset.point;$('#point').value=state.point;render();}
 if(t.dataset.info)openDrawer(t.dataset.info);
});
document.addEventListener('keydown',e=>{
 const t=e.target.closest('[data-point]');if(t?.tagName.toLowerCase()==='g'&&(e.key==='Enter'||e.key===' ')){e.preventDefault();state.point=t.dataset.point;$('#point').value=state.point;render();}
 if(e.key==='Escape')closeDrawer();
 if(e.key==='Tab'&&!$('#drawer').hidden){
  const f=[...$('#drawer').querySelectorAll('button,a[href],select,[tabindex="0"]')],first=f[0],last=f.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});
$('#method').addEventListener('click',()=>openDrawer('metodo'));
$('#compact').addEventListener('click',()=>{const active=document.body.classList.toggle('compact');$('#compact').setAttribute('aria-pressed',String(active));});
$('#scope').addEventListener('click',()=>openDrawer('perimetro'));
$('#close').addEventListener('click',closeDrawer);$('#overlay').addEventListener('click',closeDrawer);
$('#csv').addEventListener('click',()=>{
 const b=new Blob([exportRows(records(state.point,state.scenario,state.range))],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(b),a=document.createElement('a');
 a.href=url;a.download='Consulta_Roma_DATI_SIMULATI_'+state.point+'_'+state.scenario+'_'+state.range+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 $('#toast').textContent='Prospetto dei dati simulati esportato';$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,3000);
});
enhance=installEnhancements();
render();
