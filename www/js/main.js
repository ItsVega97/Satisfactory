/* =========================================================
   Factoría 2D — Bucle principal, audio y arranque
   ========================================================= */

/* ---------------- Audio (sintetizado, sin assets) ---------------- */
let audioCtx = null;
let audioMuted = false;

function unlockAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function toggleMute() { audioMuted = !audioMuted; }

function tone(freq, dur, type, vol, when) {
  if (!audioCtx || audioMuted) return;
  const t0 = audioCtx.currentTime + (when || 0);
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type || 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.08, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t0); o.stop(t0 + dur);
}

function sfx(kind) {
  switch (kind) {
    case 'click':     tone(600, 0.06, 'square', 0.05); break;
    case 'mine':      tone(220 + Math.random() * 60, 0.08, 'square', 0.07); break;
    case 'collect':   tone(520, 0.07, 'triangle', 0.08); tone(780, 0.09, 'triangle', 0.07, 0.06); break;
    case 'build':     tone(300, 0.1, 'square', 0.08); tone(450, 0.12, 'square', 0.06, 0.08); break;
    case 'demolish':  tone(200, 0.12, 'sawtooth', 0.07); tone(120, 0.15, 'sawtooth', 0.06, 0.08); break;
    case 'craft':     tone(660, 0.06, 'triangle', 0.06); break;
    case 'error':     tone(160, 0.2, 'sawtooth', 0.09); break;
    case 'milestone': tone(523, 0.12, 'triangle', 0.1); tone(659, 0.12, 'triangle', 0.1, 0.12); tone(784, 0.2, 'triangle', 0.1, 0.24); break;
  }
}

/* ---------------- Bucle ---------------- */
let lastT = 0;
let autosaveT = 0;
let uiRefreshT = 0;

function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (document.hidden) return;

  tick(dt);
  draw(t);

  uiRefreshT += dt;
  if (uiRefreshT > 0.4) {
    uiRefreshT = 0;
    updateTopbar();
    updateHint();
    if (ui.sheetKind === 'hub' || ui.sheetKind === 'building' || ui.sheetKind === 'inventory') refreshSheet();
  }

  autosaveT += dt;
  if (autosaveT > 12) { autosaveT = 0; saveGame(); }
}

/* ---------------- Arranque ---------------- */
function boot() {
  const loaded = loadGame();
  if (!loaded) newGame();

  cam.x = 20 * TILE;
  cam.y = 23 * TILE;
  cam.z = window.innerWidth < 700 ? 0.85 : 1.1;

  initUI();
  initInput();
  rebuildPalette();
  updateTopbar();

  if (state.victory) state.victoryShown = true; // no repetir la pantalla al recargar

  window.addEventListener('beforeunload', saveGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });

  if (!loaded) {
    setTimeout(() => toast('👷 Bienvenido, ingeniero. Pica hierro tocando los yacimientos junto al HUB.'), 600);
  } else {
    toast('Partida cargada. ¡Seguimos construyendo!');
  }

  requestAnimationFrame(loop);
}

window.addEventListener('load', boot);
