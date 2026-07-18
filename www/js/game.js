/* =========================================================
   Factoría 2D — Lógica del juego (estado, simulación, construcción)
   ========================================================= */

const SAVE_KEY = 'factoria2d_save_v5';
let state = null;
let powerEdges = [];   // conexiones eléctricas activas [{a,b}] (para dibujar cables)

const DIRS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
const DIR_LIST = ['E', 'S', 'W', 'N'];
function dirOf(dx, dy) {
  if (dx === 1) return 'E'; if (dx === -1) return 'W';
  if (dy === 1) return 'S'; return 'N';
}
function opposite(d) { return { E: 'W', W: 'E', N: 'S', S: 'N' }[d]; }

/* ---------------- Nueva partida ---------------- */
function newGame() {
  const seed = (Math.random() * 2 ** 31) | 0;
  state = {
    version: 5,
    time: 0,
    playTime: 0,
    inventory: {},
    buildings: [],
    beltMap: {},          // "x,y" -> {x,y,dir,items:[{item,pos}]}
    occ: {},              // "x,y" -> building id
    nextId: 1,
    milestoneIndex: 0,
    msProgress: {},       // item -> entregado (del hito actual)
    unlockedB: ['hub'],
    unlockedR: [],
    cables: [],           // conexiones manuales de los postes [{a,b}] (ids de edificios)
    power: { sup: 0, dem: 0, overload: false },
    victory: false,
    victoryShown: false,
    stats: { mined: 0, crafted: 0, built: 0, produced: 0, delivered: 0 },
    introDone: false,
    world: genWorld(seed),
  };
  // No hay HUB inicial: el jugador debe construirlo con las piezas de la nave.
}

function hubBuilt() { return state.buildings.some(b => b.type === 'hub'); }

/* Recuperar las piezas de la nave estrellada (una sola vez) */
function salvageWreck() {
  const w = state.world.wreck;
  if (!w || w.salvaged) return false;
  w.salvaged = true;
  invAdd('plate', 10);
  invAdd('rod', 8);
  invAdd('cable', 5);
  sfx('collect');
  return true;
}

/* Al construir el HUB: entrega el pico y el plano del taladro portátil */
function onHubBuilt() {
  if (!state.unlockedB.includes('portable_miner')) state.unlockedB.push('portable_miner');
  sfx('milestone');
  toast('HUB operativo: has recibido el pico de minero.');
  toast('Nuevo plano desbloqueado: Taladro portátil.');
  onUnlocksChanged();
}

function mkBuilding(type, x, y) {
  const def = BUILDINGS[type];
  const b = {
    id: state.nextId++, type, x, y,
    recipe: null, inBuf: {}, outBuf: {}, progress: 0, working: false,
  };
  if (type === 'storage') b.store = {};
  if (type === 'splitter') { b.queue = []; b.rr = 0; }
  if (def.fuelItem) { b.fuel = 0; b.burnLeft = 0; }
  if (type === 'miner1' || type === 'miner2' || type === 'portable_miner') {
    const n = nodeAt(x, y);
    b.nodeType = n ? n.type : null;
    b.buf = 0;
  }
  return b;
}

function occupy(b) {
  const def = BUILDINGS[b.type];
  for (let dy = 0; dy < def.h; dy++)
    for (let dx = 0; dx < def.w; dx++)
      state.occ[key(b.x + dx, b.y + dy)] = b.id;
}
function unoccupy(b) {
  const def = BUILDINGS[b.type];
  for (let dy = 0; dy < def.h; dy++)
    for (let dx = 0; dx < def.w; dx++)
      delete state.occ[key(b.x + dx, b.y + dy)];
}
function buildingAt(x, y) {
  const id = state.occ[key(x, y)];
  if (id === undefined) return null;
  return state.buildings.find(b => b.id === id) || null;
}
function beltAt(x, y) { return state.beltMap[key(x, y)] || null; }

/* ---------------- Inventario ---------------- */
function invCount(item) { return state.inventory[item] || 0; }
function invAdd(item, n) {
  if (n === 0) return;
  state.inventory[item] = (state.inventory[item] || 0) + n;
  if (state.inventory[item] <= 0) delete state.inventory[item];
}
function canAfford(cost) {
  for (const k in cost) if (invCount(k) < cost[k]) return false;
  return true;
}
function payCost(cost) { for (const k in cost) invAdd(k, -cost[k]); }
function refund(cost) { for (const k in cost) invAdd(k, cost[k]); }

/* ---------------- Construcción ---------------- */
function tileFree(x, y) {
  if (!inBounds(x, y)) return false;
  if (isWater(x, y)) return false;
  if (wreckAt(x, y)) return false;
  if (state.occ[key(x, y)] !== undefined) return false;
  if (beltAt(x, y)) return false;
  if (treeAt(x, y) || rockAt(x, y) || bushAt(x, y)) return false;
  return true;
}

function canPlaceBuilding(type, x, y) {
  const def = BUILDINGS[type];
  const isMiner = type === 'miner1' || type === 'miner2';
  const onNode = isMiner || type === 'portable_miner';
  let node = null;
  if (onNode) {
    node = nodeAt(x, y);
    if (!node) return { ok: false, why: 'Debe colocarse sobre un yacimiento' };
    if (isMiner) { x = node.x; y = node.y; }
  }
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!inBounds(tx, ty)) return { ok: false, why: 'Fuera del mapa' };
      if (isWater(tx, ty)) return { ok: false, why: 'No se puede construir en el agua' };
      if (wreckAt(tx, ty)) return { ok: false, why: 'Los restos de la nave bloquean el paso' };
      if (state.occ[key(tx, ty)] !== undefined) return { ok: false, why: 'Espacio ocupado' };
      if (beltAt(tx, ty)) return { ok: false, why: 'Hay una cinta en el camino' };
      if (treeAt(tx, ty) || rockAt(tx, ty) || bushAt(tx, ty)) return { ok: false, why: 'Despeja la vegetación primero' };
      const n = nodeAt(tx, ty);
      if (onNode) {
        if (!n || n !== node) {
          if (isMiner) return { ok: false, why: 'Debe cubrir el yacimiento completo' };
          if (type === 'portable_miner' && !n) return { ok: false, why: 'Debe colocarse sobre un yacimiento' };
        }
      } else if (n) {
        return { ok: false, why: 'No se puede construir sobre un yacimiento' };
      }
    }
  }
  if (type === 'portable_miner') {
    const count = state.buildings.filter(b => b.type === 'portable_miner').length;
    if (count >= def.limit) return { ok: false, why: 'Máximo ' + def.limit + ' taladros portátiles' };
  }
  if (type === 'hub' && hubBuilt()) return { ok: false, why: 'Ya tienes un HUB' };
  return { ok: true, x, y };
}

function placeBuilding(type, x, y) {
  const def = BUILDINGS[type];
  const chk = canPlaceBuilding(type, x, y);
  if (!chk.ok) return chk;
  if (!canAfford(def.cost)) return { ok: false, why: 'Faltan materiales: ' + fmtCost(def.cost) };
  payCost(def.cost);
  const b = mkBuilding(type, chk.x !== undefined ? chk.x : x, chk.y !== undefined ? chk.y : y);
  state.buildings.push(b);
  occupy(b);
  state.stats.built++;
  sfx('build');
  if (type === 'hub') onHubBuilt();
  return { ok: true, b };
}

function demolishBuilding(b) {
  if (b.type === 'hub') return false;
  const def = BUILDINGS[b.type];
  refund(def.cost);
  // devolver contenidos
  for (const k in b.inBuf) invAdd(k, b.inBuf[k]);
  for (const k in b.outBuf) invAdd(k, b.outBuf[k]);
  if (b.store) for (const k in b.store) invAdd(k, b.store[k]);
  if (b.queue) for (const it of b.queue) invAdd(it, 1);
  if (b.fuel) invAdd(def.fuelItem, b.fuel);
  if (b.buf && b.nodeType) invAdd(NODE_TYPES[b.nodeType].item, Math.floor(b.buf));
  const cut = (state.cables || []).filter(c => c.a === b.id || c.b === b.id).length;
  if (cut > 0) {
    state.cables = state.cables.filter(c => c.a !== b.id && c.b !== b.id);
    invAdd('cable', cut);
  }
  unoccupy(b);
  state.buildings = state.buildings.filter(x => x.id !== b.id);
  sfx('demolish');
  return true;
}

/* ---------------- Cintas ---------------- */
function canPlaceBelt(x, y) {
  if (!inBounds(x, y)) return false;
  if (isWater(x, y)) return false;
  if (wreckAt(x, y)) return false;
  if (state.occ[key(x, y)] !== undefined) return false;
  if (nodeAt(x, y)) return false;
  if (treeAt(x, y) || rockAt(x, y) || bushAt(x, y)) return false;
  return true;
}

/* Coloca una ruta de cintas [{x,y},...]. Devuelve nº colocadas. */
function placeBeltPath(path) {
  let placed = 0;
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    let dir;
    if (i < path.length - 1) dir = dirOf(path[i + 1].x - c.x, path[i + 1].y - c.y);
    else if (i > 0) dir = dirOf(c.x - path[i - 1].x, c.y - path[i - 1].y);
    else dir = c.dir || 'E';
    const existing = beltAt(c.x, c.y);
    if (existing) { existing.dir = dir; continue; }
    if (!canPlaceBelt(c.x, c.y)) continue;
    if (!canAfford(BUILDINGS.conveyor.cost)) {
      toast('Sin placas para más cintas');
      break;
    }
    payCost(BUILDINGS.conveyor.cost);
    state.beltMap[key(c.x, c.y)] = { x: c.x, y: c.y, dir, items: [] };
    placed++;
  }
  if (placed > 0) { state.stats.built += placed; sfx('build'); }
  return placed;
}

function removeBelt(x, y) {
  const b = beltAt(x, y);
  if (!b) return false;
  for (const it of b.items) invAdd(it.item, 1);
  refund(BUILDINGS.conveyor.cost);
  delete state.beltMap[key(x, y)];
  sfx('demolish');
  return true;
}

/* ¿Acepta el edificio este objeto (por cinta)? */
function acceptsItem(b, item) {
  const def = BUILDINGS[b.type];
  if (b.type === 'hub') return true;
  if (b.type === 'storage') {
    let total = 0; for (const k in b.store) total += b.store[k];
    return total < def.cap;
  }
  if (b.type === 'splitter') return b.queue.length < 6;
  if (def.fuelItem) return item === def.fuelItem && b.fuel < 50;
  if (b.recipe) {
    const r = RECIPES[b.recipe];
    if (!(item in r.in)) return false;
    const cap = Math.max(10, r.in[item] * 4);
    return (b.inBuf[item] || 0) < cap;
  }
  return false;
}

function insertItem(b, item) {
  if (b.type === 'hub') { invAdd(item, 1); return; }
  if (b.type === 'storage') { b.store[item] = (b.store[item] || 0) + 1; return; }
  if (b.type === 'splitter') { b.queue.push(item); return; }
  const def = BUILDINGS[b.type];
  if (def.fuelItem) { b.fuel++; return; }
  b.inBuf[item] = (b.inBuf[item] || 0) + 1;
}

/* Puertos de salida: cintas adyacentes que NO apuntan hacia el edificio */
function outputBelts(b) {
  const def = BUILDINGS[b.type];
  const out = [];
  const check = (bx, by, intoDir) => {
    const belt = beltAt(bx, by);
    if (belt && belt.dir !== intoDir) out.push(belt);
  };
  for (let dx = 0; dx < def.w; dx++) {
    check(b.x + dx, b.y - 1, 'S');          // arriba: hacia el edificio sería S
    check(b.x + dx, b.y + def.h, 'N');      // abajo
  }
  for (let dy = 0; dy < def.h; dy++) {
    check(b.x - 1, b.y + dy, 'E');          // izquierda
    check(b.x + def.w, b.y + dy, 'W');      // derecha
  }
  return out;
}

function beltHasSpaceAtStart(belt) {
  for (const it of belt.items) if (it.pos < BELT_SPACING) return false;
  return true;
}

function pushToBelts(b, getItem) {
  const belts = outputBelts(b);
  for (const belt of belts) {
    if (!beltHasSpaceAtStart(belt)) continue;
    const item = getItem();
    if (!item) return;
    belt.items.push({ item, pos: 0 });
  }
}

/* ---------------- Energía: red eléctrica con postes y cables ----------------
   Nodos: generadores (con power>0, incl. HUB), postes y máquinas consumidoras.
   Enlaces (por hueco entre huellas, en tiles):
     poste ↔ poste/generador/HUB  ≤ LINK_RANGE
     máquina ↔ poste/generador/HUB ≤ PLUG_RANGE
   Cada componente conexa es una red con su generación/demanda propia. */

function isPowerSource(b) { return BUILDINGS[b.type].power > 0; }
function isPowerConsumer(b) { return BUILDINGS[b.type].power < 0; }
function isPole(b) { return !!BUILDINGS[b.type].pole; }

/* Hueco entre las huellas de dos edificios, en tiles */
function buildingGap(a, b) {
  const da = BUILDINGS[a.type], db = BUILDINGS[b.type];
  const gx = Math.max(0, Math.max(b.x - (a.x + da.w), a.x - (b.x + db.w)));
  const gy = Math.max(0, Math.max(b.y - (a.y + da.h), a.y - (b.y + db.h)));
  return Math.hypot(gx, gy);
}

/* ---- Cables manuales de los postes ----
   Un poste admite hasta 3 conexiones, trazadas por el jugador (1 Cable cada una).
   Las máquinas solo se enchufan automáticamente a generadores/HUB cercanos. */
function cableCount(b) {
  return (state.cables || []).filter(c => c.a === b.id || c.b === b.id).length;
}
function cableLimit(b) {
  if (isPole(b)) return 3;
  if (isPowerConsumer(b)) return 1;
  return 99;   // generadores y HUB
}
function addCable(pole, target) {
  if (!target || target.id === pole.id) return { ok: false, why: 'Objetivo no válido' };
  if (!(isPowerSource(target) || isPowerConsumer(target) || isPole(target)))
    return { ok: false, why: 'Ese edificio no se conecta a la red eléctrica' };
  if ((state.cables || []).some(c =>
    (c.a === pole.id && c.b === target.id) || (c.b === pole.id && c.a === target.id)))
    return { ok: false, why: 'Ya están conectados' };
  if (cableCount(pole) >= 3) return { ok: false, why: 'El poste ya tiene sus 3 conexiones' };
  if (cableCount(target) >= cableLimit(target))
    return { ok: false, why: isPole(target) ? 'Ese poste ya tiene sus 3 conexiones' : 'Esa máquina ya tiene un cable' };
  if (buildingGap(pole, target) > LINK_RANGE)
    return { ok: false, why: 'Demasiado lejos (máximo ' + LINK_RANGE + ' casillas)' };
  if (invCount('cable') < 1) return { ok: false, why: 'Necesitas 1 Cable para trazar la conexión' };
  invAdd('cable', -1);
  state.cables.push({ a: pole.id, b: target.id });
  sfx('build');
  return { ok: true };
}
function removeCable(idx) {
  const c = (state.cables || [])[idx];
  if (!c) return false;
  state.cables.splice(idx, 1);
  invAdd('cable', 1);
  sfx('demolish');
  return true;
}

let _wasOverloaded = false;

function computePower() {
  const nodes = state.buildings.filter(b => isPowerSource(b) || isPowerConsumer(b) || isPole(b));
  const byId = new Map(nodes.map(n => [n.id, n]));
  // descartar cables cuyos extremos ya no existen
  state.cables = (state.cables || []).filter(c => byId.has(c.a) && byId.has(c.b));
  powerEdges = [];
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id, []));
  const link = (a, b) => {
    adj.get(a.id).push(b);
    adj.get(b.id).push(a);
    powerEdges.push({ a, b });
  };
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (isPole(a) || isPole(b)) continue;   // los postes solo conectan por cables trazados
      if (isPowerSource(a) && isPowerSource(b)) {
        if (buildingGap(a, b) <= LINK_RANGE) link(a, b);
      } else if (isPowerSource(a) !== isPowerSource(b)) {
        if (buildingGap(a, b) <= PLUG_RANGE) link(a, b);   // enchufe directo a generador/HUB
      }
    }
  }
  for (const c of state.cables) link(byId.get(c.a), byId.get(c.b));

  // componentes conexas
  const seen = new Set();
  let totSup = 0, totDem = 0, overload = false;
  for (const n of nodes) {
    if (isPowerConsumer(n)) { n._pw = false; n._conn = false; }
    if (isPowerSource(n)) n._burnF = 0;
  }
  for (const start of nodes) {
    if (seen.has(start.id)) continue;
    const comp = [];
    const queue = [start];
    seen.add(start.id);
    while (queue.length) {
      const cur = queue.pop();
      comp.push(cur);
      for (const nb of adj.get(cur.id)) {
        if (!seen.has(nb.id)) { seen.add(nb.id); queue.push(nb); }
      }
    }
    let sup = 0, dem = 0, hasSource = false;
    for (const b of comp) {
      const def = BUILDINGS[b.type];
      if (isPowerSource(b)) {
        hasSource = true;
        const active = !def.fuelItem || b.fuel > 0 || b.burnLeft > 0;
        if (active) sup += def.power;
      } else if (isPowerConsumer(b) && machineWants(b)) {
        dem += -def.power;
      }
    }
    const ok = sup > 0 && dem <= sup;
    if (sup > 0 && dem > sup) overload = true;
    const burnF = sup > 0 ? Math.min(1, dem / sup) : 0;
    for (const b of comp) {
      if (isPowerConsumer(b)) { b._pw = ok; b._conn = hasSource; }
      if (isPowerSource(b)) b._burnF = burnF;
    }
    totSup += sup;
    totDem += dem;
  }
  state.power.sup = totSup;
  state.power.dem = totDem;
  state.power.overload = overload;
  if (overload && !_wasOverloaded) {
    sfx('error');
    toast('Red sobrecargada: la demanda supera la generación. Añade o alimenta generadores.');
  }
  _wasOverloaded = overload;
}

function machineWants(b) {
  if (b.type === 'miner1' || b.type === 'miner2') return b.buf < OUT_CAP;
  if (b.working) return true;
  if (!b.recipe) return false;
  const r = RECIPES[b.recipe];
  for (const k in r.in) if ((b.inBuf[k] || 0) < r.in[k]) return false;
  for (const k in r.out) if ((b.outBuf[k] || 0) + r.out[k] > OUT_CAP) return false;
  return true;
}

/* ---------------- Simulación ---------------- */
function tick(dt) {
  if (!state) return;
  state.time += dt;
  state.playTime += dt;

  // arbustos: recarga
  for (const bush of state.world.bushes) {
    if (bush.charges <= 0) {
      bush.timer -= dt;
      if (bush.timer <= 0) bush.charges = 3;
    }
  }

  computePower();

  // generadores: quemar combustible según la demanda de su red
  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];
    if (def.power <= 0 || !def.fuelItem) continue;
    if (b.burnLeft <= 0 && b.fuel > 0) { b.fuel--; b.burnLeft = def.burnTime; }
    if (b.burnLeft > 0) b.burnLeft -= dt * Math.max(0.05, b._burnF || 0);
  }

  // cintas: mover objetos
  for (const k in state.beltMap) {
    const belt = state.beltMap[k];
    if (!belt.items.length) continue;
    belt.items.sort((a, b2) => b2.pos - a.pos);
    for (let i = 0; i < belt.items.length; i++) {
      const it = belt.items[i];
      let target = it.pos + BELT_SPEED * dt;
      if (i > 0) target = Math.min(target, belt.items[i - 1].pos - BELT_SPACING);
      if (i === 0 && target >= 1) {
        const [dx, dy] = DIRS[belt.dir];
        const nx = belt.x + dx, ny = belt.y + dy;
        const nb = beltAt(nx, ny);
        if (nb) {
          let minPos = Infinity;
          for (const o of nb.items) minPos = Math.min(minPos, o.pos);
          if (minPos >= BELT_SPACING) {
            belt.items.splice(i, 1); i--;
            nb.items.push({ item: it.item, pos: Math.min(target - 1, minPos - BELT_SPACING) });
            continue;
          } else target = 1;
        } else {
          const bld = buildingAt(nx, ny);
          if (bld && acceptsItem(bld, it.item)) {
            insertItem(bld, it.item);
            belt.items.splice(i, 1); i--;
            continue;
          } else target = 1;
        }
      }
      it.pos = Math.max(it.pos, Math.min(target, 1));
    }
  }

  // edificios
  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];

    if (b.type === 'portable_miner') {
      if (b.buf < def.cap) {
        b.buf += def.rate * dt;
        if (b.buf > def.cap) b.buf = def.cap;
      }
      continue;
    }

    if (b.type === 'miner1' || b.type === 'miner2') {
      if (b._pw && b.buf < OUT_CAP) {
        b.progress += def.rate * dt;
        while (b.progress >= 1 && b.buf < OUT_CAP) { b.progress -= 1; b.buf++; state.stats.produced++; }
        if (b.buf >= OUT_CAP) b.progress = Math.min(b.progress, 1);
      }
      if (b.buf >= 1 && b.nodeType) {
        const item = NODE_TYPES[b.nodeType].item;
        pushToBelts(b, () => { if (b.buf >= 1) { b.buf--; return item; } return null; });
      }
      continue;
    }

    if (MACH_RECIPES[b.type]) {
      if (b.recipe) {
        const r = RECIPES[b.recipe];
        if (!b.working) {
          let can = true;
          for (const k2 in r.in) if ((b.inBuf[k2] || 0) < r.in[k2]) can = false;
          for (const k2 in r.out) if ((b.outBuf[k2] || 0) + r.out[k2] > OUT_CAP) can = false;
          if (can) {
            for (const k2 in r.in) b.inBuf[k2] -= r.in[k2];
            b.working = true; b.progress = 0;
          }
        }
        if (b.working && b._pw) {
          b.progress += dt / r.time;
          if (b.progress >= 1) {
            for (const k2 in r.out) {
              b.outBuf[k2] = (b.outBuf[k2] || 0) + r.out[k2];
              state.stats.produced += r.out[k2];
            }
            b.working = false; b.progress = 0;
          }
        }
      }
      // empujar salida a cintas
      pushToBelts(b, () => {
        for (const k2 in b.outBuf) {
          if (b.outBuf[k2] >= 1) { b.outBuf[k2]--; if (b.outBuf[k2] <= 0) delete b.outBuf[k2]; return k2; }
        }
        return null;
      });
      continue;
    }

    if (b.type === 'splitter') {
      // reparto por turnos entre las cintas de salida
      if (b.queue.length) {
        const outs = outputBelts(b);
        for (let k = 0; k < outs.length && b.queue.length; k++) {
          const belt = outs[(b.rr + k) % outs.length];
          if (beltHasSpaceAtStart(belt)) {
            belt.items.push({ item: b.queue.shift(), pos: 0 });
            b.rr = (b.rr + k + 1) % Math.max(1, outs.length);
            break;
          }
        }
      }
      continue;
    }

    if (b.type === 'storage') {
      pushToBelts(b, () => {
        for (const k2 in b.store) {
          if (b.store[k2] >= 1) { b.store[k2]--; if (b.store[k2] <= 0) delete b.store[k2]; return k2; }
        }
        return null;
      });
    }
  }
}

/* ---------------- Interacción con el mundo ---------------- */
let mineCooldown = 0;
function manualMine(node) {
  if (performance.now() < mineCooldown) return false;
  mineCooldown = performance.now() + 220;
  if (!hubBuilt()) {
    toast('Necesitas el pico de minero: recupera los restos de la nave y construye el HUB.');
    return false;
  }
  const item = NODE_TYPES[node.type].item;
  invAdd(item, 1);
  state.stats.mined++;
  sfx('mine');
  return item;
}

function harvestBush(bush) {
  if (bush.charges <= 0) return 0;
  bush.charges--;
  if (bush.charges <= 0) bush.timer = 60;
  invAdd('biomass', 4);
  sfx('collect');
  return 4;
}

function chopTree(tree) {
  tree.hp--;
  sfx('mine');
  if (tree.hp <= 0) {
    state.world.trees = state.world.trees.filter(t => t !== tree);
    invAdd('biomass', 8);
    sfx('collect');
    return 8;
  }
  return 0;
}

function collectPortable(b) {
  const n = Math.floor(b.buf);
  if (n <= 0) return 0;
  b.buf -= n;
  invAdd(NODE_TYPES[b.nodeType].item, n);
  state.stats.mined += n;
  sfx('collect');
  return n;
}

function collectOutput(b) {
  let total = 0;
  for (const k in b.outBuf) {
    const n = Math.floor(b.outBuf[k]);
    if (n > 0) { invAdd(k, n); b.outBuf[k] -= n; total += n; }
    if (b.outBuf[k] <= 0) delete b.outBuf[k];
  }
  if (total > 0) sfx('collect');
  return total;
}

function loadFuel(b, amount) {
  const def = BUILDINGS[b.type];
  const item = def.fuelItem;
  const n = Math.min(amount, invCount(item), 50 - b.fuel);
  if (n <= 0) return 0;
  invAdd(item, -n);
  b.fuel += n;
  sfx('click');
  return n;
}

/* ---------------- Fabricación manual (banco del HUB) ---------------- */
function handCraft(recipeId, times) {
  const r = RECIPES[recipeId];
  let made = 0;
  for (let i = 0; i < times; i++) {
    if (!canAfford(r.in)) break;
    payCost(r.in);
    for (const k in r.out) invAdd(k, r.out[k]);
    made++;
  }
  if (made > 0) { state.stats.crafted += made; sfx('craft'); }
  return made;
}

/* ---------------- Hitos ---------------- */
function currentMilestone() {
  return MILESTONES[state.milestoneIndex] || null;
}

function deliverItem(item) {
  const ms = currentMilestone();
  if (!ms || !(item in ms.req)) return 0;
  const done = state.msProgress[item] || 0;
  const need = ms.req[item] - done;
  const n = Math.min(need, invCount(item));
  if (n <= 0) return 0;
  invAdd(item, -n);
  state.msProgress[item] = done + n;
  state.stats.delivered += n;
  sfx('collect');
  checkMilestone();
  return n;
}

function milestoneComplete(ms) {
  for (const k in ms.req) if ((state.msProgress[k] || 0) < ms.req[k]) return false;
  return true;
}

function checkMilestone() {
  const ms = currentMilestone();
  if (!ms || !milestoneComplete(ms)) return;
  // aplicar desbloqueos
  const u = ms.unlocks || {};
  (u.buildings || []).forEach(b => { if (!state.unlockedB.includes(b)) state.unlockedB.push(b); });
  (u.recipes || []).forEach(r => { if (!state.unlockedR.includes(r)) state.unlockedR.push(r); });
  state.milestoneIndex++;
  state.msProgress = {};
  sfx('milestone');
  if (u.victory) {
    state.victory = true;
    onVictory();
  } else {
    toast('Hito completado: ' + ms.name);
    const next = currentMilestone();
    if (next) toast('Nuevo hito: ' + next.name);
    onUnlocksChanged();
  }
}

/* ---------------- Guardar / Cargar ---------------- */
function saveGame() {
  try {
    const s = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, s);
    return true;
  } catch (e) { return false; }
}

function loadGame() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return false;
    const data = JSON.parse(s);
    if (!data || data.version !== 5) return false;
    state = data;
    return true;
  } catch (e) { return false; }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  newGame();
  onUnlocksChanged();
}
