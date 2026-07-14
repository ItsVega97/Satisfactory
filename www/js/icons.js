/* =========================================================
   Factoría 2D — Iconos generados por código (sin assets externos)
   - SVG en línea para botones de interfaz
   - Iconos de objetos y edificios dibujados en canvas (dataURL)
   ========================================================= */

const ICON_SVG = {
  select: '<svg viewBox="0 0 24 24"><path d="M6 2l12 11-6.2.9 3.3 6.2-2.6 1.4-3.3-6.2L6 19.4z" fill="currentColor"/></svg>',
  build: '<svg viewBox="0 0 24 24"><g transform="rotate(45 12 12)" fill="currentColor"><rect x="3" y="8.6" width="10" height="6.8" rx="1.2"/><rect x="12.6" y="10.6" width="8.6" height="2.8" rx="1.4"/></g></svg>',
  belt: '<svg viewBox="0 0 24 24"><path d="M3 10.5h11V6.5l7 5.5-7 5.5v-4H3z" fill="currentColor"/></svg>',
  demolish: '<svg viewBox="0 0 24 24"><path d="M9.5 3h5l.8 1.8H19v2H5v-2h3.7L9.5 3zM6 8.4h12l-1 12.6H7L6 8.4zm3.6 2.2l.3 8.2h1.4l-.3-8.2H9.6zm4.8 0l-.3 8.2h1.4l.3-8.2h-1.4z" fill="currentColor"/></svg>',
  power: '<svg viewBox="0 0 24 24"><path d="M13.5 2L5 13.5h5.5L9 22l8.5-11.5H12z" fill="currentColor"/></svg>',
  milestone: '<svg viewBox="0 0 24 24"><path d="M6 2.5h2V22H6zM10 4h9.5l-3 4.5 3 4.5H10z" fill="currentColor"/></svg>',
  inventory: '<svg viewBox="0 0 24 24"><path d="M4 7.2L12 3l8 4.2v9.6L12 21l-8-4.2zm8-1.9L7 7.9l5 2.6 5-2.6zM6 9.7l5 2.6v6.2l-5-2.6zm12 0v6.2l-5 2.6v-6.2z" fill="currentColor"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16v2.2H4zM4 10.9h16v2.2H4zM4 15.8h16v2.2H4z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M5 6.5L6.5 5 12 10.5 17.5 5 19 6.5 13.5 12 19 17.5 17.5 19 12 13.5 6.5 19 5 17.5 10.5 12z" fill="currentColor"/></svg>',
};

/* ---------------- Formas de objetos (compartidas canvas/iconos) ---------------- */
function _poly(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath(); g.fill();
}
function _rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function _rock(g, x, y, s, c, d) {
  g.fillStyle = d; _poly(g, [[x - s, y + s * 0.5], [x - s * 0.4, y - s], [x + s * 0.7, y - s * 0.7], [x + s, y + s * 0.5]]);
  g.fillStyle = c; _poly(g, [[x - s * 0.65, y + s * 0.3], [x - s * 0.25, y - s * 0.8], [x + s * 0.5, y - s * 0.5], [x + s * 0.7, y + s * 0.3]]);
}

function drawBoltShape(g, x, y, s, fill) {
  g.fillStyle = fill;
  _poly(g, [[x + s * 0.15, y - s], [x - s * 0.6, y + s * 0.15], [x - s * 0.05, y + s * 0.15],
            [x - s * 0.15, y + s], [x + s * 0.6, y - s * 0.15], [x + s * 0.05, y - s * 0.15]]);
}

/* Dibuja la forma de un objeto centrada en (cx,cy); s ≈ medio tamaño */
function drawItemShape(g, id, cx, cy, s) {
  const it = ITEMS[id];
  if (!it) return;
  const c = it.color, d = it.ring;
  g.save();
  g.translate(cx, cy);
  switch (id) {
    case 'iron_ore': case 'copper_ore': case 'limestone': case 'coal':
      _rock(g, -s * 0.38, s * 0.28, s * 0.5, c, d);
      _rock(g, s * 0.42, s * 0.32, s * 0.42, c, d);
      _rock(g, 0.02 * s, -s * 0.15, s * 0.66, c, d);
      break;
    case 'iron_ingot': case 'copper_ingot':
      g.fillStyle = d;
      _poly(g, [[-s, 0], [s, 0], [s * 0.72, s * 0.55], [-s * 0.72, s * 0.55]]);
      g.fillStyle = c;
      _poly(g, [[-s * 0.78, -s * 0.5], [s * 0.78, -s * 0.5], [s, 0], [-s, 0]]);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      _poly(g, [[-s * 0.5, -s * 0.4], [s * 0.05, -s * 0.4], [s * 0.15, -s * 0.12], [-s * 0.42, -s * 0.12]]);
      break;
    case 'plate':
      g.fillStyle = d; _rr(g, -s * 0.85, -s * 0.7, s * 1.7, s * 1.4, s * 0.2);
      g.fillStyle = c; _rr(g, -s * 0.65, -s * 0.5, s * 1.3, s * 1.0, s * 0.15);
      g.fillStyle = d;
      g.beginPath(); g.arc(-s * 0.42, -s * 0.26, s * 0.1, 0, 7); g.fill();
      g.beginPath(); g.arc(s * 0.42, s * 0.26, s * 0.1, 0, 7); g.fill();
      break;
    case 'rod':
      g.rotate(-0.6);
      g.fillStyle = d; _rr(g, -s, -s * 0.22, s * 2, s * 0.44, s * 0.22);
      g.fillStyle = 'rgba(255,255,255,0.35)'; _rr(g, -s * 0.8, -s * 0.16, s * 1.4, s * 0.14, s * 0.07);
      break;
    case 'screw':
      g.fillStyle = d; _rr(g, -s * 0.18, -s * 0.5, s * 0.36, s * 1.3, s * 0.12);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = s * 0.09;
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(-s * 0.18, -s * 0.1 + i * s * 0.28); g.lineTo(s * 0.18, -s * 0.22 + i * s * 0.28); g.stroke();
      }
      g.fillStyle = c;
      g.beginPath(); g.arc(0, -s * 0.55, s * 0.42, 0, 7); g.fill();
      g.strokeStyle = d; g.lineWidth = s * 0.12;
      g.beginPath(); g.moveTo(-s * 0.24, -s * 0.55); g.lineTo(s * 0.24, -s * 0.55); g.stroke();
      break;
    case 'wire':
      g.strokeStyle = d; g.lineWidth = s * 0.34;
      g.beginPath(); g.arc(0, 0, s * 0.62, 0.4, 5.6); g.stroke();
      g.strokeStyle = c; g.lineWidth = s * 0.2;
      g.beginPath(); g.arc(0, 0, s * 0.62, 0.4, 5.6); g.stroke();
      g.beginPath(); g.arc(0, 0, s * 0.25, 2, 6.5); g.stroke();
      break;
    case 'cable':
      g.strokeStyle = '#26282d'; g.lineWidth = s * 0.42;
      g.beginPath(); g.arc(0, 0, s * 0.58, 0.5, 5.5); g.stroke();
      g.strokeStyle = c; g.lineWidth = s * 0.24;
      g.beginPath(); g.arc(0, 0, s * 0.58, 0.5, 5.5); g.stroke();
      g.fillStyle = '#e8c34f'; _rr(g, s * 0.42, -s * 0.22, s * 0.42, s * 0.34, s * 0.08);
      break;
    case 'concrete':
      g.fillStyle = d; _poly(g, [[-s * 0.85, -s * 0.1], [0, s * 0.32], [0, s * 0.75], [-s * 0.85, s * 0.32]]);
      g.fillStyle = shade(c, -0.18); _poly(g, [[s * 0.85, -s * 0.1], [0, s * 0.32], [0, s * 0.75], [s * 0.85, s * 0.32]]);
      g.fillStyle = c; _poly(g, [[-s * 0.85, -s * 0.1], [0, -s * 0.52], [s * 0.85, -s * 0.1], [0, s * 0.32]]);
      break;
    case 'reinforced_plate':
      g.fillStyle = d; _rr(g, -s * 0.85, -s * 0.7, s * 1.7, s * 1.4, s * 0.2);
      g.fillStyle = c; _rr(g, -s * 0.65, -s * 0.5, s * 1.3, s * 1.0, s * 0.15);
      g.strokeStyle = d; g.lineWidth = s * 0.18;
      g.beginPath(); g.moveTo(-s * 0.55, -s * 0.4); g.lineTo(s * 0.55, s * 0.4); g.stroke();
      g.beginPath(); g.moveTo(s * 0.55, -s * 0.4); g.lineTo(-s * 0.55, s * 0.4); g.stroke();
      g.fillStyle = '#dfe6ee';
      for (const [rx, ry] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) {
        g.beginPath(); g.arc(rx * s, ry * s, s * 0.09, 0, 7); g.fill();
      }
      break;
    case 'rotor':
      g.strokeStyle = d; g.lineWidth = s * 0.3;
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        g.beginPath(); g.arc(0, 0, s * 0.62, a, a + 1.25); g.stroke();
      }
      g.fillStyle = c; g.beginPath(); g.arc(0, 0, s * 0.34, 0, 7); g.fill();
      g.fillStyle = d; g.beginPath(); g.arc(0, 0, s * 0.14, 0, 7); g.fill();
      break;
    case 'biomass':
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, s * 0.85);
      g.bezierCurveTo(-s * 1.05, s * 0.2, -s * 0.5, -s * 0.8, 0, -s * 0.85);
      g.bezierCurveTo(s * 0.5, -s * 0.8, s * 1.05, s * 0.2, 0, s * 0.85);
      g.fill();
      g.strokeStyle = d; g.lineWidth = s * 0.12;
      g.beginPath(); g.moveTo(0, s * 0.7); g.lineTo(0, -s * 0.6); g.stroke();
      break;
    default:
      g.fillStyle = c; g.beginPath(); g.arc(0, 0, s * 0.7, 0, 7); g.fill();
  }
  g.restore();
}

/* ---------------- Iconos como dataURL (para HTML) ---------------- */
const _iconCache = {};

function itemIconURL(id, size) {
  size = size || 44;
  const k = 'i_' + id + '_' + size;
  if (_iconCache[k]) return _iconCache[k];
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.07)';
  _rr(g, 1, 1, size - 2, size - 2, size * 0.22);
  drawItemShape(g, id, size / 2, size / 2, size * 0.32);
  return (_iconCache[k] = cv.toDataURL());
}

function buildingIconURL(type, size) {
  size = size || 60;
  const k = 'b_' + type + '_' + size;
  if (_iconCache[k]) return _iconCache[k];
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  drawBuildingIcon(g, type, size);
  return (_iconCache[k] = cv.toDataURL());
}

function drawBuildingIcon(g, type, S) {
  const def = BUILDINGS[type];
  const cx = S / 2;

  if (type === 'power_pole') {
    // poste con travesaño y cables
    g.strokeStyle = '#2a2d33'; g.lineWidth = S * 0.035;
    g.beginPath(); g.moveTo(S * 0.06, S * 0.32); g.quadraticCurveTo(S * 0.3, S * 0.48, cx - S * 0.16, S * 0.26); g.stroke();
    g.beginPath(); g.moveTo(S * 0.94, S * 0.32); g.quadraticCurveTo(S * 0.7, S * 0.48, cx + S * 0.16, S * 0.26); g.stroke();
    g.fillStyle = '#5d4326'; _rr(g, cx - S * 0.05, S * 0.14, S * 0.1, S * 0.74, S * 0.03);
    g.fillStyle = '#6f522f'; _rr(g, cx - S * 0.26, S * 0.2, S * 0.52, S * 0.09, S * 0.03);
    g.fillStyle = '#c9cdd4';
    g.beginPath(); g.arc(cx - S * 0.17, S * 0.2, S * 0.04, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + S * 0.17, S * 0.2, S * 0.04, 0, 7); g.fill();
    g.fillStyle = '#3a3d33'; _rr(g, cx - S * 0.12, S * 0.84, S * 0.24, S * 0.08, S * 0.03);
    return;
  }
  if (type === 'conveyor') {
    g.fillStyle = '#3d4148'; _rr(g, S * 0.08, S * 0.3, S * 0.84, S * 0.4, S * 0.08);
    g.fillStyle = '#585e68'; _rr(g, S * 0.13, S * 0.36, S * 0.74, S * 0.28, S * 0.05);
    g.strokeStyle = '#ffd64f'; g.lineWidth = S * 0.05;
    for (let i = 0; i < 3; i++) {
      const x = S * 0.24 + i * S * 0.22;
      g.beginPath(); g.moveTo(x, S * 0.38); g.lineTo(x + S * 0.1, S * 0.5); g.lineTo(x, S * 0.62); g.stroke();
    }
    return;
  }

  // cuerpo genérico con extrusión
  const m = S * 0.08, ext = S * 0.1;
  g.fillStyle = shade(def.color, -0.35);
  _rr(g, m, S * 0.3 + ext, S - 2 * m, S * 0.56, S * 0.06);
  g.fillStyle = def.roof || def.color;
  _rr(g, m, S * 0.18, S - 2 * m, S * 0.62, S * 0.07);
  g.fillStyle = 'rgba(255,255,255,0.14)';
  _rr(g, m + S * 0.03, S * 0.21, S - 2 * m - S * 0.06, S * 0.08, S * 0.04);

  const cy = S * 0.5;
  if (type === 'portable_miner' || type === 'miner1') {
    g.save(); g.translate(cx, cy);
    g.fillStyle = shade(def.color, -0.45);
    for (let i = 0; i < 3; i++) {
      g.rotate(Math.PI * 2 / 3);
      _poly(g, [[0, 0], [S * 0.22, -S * 0.07], [S * 0.22, S * 0.07]]);
    }
    g.restore();
    g.fillStyle = '#2e2e2e'; g.beginPath(); g.arc(cx, cy, S * 0.08, 0, 7); g.fill();
  } else if (type === 'smelter') {
    g.fillStyle = '#5b3d2a'; _rr(g, S * 0.62, S * 0.22, S * 0.18, S * 0.18, S * 0.04);
    g.fillStyle = '#e8853c'; g.beginPath(); g.arc(cx - S * 0.08, cy + S * 0.05, S * 0.13, 0, 7); g.fill();
    g.fillStyle = '#ffd64f'; g.beginPath(); g.arc(cx - S * 0.08, cy + S * 0.05, S * 0.06, 0, 7); g.fill();
  } else if (type === 'constructor') {
    g.fillStyle = shade(def.color, -0.25); _rr(g, S * 0.2, S * 0.3, S * 0.6, S * 0.34, S * 0.05);
    g.fillStyle = '#ffd64f'; _rr(g, S * 0.3, S * 0.44, S * 0.2, S * 0.08, S * 0.03);
  } else if (type === 'assembler') {
    g.strokeStyle = shade(def.color, -0.35); g.lineWidth = S * 0.07;
    g.beginPath(); g.arc(cx, cy, S * 0.2, 0.6, 5.3); g.stroke();
    g.fillStyle = shade(def.color, -0.45); g.beginPath(); g.arc(cx, cy, S * 0.09, 0, 7); g.fill();
  } else if (type === 'storage') {
    g.strokeStyle = shade(def.color, -0.3); g.lineWidth = S * 0.035;
    g.strokeRect(S * 0.22, S * 0.3, S * 0.56, S * 0.36);
    g.beginPath(); g.moveTo(S * 0.22, cy - S * 0.02); g.lineTo(S * 0.78, cy - S * 0.02); g.stroke();
  } else if (type === 'biomass_burner') {
    g.fillStyle = '#e8853c';
    g.beginPath();
    g.moveTo(cx, cy - S * 0.18);
    g.bezierCurveTo(cx + S * 0.16, cy - S * 0.02, cx + S * 0.12, cy + S * 0.14, cx, cy + S * 0.16);
    g.bezierCurveTo(cx - S * 0.12, cy + S * 0.14, cx - S * 0.16, cy - S * 0.02, cx, cy - S * 0.18);
    g.fill();
    g.fillStyle = '#ffd64f'; g.beginPath(); g.arc(cx, cy + S * 0.06, S * 0.07, 0, 7); g.fill();
  } else if (type === 'coal_generator') {
    drawBoltShape(g, cx, cy, S * 0.2, '#ffe07a');
  } else if (type === 'hub') {
    g.fillStyle = shade(def.color, -0.2); _rr(g, S * 0.24, S * 0.3, S * 0.52, S * 0.34, S * 0.04);
    g.strokeStyle = '#ddd'; g.lineWidth = S * 0.03;
    g.beginPath(); g.moveTo(S * 0.72, S * 0.22); g.lineTo(S * 0.72, S * 0.08); g.stroke();
    g.fillStyle = '#ff5544'; g.beginPath(); g.arc(S * 0.72, S * 0.07, S * 0.04, 0, 7); g.fill();
  }
}
