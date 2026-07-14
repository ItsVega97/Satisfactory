/* =========================================================
   Factoría 2D — Interfaz (paneles, palette, pistas, toasts)
   ========================================================= */

const ui = {
  selected: null,
  ghost: null,
  buildType: null,
  beltTool: 'conveyor',   // conveyor | splitter
  sheetKind: null,   // 'hub' | 'building' | 'inventory' | 'menu' | null
  sheetBuilding: null,
  hubTab: 'hitos',
};

const $ = id => document.getElementById(id);

function chip(item, qty) {
  const it = ITEMS[item];
  return `<span class="chip"><img class="icico" src="${itemIconURL(item)}" alt="">${qty !== undefined ? qty + ' × ' : ''}${it.name}</span>`;
}

/* ---------------- Toasts apilados (se desvanecen en orden) ---------------- */
function toast(msg) {
  const box = $('toasts');
  // si ya hay un toast idéntico visible, no duplicar
  for (const child of box.children) {
    if (child.dataset.msg === msg) return;
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.dataset.msg = msg;
  el.textContent = msg;
  box.appendChild(el);
  // máximo 3 visibles: retirar los más antiguos
  while (box.children.length > 3) box.firstElementChild.remove();
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }, 2600);
}

/* ---------------- Barra superior ---------------- */
function updateTopbar() {
  const p = state.power;
  $('powerVal').textContent = `${p.dem}/${p.sup} MW`;
  $('powerStat').classList.toggle('bad', p.overload);
  $('powerBanner').classList.toggle('hidden', !p.overload);

  const ms = currentMilestone();
  if (!hubBuilt()) {
    $('msVal').textContent = 'Construye el HUB';
  } else if (ms) {
    let done = 0, total = 0;
    for (const k in ms.req) { total += ms.req[k]; done += Math.min(ms.req[k], state.msProgress[k] || 0); }
    $('msVal').textContent = `${ms.name} · ${Math.floor(done / total * 100)}%`;
  } else {
    $('msVal').textContent = '¡Todo completado!';
  }
  updateMissionHud();
}

/* ---------------- HUD de misión (flotante, bajo el indicador eléctrico) ---------------- */
let _mhLast = '';
function updateMissionHud() {
  const el = $('missionHud');
  const ms = currentMilestone();
  let html;
  if (!hubBuilt()) {
    const w = state.world.wreck;
    const step = w && !w.salvaged ? 'Recupera los restos de la nave' : 'Construye el HUB';
    html = `<div class="mh-title">Misión: ${step}</div>
      <div class="mh-reqs"><span class="mh-req"><img src="${buildingIconURL('hub')}" alt="HUB">0/1</span></div>`;
  } else if (!ms) {
    html = `<div class="mh-title">Misiones completadas</div>
      <div class="mh-reqs"><span class="mh-req ok">¡Ascensor Espacial terminado!</span></div>`;
  } else {
    let rows = '';
    for (const item in ms.req) {
      const done = state.msProgress[item] || 0;
      const need = ms.req[item];
      rows += `<span class="mh-req ${done >= need ? 'ok' : ''}">
        <img src="${itemIconURL(item)}" alt="${itemName(item)}">${done}/${need}</span>`;
    }
    html = `<div class="mh-title">Misión ${state.milestoneIndex + 1}/${MILESTONES.length}: ${ms.name}</div>
      <div class="mh-reqs">${rows}</div>`;
  }
  if (html !== _mhLast) { el.innerHTML = html; _mhLast = html; }
  el.classList.remove('hidden');
}

/* ---------------- Palette de construcción ---------------- */
function rebuildPalette() {
  const pal = $('palette');
  pal.innerHTML = '';
  const order = ['portable_miner', 'miner1', 'miner2', 'smelter', 'foundry', 'constructor', 'assembler', 'storage', 'power_pole', 'biomass_burner', 'coal_generator'];
  if (!hubBuilt()) order.unshift('hub');
  for (const id of order) {
    const def = BUILDINGS[id];
    const unlocked = state.unlockedB.includes(id);
    const div = document.createElement('button');
    div.className = 'pal-item' + (unlocked ? '' : ' locked') + (ui.buildType === id ? ' sel' : '');
    const afford = canAfford(def.cost);
    div.innerHTML = `<img class="pal-img" src="${buildingIconURL(id)}" alt="">
      <span class="pal-name">${def.name}</span>
      <span class="pal-cost ${afford || !unlocked ? '' : 'bad'}">${unlocked ? fmtCost(def.cost) : 'Bloqueado'}</span>`;
    div.addEventListener('click', () => {
      if (!unlocked) {
        const msIdx = MILESTONES.findIndex(m => (m.unlocks.buildings || []).includes(id));
        toast(`Se desbloquea con el hito: "${MILESTONES[msIdx] ? MILESTONES[msIdx].name : '?'}"`);
        return;
      }
      ui.buildType = id;
      ui.ghost = null;
      updateConfirmBar();
      rebuildPalette();
      toast(def.desc);
    });
    pal.appendChild(div);
  }
}

function updateConfirmBar() {
  $('confirmBar').classList.toggle('hidden', !ui.ghost);
}

/* ---------------- Submenú de cintas (cinta / separador) ---------------- */
function rebuildBeltPalette() {
  const pal = $('palette');
  pal.innerHTML = '';
  const tools = [
    { id: 'conveyor', type: 'conveyor', costTxt: fmtCost(BUILDINGS.conveyor.cost) + ' por tramo' },
    { id: 'splitter', type: 'splitter', costTxt: fmtCost(BUILDINGS.splitter.cost) },
  ];
  for (const t of tools) {
    const def = BUILDINGS[t.type];
    const unlocked = state.unlockedB.includes(t.type);
    const afford = canAfford(def.cost);
    const div = document.createElement('button');
    div.className = 'pal-item' + (unlocked ? '' : ' locked') + (ui.beltTool === t.id ? ' sel' : '');
    div.innerHTML = `<img class="pal-img" src="${buildingIconURL(t.type)}" alt="">
      <span class="pal-name">${def.name}</span>
      <span class="pal-cost ${afford || !unlocked ? '' : 'bad'}">${unlocked ? t.costTxt : 'Bloqueado'}</span>`;
    div.addEventListener('click', () => {
      if (!unlocked) {
        const msIdx = MILESTONES.findIndex(m => (m.unlocks.buildings || []).includes(t.type));
        toast(`Se desbloquea con el hito: "${MILESTONES[msIdx] ? MILESTONES[msIdx].name : '?'}"`);
        return;
      }
      ui.beltTool = t.id;
      ui.ghost = null;
      updateConfirmBar();
      rebuildBeltPalette();
      toast(def.desc);
    });
    pal.appendChild(div);
  }
}

/* ---------------- Hoja inferior (paneles) ---------------- */
function openSheet(kind, title) {
  ui.sheetKind = kind;
  $('sheetTitle').innerHTML = title;
  $('sheet').classList.remove('hidden');
  refreshSheet();
}
function closeSheet() {
  ui.sheetKind = null;
  ui.sheetBuilding = null;
  $('sheet').classList.add('hidden');
}

function refreshSheet() {
  if (!ui.sheetKind) return;
  if (ui.sheetKind === 'hub') renderHubSheet();
  else if (ui.sheetKind === 'building') renderBuildingSheet();
  else if (ui.sheetKind === 'inventory') renderInventorySheet();
  else if (ui.sheetKind === 'menu') renderMenuSheet();
}

/* ---------------- Panel del HUB ---------------- */
function openHubPanel(tab) {
  if (!hubBuilt()) { toast('Aún no has construido el HUB.'); return; }
  if (tab) ui.hubTab = tab;
  openSheet('hub', `<img class="title-img" src="${buildingIconURL('hub')}" alt=""> HUB de FICSIT`);
}

function renderHubSheet() {
  const body = $('sheetBody');
  const ms = currentMilestone();
  if (ui.hubTab !== 'banco') ui.hubTab = 'hitos';
  let html = `<div class="tabs">
    <button class="tab ${ui.hubTab === 'hitos' ? 'on' : ''}" data-tab="hitos">Misiones</button>
    <button class="tab ${ui.hubTab === 'banco' ? 'on' : ''}" data-tab="banco">Banco de artesanía</button>
  </div>`;

  if (ui.hubTab === 'hitos') {
    if (!ms) {
      html += `<p class="ok">¡Has completado todos los hitos! Sigue ampliando tu fábrica.</p>`;
    } else {
      html += `<h3>Misión ${state.milestoneIndex + 1}/${MILESTONES.length}: ${ms.name}</h3>
        <p class="dim">${ms.desc}</p>`;
      for (const item in ms.req) {
        const done = state.msProgress[item] || 0;
        const need = ms.req[item];
        const inv = invCount(item);
        const pct = Math.floor(done / need * 100);
        html += `<div class="req-row">
          <div class="req-info">${chip(item)} <b>${done}/${need}</b>
            <div class="mini-bar"><div style="width:${pct}%"></div></div>
          </div>
          <button class="btn deliver" data-item="${item}" ${inv <= 0 || done >= need ? 'disabled' : ''}>Entregar (${inv})</button>
        </div>`;
      }
      const u = ms.unlocks || {};
      const unlockTxt = [
        ...(u.buildings || []).map(b => BUILDINGS[b].name),
        ...(u.recipes || []).map(r => RECIPES[r].name),
        ...(u.victory ? ['¡VICTORIA!'] : []),
      ];
      if (unlockTxt.length) html += `<p class="dim">Desbloquea: ${unlockTxt.join(', ')}</p>`;
    }
    // lista completa de misiones con su estado
    html += `<h4>Lista de misiones</h4><div class="ms-list">`;
    MILESTONES.forEach((m, i) => {
      const cls = i < state.milestoneIndex ? 'done' : i === state.milestoneIndex ? 'now' : 'todo';
      const mark = i < state.milestoneIndex ? '✓' : i === state.milestoneIndex ? '›' : (i + 1);
      html += `<div class="ms-row ${cls}"><span class="ms-mark">${mark}</span>
        <span>${m.name}</span>
        <span class="ms-state">${cls === 'done' ? 'Completada' : cls === 'now' ? 'En curso' : 'Pendiente'}</span></div>`;
    });
    html += `</div>`;
  } else {
    html += `<p class="dim">Fabrica objetos a mano con los recursos del inventario.</p>`;
    const list = Object.keys(RECIPES).filter(r => state.unlockedR.includes(r) && RECIPES[r].hand);
    if (!list.length) html += `<p class="dim">Aún no conoces ninguna receta. Completa el primer hito.</p>`;
    for (const rid of list) {
      const r = RECIPES[rid];
      const ins = Object.keys(r.in).map(k => chip(k, r.in[k])).join(' + ');
      const outs = Object.keys(r.out).map(k => chip(k, r.out[k])).join(' ');
      const can = canAfford(r.in);
      html += `<div class="req-row">
        <div class="req-info">${ins} → ${outs}</div>
        <span class="btn-group">
          <button class="btn craft" data-r="${rid}" data-n="1" ${can ? '' : 'disabled'}>Fabricar</button>
          <button class="btn craft alt" data-r="${rid}" data-n="10" ${can ? '' : 'disabled'}>×10</button>
        </span>
      </div>`;
    }
  }
  body.innerHTML = html;

  body.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { ui.hubTab = t.dataset.tab; refreshSheet(); }));
  body.querySelectorAll('.deliver').forEach(btn => btn.addEventListener('click', () => {
    const n = deliverItem(btn.dataset.item);
    if (n > 0) refreshSheet();
    updateTopbar();
  }));
  body.querySelectorAll('.craft').forEach(btn => btn.addEventListener('click', () => {
    const made = handCraft(btn.dataset.r, parseInt(btn.dataset.n, 10));
    if (made > 0) refreshSheet();
    else toast('Faltan ingredientes');
  }));
}

/* ---------------- Panel de edificio ---------------- */
function openBuildingPanel(b) {
  ui.sheetBuilding = b;
  openSheet('building', `<img class="title-img" src="${buildingIconURL(b.type)}" alt=""> ${BUILDINGS[b.type].name}`);
}

function renderBuildingSheet() {
  const b = ui.sheetBuilding;
  if (!b || !state.buildings.includes(b)) { closeSheet(); return; }
  const def = BUILDINGS[b.type];
  const body = $('sheetBody');
  let html = `<p class="dim">${def.desc}</p>`;

  if (def.power < 0) {
    if (!b._conn) html += `<p class="warn">Sin conexión a la red eléctrica: acércala al HUB, a un generador o a un poste.</p>`;
    else if (!b._pw && machineWants(b)) html += `<p class="warn">Red sin energía suficiente: añade o alimenta generadores.</p>`;
    else html += `<p class="ok">Conectada a la red eléctrica (${-def.power} MW).</p>`;
  }

  if (b.type === 'miner1') {
    const item = NODE_TYPES[b.nodeType].item;
    html += `<p>Extrayendo ${chip(item)} — búfer: <b>${Math.floor(b.buf)}</b>/${OUT_CAP}</p>
      <p class="dim">Conecta cintas que salgan del minero para transportar el mineral.</p>
      <button class="btn" id="bCollect">Recoger búfer</button>`;
  }

  if (MACH_RECIPES[b.type]) {
    html += `<h4>Receta</h4><div class="recipe-list">`;
    const avail = MACH_RECIPES[b.type].filter(r => state.unlockedR.includes(r));
    if (!avail.length) html += `<p class="dim">No hay recetas desbloqueadas para esta máquina.</p>`;
    for (const rid of avail) {
      const r = RECIPES[rid];
      const ins = Object.keys(r.in).map(k => chip(k, r.in[k])).join(' + ');
      const outs = Object.keys(r.out).map(k => chip(k, r.out[k])).join(' ');
      html += `<button class="recipe-btn ${b.recipe === rid ? 'on' : ''}" data-r="${rid}">
        <b>${r.name}</b><br><small>${ins} → ${outs} · ${r.time}s</small></button>`;
    }
    html += `</div>`;
    if (b.recipe) {
      const r = RECIPES[b.recipe];
      html += `<h4>Búferes</h4><div class="bufs">`;
      for (const k in r.in) html += `<span>${chip(k)} entrada: <b>${b.inBuf[k] || 0}</b></span>`;
      for (const k in r.out) html += `<span>${chip(k)} salida: <b>${b.outBuf[k] || 0}</b></span>`;
      html += `</div>
        <p class="dim">Entra por cintas hacia la máquina; sale por cintas que se alejan. También puedes cargar/recoger a mano.</p>
        <span class="btn-group">
          <button class="btn" id="bFeed">Cargar entradas (×10)</button>
          <button class="btn" id="bCollect">Recoger salida</button>
        </span>`;
    }
  }

  if (b.type === 'storage') {
    let total = 0; for (const k in b.store) total += b.store[k];
    html += `<p>Ocupación: <b>${total}</b>/${def.cap}</p><div class="bufs">`;
    for (const k in b.store) html += `<span>${chip(k, b.store[k])}</span>`;
    html += `</div><button class="btn" id="bCollect">Vaciar al inventario</button>`;
  }

  if (def.fuelItem) {
    const inv = invCount(def.fuelItem);
    html += `<p>Combustible: ${chip(def.fuelItem)} <b>${b.fuel}</b>/50 ${b.burnLeft > 0 ? '· quemando' : ''}</p>
      <button class="btn" id="bFuel" ${inv <= 0 ? 'disabled' : ''}>Cargar ${def.fuelItem === 'coal' ? 'carbón' : 'biomasa'} (tienes ${inv})</button>`;
    if (b.type === 'coal_generator') html += `<p class="dim">También acepta carbón por cinta.</p>`;
  }

  html += `<hr><button class="btn danger" id="bDemolish">Demoler (devuelve materiales)</button>`;
  body.innerHTML = html;

  body.querySelectorAll('.recipe-btn').forEach(btn => btn.addEventListener('click', () => {
    b.recipe = btn.dataset.r;
    b.working = false; b.progress = 0;
    // devolver entradas que no correspondan
    const r = RECIPES[b.recipe];
    for (const k in b.inBuf) if (!(k in r.in)) { invAdd(k, b.inBuf[k]); delete b.inBuf[k]; }
    sfx('click');
    refreshSheet();
  }));
  const collect = body.querySelector('#bCollect');
  if (collect) collect.addEventListener('click', () => {
    if (b.type === 'miner1') {
      const n = Math.floor(b.buf);
      if (n > 0) { b.buf -= n; invAdd(NODE_TYPES[b.nodeType].item, n); sfx('collect'); }
    } else if (b.type === 'storage') {
      for (const k in b.store) { invAdd(k, b.store[k]); delete b.store[k]; }
      sfx('collect');
    } else collectOutput(b);
    refreshSheet();
  });
  const feed = body.querySelector('#bFeed');
  if (feed) feed.addEventListener('click', () => {
    const r = RECIPES[b.recipe];
    let moved = 0;
    for (const k in r.in) {
      const cap = Math.max(10, r.in[k] * 4);
      const n = Math.min(10, invCount(k), cap - (b.inBuf[k] || 0));
      if (n > 0) { invAdd(k, -n); b.inBuf[k] = (b.inBuf[k] || 0) + n; moved += n; }
    }
    if (moved > 0) sfx('click'); else toast('No hay ingredientes en el inventario');
    refreshSheet();
  });
  const fuel = body.querySelector('#bFuel');
  if (fuel) fuel.addEventListener('click', () => { loadFuel(b, 10); refreshSheet(); });
  body.querySelector('#bDemolish').addEventListener('click', () => {
    demolishBuilding(b);
    closeSheet();
  });
}

/* ---------------- Inventario ---------------- */
function renderInventorySheet() {
  const body = $('sheetBody');
  const keys = Object.keys(state.inventory).filter(k => state.inventory[k] > 0);
  if (!keys.length) { body.innerHTML = '<p class="dim">Inventario vacío. ¡Pica algún yacimiento!</p>'; return; }
  let html = '<div class="inv-grid">';
  for (const k of keys) {
    const it = ITEMS[k];
    html += `<div class="inv-cell"><img class="inv-img" src="${itemIconURL(k)}" alt="">
      <b>${state.inventory[k]}</b><small>${it.name}</small></div>`;
  }
  html += '</div>';
  body.innerHTML = html;
}

/* ---------------- Menú ---------------- */
function renderMenuSheet() {
  const body = $('sheetBody');
  const m = Math.floor(state.playTime / 60), s = Math.floor(state.playTime % 60);
  body.innerHTML = `
    <p class="dim">Tiempo de partida: <b>${m}m ${s}s</b> · Construcciones: <b>${state.stats.built}</b> ·
    Producido: <b>${state.stats.produced}</b> · Fabricado a mano: <b>${state.stats.crafted}</b></p>
    <div class="menu-list">
      <button class="btn" id="mSound">${audioMuted ? 'Activar sonido' : 'Silenciar sonido'}</button>
      <button class="btn" id="mSave">Guardar partida</button>
      <button class="btn" id="mHelp">Cómo jugar</button>
      <button class="btn danger" id="mReset">Nueva partida</button>
    </div>
    <div id="helpBox" class="hidden help-box">
      <h4>Cómo jugar</h4>
      <ol>
        <li><b>Pica recursos:</b> toca los yacimientos (rocas de colores) para extraer mineral a mano.</li>
        <li><b>Taladro portátil:</b> en modo Construir, colócalo sobre un yacimiento (cuesta 5 de mineral de hierro) y tócalo para recoger lo extraído.</li>
        <li><b>HUB:</b> toca el edificio HUB para entregar objetos a los hitos y fabricar a mano en el banco. Además suministra 10 MW a los edificios cercanos.</li>
        <li><b>Automatiza:</b> desbloquea Fundidoras, Constructores y Mineros. Asigna una receta tocando la máquina.</li>
        <li><b>Cintas:</b> en el modo cintas, arrastra el dedo para trazarlas desde los mineros a las máquinas y hasta el HUB.</li>
        <li><b>Electricidad:</b> las máquinas solo funcionan conectadas a la red. Colócalas cerca del HUB o de un generador, o construye <b>postes eléctricos</b> para llevar los cables más lejos. Alimenta los quemadores con biomasa (arbustos y árboles) y los generadores de carbón por cinta. Si la demanda supera la generación, la red se sobrecarga.</li>
        <li><b>Objetivo:</b> completa los 6 hitos y envía la Fase 1 del Ascensor Espacial (~30 min).</li>
      </ol>
    </div>`;
  $('mSound').addEventListener('click', () => { toggleMute(); refreshSheet(); });
  $('mSave').addEventListener('click', () => { saveGame() ? toast('Partida guardada') : toast('Error al guardar'); });
  $('mHelp').addEventListener('click', () => $('helpBox').classList.toggle('hidden'));
  $('mReset').addEventListener('click', () => {
    if (confirm('¿Empezar una nueva partida? Se perderá el progreso.')) {
      resetGame();
      groundCanvas = null;
      cam.x = (state.world.hubX + 2) * TILE;
      cam.y = (state.world.hubY + 1.5) * TILE;
      cam.z = 1;
      closeSheet();
      toast('¡Nueva partida! Bienvenido, ingeniero de FICSIT.');
    }
  });
}

/* ---------------- Pistas (tutorial contextual) ---------------- */
const HINTS = [
  { id: 'salvage', cond: () => state.world.wreck && !state.world.wreck.salvaged,
    text: 'Tu nave se ha estrellado. Toca los restos humeantes para recuperar las piezas útiles.' },
  { id: 'buildhub', cond: () => !hubBuilt(),
    text: 'Con las piezas recuperadas, construye el HUB (modo Construir): será tu base y te dará el pico.' },
  { id: 'mine', cond: () => state.milestoneIndex === 0 && state.stats.mined < 10,
    text: 'El HUB te ha entregado el pico. Toca un yacimiento de hierro (rocas grises) para picar mineral.' },
  { id: 'portable', cond: () => state.milestoneIndex === 0 && state.stats.mined >= 10 && !state.buildings.some(b => b.type === 'portable_miner'),
    text: 'Abre Construir y coloca un Taladro portátil sobre un yacimiento (cuesta 5 de mineral de hierro).' },
  { id: 'deliver0', cond: () => state.milestoneIndex === 0 && invCount('iron_ore') + (state.msProgress.iron_ore || 0) >= 30,
    text: 'Toca el HUB y entrega el mineral de hierro para completar el hito.' },
  { id: 'smelter', cond: () => state.milestoneIndex === 1 && !state.buildings.some(b => b.type === 'smelter'),
    text: 'Fabrica varillas y alambre en el banco del HUB y construye una Fundidora cerca del HUB (te dará sus 10 MW).' },
  { id: 'noconn', cond: () => state.buildings.some(b => BUILDINGS[b.type].power < 0 && b._conn === false),
    text: 'Hay máquinas sin conexión eléctrica: acércalas al HUB o a un generador, o únelas con postes eléctricos.' },
  { id: 'recipe', cond: () => state.buildings.some(b => MACH_RECIPES[b.type] && !b.recipe),
    text: 'Tienes máquinas sin receta (icono "?"). Tócalas y asigna una receta.' },
  { id: 'belts', cond: () => state.milestoneIndex === 2 && Object.keys(state.beltMap).length === 0,
    text: 'Usa el modo cintas para conectar mineros, máquinas y HUB y así automatizar.' },
  { id: 'overload', cond: () => state.power.overload,
    text: 'Red sobrecargada: construye más generadores (o aliméntalos) para cubrir la demanda.' },
  { id: 'fuel', cond: () => state.buildings.some(b => BUILDINGS[b.type].fuelItem && b.fuel <= 0 && b.burnLeft <= 0),
    text: 'Un generador no tiene combustible. Tócalo y cárgalo.' },
  { id: 'coal', cond: () => state.milestoneIndex >= 3 && !state.buildings.some(b => b.type === 'coal_generator'),
    text: 'El Generador de carbón (75 MW) se alimenta por cinta desde los yacimientos de carbón, en la periferia del mapa.' },
];

function updateHint() {
  const el = $('hint');
  if (state.victory) { el.classList.add('hidden'); return; }
  const h = HINTS.find(h => { try { return h.cond(); } catch (e) { return false; } });
  if (h) {
    if (el.textContent !== h.text) el.textContent = h.text;
    el.classList.remove('hidden');
  } else el.classList.add('hidden');
}

/* ---------------- Victoria / desbloqueos ---------------- */
function onVictory() {
  if (state.victoryShown) return;
  state.victoryShown = true;
  const m = Math.floor(state.playTime / 60), s = Math.floor(state.playTime % 60);
  $('vStats').innerHTML = `
    <p>Tiempo: <b>${m}m ${s}s</b></p>
    <p>Construcciones: <b>${state.stats.built}</b></p>
    <p>Objetos producidos: <b>${state.stats.produced}</b></p>
    <p>Fabricados a mano: <b>${state.stats.crafted}</b></p>
    <p>Entregados al HUB: <b>${state.stats.delivered}</b></p>`;
  $('victory').classList.remove('hidden');
  saveGame();
}

function onUnlocksChanged() {
  rebuildPalette();
  if (ui.sheetKind) refreshSheet();
}

function initUI() {
  // iconos SVG de la interfaz (sin emojis)
  $('powerStat').innerHTML = ICON_SVG.power + '<span id="powerVal"></span>';
  $('msStat').innerHTML = ICON_SVG.milestone + '<span id="msVal"></span>';
  $('invBtn').innerHTML = ICON_SVG.inventory;
  $('menuBtn').innerHTML = ICON_SVG.menu;
  $('sheetClose').innerHTML = ICON_SVG.close;
  const modeIcons = { select: 'select', build: 'build', belt: 'belt', demolish: 'demolish' };
  document.querySelectorAll('#modebar button').forEach(b => {
    b.innerHTML = ICON_SVG[modeIcons[b.dataset.mode]];
  });

  $('invBtn').addEventListener('click', () => { unlockAudio(); ui.sheetKind === 'inventory' ? closeSheet() : openSheet('inventory', 'Inventario'); });
  $('menuBtn').addEventListener('click', () => { unlockAudio(); ui.sheetKind === 'menu' ? closeSheet() : openSheet('menu', 'Menú'); });
  $('msStat').addEventListener('click', () => { unlockAudio(); openHubPanel('hitos'); });
  $('missionHud').addEventListener('click', () => { unlockAudio(); openHubPanel('hitos'); });
  $('sheetClose').addEventListener('click', closeSheet);
  $('ghostOk').addEventListener('click', confirmGhost);
  $('ghostCancel').addEventListener('click', cancelGhost);
  $('vContinue').addEventListener('click', () => $('victory').classList.add('hidden'));
}
