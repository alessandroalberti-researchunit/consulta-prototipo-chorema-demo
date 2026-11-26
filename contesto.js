// Vista "Contesto territoriale": dati Chorema attorno a Piazza Risorgimento. Dati in ./dati/ (generati da export/ con id di tracciabilita' al Demo Builder).
const V3_URL = ''; // URL di una pagina pubblica Chorema da incorporare (iframe). Vuoto = card nascosta.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const it = (n, d = 0) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const METRICHE = {
  residenti: { label: 'Residenti 2021', key: 'residenti_2021', id: 'id_residenti', unit: 'abitanti per cella', lo: [236, 236, 255], hi: [84, 27, 198] },
  ricettive: { label: 'Ricettività a 15 min', key: 'ricettive_15min', id: 'id_ricettive', unit: 'strutture raggiungibili a piedi in 15 min', lo: [224, 249, 241], hi: [24, 72, 62] }
};
let cache, metrica = 'residenti', selezionata = null;

async function carica() {
  if (cache) return cache;
  const get = f => fetch('./dati/' + f).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
  const [geo, ctx, punti] = await Promise.all([get('celle_h3.geojson'), get('contesto_chorema.json'), get('punti.json')]);
  return (cache = { geo, ctx, punti });
}
const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';

function mappa({ geo, punti }) {
  const W = 560, H = 470, pad = 18, k = Math.cos(41.9 * Math.PI / 180);
  const pts = geo.features.flatMap(f => f.geometry.coordinates[0]);
  const xs = pts.map(p => p[0] * k), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  const px = (lon, lat) => [pad + (lon * k - x0) * s, H - pad - (lat - y0) * s];
  const m = METRICHE[metrica], vals = geo.features.map(f => f.properties[m.key]), vmin = Math.min(...vals), vmax = Math.max(...vals);
  let c = '';
  geo.features.forEach(f => {
    const p = f.properties, t = (p[m.key] - vmin) / (vmax - vmin);
    const d = 'M' + f.geometry.coordinates[0].map(q => px(q[0], q[1]).map(v => v.toFixed(1)).join(',')).join('L') + 'Z';
    c += '<path class="hex' + (p.centro ? ' centro' : '') + '" d="' + d + '" fill="' + mix(m.lo, m.hi, t) + '" data-cella="' + p.cella + '" tabindex="0" role="button" aria-label="Cella ' + p.cella + ', ' + it(p[m.key]) + '"><title>' + it(p[m.key]) + ' (' + m.label + ')</title></path>';
  });
  punti.forEach((p, i) => { const [x, y] = px(p.lon, p.lat); c += '<g class="pin"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5"/><text x="' + (x + 9).toFixed(1) + '" y="' + (y + 4 + (i - 1) * 14).toFixed(1) + '">' + esc(p.nome) + '</text></g>'; });
  return { svg: '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="19 celle H3 attorno a Piazza Risorgimento">' + c + '</svg>', vmin, vmax, m };
}

function dettaglio({ geo }) {
  const f = geo.features.find(x => x.properties.cella === selezionata) || geo.features.find(x => x.properties.centro), p = f.properties, m = METRICHE[metrica];
  return '<b>' + it(p[m.key], metrica === 'residenti' ? 0 : 0) + '</b><small>' + m.label + ', ' + m.unit + '</small><small>Cella H3 r8 ' + esc(p.cella) + (p.centro ? ' (contiene Piazza Risorgimento)' : '') + ' · valore di cella, circa 0,8 km² · id Demo Builder ' + esc(p[m.id]) + '</small>';
}

function schede({ ctx }) {
  return ctx.schede.map(s => '<div class="sheet-item"><h3>' + esc(s.titolo) + '</h3><span class="badge chorema">Chorema</span><p>' + esc(s.valore) + '</p><small>' + esc(s.id) + ' · verificato il ' + esc(s.data_verifica) + '</small></div>').join('');
}

function rioni({ ctx }) {
  const r = ctx.rioni, max = Math.max(...Object.values(r).map(x => Math.abs(x.variazione_1991_2021_pct)));
  return Object.entries(r).map(([n, x]) => '<div class="rione-row"><span>' + esc(n) + '</span><div class="track" title="Variazione dei residenti 1991-2021"><span style="width:' + (100 * Math.abs(x.variazione_1991_2021_pct) / max).toFixed(1) + '%"></span></div><b>' + it(x.variazione_1991_2021_pct, 2) + '%</b></div>').join('');
}

function disegna(el, d) {
  const mp = mappa(d), m = mp.m;
  el.innerHTML = '<div class="ctx-grid"><article class="card"><div class="card-head"><div><h2>Le celle attorno alla piazza</h2><p>19 celle H3 r8 (anello k=2). Seleziona una cella per leggerne il valore.</p></div><span class="badge chorema">Chorema</span></div>' +
    '<div style="padding:4px 20px 0"><div class="seg" role="group" aria-label="Metrica">' + Object.entries(METRICHE).map(([k, v]) => '<button data-metrica="' + k + '" aria-pressed="' + (k === metrica) + '">' + v.label + '</button>').join('') + '</div></div>' +
    '<div class="ctx-map">' + mp.svg + '</div><div class="ctx-legend"><span>' + it(mp.vmin) + '</span><i style="background:linear-gradient(90deg,' + mix(m.lo, m.hi, 0) + ',' + mix(m.lo, m.hi, 1) + ')"></i><span>' + it(mp.vmax) + '</span><span>· i tre punti cadono nella stessa cella; posizioni di Via e Accesso Ottaviano stimate</span></div>' +
    '<div class="cell-detail" id="cell-detail">' + dettaglio(d) + '</div></article>' +
    '<div style="display:grid;gap:18px;align-content:start"><article class="card"><div class="card-head"><div><h2>Residenti nei rioni</h2><p>Variazione 1991-2021, somma delle celle H3 del rione</p></div><span class="badge chorema">Chorema</span></div><div class="rioni">' + rioni(d) + '</div></article>' +
    '<article class="card"><div class="card-head"><div><h2>Il contesto dell’area</h2><p>Valori Chorema con id e data di verifica</p></div></div><div class="sheet">' + schede(d) + '</div></article></div></div>' +
    (V3_URL ? '<article class="card" style="margin-top:18px"><div class="card-head"><div><h2>Studio completo Chorema v3</h2><p>Pagina pubblica incorporata, con mappe e fonti</p></div><span class="badge chorema">Chorema v3</span></div><details class="v3-note"><summary>Apri lo studio incorporato</summary><iframe class="v3-frame" title="Studio Chorema v3" loading="lazy" data-src="' + V3_URL + '"></iframe></details></article>' : '') +
    '<div class="method-callout">I dati di questa vista sono Chorema (ISTAT, CLC, OvertureMaps, ERA5, CAMS), riaggregati su griglia H3: descrivono il contesto, non i flussi. I flussi del cruscotto restano simulati.</div>';
  el.querySelector('details')?.addEventListener('toggle', e => { const f = e.target.querySelector('iframe'); if (e.target.open && !f.src) f.src = f.dataset.src; });
}

export async function renderContesto(el, ancora = () => true) {
  el.innerHTML = '<div class="card" style="padding:24px">Caricamento dei dati Chorema…</div>';
  let d;
  try { d = await carica(); } catch (e) { if (!ancora()) return; el.innerHTML = '<div class="method-callout">Dati Chorema non caricati (' + esc(e.message) + '). Servire la cartella con un server statico, non con file://.</div>'; return; }
  if (!ancora()) return; // l'utente ha cambiato vista durante il caricamento
  const ridisegna = () => disegna(el, d);
  ridisegna();
  const scegli = h => { selezionata = h.dataset.cella; el.querySelector('#cell-detail').innerHTML = dettaglio(d); };
  el.onkeydown = e => { const h = e.target.closest('[data-cella]'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); scegli(h); } };
  el.onclick = e => {
    const mb = e.target.closest('[data-metrica]'), h = e.target.closest('[data-cella]');
    if (mb) { metrica = mb.dataset.metrica; ridisegna(); } else if (h) scegli(h);
  };
}
