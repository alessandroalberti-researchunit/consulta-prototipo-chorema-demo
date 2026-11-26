// Vista "Contesto territoriale": dati Chorema attorno a Piazza Risorgimento. Dati in ./dati/ (generati da export/ con id di tracciabilita' al Demo Builder).
// Mappa: MapLibre GL (se disponibile e con WebGL) sopra base CARTO Positron; altrimenti mappa SVG.
const V3_URL = ''; // URL di una pagina pubblica Chorema da incorporare (iframe). Vuoto = card nascosta.
// Base cartografica: OpenFreeMap (stile Positron, vettoriale, gratuito, senza chiave, uso commerciale ammesso; dati © OpenMapTiles, © OpenStreetMap contributors). Sostituibile con qualsiasi stile MapLibre.
const STILE_URL = 'https://tiles.openfreemap.org/styles/positron';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const it = (n, d = 0) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const METRICHE = {
  residenti: { label: 'Residenti 2021', key: 'residenti_2021', id: 'id_residenti', unit: 'abitanti per cella', lo: [236, 236, 255], hi: [84, 27, 198], rampa: ['#ECECFF', '#8E7DF6', '#541BC6'] },
  ricettive: { label: 'Ricettività a 15 min', key: 'ricettive_15min', id: 'id_ricettive', unit: 'strutture raggiungibili a piedi in 15 min', lo: [224, 249, 241], hi: [24, 72, 62], rampa: ['#E0F9F1', '#5CE0C3', '#18483E'] }
};
let cache, metrica = 'residenti', selezionata = null, vista3d = false, gl = null;

async function carica() {
  if (cache) return cache;
  const get = f => fetch('./dati/' + f).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
  const [geo, ctx, punti] = await Promise.all([get('celle_h3.geojson'), get('contesto_chorema.json'), get('punti.json')]);
  const estremi = Object.fromEntries(Object.entries(METRICHE).map(([k, m]) => { const v = geo.features.map(f => f.properties[m.key]); return [k, { vmin: Math.min(...v), vmax: Math.max(...v) }]; }));
  return (cache = { geo, ctx, punti, estremi, centro: geo.features.find(f => f.properties.centro).properties.cella });
}
const mix = (a, b, t) => 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
const usaGL = () => typeof maplibregl !== 'undefined' && webglOk();

/* ---------- mappa SVG (fallback) ---------- */
function mappaSVG({ geo, punti, estremi }) {
  const W = 560, H = 470, pad = 18, k = Math.cos(41.9 * Math.PI / 180);
  const pts = geo.features.flatMap(f => f.geometry.coordinates[0]);
  const xs = pts.map(p => p[0] * k), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0));
  const px = (lon, lat) => [pad + (lon * k - x0) * s, H - pad - (lat - y0) * s];
  const m = METRICHE[metrica], { vmin, vmax } = estremi[metrica];
  let c = '';
  geo.features.forEach(f => {
    const p = f.properties, t = (p[m.key] - vmin) / (vmax - vmin);
    const d = 'M' + f.geometry.coordinates[0].map(q => px(q[0], q[1]).map(v => v.toFixed(1)).join(',')).join('L') + 'Z';
    c += '<path class="hex' + (p.centro ? ' centro' : '') + '" d="' + d + '" fill="' + mix(m.lo, m.hi, t) + '" data-cella="' + p.cella + '" tabindex="0" role="button" aria-label="Cella ' + p.cella + ', ' + it(p[m.key]) + '"><title>' + it(p[m.key]) + ' (' + m.label + ')</title></path>';
  });
  punti.forEach((p, i) => { const [x, y] = px(p.lon, p.lat); c += '<g class="pin"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5"/><text x="' + (x + 9).toFixed(1) + '" y="' + (y + 4 + (i - 1) * 14).toFixed(1) + '">' + esc(p.nome) + '</text></g>'; });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="19 celle H3 attorno a Piazza Risorgimento">' + c + '</svg>';
}

/* ---------- mappa MapLibre GL ---------- */
const colore = (d, sel) => {
  const m = METRICHE[metrica], { vmin, vmax } = d.estremi[metrica];
  const scala = ['interpolate', ['linear'], ['get', m.key], vmin, m.rampa[0], (vmin + vmax) / 2, m.rampa[1], vmax, m.rampa[2]];
  return sel ? ['case', ['boolean', ['feature-state', 'sel'], false], '#272735', scala] : scala;
};
const altezza = d => ['*', ['/', ['get', METRICHE[metrica].key], d.estremi[metrica].vmax], 650];

function iniziaMappa(d) {
  if (gl) { gl.remove(); gl = null; }
  const lons = d.geo.features.flatMap(f => f.geometry.coordinates[0].map(p => p[0])), lats = d.geo.features.flatMap(f => f.geometry.coordinates[0].map(p => p[1]));
  const m = (gl = new maplibregl.Map({
    container: 'mapa',
    style: STILE_URL,
    bounds: [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], fitBoundsOptions: { padding: 36 },
    attributionControl: false, cooperativeGestures: true,
    locale: { 'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + scorri per zoomare', 'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + scorri per zoomare', 'CooperativeGesturesHandler.MobileHelpText': 'Usa due dita per muovere la mappa' }
  }));
  m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  const pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'ctx-pop' });
  d.punti.forEach((p, i) => {
    const e = document.createElement('div');
    e.className = 'pin-gl';
    e.innerHTML = '<i></i><span style="--dy:' + ((1 - i) * 26) + 'px">' + esc(p.nome) + (String(p.coordinate).startsWith('STIMATE') ? ' (posizione stimata)' : '') + '</span>';
    new maplibregl.Marker({ element: e }).setLngLat([p.lon, p.lat]).addTo(m);
  });
  let caricata = false;
  const attesa = setTimeout(() => { // stile non raggiungibile (rete assente): torna alla mappa SVG
    if (caricata) return;
    if (gl) { gl.remove(); gl = null; }
    const box = document.querySelector('.ctx-map'); if (box) { box.classList.remove('ctx-gl'); box.innerHTML = mappaSVG(d); }
  }, 9000);
  m.on('load', () => {
    caricata = true; clearTimeout(attesa);
    const prima = m.getStyle().layers.find(l => l.type === 'symbol')?.id; // esagoni sotto le etichette
    m.addSource('celle', { type: 'geojson', data: d.geo, promoteId: 'cella' });
    m.addLayer({ id: 'c-fill', type: 'fill', source: 'celle', paint: { 'fill-color': colore(d), 'fill-opacity': 0.74 } }, prima);
    m.addLayer({ id: 'c-line', type: 'line', source: 'celle', paint: { 'line-color': '#ffffff', 'line-width': 1.3 } }, prima);
    m.addLayer({ id: 'c-sel', type: 'line', source: 'celle', filter: ['==', ['get', 'cella'], selezionata || d.centro], paint: { 'line-color': '#272735', 'line-width': 3 } }, prima);
    m.addLayer({ id: 'c-3d', type: 'fill-extrusion', source: 'celle', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': colore(d, true), 'fill-extrusion-height': altezza(d), 'fill-extrusion-opacity': 0.88 } });
    ['c-fill', 'c-3d'].forEach(l => {
      m.on('mousemove', l, e => {
        const p = e.features[0].properties, mt = METRICHE[metrica];
        m.getCanvas().style.cursor = 'pointer';
        pop.setLngLat(e.lngLat).setHTML('<b>' + it(p[mt.key]) + '</b> ' + esc(mt.label) + '<br><small>Cella ' + esc(p.cella) + (p.centro === true || p.centro === 'true' ? ' · contiene la piazza' : '') + '</small>').addTo(m);
      });
      m.on('mouseleave', l, () => { m.getCanvas().style.cursor = ''; pop.remove(); });
      m.on('click', l, e => scegli(d, e.features[0].properties.cella));
    });
    evidenzia(d);
    applicaVista(d, false);
  });
}
function evidenzia(d) {
  if (!gl || !gl.getLayer('c-sel')) return;
  const id = selezionata || d.centro;
  gl.setFilter('c-sel', ['==', ['get', 'cella'], id]);
  gl.removeFeatureState({ source: 'celle' });
  gl.setFeatureState({ source: 'celle', id }, { sel: true });
}
function applicaMetrica(d) {
  if (!gl || !gl.getLayer('c-fill')) return;
  gl.setPaintProperty('c-fill', 'fill-color', colore(d));
  gl.setPaintProperty('c-3d', 'fill-extrusion-color', colore(d, true));
  gl.setPaintProperty('c-3d', 'fill-extrusion-height', altezza(d));
}
function applicaVista(d, anima = true) {
  if (!gl || !gl.getLayer('c-3d')) return;
  gl.setLayoutProperty('c-3d', 'visibility', vista3d ? 'visible' : 'none');
  gl.setLayoutProperty('c-fill', 'visibility', vista3d ? 'none' : 'visible');
  gl.easeTo({ pitch: vista3d ? 58 : 0, bearing: vista3d ? -25 : 0, duration: anima ? 900 : 0 });
}

/* ---------- pannelli ---------- */
function dettaglio({ geo, centro }) {
  const f = geo.features.find(x => x.properties.cella === (selezionata || centro)), p = f.properties, m = METRICHE[metrica];
  return '<b>' + it(p[m.key]) + '</b><small>' + m.label + ', ' + m.unit + '</small><small>Cella H3 r8 ' + esc(p.cella) + (p.centro ? ' (contiene Piazza Risorgimento)' : '') + ' · valore di cella, circa 0,8 km² · id Demo Builder ' + esc(p[m.id]) + '</small>';
}
function legenda({ estremi }) {
  const m = METRICHE[metrica], e = estremi[metrica];
  return '<span>' + it(e.vmin) + '</span><i style="background:linear-gradient(90deg,' + m.rampa.join(',') + ')"></i><span>' + it(e.vmax) + '</span><span>· i tre punti cadono nella stessa cella; posizioni di Via e Accesso Ottaviano stimate</span>';
}
function schede({ ctx }) {
  return ctx.schede.map(s => '<div class="sheet-item"><h3>' + esc(s.titolo) + '</h3><span class="badge chorema">Chorema</span><p>' + esc(s.valore) + '</p><small>' + esc(s.id) + ' · verificato il ' + esc(s.data_verifica) + '</small></div>').join('');
}
function rioni({ ctx }) {
  const r = ctx.rioni, max = Math.max(...Object.values(r).map(x => Math.abs(x.variazione_1991_2021_pct)));
  return Object.entries(r).map(([n, x]) => '<div class="rione-row"><span>' + esc(n) + '</span><div class="track" title="Variazione dei residenti 1991-2021"><span style="width:' + (100 * Math.abs(x.variazione_1991_2021_pct) / max).toFixed(1) + '%"></span></div><b>' + it(x.variazione_1991_2021_pct, 2) + '%</b></div>').join('');
}
const seg = (nome, attr, voci, attivo) => '<div class="seg" role="group" aria-label="' + nome + '">' + voci.map(([k, l]) => '<button ' + attr + '="' + k + '" aria-pressed="' + (k === attivo) + '">' + l + '</button>').join('') + '</div>';

function disegna(el, d) {
  const g = usaGL();
  const mappa = g ? '<div class="ctx-map ctx-gl"><div id="mapa" role="region" aria-label="Mappa interattiva delle 19 celle H3 attorno a Piazza Risorgimento"></div></div>' : '<div class="ctx-map">' + mappaSVG(d) + '</div>';
  const sel = g ? '<label class="sel-cella">Cella <select id="sel-cella">' + d.geo.features.map(f => '<option value="' + f.properties.cella + '">' + esc(f.properties.cella.slice(0, 10)) + (f.properties.centro ? ' (piazza)' : '') + '</option>').join('') + '</select></label>' : '';
  el.innerHTML = '<div class="ctx-grid"><article class="card"><div class="card-head"><div><h2>Le celle attorno alla piazza</h2><p>19 celle H3 r8 (anello k=2). ' + (g ? 'Passa il mouse o clicca una cella per leggerne il valore.' : 'Seleziona una cella per leggerne il valore.') + '</p></div><span class="badge chorema">Chorema</span></div>' +
    '<div class="ctx-tools">' + seg('Metrica', 'data-metrica', Object.entries(METRICHE).map(([k, v]) => [k, v.label]), metrica) + (g ? seg('Vista', 'data-vista3d', [['0', 'Piana'], ['1', '3D']], vista3d ? '1' : '0') : '') + sel + '</div>' +
    mappa + '<div class="ctx-legend" id="legenda">' + legenda(d) + '</div><div class="cell-detail" id="cell-detail">' + dettaglio(d) + '</div></article>' +
    '<div style="display:grid;gap:18px;align-content:start"><article class="card"><div class="card-head"><div><h2>Residenti nei rioni</h2><p>Variazione 1991-2021, somma delle celle H3 del rione</p></div><span class="badge chorema">Chorema</span></div><div class="rioni">' + rioni(d) + '</div></article>' +
    '<article class="card"><div class="card-head"><div><h2>Il contesto dell’area</h2><p>Valori Chorema con id e data di verifica</p></div></div><div class="sheet">' + schede(d) + '</div></article></div></div>' +
    (V3_URL ? '<article class="card" style="margin-top:18px"><div class="card-head"><div><h2>Studio completo Chorema v3</h2><p>Pagina pubblica incorporata, con mappe e fonti</p></div><span class="badge chorema">Chorema v3</span></div><details class="v3-note"><summary>Apri lo studio incorporato</summary><iframe class="v3-frame" title="Studio Chorema v3" loading="lazy" data-src="' + V3_URL + '"></iframe></details></article>' : '') +
    '<div class="method-callout">I dati di questa vista sono Chorema (ISTAT, CLC, OvertureMaps, ERA5, CAMS), riaggregati su griglia H3: descrivono il contesto, non i flussi. I flussi del cruscotto restano simulati.</div>';
  el.querySelector('details')?.addEventListener('toggle', e => { const f = e.target.querySelector('iframe'); if (e.target.open && !f.src) f.src = f.dataset.src; });
  if (g) { el.querySelector('#sel-cella').value = selezionata || d.centro; try { iniziaMappa(d); } catch (e) { gl = null; } }
}

function scegli(d, cella) {
  selezionata = cella;
  const el = document.querySelector('#cell-detail'); if (el) el.innerHTML = dettaglio(d);
  const s = document.querySelector('#sel-cella'); if (s) s.value = cella;
  evidenzia(d);
}

export async function renderContesto(el, ancora = () => true) {
  if (gl) { gl.remove(); gl = null; }
  el.innerHTML = '<div class="card" style="padding:24px">Caricamento dei dati Chorema…</div>';
  let d;
  try { d = await carica(); } catch (e) { if (!ancora()) return; el.innerHTML = '<div class="method-callout">Dati Chorema non caricati (' + esc(e.message) + '). Servire la cartella con un server statico, non con file://.</div>'; return; }
  if (!ancora()) return; // l'utente ha cambiato vista durante il caricamento
  disegna(el, d);
  const aggiornaSeg = (attr, val) => el.querySelectorAll('[' + attr + ']').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === val)));
  el.onkeydown = e => { const h = e.target.closest('[data-cella]'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); scegli(d, h.dataset.cella); } };
  el.onchange = e => { if (e.target.id === 'sel-cella') scegli(d, e.target.value); };
  el.onclick = e => {
    const mb = e.target.closest('[data-metrica]'), v3 = e.target.closest('[data-vista3d]'), h = e.target.closest('[data-cella]');
    if (mb) {
      metrica = mb.dataset.metrica;
      if (gl) { aggiornaSeg('data-metrica', metrica); applicaMetrica(d); el.querySelector('#legenda').innerHTML = legenda(d); el.querySelector('#cell-detail').innerHTML = dettaglio(d); } else disegna(el, d);
    } else if (v3) { vista3d = v3.dataset.vista3d === '1'; aggiornaSeg('data-vista3d', v3.dataset.vista3d); applicaVista(d); }
    else if (h) scegli(d, h.dataset.cella);
  };
}
