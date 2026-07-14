/* =========================================================
   Factoría 2D — Generación del mundo
   Mapa fijo (semilla constante) con yacimientos, agua y vegetación.
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

function genWorld() {
  const rng = mulberry32(20260714);
  const world = {
    water: [],   // {x,y,r} círculos de agua (en tiles)
    nodes: [],   // {id,x,y,type} yacimientos 2x2
    bushes: [],  // {x,y,charges,timer}
    trees: [],   // {x,y,hp}
    rocks: [],   // {x,y,s}
    waterTiles: {}, // key -> true
    nodeTiles: {},  // key -> node index
  };

  // Lagos decorativos (bloquean construcción)
  world.water = [
    { x: 54, y: 11, r: 4.2 },
    { x: 6.5, y: 7, r: 3.2 },
    { x: 59, y: 40, r: 3.5 },
    { x: 3, y: 30, r: 2.6 },
  ];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      for (const w of world.water) {
        const dx = x + 0.5 - w.x, dy = y + 0.5 - w.y;
        if (dx * dx + dy * dy < w.r * w.r) { world.waterTiles[key(x, y)] = true; break; }
      }
    }
  }

  // Yacimientos (2x2). El HUB estará en (18,22) 4x3.
  const nodeDefs = [
    // hierro: cerca del inicio
    ['iron', 25, 20], ['iron', 28, 23], ['iron', 24, 27],
    ['iron', 14, 31], ['iron', 11, 28],
    ['iron', 40, 14], ['iron', 43, 16],
    // cobre
    ['copper', 12, 16], ['copper', 15, 14],
    ['copper', 34, 33], ['copper', 37, 35],
    // caliza
    ['limestone', 29, 30], ['limestone', 31, 27],
    ['limestone', 9, 38], ['limestone', 12, 40],
    // carbón: más lejos
    ['coal', 44, 26], ['coal', 47, 28], ['coal', 45, 31],
    ['coal', 50, 40], ['coal', 53, 38],
  ];
  nodeDefs.forEach((nd, i) => {
    const node = { id: i, type: nd[0], x: nd[1], y: nd[2] };
    world.nodes.push(node);
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++)
        world.nodeTiles[key(node.x + dx, node.y + dy)] = i;
  });

  const reserved = (x, y) => {
    if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return true;
    if (world.waterTiles[key(x, y)]) return true;
    if (world.nodeTiles[key(x, y)] !== undefined) return true;
    // zona del HUB y alrededores
    if (x >= 15 && x <= 24 && y >= 19 && y <= 27) return true;
    return false;
  };

  // Arbustos de biomasa
  let tries = 0;
  while (world.bushes.length < 42 && tries++ < 4000) {
    const x = 1 + Math.floor(rng() * (MAP_W - 2));
    const y = 1 + Math.floor(rng() * (MAP_H - 2));
    if (reserved(x, y)) continue;
    if (world.bushes.some(b => Math.abs(b.x - x) + Math.abs(b.y - y) < 3)) continue;
    world.bushes.push({ x, y, charges: 3, timer: 0 });
  }

  // Árboles (talar da biomasa)
  tries = 0;
  while (world.trees.length < 34 && tries++ < 4000) {
    const x = 1 + Math.floor(rng() * (MAP_W - 2));
    const y = 1 + Math.floor(rng() * (MAP_H - 2));
    if (reserved(x, y)) continue;
    if (world.trees.some(t => Math.abs(t.x - x) + Math.abs(t.y - y) < 3)) continue;
    if (world.bushes.some(b => b.x === x && b.y === y)) continue;
    world.trees.push({ x, y, hp: 3 });
  }

  // Rocas decorativas (se quitan en modo demoler)
  tries = 0;
  while (world.rocks.length < 16 && tries++ < 3000) {
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
function inBounds(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
