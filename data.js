// Dataset interamente sintetico. Nessuna connessione a telecamere o sistemi comunali.
export const POINTS = [
 {id:'metro',name:'Accesso Ottaviano',short:'Accesso Ottaviano',area:160,scale:.83,occupancyFactor:.57,directions:['Verso Piazza Risorgimento','Verso Metro Ottaviano'],map:[335,95]},
 {id:'via',name:'Via Ottaviano',short:'Via Ottaviano',area:180,scale:.92,occupancyFactor:.62,directions:['Verso Piazza Risorgimento','Verso Metro Ottaviano'],map:[335,235]},
 {id:'piazza',name:'Piazza Risorgimento',short:'Piazza Risorgimento',area:300,scale:1,occupancyFactor:.85,directions:['Direzione Borgo','Direzione Ottaviano'],map:[335,395]}
];
export const SCENARIOS=[{id:'ordinaria',name:'Giornata ordinaria'},{id:'evento',name:'Giornata con evento'}];
export const RANGES=[{id:'giornata',name:'Giornata completa',start:6,end:22},{id:'mattina',name:'Mattina',start:6,end:14},{id:'pomeriggio',name:'Pomeriggio e sera',start:14,end:22}];
export const THRESHOLD=.65; // Soglia dimostrativa, da calibrare nel pilota.
const base=[120,220,440,650,900,920,800,720,650,670,710,660,520,430,300,180];
const event=[1.08,1.1,1.12,1.25,1.8,1.9,1.6,1.3,1.15,1.08,1.06,1.05,1.02,1.02,1.03,1.05];
export function dataset(pointId,scenarioId){
 const p=POINTS.find(x=>x.id===pointId);
 if(!p||!SCENARIOS.some(x=>x.id===scenarioId))throw new Error('Scenario o punto non valido');
 const out=[];
 for(let h=0;h<16;h++){
  const total=Math.round(base[h]*p.scale*(scenarioId==='evento'?event[h]:1));
  let assigned=0;
  [.22,.26,.28,.24].forEach((weight,q)=>{
   const count=q===3?total-assigned:Math.round(total*weight);assigned+=count;
   const dirRatio=Math.max(.34,Math.min(.8,.79-h*.027+(pointId==='metro'?.025:pointId==='via'?.01:-.015)));
   const a=Math.round(count*dirRatio), occupancy=Math.round(24+count*p.occupancyFactor+(q===2?9:0));
   out.push({point:pointId,scenario:scenarioId,hour:6+h+q/4,minutes:15,count,a,b:count-a,occupancy,area:p.area,density:occupancy/p.area});
  });
 }
 return out;
}
export function records(pointId,scenarioId,rangeId='giornata'){
 const r=RANGES.find(x=>x.id===rangeId);if(!r)throw new Error('Intervallo non valido');
 return dataset(pointId,scenarioId).filter(x=>x.hour>=r.start&&x.hour<r.end);
}
export const sum=(xs,fn=x=>x)=>xs.reduce((a,x)=>a+fn(x),0);
export function metrics(rows){
 const total=sum(rows,x=>x.count),a=sum(rows,x=>x.a),b=sum(rows,x=>x.b);
 let peakCount=-1,peakIndex=0;
 for(let i=0;i<=rows.length-12;i++){const v=sum(rows.slice(i,i+12),x=>x.count);if(v>peakCount){peakCount=v;peakIndex=i;}}
 const pressureMinutes=sum(rows.filter(x=>x.density>=THRESHOLD),x=>x.minutes);
 return {total,a,b,aPct:100*a/total,bPct:100*b/total,peakCount,concentration:100*peakCount/total,peakStart:rows[peakIndex].hour,peakEnd:rows[peakIndex].hour+3,pressureMinutes,pressurePct:100*pressureMinutes/sum(rows,x=>x.minutes),hours:sum(rows,x=>x.minutes)/60,maxDensity:Math.max(...rows.map(x=>x.density))};
}
export function hourly(rows){
 const result=[];
 for(let hour=Math.floor(rows[0].hour);hour<=Math.floor(rows.at(-1).hour);hour++){
  const r=rows.filter(x=>Math.floor(x.hour)===hour);
  result.push({hour,count:sum(r,x=>x.count),a:sum(r,x=>x.a),b:sum(r,x=>x.b),density:sum(r,x=>x.density)/r.length,pressureMinutes:sum(r.filter(x=>x.density>=THRESHOLD),x=>x.minutes)});
 }
 return result;
}
export const time=h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round((h%1)*60)).padStart(2,'0');
export const it=(n,d=0)=>new Intl.NumberFormat('it-IT',{useGrouping:'always',minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
export function exportRows(rows){return '\uFEFFtipo_dato;punto;scenario;ora;minuti;passaggi;direzione_a;direzione_b;presenze_simulate;superficie_simulata_m2;densita_simulata_pers_m2\n'+rows.map(x=>['SIMULATO',x.point,x.scenario,time(x.hour),x.minutes,x.count,x.a,x.b,x.occupancy,x.area,x.density.toFixed(4).replace('.',',')].join(';')).join('\n');}
