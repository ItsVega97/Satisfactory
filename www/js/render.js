/* =========================================================
   Factoría 2D — Renderizado (canvas, pseudo-3D con sombras)
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let dpr = 1;

const cam = { x: 0, y: 0, z: 1 };   // x,y en píxeles de mundo (centro), z = zoom
const ZOOM_MIN = 0.35, ZOOM_MAX = 2.6;

let groundCanvas = null;
let floatTexts = [];   // {x,y,txt,t,color}

function addFloat(wx, wy, txt, color) {
  floatTexts.push({ x: wx, y: wy, t: 0, txt, color: color || '#fff' });
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

/* ---------------- Suelo (pre-renderizado) ---------------- */
function buildGround() {
  groundCanvas = document.createElement('canvas');
  groundCanvas.width = MAP_W * TILE;
  groundCanvas.height = MAP_H * TILE;
  const g = groundCanvas.getContext('2d');
  const rng = mulberry32(777);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const v = rng();
      let c;
      if (isWater(x, y)) c = '#3a6f8f';
      else {
        const shade = 0.92 + v * 0.16;
        const r = Math.floor(88 * shade), gr = Math.floor(126 * shade), b = Math.floor(70 * shade);
        c = `rgb(${r},${gr},${b})`;
      }
      g.fillStyle = c;
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
      // hierba: puntitos
      if (!isWater(x, y) && v > 0.75) {
        g.fillStyle = 'rgba(60,95,45,0.5)';
        g.fillRect(x * TILE + 6 + v * 12, y * TILE + 8 + v * 10, 3, 3);
      }
    }
  }
  // bordes de agua
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  for (const w of state.world.water) {
    g.beginPath();
    g.arc(w.x * TILE, w.y * TILE, w.r * TILE, 0, Math.PI * 2);
    g.stroke();
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
  for (const b of state.buildings) shadowRect(b);
  for (const tr of state.world.trees) shadowEllipse(tr.x + 0.5, tr.y + 0.75, 0.55, 0.28);
  for (const r of state.world.rocks) shadowEllipse(r.x + 0.55, r.y + 0.7, 0.45 * r.s, 0.22 * r.s);
  for (const bu of state.world.bushes) if (bu.charges > 0) shadowEllipse(bu.x + 0.55, bu.y + 0.7, 0.4, 0.2);

  // cuerpos ordenados por Y (para solapado correcto)
  const drawables = [];
  for (const b of state.buildings) drawables.push({ y: b.y + BUILDINGS[b.type].h, f: () => drawBuilding(b, t) });
  for (const tr of state.world.trees) drawables.push({ y: tr.y + 1, f: () => drawTree(tr) });
  for (const r of state.world.rocks) drawables.push({ y: r.y + 1, f: () => drawRock(r) });
  for (const bu of state.world.bushes) drawables.push({ y: bu.y + 1, f: () => drawBush(bu) });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.f();

  drawOverlays(t);
  drawGhost(t);
  drawFloatTexts(t);
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
function drawNodes(t) {
  for (const n of state.world.nodes) {
    // si hay un minero encima, no dibujar rocas
    if (buildingAt(n.x, n.y) && buildingAt(n.x, n.y).type === 'miner1') continue;
    const c = NODE_TYPES[n.type].color;
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
    // brillo
    const tw = (Math.sin(t / 400 + n.id * 2) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.25})`;
    ctx.beginPath(); ctx.arc(cx - 6, cy - 8, 3, 0, Math.PI * 2); ctx.fill();
  }
}

/* ---------------- Cintas ---------------- */
function drawBelts(t) {
  const anim = (t / 1000 * BELT_SPEED) % 0.5;
  for (const k in state.beltMap) {
    const belt = state.beltMap[k];
    const x = belt.x * TILE, y = belt.y * TILE;
    ctx.fillStyle = '#3d4148';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, TILE - 4, TILE - 4, 5); ctx.fill();
    ctx.fillStyle = '#585e68';
    ctx.beginPath(); ctx.roundRect(x + 5, y + 5, TILE - 10, TILE - 10, 3); ctx.fill();
    // flechas animadas
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
  }
  // objetos sobre cintas
  for (const k in state.beltMap) {
    const belt = state.beltMap[k];
    const [dx, dy] = DIRS[belt.dir];
    for (const it of belt.items) {
      const px = (belt.x + 0.5 + dx * (it.pos - 0.5)) * TILE;
      const py = (belt.y + 0.5 + dy * (it.pos - 0.5)) * TILE;
      const info = ITEMS[it.item];
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(px + 1.5, py + 3, 6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = info.ring;
      ctx.beginPath(); ctx.arc(px, py, 6.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = info.color;
      ctx.beginPath(); ctx.arc(px, py - 1, 5.2, 0, Math.PI * 2); ctx.fill();
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

function drawBuilding(b, t) {
  const def = BUILDINGS[b.type];
  const x = b.x * TILE, y = b.y * TILE;
  const w = def.w * TILE, h = def.h * TILE;
  const ext = 9; // extrusión vertical (pseudo-3D)

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
  } else if (b.type === 'miner1' || b.type === 'portable_miner') {
    // taladro giratorio
    const spin = t / (b.type === 'miner1' ? 150 : 300);
    const rr = b.type === 'miner1' ? 12 : 8;
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
    const cap = b.type === 'miner1' ? OUT_CAP : def.cap;
    drawBar(x + 3, y + h - ext - 6, w - 6, 4, b.buf / cap, '#ffd64f');
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
    const on = (b.burnLeft > 0 || b.fuel > 0) && !state.fuse;
    ctx.fillStyle = on ? '#ffe07a' : '#3a3a3a';
    ctx.beginPath(); ctx.arc(cx, cy - 2, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#c98a2a' : '#222';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡', cx, cy - 2);
    drawBar(x + 3, y + h - ext - 6, w - 6, 4, b.fuel / 50, '#e8a34f');
    if (on) {
      // humo
      const p = (t / 900) % 1;
      ctx.fillStyle = `rgba(200,200,200,${0.5 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(x + w - 12, y - ext - 4 - p * 14, 4 + p * 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // icono de estado
  if (MACH_RECIPES[b.type] && !b.recipe) {
    bounceIcon(cx, y - ext - 10, t, '#ffd64f', '?');
  } else if (needsPowerIcon(b)) {
    bounceIcon(cx, y - ext - 10, t, '#ff6655', '⚡');
  }

  // barra de progreso
  if (MACH_RECIPES[b.type] && b.recipe) {
    drawBar(x + 3, y - ext - 4, w - 6, 4, b.working ? b.progress : 0, '#6fd3ff');
  }
}

function needsPowerIcon(b) {
  const def = BUILDINGS[b.type];
  if (def.power >= 0) return false;
  return state.fuse || state.power.dem > state.power.sup;
}

function bounceIcon(cx, cy, t, color, txt) {
  const dy = Math.sin(t / 250) * 2;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy + dy, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, cx, cy + dy + 0.5);
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
      const pulse = 2 + Math.sin(t / 250) * 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x * TILE - pulse, b.y * TILE - 9 - pulse, def.w * TILE + pulse * 2, def.h * TILE + 9 + pulse * 2);
      ctx.setLineDash([]);
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
    const p = (now - f.start) / 1100;
    if (p >= 1) return false;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    ctx.strokeText(f.txt, f.x, f.y - p * 26);
    ctx.fillText(f.txt, f.x, f.y - p * 26);
    ctx.globalAlpha = 1;
    return true;
  });
}
