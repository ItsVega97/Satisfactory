/* =========================================================
   Factoría 2D — Renderizado (canvas, pseudo-3D con sombras)
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let dpr = 1;

const cam = { x: 0, y: 0, z: 1 };   // x,y en píxeles de mundo (centro), z = zoom
const ZOOM_MIN = 0.35, ZOOM_MAX = 2.6;

let groundCanvas = null;
let floatTexts = [];   // {x,y,txt,t,color,item}
let ripples = [];      // ondas al tocar {x,y,start}

function addRipple(wx, wy) {
  ripples.push({ x: wx, y: wy, start: performance.now() });
  if (ripples.length > 6) ripples.shift();
}

function addFloat(wx, wy, txt, color, item) {
  floatTexts.push({ x: wx, y: wy, t: 0, txt, color: color || '#fff', item: item || null });
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - window.innerWidth / 2) / cam.z + cam.x,
    y: (sy - window.innerHeight / 2) / cam.z + cam.y,
  };
}
function screenToTile(sx, sy) {
  const w = screenToWorld(sx, sy);
  return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
}

function clampCam() {
  cam.z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.z));
  const mw = MAP_W * TILE, mh = MAP_H * TILE;
  cam.x = Math.max(0, Math.min(mw, cam.x));
  cam.y = Math.max(0, Math.min(mh, cam.y));
}

/* ---------------- Minimapa ---------------- */
const MINI_SCALE = 2;   // px por tile
let minimapCanvas = null, minimapCtx = null;

function initMinimap() {
  minimapCanvas = document.getElementById('minimapCanvas');
  minimapCtx = minimapCanvas.getContext('2d');
  minimapCanvas.width = MAP_W * MINI_SCALE;
  minimapCanvas.height = MAP_H * MINI_SCALE;
  minimapCanvas.style.width = (MAP_W * MINI_SCALE) + 'px';
  minimapCanvas.style.height = (MAP_H * MINI_SCALE) + 'px';

  minimapCanvas.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const r = minimapCanvas.getBoundingClientRect();
    const scaleX = minimapCanvas.width / r.width, scaleY = minimapCanvas.height / r.height;
    const mx = (e.clientX - r.left) * scaleX / MINI_SCALE;
    const my = (e.clientY - r.top) * scaleY / MINI_SCALE;
    cam.x = mx * TILE;
    cam.y = my * TILE;
    clampCam();
    sfx('click');
  });
  document.getElementById('minimapToggle').addEventListener('pointerdown', e => {
    e.stopPropagation();
    document.getElementById('minimap').classList.toggle('collapsed');
  });
}

function setMinimapVisible(v) {
  const el = document.getElementById('minimap');
  if (el) el.classList.toggle('hidden', !v);
}

function drawMinimap() {
  if (!minimapCtx || !state || !state.world) return;
  const m = minimapCtx, s = MINI_SCALE;
  m.fillStyle = '#1c2a17';
  m.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

  m.fillStyle = '#2e6787';
  for (const w of state.world.water) {
    m.beginPath(); m.ellipse(w.x * s, w.y * s, w.r * s, w.r * s * 0.85, 0, 0, Math.PI * 2); m.fill();
  }

  for (const n of state.world.nodes) {
    m.fillStyle = nodeScanned(n.type) ? NODE_TYPES[n.type].color : UNSCANNED_COLOR;
    m.fillRect(n.x * s - 1, n.y * s - 1, s * 2 + 2, s * 2 + 2);
  }

  const wreck = state.world.wreck;
  if (wreck && !wreck.salvaged) { m.fillStyle = '#ff7a66'; m.fillRect(wreck.x * s, wreck.y * s, 4 * s, 2 * s); }

  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];
    m.fillStyle = b.type === 'hub' ? '#ffd64f' : (def.pole ? '#caa46a' : '#cfe0c8');
    m.fillRect(b.x * s, b.y * s, Math.max(2, def.w * s), Math.max(2, def.h * s));
  }

  const vw = window.innerWidth / cam.z / TILE, vh = window.innerHeight / cam.z / TILE;
  const cx = cam.x / TILE, cy = cam.y / TILE;
  m.strokeStyle = '#f59e2e'; m.lineWidth = 1.5;
  m.strokeRect((cx - vw / 2) * s, (cy - vh / 2) * s, vw * s, vh * s);
}

/* ---------------- Suelo (pre-renderizado) ---------------- */
function buildGround() {
  groundCanvas = document.createElement('canvas');
  groundCanvas.width = MAP_W * TILE;
  groundCanvas.height = MAP_H * TILE;
  const g = groundCanvas.getContext('2d');
  const rng = mulberry32(777);

  const ph = mulberry32(state.world.seed || 1)() * 6.28;   // fase de los parches por semilla
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const v = rng();
      let c;
      if (isWater(x, y)) c = '#2e6787';
      else {
        // dos escalas: parches amplios de pradera + grano fino
        const patch = Math.sin(x * 0.16 + ph) * Math.sin(y * 0.13 + ph * 1.7)
                    + Math.sin((x + y) * 0.07 + ph * 0.6) * 0.6;
        const shade = 0.90 + v * 0.10 + patch * 0.045;
        const r = Math.floor(86 * shade), gr = Math.floor(128 * shade), b = Math.floor(68 * shade);
        c = `rgb(${r},${gr},${b})`;
      }
      g.fillStyle = c;
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (!isWater(x, y)) {
        // briznas de hierba
        if (v > 0.72) {
          g.fillStyle = 'rgba(52,88,40,0.55)';
          g.fillRect(x * TILE + 5 + v * 14, y * TILE + 7 + v * 12, 2.5, 4);
          g.fillRect(x * TILE + 12 + v * 8, y * TILE + 16 + v * 6, 2, 3.5);
        }
        // flores dispersas
        if (v < 0.018) {
          const fx = x * TILE + 8 + v * 700, fy = y * TILE + 10 + v * 500;
          const fc = v < 0.006 ? '#ffe9a8' : v < 0.012 ? '#f0f2f4' : '#e8a0b4';
          g.fillStyle = fc;
          for (let p = 0; p < 4; p++) {
            const a = p * 1.57 + v * 100;
            g.beginPath(); g.arc(fx + Math.cos(a) * 2.4, fy + Math.sin(a) * 2.4, 1.7, 0, 7); g.fill();
          }
          g.fillStyle = '#c98a2a';
          g.beginPath(); g.arc(fx, fy, 1.4, 0, 7); g.fill();
        }
        // guijarros
        if (v > 0.982) {
          g.fillStyle = 'rgba(140,145,138,0.6)';
          g.beginPath(); g.ellipse(x * TILE + 16, y * TILE + 20, 3.4, 2.2, v * 6, 0, 7); g.fill();
        }
      }
    }
  }
  // lagos: orilla de arena, profundidad y brillo
  for (const w of state.world.water) {
    const wx = w.x * TILE, wy = w.y * TILE, wr = w.r * TILE;
    g.strokeStyle = 'rgba(196,178,128,0.85)';
    g.lineWidth = 7;
    g.beginPath(); g.arc(wx, wy, wr + 2, 0, Math.PI * 2); g.stroke();
    const grad = g.createRadialGradient(wx, wy, wr * 0.1, wx, wy, wr);
    grad.addColorStop(0, 'rgba(18,58,84,0.85)');
    grad.addColorStop(0.75, 'rgba(38,96,130,0.4)');
    grad.addColorStop(1, 'rgba(120,190,215,0.35)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(wx, wy, wr, 0, Math.PI * 2); g.fill();
  }
  // surco quemado del aterrizaje forzoso
  if (state.world.wreck) {
    const wk = state.world.wreck;
    const wx = (wk.x + 2) * TILE, wy = (wk.y + 1) * TILE;
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(45,32,22,${0.42 - i * 0.06})`;
      g.beginPath();
      g.ellipse(wx - 34 - i * 26, wy + 6 + i * 2, 26 - i * 2.5, 12 - i * 1.2, -0.08, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(45,32,22,0.5)';
    g.beginPath();
    g.ellipse(wx, wy + 8, TILE * 2.3, TILE * 0.9, -0.05, 0, Math.PI * 2);
    g.fill();
  }

  // tinte bajo yacimientos
  for (const n of state.world.nodes) {
    g.fillStyle = 'rgba(70,55,40,0.45)';
    g.beginPath();
    g.ellipse((n.x + 1) * TILE, (n.y + 1) * TILE, TILE * 1.35, TILE * 1.1, 0, 0, Math.PI * 2);
    g.fill();
  }
  // cuadrícula sutil
  g.strokeStyle = 'rgba(0,0,0,0.05)';
  g.lineWidth = 1;
  for (let x = 0; x <= MAP_W; x++) { g.beginPath(); g.moveTo(x * TILE, 0); g.lineTo(x * TILE, MAP_H * TILE); g.stroke(); }
  for (let y = 0; y <= MAP_H; y++) { g.beginPath(); g.moveTo(0, y * TILE); g.lineTo(MAP_W * TILE, y * TILE); g.stroke(); }
}

/* ---------------- Dibujo principal ---------------- */
function draw(t) {
  resizeCanvas();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2b3a2b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(
    dpr * cam.z, 0, 0, dpr * cam.z,
    dpr * (window.innerWidth / 2 - cam.x * cam.z),
    dpr * (window.innerHeight / 2 - cam.y * cam.z)
  );

  if (!groundCanvas) buildGround();
  ctx.drawImage(groundCanvas, 0, 0);

  drawBelts(t);
  drawNodes(t);

  // sombras de entidades "altas"
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (const b of state.buildings) {
    if (b.type === 'power_pole') shadowEllipse(b.x + 0.62, b.y + 0.82, 0.38, 0.18);
    else shadowRect(b);
  }
  if (state.world.wreck) shadowEllipse(state.world.wreck.x + 2, state.world.wreck.y + 1.35, 1.9, 0.55);
  for (const tr of state.world.trees) shadowEllipse(tr.x + 0.5, tr.y + 0.75, 0.55, 0.28);
  for (const r of state.world.rocks) shadowEllipse(r.x + 0.55, r.y + 0.7, 0.45 * r.s, 0.22 * r.s);
  for (const bu of state.world.bushes) if (bu.charges > 0) shadowEllipse(bu.x + 0.55, bu.y + 0.7, 0.4, 0.2);

  // cuerpos ordenados por Y (para solapado correcto)
  const drawables = [];
  for (const b of state.buildings) drawables.push({ y: b.y + BUILDINGS[b.type].h, f: () => drawBuilding(b, t) });
  if (state.world.wreck) drawables.push({ y: state.world.wreck.y + 2, f: () => drawWreck(state.world.wreck, t) });
  for (const tr of state.world.trees) drawables.push({ y: tr.y + 1, f: () => drawTree(tr) });
  for (const r of state.world.rocks) drawables.push({ y: r.y + 1, f: () => drawRock(r) });
  for (const bu of state.world.bushes) drawables.push({ y: bu.y + 1, f: () => drawBush(bu) });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.f();

  drawPowerCables(t);
  drawWaterSparkle(t);
  drawCloudShadows(t);
  drawContents(t);
  drawOverlays(t);
  drawRipples(t);
  drawGhost(t);
  drawFloatTexts(t);
  drawVignette();
}

/* ---------------- Efectos de ambiente ---------------- */
function drawWaterSparkle(t) {
  for (const w of state.world.water) {
    const wx = w.x * TILE, wy = w.y * TILE, wr = w.r * TILE;
    for (let i = 0; i < 4; i++) {
      const p = (t / 2600 + i * 0.31 + w.x * 0.13) % 1;
      const a = i * 2.4 + w.y;
      const rr = wr * (0.25 + p * 0.55);
      const sx = wx + Math.cos(a) * rr, sy = wy + Math.sin(a) * rr * 0.8;
      ctx.strokeStyle = `rgba(210,240,255,${0.35 * Math.sin(p * Math.PI)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + p * 5, 0.3, 2.3);
      ctx.stroke();
    }
  }
}

let _cloudSprite = null;
function drawCloudShadows(t) {
  if (!_cloudSprite) {
    _cloudSprite = document.createElement('canvas');
    _cloudSprite.width = _cloudSprite.height = 256;
    const cg = _cloudSprite.getContext('2d');
    const mk = (x, y, r) => {
      const gr = cg.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.16)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      cg.fillStyle = gr;
      cg.beginPath(); cg.arc(x, y, r, 0, Math.PI * 2); cg.fill();
    };
    mk(100, 120, 90); mk(160, 100, 70); mk(70, 100, 60); mk(150, 150, 60);
  }
  const mw = MAP_W * TILE, mh = MAP_H * TILE;
  for (let i = 0; i < 3; i++) {
    const cx = ((t * (0.008 + i * 0.003) + i * 1400) % (mw + 900)) - 450;
    const cy = ((i * 731 + t * 0.004) % (mh + 600)) - 300;
    const s = 2.2 + i * 0.9;
    ctx.drawImage(_cloudSprite, cx, cy, 256 * s, 256 * s);
  }
}

function drawRipples(t) {
  const now = performance.now();
  ripples = ripples.filter(r => {
    const p = (now - r.start) / 450;
    if (p >= 1) return false;
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p)})`;
    ctx.lineWidth = 2.5 * (1 - p) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 6 + p * 26, 0, Math.PI * 2);
    ctx.stroke();
    return true;
  });
}

function drawVignette() {
  const W = window.innerWidth, H = window.innerHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,16,8,0.26)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ---------------- Contenido visible sobre los edificios ----------------
   Mini-lista vertical (icono + cantidad, como el HUD de misión):
   - HUB: los materiales del inventario (los 4 más abundantes)
   - Contenedores: sus 3 materiales principales
   - Mineros y taladros: SIEMPRE el mineral que minan (aunque sea 0),
     porque el edificio tapa el yacimiento
   - Máquinas: su salida · Generadores: su combustible · Separadores: su cola */
function drawContents(t) {
  if (cam.z < 0.55) return;   // demasiado lejos para leerse
  ctx.font = 'bold 10px sans-serif';
  ctx.textBaseline = 'middle';
  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];
    let entries = [];
    if (b.type === 'hub') {
      // todos los materiales del inventario, de mayor a menor
      entries = Object.entries(state.inventory).filter(e => e[1] >= 1).sort((a, c) => c[1] - a[1]);
      if (!entries.length) continue;
    } else if (b.type === 'storage') {
      entries = Object.entries(b.store).filter(e => e[1] >= 1).sort((a, c) => c[1] - a[1]);
      if (!entries.length) continue;
    } else if (b.type === 'miner1' || b.type === 'miner2' || b.type === 'portable_miner') {
      if (!b.nodeType) continue;
      entries = [[NODE_TYPES[b.nodeType].item, Math.floor(b.buf)]];   // siempre visible
    } else if (MACH_RECIPES[b.type]) {
      entries = Object.entries(b.outBuf).filter(e => e[1] >= 1).slice(0, 2);
      if (!entries.length) continue;
    } else if (def.fuelItem) {
      if (b.fuel <= 0) continue;
      entries = [[def.fuelItem, b.fuel]];
    } else if (b.type === 'splitter' && b.queue && b.queue.length) {
      entries = [[b.queue[0], b.queue.length]];
    } else continue;

    // panel horizontal: las entradas se reparten en filas cuyo ancho
    // de referencia es el del propio edificio
    const rowH = 17, pad = 5, gap = 7;
    const parts = entries.map(([item, nq]) => {
      const txt = String(Math.floor(nq));
      return { item, txt, w: 16 + ctx.measureText(txt).width };
    });
    const maxRowW = Math.max(def.w * TILE, ...parts.map(p => p.w));
    const rows = [[]];
    let rowW = 0;
    for (const p of parts) {
      const need = (rows[rows.length - 1].length ? gap : 0) + p.w;
      if (rowW + need > maxRowW && rows[rows.length - 1].length) {
        rows.push([p]);
        rowW = p.w;
      } else {
        rows[rows.length - 1].push(p);
        rowW += need;
      }
    }
    const widths = rows.map(r => r.reduce((s, p, i) => s + p.w + (i ? gap : 0), 0));
    const wsum = Math.max(...widths) + pad * 2;
    const hsum = rows.length * rowH + pad * 2 - 3;
    const cx = (b.x + def.w / 2) * TILE;
    const top = b.y * TILE - 9 - 14 - hsum;
    ctx.fillStyle = 'rgba(12,16,12,0.68)';
    ctx.beginPath(); ctx.roundRect(cx - wsum / 2, top, wsum, hsum, 8); ctx.fill();
    ctx.textAlign = 'left';
    rows.forEach((row, ri) => {
      const y = top + pad + rowH * ri + 7;
      let px = cx - widths[ri] / 2;   // cada fila centrada
      for (const p of row) {
        drawItemShape(ctx, p.item, px + 6, y, 6);
        ctx.fillStyle = '#fff';
        ctx.fillText(p.txt, px + 14, y + 0.5);
        px += p.w + gap;
      }
    });
  }
  ctx.textAlign = 'center';
}

function shadowRect(b) {
  const def = BUILDINGS[b.type];
  const x = b.x * TILE, y = b.y * TILE;
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 7, def.w * TILE, def.h * TILE, 6);
  ctx.fill();
}
function shadowEllipse(tx, ty, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(tx * TILE, ty * TILE, rx * TILE, ry * TILE, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------------- Yacimientos ---------------- */
const UNSCANNED_COLOR = '#767b85';
function drawNodes(t) {
  for (const n of state.world.nodes) {
    // si hay un minero encima, no dibujar rocas
    const over = buildingAt(n.x, n.y);
    if (over && (over.type === 'miner1' || over.type === 'miner2')) continue;
    const scanned = nodeScanned(n.type);
    const c = scanned ? NODE_TYPES[n.type].color : UNSCANNED_COLOR;
    const cx = (n.x + 1) * TILE, cy = (n.y + 1) * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx + 4, cy + 8, TILE * 1.05, TILE * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    const rocks = [
      [-14, -6, 15], [10, -12, 12], [-2, 8, 17], [16, 6, 11], [-20, 10, 9],
    ];
    for (const [ox, oy, r] of rocks) {
      ctx.fillStyle = shade(c, -0.25);
      ctx.beginPath();
      ctx.moveTo(cx + ox - r, cy + oy + r * 0.5);
      ctx.lineTo(cx + ox - r * 0.4, cy + oy - r);
      ctx.lineTo(cx + ox + r * 0.7, cy + oy - r * 0.7);
      ctx.lineTo(cx + ox + r, cy + oy + r * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(cx + ox - r * 0.7, cy + oy + r * 0.3);
      ctx.lineTo(cx + ox - r * 0.3, cy + oy - r * 0.8);
      ctx.lineTo(cx + ox + r * 0.55, cy + oy - r * 0.5);
      ctx.lineTo(cx + ox + r * 0.75, cy + oy + r * 0.3);
      ctx.closePath(); ctx.fill();
    }
    if (scanned) {
      // brillo (yacimiento catalogado, listo para explotar)
      const tw = (Math.sin(t / 400 + n.id * 2) + 1) / 2;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.25})`;
      ctx.beginPath(); ctx.arc(cx - 6, cy - 8, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      // insignia de lupa: mineral aún sin catalogar por el escáner FICSIT
      const bx = cx, by = cy - 30;
      ctx.fillStyle = 'rgba(20,22,26,0.55)';
      ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f59e2e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx - 1.5, by - 1.5, 4.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + 1.6, by + 1.6); ctx.lineTo(bx + 5, by + 5);
      ctx.stroke();
    }
  }
}

/* ---------------- Cintas (con curvas en las esquinas) ---------------- */

/* Dirección de entrada de una cinta: si le llega exactamente una cinta
   vecina con dirección distinta a la propia, es una esquina (curva). */
function beltEntryDir(belt) {
  let entry = null, count = 0;
  for (const d of DIR_LIST) {
    const [dx, dy] = DIRS[d];
    const nb = state.beltMap[key(belt.x - dx, belt.y - dy)];
    if (nb && nb.dir === d) { count++; entry = d; }
  }
  return (count === 1 && entry !== belt.dir) ? entry : null;
}

/* Punto (en píxeles de mundo) a lo largo del recorrido de una cinta.
   Recta: línea por el centro. Curva: bézier cuadrática entre los lados. */
function beltPointAt(belt, pos, entry) {
  const cx = belt.x + 0.5, cy = belt.y + 0.5;
  const [odx, ody] = DIRS[belt.dir];
  if (!entry) {
    return { x: (cx + odx * (pos - 0.5)) * TILE, y: (cy + ody * (pos - 0.5)) * TILE };
  }
  const [idx, idy] = DIRS[entry];
  const p0x = cx - idx * 0.5, p0y = cy - idy * 0.5;   // lado por el que entra
  const p2x = cx + odx * 0.5, p2y = cy + ody * 0.5;   // lado por el que sale
  const mt = 1 - pos;
  return {
    x: (mt * mt * p0x + 2 * mt * pos * cx + pos * pos * p2x) * TILE,
    y: (mt * mt * p0y + 2 * mt * pos * cy + pos * pos * p2y) * TILE,
  };
}

function beltTangentAt(belt, pos, entry) {
  const [odx, ody] = DIRS[belt.dir];
  if (!entry) return Math.atan2(ody, odx);
  const [idx, idy] = DIRS[entry];
  const cx = belt.x + 0.5, cy = belt.y + 0.5;
  const p0x = cx - idx * 0.5, p0y = cy - idy * 0.5;
  const p2x = cx + odx * 0.5, p2y = cy + ody * 0.5;
  const dx = 2 * (1 - pos) * (cx - p0x) + 2 * pos * (p2x - cx);
  const dy = 2 * (1 - pos) * (cy - p0y) + 2 * pos * (p2y - cy);
  return Math.atan2(dy, dx);
}

function drawBelts(t) {
  const anim = (t / 1000 * BELT_SPEED) % 0.5;
  for (const k in state.beltMap) {
    const belt = state.beltMap[k];
    const entry = beltEntryDir(belt);
    belt._entry = entry;
    const x = belt.x * TILE, y = belt.y * TILE;

    if (!entry) {
      // tramo recto
      ctx.fillStyle = '#3d4148';
      ctx.beginPath(); ctx.roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 5); ctx.fill();
      ctx.fillStyle = '#585e68';
      ctx.beginPath(); ctx.roundRect(x + 5, y + 5, TILE - 10, TILE - 10, 3); ctx.fill();
      const [dx, dy] = DIRS[belt.dir];
      ctx.save();
      ctx.translate(x + TILE / 2, y + TILE / 2);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.strokeStyle = 'rgba(255,214,79,0.8)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 2; i++) {
        const p = ((anim + i * 0.5) % 1) * TILE - TILE / 2;
        ctx.beginPath();
        ctx.moveTo(p - 4, -5); ctx.lineTo(p + 2, 0); ctx.lineTo(p - 4, 5);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // esquina: carril curvo
      const p0 = beltPointAt(belt, 0, entry);
      const p2 = beltPointAt(belt, 1, entry);
      const ccx = (belt.x + 0.5) * TILE, ccy = (belt.y + 0.5) * TILE;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = '#3d4148';
      ctx.lineWidth = TILE - 5;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(ccx, ccy, p2.x, p2.y); ctx.stroke();
      ctx.strokeStyle = '#585e68';
      ctx.lineWidth = TILE - 12;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(ccx, ccy, p2.x, p2.y); ctx.stroke();
      // flechas animadas siguiendo la curva
      ctx.strokeStyle = 'rgba(255,214,79,0.8)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 2; i++) {
        const tt = (anim * 2 + i * 0.5) % 1;
        const p = beltPointAt(belt, tt, entry);
        const ang = beltTangentAt(belt, tt, entry);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(-4, -5); ctx.lineTo(2, 0); ctx.lineTo(-4, 5);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  // objetos sobre cintas (siguen la curva en las esquinas)
  for (const k in state.beltMap) {
    const belt = state.beltMap[k];
    for (const it of belt.items) {
      const p = beltPointAt(belt, it.pos, belt._entry);
      const info = ITEMS[it.item];
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(p.x + 1.5, p.y + 3, 6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = info.ring;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = info.color;
      ctx.beginPath(); ctx.arc(p.x, p.y - 1, 5.2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/* ---------------- Edificios ---------------- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * (1 + amt))));
  g = Math.max(0, Math.min(255, Math.round(g * (1 + amt))));
  b = Math.max(0, Math.min(255, Math.round(b * (1 + amt))));
  return `rgb(${r},${g},${b})`;
}

/* Punto de anclaje de los cables eléctricos de un edificio */
function powerAttach(b) {
  const def = BUILDINGS[b.type];
  const x = b.x * TILE, y = b.y * TILE;
  if (b.type === 'power_pole') return { x: x + TILE / 2, y: y - 30 };
  if (b.type === 'hub') return { x: x + def.w * TILE - 14, y: y - 9 - 12 };
  return { x: x + def.w * TILE / 2, y: y - 6 };
}

function drawPowerCables(t) {
  if (!powerEdges.length) return;
  for (const e of powerEdges) {
    const pa = powerAttach(e.a), pb = powerAttach(e.b);
    const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const sag = 6 + dist * 0.09;
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2 + sag;
    ctx.strokeStyle = 'rgba(20,22,26,0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.quadraticCurveTo(mx, my, pb.x, pb.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,130,145,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y - 1);
    ctx.quadraticCurveTo(mx, my - 1, pb.x, pb.y - 1);
    ctx.stroke();
  }
}

/* Zona de alcance eléctrico alrededor de una huella.
   kind: 'pole' = solo alcance de cable (6) · 'relay' = enchufe + cable · false = solo enchufe */
function drawPowerRange(x, y, w, h, kind) {
  ctx.setLineDash([5, 5]);
  if (kind !== 'pole') {
    const plug = PLUG_RANGE * TILE;
    ctx.fillStyle = 'rgba(255,214,79,0.10)';
    ctx.beginPath();
    ctx.roundRect(x * TILE - plug, y * TILE - plug, w * TILE + plug * 2, h * TILE + plug * 2, plug);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,79,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (kind === 'pole' || kind === 'relay') {
    const link = LINK_RANGE * TILE;
    if (kind === 'pole') {
      ctx.fillStyle = 'rgba(120,190,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(x * TILE - link, y * TILE - link, w * TILE + link * 2, h * TILE + link * 2, link);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(120,190,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x * TILE - link, y * TILE - link, w * TILE + link * 2, h * TILE + link * 2, link);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBuilding(b, t) {
  const def = BUILDINGS[b.type];
  const x = b.x * TILE, y = b.y * TILE;
  const w = def.w * TILE, h = def.h * TILE;
  const ext = 9; // extrusión vertical (pseudo-3D)

  if (b.type === 'power_pole') {
    const cx0 = x + TILE / 2;
    // base
    ctx.fillStyle = '#3a3d33';
    ctx.beginPath(); ctx.ellipse(cx0, y + TILE * 0.72, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    // mástil
    ctx.fillStyle = '#4e3a22';
    ctx.fillRect(cx0 - 3.5, y - 30, 7, TILE * 0.72 + 30);
    ctx.fillStyle = '#6f522f';
    ctx.fillRect(cx0 - 2, y - 30, 3, TILE * 0.72 + 30);
    // travesaño
    ctx.fillStyle = '#5d4326';
    ctx.beginPath(); ctx.roundRect(cx0 - 13, y - 27, 26, 5, 2); ctx.fill();
    // aisladores
    ctx.fillStyle = '#c9cdd4';
    ctx.beginPath(); ctx.arc(cx0 - 9, y - 28, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx0 + 9, y - 28, 2.5, 0, Math.PI * 2); ctx.fill();
    return;
  }

  // cara frontal (pared)
  ctx.fillStyle = shade(def.color, -0.35);
  ctx.beginPath(); ctx.roundRect(x, y + h - ext, w, ext + 2, 4); ctx.fill();
  // techo
  ctx.fillStyle = def.roof || def.color;
  ctx.beginPath(); ctx.roundRect(x, y - ext, w, h, 5); ctx.fill();
  // brillo del borde superior
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.roundRect(x + 2, y - ext + 2, w - 4, 6, 3); ctx.fill();

  const cx = x + w / 2, cy = y - ext + h / 2;

  if (b.type === 'hub') {
    ctx.fillStyle = shade(def.color, -0.2);
    ctx.beginPath(); ctx.roundRect(x + 8, y - ext + 8, w - 16, h - 16, 4); ctx.fill();
    ctx.fillStyle = '#f4e3b0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('HUB', cx, cy - 4);
    ctx.font = '10px sans-serif';
    ctx.fillText('FICSIT', cx, cy + 12);
    // antena
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w - 14, y - ext + 6); ctx.lineTo(x + w - 14, y - ext - 12); ctx.stroke();
    const blink = Math.sin(t / 300) > 0;
    ctx.fillStyle = blink ? '#ff5544' : '#882222';
    ctx.beginPath(); ctx.arc(x + w - 14, y - ext - 13, 3, 0, Math.PI * 2); ctx.fill();
  } else if (b.type === 'miner1' || b.type === 'miner2' || b.type === 'portable_miner') {
    // taladro giratorio
    const spin = t / (b.type === 'miner2' ? 90 : b.type === 'miner1' ? 150 : 300);
    const rr = b.type === 'portable_miner' ? 8 : 12;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.fillStyle = shade(def.color, -0.4);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(rr, -4); ctx.lineTo(rr, 4); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#2e2e2e';
    ctx.beginPath(); ctx.arc(cx, cy, rr * 0.35, 0, Math.PI * 2); ctx.fill();
    // barra de búfer
    const cap = b.type === 'portable_miner' ? def.cap : OUT_CAP;
    drawBar(x + 3, y + h - ext - 6, w - 6, 4, b.buf / cap, '#ffd64f');
  } else if (b.type === 'splitter') {
    // caja con flechas de reparto
    ctx.strokeStyle = '#ffd64f'; ctx.lineWidth = 2.5;
    const ac = (x1, y1, x2, y2) => {
      ctx.beginPath(); ctx.moveTo(cx + x1, cy + y1); ctx.lineTo(cx + x2, cy + y2); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(cx + x2, cy + y2);
      ctx.lineTo(cx + x2 - Math.cos(a - 0.5) * 4, cy + y2 - Math.sin(a - 0.5) * 4);
      ctx.moveTo(cx + x2, cy + y2);
      ctx.lineTo(cx + x2 - Math.cos(a + 0.5) * 4, cy + y2 - Math.sin(a + 0.5) * 4);
      ctx.stroke();
    };
    ac(-9, 0, -3, 0);
    ac(3, 0, 10, 0);
    ac(0, -3, 0, -10);
    ac(0, 3, 0, 10);
    drawBar(x + 3, y + h - ext - 6, w - 6, 4, (b.queue ? b.queue.length : 0) / 6, '#ffd64f');
  } else if (b.type === 'foundry') {
    // dos chimeneas y crisol
    ctx.fillStyle = '#4a3226';
    ctx.beginPath(); ctx.roundRect(x + w - 22, y - ext + 5, 12, 12, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + w - 38, y - ext + 5, 12, 12, 3); ctx.fill();
    const hot2 = b.working ? (Math.sin(t / 150) + 1) / 2 : 0;
    ctx.fillStyle = `rgb(${190 + hot2 * 65},${70 + hot2 * 90},35)`;
    ctx.beginPath(); ctx.arc(cx - 10, cy + 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,224,122,${0.35 + hot2 * 0.5})`;
    ctx.beginPath(); ctx.arc(cx - 10, cy + 4, 5, 0, Math.PI * 2); ctx.fill();
    if (b.working) {
      const p2 = (t / 700) % 1;
      ctx.fillStyle = `rgba(90,90,90,${0.5 * (1 - p2)})`;
      ctx.beginPath(); ctx.arc(x + w - 16, y - ext - 2 - p2 * 16, 4 + p2 * 6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (b.type === 'smelter') {
    // chimenea con brasa
    ctx.fillStyle = '#5b3d2a';
    ctx.beginPath(); ctx.roundRect(x + w - 20, y - ext + 6, 13, 13, 3); ctx.fill();
    const hot = b.working ? (Math.sin(t / 180) + 1) / 2 : 0;
    ctx.fillStyle = `rgb(${180 + hot * 75},${60 + hot * 80},30)`;
    ctx.beginPath(); ctx.arc(cx - 6, cy + 4, 8, 0, Math.PI * 2); ctx.fill();
  } else if (b.type === 'constructor') {
    ctx.fillStyle = shade(def.color, -0.25);
    ctx.beginPath(); ctx.roundRect(x + 6, y - ext + 10, w - 12, h - 24, 4); ctx.fill();
    if (b.working) {
      const p = (t / 300) % 1;
      ctx.fillStyle = '#ffd64f';
      ctx.fillRect(x + 8 + p * (w - 22), y - ext + h / 2 - 2, 6, 4);
    }
  } else if (b.type === 'assembler') {
    ctx.strokeStyle = shade(def.color, -0.35); ctx.lineWidth = 4;
    const ang = b.working ? t / 400 : 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, 16, ang, ang + Math.PI * 1.5); ctx.stroke();
    ctx.fillStyle = shade(def.color, -0.45);
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
  } else if (b.type === 'storage') {
    ctx.strokeStyle = shade(def.color, -0.3); ctx.lineWidth = 2;
    ctx.strokeRect(x + 8, y - ext + 8, w - 16, h - 16);
    ctx.beginPath(); ctx.moveTo(x + 8, cy); ctx.lineTo(x + w - 8, cy); ctx.stroke();
    let total = 0; for (const k in b.store) total += b.store[k];
    drawBar(x + 3, y + h - ext - 6, w - 6, 4, total / def.cap, '#8fd14f');
  } else if (b.type === 'biomass_burner' || b.type === 'coal_generator') {
    const on = b.burnLeft > 0 || b.fuel > 0;
    ctx.fillStyle = on ? '#ffe07a' : '#3a3a3a';
    ctx.beginPath(); ctx.arc(cx, cy - 2, 9, 0, Math.PI * 2); ctx.fill();
    drawBoltShape(ctx, cx, cy - 2, 6, on ? '#8a5c14' : '#222');
    drawBar(x + 3, y + h - ext - 6, w - 6, 4, b.fuel / 50, '#e8a34f');
    if (on) {
      // humo
      const p = (t / 900) % 1;
      ctx.fillStyle = `rgba(200,200,200,${0.5 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(x + w - 12, y - ext - 4 - p * 14, 4 + p * 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // LED de estado en la esquina del techo
  if (MACH_RECIPES[b.type] || def.power !== 0 || b.type === 'miner1' || b.type === 'miner2') {
    let led = null;
    if (def.power < 0) {
      led = !b._conn ? '#8a8f96' : (b._pw ? '#7ee787' : '#ff6655');
    } else if (def.power > 0 && def.fuelItem) {
      led = (b.fuel > 0 || b.burnLeft > 0) ? '#7ee787' : '#ff6655';
    } else if (b.type === 'hub') {
      led = '#7ee787';
    }
    if (led) {
      const on = led !== '#7ee787' || Math.sin(t / 500) > -0.7;
      ctx.fillStyle = on ? led : 'rgba(120,120,120,0.5)';
      ctx.beginPath(); ctx.arc(x + w - 7, y - ext + 7, 2.6, 0, Math.PI * 2); ctx.fill();
      if (on && led === '#7ee787') {
        ctx.fillStyle = 'rgba(126,231,135,0.25)';
        ctx.beginPath(); ctx.arc(x + w - 7, y - ext + 7, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // icono de estado
  if (MACH_RECIPES[b.type] && !b.recipe) {
    bounceIcon(cx, y - ext - 10, t, '#ffd64f', '?');
  } else if (def.power < 0) {
    if (!b._conn) boltIcon(cx, y - ext - 10, t, '#b9bfc7', '#41454c');          // sin conexión a la red
    else if (!b._pw && machineWants(b)) boltIcon(cx, y - ext - 10, t, '#ff6655', '#4d1410'); // red sin energía
  }

  // barra de progreso
  if (MACH_RECIPES[b.type] && b.recipe) {
    drawBar(x + 3, y - ext - 4, w - 6, 4, b.working ? b.progress : 0, '#6fd3ff');
  }
}

function bounceIcon(cx, cy, t, color, txt) {
  const dy = Math.sin(t / 250) * 2;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy + dy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, cx, cy + dy + 0.5);
}

function boltIcon(cx, cy, t, bg, fg) {
  const dy = Math.sin(t / 250) * 2;
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.arc(cx, cy + dy, 8, 0, Math.PI * 2); ctx.fill();
  drawBoltShape(ctx, cx, cy + dy, 5.5, fg);
}

function drawBar(x, y, w, h, p, color) {
  p = Math.max(0, Math.min(1, p));
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill();
  if (p > 0.01) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x + 1, y + 1, (w - 2) * p, h - 2, 2); ctx.fill();
  }
}

/* ---------------- Nave estrellada ---------------- */
function drawWreck(wk, t) {
  const cx = (wk.x + 2) * TILE, cy = (wk.y + 1) * TILE;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  const S = TILE * 1.85;
  // casco
  ctx.fillStyle = wk.salvaged ? '#79828c' : '#8f98a3';
  ctx.beginPath(); ctx.roundRect(-S * 0.62, -S * 0.26, S * 1.24, S * 0.52, S * 0.24); ctx.fill();
  ctx.fillStyle = wk.salvaged ? '#525a63' : '#5f6871';
  ctx.beginPath(); ctx.roundRect(-S * 0.6, 0, S * 1.2, S * 0.24, S * 0.12); ctx.fill();
  // morro hundido en la tierra
  ctx.fillStyle = '#6b4a2f';
  ctx.beginPath(); ctx.ellipse(S * 0.62, S * 0.1, S * 0.28, S * 0.2, 0.3, 0, Math.PI * 2); ctx.fill();
  // aleta rota
  ctx.fillStyle = '#c07a42';
  ctx.beginPath();
  ctx.moveTo(-S * 0.3, -S * 0.24); ctx.lineTo(-S * 0.52, -S * 0.5); ctx.lineTo(-S * 0.12, -S * 0.24);
  ctx.closePath(); ctx.fill();
  // ventana agrietada
  ctx.fillStyle = '#2c3a46';
  ctx.beginPath(); ctx.arc(S * 0.12, -S * 0.02, S * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(220,230,240,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(S * 0.04, -S * 0.1); ctx.lineTo(S * 0.16, S * 0.02); ctx.lineTo(S * 0.1, S * 0.1);
  ctx.stroke();
  // panel abierto si ya se recuperaron las piezas
  if (wk.salvaged) {
    ctx.strokeStyle = '#3a4149'; ctx.lineWidth = 2;
    ctx.strokeRect(-S * 0.42, -S * 0.14, S * 0.24, S * 0.24);
  }
  ctx.restore();
  // humo
  for (let i = 0; i < 3; i++) {
    const p = (t / 1300 + i * 0.33) % 1;
    ctx.fillStyle = `rgba(100,100,100,${(wk.salvaged ? 0.25 : 0.45) * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(cx - 8 + Math.sin(i * 2.7) * 14, cy - 26 - p * 46, 6 + p * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  // aviso de piezas por recuperar
  if (!wk.salvaged) bounceIcon(cx, cy - 52, t, '#ffd64f', '!');
}

/* ---------------- Vegetación ---------------- */
function drawTree(tr) {
  const x = (tr.x + 0.5) * TILE, y = (tr.y + 0.5) * TILE;
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(x - 3, y - 4, 6, 12);
  const lean = (3 - tr.hp) * 2;
  ctx.fillStyle = '#3e6b2e';
  ctx.beginPath(); ctx.arc(x + lean, y - 14, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4f8239';
  ctx.beginPath(); ctx.arc(x - 4 + lean, y - 18, 9, 0, Math.PI * 2); ctx.fill();
}
function drawBush(bu) {
  const x = (bu.x + 0.5) * TILE, y = (bu.y + 0.55) * TILE;
  if (bu.charges <= 0) {
    ctx.fillStyle = '#5d5a40';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    return;
  }
  ctx.fillStyle = '#57833a';
  ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#79a94f';
  ctx.beginPath(); ctx.arc(x - 3, y - 4, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a5d16e';
  for (let i = 0; i < bu.charges; i++) {
    ctx.beginPath(); ctx.arc(x - 5 + i * 5, y + 2, 2, 0, Math.PI * 2); ctx.fill();
  }
}
function drawRock(r) {
  const x = (r.x + 0.5) * TILE, y = (r.y + 0.55) * TILE;
  const s = r.s * 12;
  ctx.fillStyle = '#7c8188';
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.5);
  ctx.lineTo(x - s * 0.4, y - s * 0.8);
  ctx.lineTo(x + s * 0.6, y - s * 0.6);
  ctx.lineTo(x + s, y + s * 0.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9aa0a8';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y + s * 0.3);
  ctx.lineTo(x - s * 0.2, y - s * 0.6);
  ctx.lineTo(x + s * 0.4, y - s * 0.4);
  ctx.closePath(); ctx.fill();
}

/* ---------------- Overlays (selección, previsualizaciones) ---------------- */
function drawOverlays(t) {
  // selección
  if (ui.selected) {
    const b = ui.selected;
    if (state.buildings.includes(b)) {
      const def = BUILDINGS[b.type];
      if (def.pole || def.power !== 0) {
        drawPowerRange(b.x, b.y, def.w, def.h, 'pole');
      }
      const pulse = 2 + Math.sin(t / 250) * 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x * TILE - pulse, b.y * TILE - 9 - pulse, def.w * TILE + pulse * 2, def.h * TILE + 9 + pulse * 2);
      ctx.setLineDash([]);
    }
  }
  // trazado de cable: alcance del poste y destinos válidos parpadeando
  if (ui.linking) {
    const pole = state.buildings.find(x => x.id === ui.linking);
    if (pole) {
      const pd = BUILDINGS[pole.type];
      drawPowerRange(pole.x, pole.y, pd.w, pd.h, 'pole');
      const pulse = 0.5 + Math.sin(t / 200) * 0.35;
      for (const cand of state.buildings) {
        if (cand.id === pole.id) continue;
        if (!(isPowerSource(cand) || isPowerConsumer(cand) || isPole(cand))) continue;
        if (buildingGap(pole, cand) > LINK_RANGE) continue;
        if (cableCount(cand) >= cableLimit(cand)) continue;
        if (state.cables.some(c =>
          (c.a === pole.id && c.b === cand.id) || (c.b === pole.id && c.a === cand.id))) continue;
        const cd = BUILDINGS[cand.type];
        ctx.strokeStyle = `rgba(140,235,140,${pulse})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 5]);
        ctx.strokeRect(cand.x * TILE - 3, cand.y * TILE - 12, cd.w * TILE + 6, cd.h * TILE + 15);
        ctx.setLineDash([]);
      }
    }
  }

  // ruta de cinta en curso
  if (input.beltPath && input.beltPath.length) {
    for (let i = 0; i < input.beltPath.length; i++) {
      const c = input.beltPath[i];
      const ok = canPlaceBelt(c.x, c.y) || beltAt(c.x, c.y);
      ctx.fillStyle = ok ? 'rgba(120,220,120,0.5)' : 'rgba(230,90,90,0.5)';
      ctx.beginPath(); ctx.roundRect(c.x * TILE + 3, c.y * TILE + 3, TILE - 6, TILE - 6, 4); ctx.fill();
      if (i < input.beltPath.length - 1) {
        const n = input.beltPath[i + 1];
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo((c.x + 0.5) * TILE, (c.y + 0.5) * TILE);
        ctx.lineTo((n.x + 0.5) * TILE, (n.y + 0.5) * TILE);
        ctx.stroke();
      }
    }
  }
}

function drawGhost(t) {
  if (!ui.ghost) return;
  const g = ui.ghost;
  const def = BUILDINGS[g.type];
  const chk = canPlaceBuilding(g.type, g.x, g.y);
  const afford = canAfford(def.cost);
  const ok = chk.ok && afford;
  const gx = (chk.ok && chk.x !== undefined) ? chk.x : g.x;
  const gy = (chk.ok && chk.y !== undefined) ? chk.y : g.y;
  if (def.pole || def.power !== 0) {
    drawPowerRange(gx, gy, def.w, def.h, 'pole');
  }
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = def.roof || def.color;
  ctx.beginPath(); ctx.roundRect(gx * TILE, gy * TILE - 9, def.w * TILE, def.h * TILE + 9, 5); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ok ? '#6fe06f' : '#ff6060';
  ctx.lineWidth = 3;
  ctx.strokeRect(gx * TILE, gy * TILE - 9, def.w * TILE, def.h * TILE + 9);
  if (!ok) {
    ctx.fillStyle = '#ff6060';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(!chk.ok ? chk.why : 'Faltan materiales', gx * TILE + def.w * TILE / 2, gy * TILE - 16);
  }
}

function drawFloatTexts(dt) {
  const now = performance.now();
  floatTexts = floatTexts.filter(f => {
    if (!f.start) f.start = now;
    const p = (now - f.start) / 1250;
    if (p >= 1) return false;
    const ty = f.y - p * 28;
    ctx.globalAlpha = 1 - p;
    ctx.font = 'bold 14px sans-serif';
    const tw = ctx.measureText(f.txt).width;
    let tx = f.x;
    if (f.item) {
      // icono del material + texto, centrados en conjunto
      const iconS = 10, gap = 5;
      const total = iconS * 2 + gap + tw;
      const startX = f.x - total / 2;
      ctx.fillStyle = 'rgba(15,18,15,0.65)';
      ctx.beginPath();
      ctx.roundRect(startX - 7, ty - 15, total + 14, 26, 13);
      ctx.fill();
      drawItemShape(ctx, f.item, startX + iconS, ty - 2, iconS);
      tx = startX + iconS * 2 + gap + tw / 2;
    }
    ctx.fillStyle = f.color;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    ctx.strokeText(f.txt, tx, ty);
    ctx.fillText(f.txt, tx, ty);
    ctx.globalAlpha = 1;
    return true;
  });
}
