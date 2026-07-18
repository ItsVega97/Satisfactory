/* =========================================================
   Factoría 2D — Generación procedural del mundo
   Cada partida usa una semilla aleatoria: lagos, yacimientos en
   anillos de distancia alrededor del HUB y vegetación.
   ========================================================= */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function key(x, y) { return x + ',' + y; }

function genWorld(seed) {
  const rng = mulberry32(seed);
  const hubX = Math.floor(MAP_W / 2) - 2;
  const hubY = Math.floor(MAP_H / 2) - 2;
  const hcx = hubX + 2, hcy = hubY + 1.5;   // centro del HUB

  const world = {
    seed, hubX, hubY,
    // restos de la nave estrellada (4x2), junto al lugar del futuro HUB
    wreck: { x: hubX + 1, y: hubY - 3, salvaged: false },
    water: [],
    nodes: [],
    bushes: [],
    trees: [],
    rocks: [],
    waterTiles: {},
    nodeTiles: {},
  };

  const inHubZone = (x, y) => x >= hubX - 4 && x <= hubX + 8 && y >= hubY - 4 && y <= hubY + 7;

  /* ---- Lagos ---- */
  let tries = 0;
  while (world.water.length < 5 && tries++ < 400) {
    const x = 5 + rng() * (MAP_W - 10);
    const y = 5 + rng() * (MAP_H - 10);
    const r = 2.4 + rng() * 2.2;
    if (Math.hypot(x - hcx, y - hcy) < r + 11) continue;
    if (world.water.some(w => Math.hypot(w.x - x, w.y - y) < w.r + r + 4)) continue;
    world.water.push({ x, y, r });
  }
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      for (const w of world.water) {
        const dx = x + 0.5 - w.x, dy = y + 0.5 - w.y;
        if (dx * dx + dy * dy < w.r * w.r) { world.waterTiles[key(x, y)] = true; break; }
      }
    }
  }

  /* ---- Yacimientos (2x2) en anillos de distancia ---- */
  const nodeFits = (x, y) => {
    if (x < 2 || y < 2 || x >= MAP_W - 4 || y >= MAP_H - 4) return false;
    for (let dy = -1; dy < 3; dy++) {
      for (let dx = -1; dx < 3; dx++) {
        const tx = x + dx, ty = y + dy;
        if (world.waterTiles[key(tx, ty)]) return false;
        if (world.nodeTiles[key(tx, ty)] !== undefined) return false;
        if (inHubZone(tx, ty)) return false;
      }
    }
    return true;
  };
  const commitNode = (type, x, y) => {
    const node = { id: world.nodes.length, type, x, y };
    world.nodes.push(node);
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++)
        world.nodeTiles[key(x + dx, y + dy)] = node.id;
  };

  /* Coloca un grupo de `count` nodos a distancia [minD,maxD] del HUB */
  const placeCluster = (type, minD, maxD, count) => {
    for (let t = 0; t < 400; t++) {
      const a = rng() * Math.PI * 2;
      const d = minD + rng() * (maxD - minD);
      const cx = Math.round(hcx + Math.cos(a) * d);
      const cy = Math.round(hcy + Math.sin(a) * d * 0.75);
      const spots = [];
      // primer nodo en el centro del grupo, resto alrededor
      if (nodeFits(cx, cy)) spots.push([cx, cy]);
      let guard = 0;
      while (spots.length < count && guard++ < 60) {
        const ox = cx + Math.round((rng() - 0.5) * 8);
        const oy = cy + Math.round((rng() - 0.5) * 7);
        if (!nodeFits(ox, oy)) continue;
        if (spots.some(s => Math.abs(s[0] - ox) < 3 && Math.abs(s[1] - oy) < 3)) continue;
        spots.push([ox, oy]);
      }
      if (spots.length >= count) {
        spots.slice(0, count).forEach(s => commitNode(type, s[0], s[1]));
        return true;
      }
    }
    // último recurso: buscar cualquier hueco en el mapa
    for (let t = 0; t < 3000 && count > 0; t++) {
      const x = 2 + Math.floor(rng() * (MAP_W - 6));
      const y = 2 + Math.floor(rng() * (MAP_H - 6));
      if (nodeFits(x, y)) { commitNode(type, x, y); count--; }
    }
    return count === 0;
  };

  // yacimientos escasos (3-4 por tipo) y alejados del lugar del accidente:
  // hay que explorar y tender cintas largas hasta la base
  placeCluster('iron', 11, 16, 2);
  placeCluster('iron', 16, 26, 2);
  placeCluster('copper', 12, 18, 2);
  placeCluster('copper', 18, 28, 1);
  placeCluster('limestone', 13, 20, 2);
  placeCluster('limestone', 18, 30, 1);
  placeCluster('coal', 20, 28, 2);
  placeCluster('coal', 26, 36, 2);

  /* ---- Vegetación ---- */
  const reserved = (x, y) => {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return true;
    if (world.waterTiles[key(x, y)]) return true;
    if (world.nodeTiles[key(x, y)] !== undefined) return true;
    if (inHubZone(x, y)) return true;
    return false;
  };

  tries = 0;
  const bushTarget = Math.floor(MAP_W * MAP_H / 110);
  while (world.bushes.length < bushTarget && tries++ < 6000) {
    const x = 1 + Math.floor(rng() * (MAP_W - 2));
    const y = 1 + Math.floor(rng() * (MAP_H - 2));
    if (reserved(x, y)) continue;
    if (world.bushes.some(b => Math.abs(b.x - x) + Math.abs(b.y - y) < 3)) continue;
    world.bushes.push({ x, y, charges: 3, timer: 0 });
  }

  tries = 0;
  const treeTarget = Math.floor(MAP_W * MAP_H / 130);
  while (world.trees.length < treeTarget && tries++ < 6000) {
    const x = 1 + Math.floor(rng() * (MAP_W - 2));
    const y = 1 + Math.floor(rng() * (MAP_H - 2));
    if (reserved(x, y)) continue;
    if (world.trees.some(t => Math.abs(t.x - x) + Math.abs(t.y - y) < 3)) continue;
    if (world.bushes.some(b => b.x === x && b.y === y)) continue;
    world.trees.push({ x, y, hp: 3 });
  }

  tries = 0;
  const rockTarget = Math.floor(MAP_W * MAP_H / 260);
  while (world.rocks.length < rockTarget && tries++ < 4000) {
    const x = 1 + Math.floor(rng() * (MAP_W - 2));
    const y = 1 + Math.floor(rng() * (MAP_H - 2));
    if (reserved(x, y)) continue;
    if (world.trees.some(t => t.x === x && t.y === y)) continue;
    if (world.bushes.some(b => b.x === x && b.y === y)) continue;
    world.rocks.push({ x, y, s: 0.7 + rng() * 0.5 });
  }

  return world;
}

/* Utilidades de consulta sobre el mundo (usan el estado global `state`) */
function nodeAt(x, y) {
  const i = state.world.nodeTiles[key(x, y)];
  return i === undefined ? null : state.world.nodes[i];
}
function isWater(x, y) { return !!state.world.waterTiles[key(x, y)]; }
function treeAt(x, y) { return state.world.trees.find(t => t.x === x && t.y === y); }
function bushAt(x, y) { return state.world.bushes.find(b => b.x === x && b.y === y); }
function rockAt(x, y) { return state.world.rocks.find(r => r.x === x && r.y === y); }
function wreckAt(x, y) {
  const w = state.world.wreck;
  return w && x >= w.x && x < w.x + 4 && y >= w.y && y < w.y + 2;
}
function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
