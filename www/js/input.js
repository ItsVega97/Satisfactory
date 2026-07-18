/* =========================================================
   Factoría 2D — Entrada (táctil y ratón): paneo, zoom, modos
   ========================================================= */

const input = {
  mode: 'select',        // select | build | belt | demolish
  pointers: new Map(),   // pointerId -> {x,y,sx,sy}
  dragging: false,
  beltPath: null,
  pinchDist: 0,
};

function setMode(m) {
  if (m === 'belt' && !state.unlockedB.includes('conveyor')) {
    toast('Las cintas se desbloquean en el hito "Logística"');
    return;
  }
  input.mode = m;
  input.beltPath = null;
  ui.ghost = null;
  ui.selected = null;
  cancelLinking(true);
  closeSheet();
  document.querySelectorAll('#modebar button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === m);
  });
  document.getElementById('palette').classList.toggle('hidden', m !== 'build' && m !== 'belt');
  updateConfirmBar();
  if (m === 'build') rebuildPalette();
  if (m === 'belt') rebuildBeltPalette();
  const tips = {
    select: 'Toca yacimientos para picar, edificios para gestionarlos. Arrastra para moverte.',
    build: 'Elige un edificio abajo y toca el mapa para situarlo. Confirma con el botón Construir.',
    belt: 'Arrastra el dedo para trazar cintas, o elige el Separador abajo para repartir una cinta en tres.',
    demolish: 'Toca edificios, cintas o rocas para retirarlos (se devuelven los materiales).',
  };
  tipOnce('mode_' + m, tips[m]);
}

function initInput() {
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  document.querySelectorAll('#modebar button').forEach(b => {
    b.addEventListener('click', () => { unlockAudio(); setMode(b.dataset.mode); });
  });
}

function onDown(e) {
  unlockAudio();
  input.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* punteros sintéticos */ }
  input.dragging = false;

  if (input.pointers.size === 2) {
    // empieza pellizco: cancelar trazado de cinta
    input.beltPath = null;
    const pts = [...input.pointers.values()];
    input.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    return;
  }

  if (input.mode === 'belt' && ui.beltTool === 'conveyor' && input.pointers.size === 1) {
    const tPos = screenToTile(e.clientX, e.clientY);
    if (inBounds(tPos.x, tPos.y)) input.beltPath = [tPos];
  }
}

function onMove(e) {
  const p = input.pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;

  if (input.pointers.size === 2) {
    p.x = e.clientX; p.y = e.clientY;
    const pts = [...input.pointers.values()];
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (input.pinchDist > 0) {
      cam.z *= d / input.pinchDist;
      clampCam();
    }
    input.pinchDist = d;
    // paneo con el centro del pellizco
    cam.x -= dx / 2 / cam.z;
    cam.y -= dy / 2 / cam.z;
    clampCam();
    return;
  }

  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 10) input.dragging = true;

  if (input.mode === 'belt' && input.beltPath) {
    const tPos = screenToTile(e.clientX, e.clientY);
    extendBeltPath(tPos);
  } else if (input.dragging) {
    cam.x -= dx / cam.z;
    cam.y -= dy / cam.z;
    clampCam();
  }
  p.x = e.clientX; p.y = e.clientY;
}

function extendBeltPath(tPos) {
  const path = input.beltPath;
  let last = path[path.length - 1];
  let guard = 0;
  while ((last.x !== tPos.x || last.y !== tPos.y) && guard++ < 200) {
    const dx = tPos.x - last.x, dy = tPos.y - last.y;
    let nx = last.x, ny = last.y;
    if (Math.abs(dx) >= Math.abs(dy)) nx += Math.sign(dx);
    else ny += Math.sign(dy);
    if (!inBounds(nx, ny)) break;
    // retroceso: si volvemos a la celda anterior, recortar
    const prev = path[path.length - 2];
    if (prev && prev.x === nx && prev.y === ny) path.pop();
    else path.push({ x: nx, y: ny });
    last = path[path.length - 1];
    if (path.length > 400) break;
  }
}

function onUp(e) {
  const p = input.pointers.get(e.pointerId);
  input.pointers.delete(e.pointerId);
  if (!p) return;
  if (input.pointers.size > 0) return;   // quedaba otro dedo (pellizco)

  if (input.mode === 'belt' && input.beltPath) {
    const path = input.beltPath;
    input.beltPath = null;
    if (path.length === 1) {
      // toque simple: colocar/rotar una cinta
      const c = path[0];
      const existing = beltAt(c.x, c.y);
      if (existing) {
        existing.dir = DIR_LIST[(DIR_LIST.indexOf(existing.dir) + 1) % 4];
        sfx('click');
      } else placeBeltPath([c]);
    } else {
      placeBeltPath(path);
    }
    return;
  }

  if (input.dragging) return;
  handleTap(e.clientX, e.clientY);
}

function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 0.89;
  cam.z *= factor;
  clampCam();
}

/* ---------------- Toques ---------------- */
function handleTap(sx, sy) {
  const tPos = screenToTile(sx, sy);
  const w = screenToWorld(sx, sy);
  if (!inBounds(tPos.x, tPos.y)) return;

  if (input.mode === 'build') {
    if (ui.buildType) {
      ui.ghost = { type: ui.buildType, x: tPos.x, y: tPos.y };
      // centrar huella en el dedo
      const def = BUILDINGS[ui.buildType];
      ui.ghost.x = tPos.x - Math.floor((def.w - 1) / 2);
      ui.ghost.y = tPos.y - Math.floor((def.h - 1) / 2);
      updateConfirmBar();
    }
    return;
  }

  if (input.mode === 'belt' && ui.beltTool === 'splitter') {
    if (!state.unlockedB.includes('splitter')) { toast('El Separador se desbloquea en el hito "Logística"'); return; }
    ui.ghost = { type: 'splitter', x: tPos.x, y: tPos.y };
    updateConfirmBar();
    return;
  }

  if (input.mode === 'demolish') {
    const b = buildingAt(tPos.x, tPos.y);
    if (b) {
      if (b.type === 'hub') { toast('El HUB no se puede demoler'); return; }
      demolishBuilding(b);
      addFloat(w.x, w.y, 'Demolido', '#ffb0a0');
      return;
    }
    if (removeBelt(tPos.x, tPos.y)) { addFloat(w.x, w.y, 'Cinta retirada', '#ffb0a0'); return; }
    const r = rockAt(tPos.x, tPos.y);
    if (r) {
      state.world.rocks = state.world.rocks.filter(x => x !== r);
      sfx('demolish');
      addFloat(w.x, w.y, 'Roca retirada', '#ccc');
      return;
    }
    const tr = treeAt(tPos.x, tPos.y);
    if (tr) {
      state.world.trees = state.world.trees.filter(x => x !== tr);
      invAdd('biomass', 8);
      sfx('collect');
      addFloat(w.x, w.y, '+8 Biomasa', '#a5d16e', 'biomass');
    }
    return;
  }

  // trazado de cable en curso: el toque elige el destino
  if (ui.linking) {
    const pole = state.buildings.find(x => x.id === ui.linking);
    if (!pole) { cancelLinking(true); return; }
    const target = buildingAt(tPos.x, tPos.y);
    if (target && target.id !== pole.id) {
      const r = addCable(pole, target);
      if (r.ok) {
        addFloat(w.x, w.y, 'Cable conectado', '#8fe08f');
        cancelLinking(true);
        ui.selected = null;
      } else {
        toast(r.why);
      }
    } else {
      cancelLinking();
      ui.selected = null;
    }
    return;
  }

  // modo selección
  const b = buildingAt(tPos.x, tPos.y);
  if (b) {
    if (b.type === 'hub') { openHubPanel(); return; }
    if (b.type === 'portable_miner') {
      const n = collectPortable(b);
      if (n > 0) addFloat(w.x, w.y, '+' + n + ' ' + itemName(NODE_TYPES[b.nodeType].item), '#ffd64f', NODE_TYPES[b.nodeType].item);
      else toast('El taladro aún no tiene mineral. Espera un poco.');
      return;
    }
    ui.selected = b;
    openBuildingPanel(b);
    return;
  }

  if (wreckAt(tPos.x, tPos.y)) {
    if (salvageWreck()) {
      addFloat(w.x, w.y - 26, '+10 Placa de hierro', '#ffd64f', 'plate');
      addFloat(w.x - 30, w.y, '+8 Varilla de hierro', '#ffd64f', 'rod');
      addFloat(w.x + 30, w.y + 22, '+5 Cable', '#ffd64f', 'cable');
      toast('Piezas recuperadas. Ahora construye el HUB (modo Construir).');
    } else {
      toast('Ya no queda nada útil entre los restos.');
    }
    return;
  }

  const node = nodeAt(tPos.x, tPos.y);
  if (node) {
    const item = manualMine(node);
    if (item) addFloat(w.x, w.y, '+1 ' + itemName(item), '#fff', item);
    return;
  }

  const bush = bushAt(tPos.x, tPos.y);
  if (bush) {
    const n = harvestBush(bush);
    if (n > 0) addFloat(w.x, w.y, '+' + n + ' Biomasa', '#a5d16e', 'biomass');
    else toast('El arbusto está rebrotando...');
    return;
  }

  const tree = treeAt(tPos.x, tPos.y);
  if (tree) {
    const n = chopTree(tree);
    addFloat(w.x, w.y, n > 0 ? '+' + n + ' Biomasa' : 'Talando... (' + tree.hp + ')', '#a5d16e', n > 0 ? 'biomass' : null);
    return;
  }

  // toque en vacío: cerrar paneles
  ui.selected = null;
  closeSheet();
}

/* Confirmación de colocación */
function confirmGhost() {
  if (!ui.ghost) return;
  const res = placeBuilding(ui.ghost.type, ui.ghost.x, ui.ghost.y);
  if (res.ok) {
    addFloat((ui.ghost.x + 1) * TILE, ui.ghost.y * TILE, BUILDINGS[ui.ghost.type].name, '#8fe08f');
    ui.ghost = null;
    updateConfirmBar();
    rebuildPalette();
  } else {
    toast(res.why);
    sfx('error');
  }
}
function cancelGhost() {
  ui.ghost = null;
  updateConfirmBar();
}
