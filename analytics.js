import {POINTS,SCENARIOS,RANGES,records,metrics,it,time} from './data.js';

export function comparativeEvidence(point,range,scenario='ordinaria'){
 const p=POINTS.find(x=>x.id===point);
 if(!p)throw new Error('Punto sconosciuto');
 const ordinary=metrics(records(point,'ordinaria',range));
 const event=metrics(records(point,'evento',range));
 const selected=scenario==='evento'?event:ordinary;
 const dominant=selected.a>=selected.b?0:1;
 return {p,ordinary,event,selected,dominant,direction:p.directions[dominant],
  directionShare:dominant===0?selected.aPct:selected.bPct,
  directionCount:dominant===0?selected.a:selected.b,
  concentrationDelta:event.concentration-ordinary.concentration,
  pressureDelta:event.pressureMinutes-ordinary.pressureMinutes,
  totalDelta:100*(event.total-ordinary.total)/ordinary.total};
}
export function replayFrame(point,scenario,range,hour){
 const rows=records(point,scenario,range);
 const sample=rows.find(x=>Math.abs(x.hour-hour)<1e-8);
 if(!sample)throw new Error('Intervallo fuori dal periodo osservato');
 return {sample,index:rows.indexOf(sample),length:rows.length,points:POINTS.map(p=>({p,sample:records(p.id,scenario,range).find(x=>Math.abs(x.hour-hour)<1e-8)}))};
}
const median=xs=>{const a=[...xs].sort((x,y)=>x-y);return (a[(a.length-1)>>1]+a[a.length>>1])/2;};
export function pointProfiles(range){
 const profiles=POINTS.flatMap((p,i)=>SCENARIOS.map(s=>{
  const m=metrics(records(p.id,s.id,range));
  return {id:p.id+'-'+s.id,point:p.id,pointNumber:i+1,name:p.name,scenario:s.id,scenarioName:s.name,m,rate:m.total/m.hours};
 }));
 return {profiles,referenceRate:median(profiles.map(x=>x.rate)),referencePressure:median(profiles.map(x=>x.m.pressurePct))};
}
export function evidenceText(point,range,scenario){
 const e=comparativeEvidence(point,range,scenario);
 const sign=n=>(n>0?'+':'')+it(n,1);
 return [
  {key:'FASCE DI VISITA',title:it(e.selected.concentration,1)+'% dei passaggi in tre ore',
   fact:it(e.selected.peakCount)+' passaggi tra le '+time(e.selected.peakStart)+' e le '+time(e.selected.peakEnd)+', su '+it(e.selected.total)+' nel periodo selezionato.',
   implication:'Approfondire le fasce da valorizzare nelle proposte di visita, verificando orari e calendario dei luoghi.'},
  {key:'COLLEGAMENTI OSSERVATI',title:e.direction+': '+it(e.directionShare,1)+'%',
   fact:it(e.directionCount)+' passaggi nella direttrice prevalente dello stesso punto e periodo.',
   implication:'Confrontare i collegamenti utilizzati prima di orientare la valorizzazione degli itinerari.'},
  {key:'CONDIZIONI NEI GIORNI DI INIZIATIVA',title:(e.pressureDelta>0?'+':'')+it(e.pressureDelta)+' minuti nello scenario con evento',
   fact:'Oltre soglia: '+it(e.event.pressureMinutes)+' minuti contro '+it(e.ordinary.pressureMinutes)+'. Concentrazione: '+sign(e.concentrationDelta)+' punti percentuali.',
   implication:'Predisporre confronti documentati tra giornate e condizioni, per valutare la programmazione del Turismo.'}
 ];
}
