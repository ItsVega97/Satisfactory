/* =========================================================
   Factoría 2D — Intro cinemática
   Título → crucero espacial → fallo del motor → reentrada →
   impacto → amanecer en el planeta. Textos autoajustados,
   partículas y easing en todo el movimiento.
   ========================================================= */

let introRaf = null;

function skipIntro() { finishIntro(); }

function finishIntro() {
  if (introRaf) cancelAnimationFrame(introRaf);
  introRaf = null;
  const wrap = document.getElementById('intro');
  wrap.classList.add('hidden');
  wrap.style.opacity = '1';
  if (state) { state.introDone = true; saveGame(); }
  toast('Has sobrevivido al aterrizaje. Toca los restos humeantes de la nave.');
}

function startIntro() {
  if (introRaf) return;
  const wrap = document.getElementById('intro');
  const cv = document.getElementById('introCanvas');
  const g = cv.getContext('2d');
  wrap.classList.remove('hidden');
  wrap.style.opacity = '1';
  document.getElementById('introSkip').onclick = skipIntro;

  /* ---------------- línea de tiempo (segundos) ---------------- */
  const T = { title: 0, space: 2.9, alarm: 7.0, dive: 8.9, impact: 12.4, after: 13.0, end: 16.6 };

  const t0 = performance.now();
  let lastNow = t0;
  const rng = mulberry32(2077);

  /* estrellas en 3 capas de paralaje, con parpadeo */
  const stars = [];
  for (let L = 0; L < 3; L++) {
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: rng(), y: rng(), L,
        s: 0.5 + L * 0.5 + rng() * 0.8,
        tw: 1 + rng() * 3, phi: rng() * 6.28,
      });
    }
  }
  const nebulae = [
    { x: 0.22, y: 0.26, r: 0.55, c: '132,96,210' },
    { x: 0.85, y: 0.18, r: 0.45, c: '66,150,170' },
  ];

  /* sistema de partículas: fire | smoke | spark | debris | ember | dust */
  let parts = [];
  const spawn = (type, n, fx) => {
    for (let i = 0; i < n; i++) {
      const p = { type, age: 0, x: 0, y: 0, vx: 0, vy: 0, life: 1, size: 4, rot: rng() * 6.28, vr: (rng() - 0.5) * 8 };
      fx(p, rng);
      parts.push(p);
    }
    if (parts.length > 320) parts.splice(0, parts.length - 320);
  };

  /* ---------------- utilidades ---------------- */
  const c01 = k => Math.max(0, Math.min(1, k));
  const lerp = (a, b, k) => a + (b - a) * c01(k);
  const ez = k => { k = c01(k); return k * k * (3 - 2 * k); };            // suave
  const ezo = k => { k = c01(k); return 1 - Math.pow(1 - k, 3); };        // salida
  const ezi = k => { k = c01(k); return k * k * k; };                     // entrada
  const seg = (t, a, b) => c01((t - a) / (b - a));

  /* sacudida por suma de ondas (sin saltos bruscos) */
  const shk = (t, amp) => ({
    x: (Math.sin(t * 43) * 0.5 + Math.sin(t * 29 + 1.7) * 0.3 + Math.sin(t * 67 + 0.4) * 0.2) * amp,
    y: (Math.sin(t * 37 + 2.1) * 0.5 + Math.sin(t * 53 + 0.9) * 0.35) * amp,
  });

  /* texto que siempre cabe: reduce la fuente hasta ajustarse al ancho */
  function fitFont(txt, maxW, base, weight) {
    let size = base;
    g.font = `${weight || 800} ${size}px 'Segoe UI', system-ui, sans-serif`;
    while (g.measureText(txt).width > maxW && size > 11) {
      size--;
      g.font = `${weight || 800} ${size}px 'Segoe UI', system-ui, sans-serif`;
    }
    return size;
  }

  /* rótulo inferior: etiqueta pequeña + línea principal, dentro del área segura */
  function caption(W, H, barH, kicker, main, alpha) {
    if (alpha <= 0) return;
    g.textAlign = 'center';
    g.globalAlpha = alpha;
    const maxW = W - 56;
    if (kicker) {
      g.font = `800 11px 'Segoe UI', system-ui, sans-serif`;
      g.fillStyle = '#f5a13c';
      const k = kicker.toUpperCase().split('').join('  ');
      g.fillText(k, W / 2, H - barH - 44);
    }
    fitFont(main, maxW, 17, 700);
    g.fillStyle = '#f2efe4';
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8;
    g.fillText(main, W / 2, H - barH - 22);
    g.shadowBlur = 0;
    g.globalAlpha = 1;
  }

  /* título con interletrado animado */
  function titleText(W, y, txt, size, spread, color, alpha) {
    if (alpha <= 0) return;
    g.globalAlpha = alpha;
    g.font = `800 ${size}px 'Segoe UI', system-ui, sans-serif`;
    let tot = 0;
    const ws = [];
    for (const ch of txt) { const w = g.measureText(ch).width + spread; ws.push(w); tot += w; }
    let x = W / 2 - tot / 2;
    g.fillStyle = color;
    g.textAlign = 'left';
    g.shadowColor = 'rgba(245,158,46,0.5)'; g.shadowBlur = 18 * alpha;
    [...txt].forEach((ch, i) => { g.fillText(ch, x, y); x += ws[i]; });
    g.shadowBlur = 0;
    g.textAlign = 'center';
    g.globalAlpha = 1;
  }

  /* ---------------- nave ---------------- */
  function drawShip(S, x, y, ang, o) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);

    // llamas de reentrada envolviendo el morro
    if (o.fire > 0) {
      g.globalCompositeOperation = 'lighter';
      for (const p of parts) if (p.type === 'fire') { /* dibujadas aparte */ }
      const f = o.fire;
      const grd = g.createRadialGradient(S * 0.75, 0, 0, S * 0.75, 0, S * 1.15);
      grd.addColorStop(0, `rgba(255,230,150,${0.55 * f})`);
      grd.addColorStop(0.4, `rgba(255,140,40,${0.4 * f})`);
      grd.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(S * 0.75, 0, S * 1.15, 0, 7); g.fill();
      g.globalCompositeOperation = 'source-over';
    }

    // llama del propulsor (doble capa con parpadeo suave)
    if (o.flame > 0) {
      const fl = o.flame * (0.75 + Math.sin(o.t * 31) * 0.15 + Math.sin(o.t * 57) * 0.1);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(120,180,255,${0.75 * o.flame})`;
      g.beginPath();
      g.moveTo(-S * 0.66, -S * 0.11);
      g.quadraticCurveTo(-S * 0.66 - S * 0.75 * fl, 0, -S * 0.66, S * 0.11);
      g.closePath(); g.fill();
      g.fillStyle = `rgba(235,248,255,${0.85 * o.flame})`;
      g.beginPath();
      g.moveTo(-S * 0.64, -S * 0.055);
      g.quadraticCurveTo(-S * 0.64 - S * 0.4 * fl, 0, -S * 0.64, S * 0.055);
      g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
    }

    // casco con brillo metálico
    const hull = g.createLinearGradient(0, -S * 0.3, 0, S * 0.32);
    hull.addColorStop(0, '#e3e9f0');
    hull.addColorStop(0.45, '#c3ccd6');
    hull.addColorStop(1, '#8d97a4');
    g.fillStyle = hull;
    g.beginPath(); g.roundRect(-S * 0.66, -S * 0.29, S * 1.32, S * 0.58, S * 0.29); g.fill();
    // panza
    g.fillStyle = 'rgba(70,80,92,0.55)';
    g.beginPath(); g.roundRect(-S * 0.62, S * 0.06, S * 1.22, S * 0.2, S * 0.1); g.fill();
    // líneas de panel
    g.strokeStyle = 'rgba(60,70,82,0.35)'; g.lineWidth = S * 0.02;
    g.beginPath(); g.moveTo(-S * 0.3, -S * 0.27); g.lineTo(-S * 0.3, S * 0.24); g.stroke();
    g.beginPath(); g.moveTo(S * 0.36, -S * 0.25); g.lineTo(S * 0.36, S * 0.2); g.stroke();
    // franja naranja FICSIT
    g.fillStyle = '#e8862c';
    g.beginPath(); g.roundRect(-S * 0.52, -S * 0.13, S * 0.34, S * 0.11, S * 0.05); g.fill();
    // aleta superior
    g.fillStyle = '#e8862c';
    g.beginPath();
    g.moveTo(-S * 0.3, -S * 0.25); g.lineTo(-S * 0.58, -S * 0.62); g.lineTo(-S * 0.06, -S * 0.27);
    g.closePath(); g.fill();
    // morro
    const nose = g.createLinearGradient(S * 0.55, 0, S * 1.0, 0);
    nose.addColorStop(0, '#f0a04a'); nose.addColorStop(1, '#c96a24');
    g.fillStyle = nose;
    g.beginPath();
    g.moveTo(S * 0.6, -S * 0.24); g.quadraticCurveTo(S * 1.05, 0, S * 0.6, S * 0.24);
    g.closePath(); g.fill();
    // tobera
    g.fillStyle = '#5c6672';
    g.beginPath(); g.roundRect(-S * 0.74, -S * 0.13, S * 0.12, S * 0.26, S * 0.04); g.fill();

    // ventana con astronauta
    g.fillStyle = '#243440';
    g.beginPath(); g.arc(S * 0.16, -S * 0.03, S * 0.185, 0, 7); g.fill();
    g.fillStyle = '#f0f3f6';
    g.beginPath(); g.arc(S * 0.15, -S * 0.005, S * 0.115, 0, 7); g.fill();
    g.fillStyle = '#242a34';
    g.beginPath(); g.arc(S * 0.18, -S * 0.005, S * 0.066, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.arc(S * 0.2, -S * 0.03, S * 0.018, 0, 7); g.fill();
    g.strokeStyle = '#78848f'; g.lineWidth = S * 0.035;
    g.beginPath(); g.arc(S * 0.16, -S * 0.03, S * 0.185, 0, 7); g.stroke();
    // reflejo de la cúpula
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = S * 0.02;
    g.beginPath(); g.arc(S * 0.16, -S * 0.03, S * 0.14, -2.4, -1.4); g.stroke();

    // luz de navegación parpadeante
    if (Math.sin(o.t * 6) > 0.2) {
      g.fillStyle = '#ff5544';
      g.beginPath(); g.arc(-S * 0.56, -S * 0.6, S * 0.035, 0, 7); g.fill();
    }
    g.restore();
  }

  /* ---------------- planeta ---------------- */
  function drawPlanet(px, py, pr, t) {
    // halo atmosférico
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(px, py, pr * 0.92, px, py, pr * 1.14);
    halo.addColorStop(0, 'rgba(120,200,255,0.0)');
    halo.addColorStop(0.55, 'rgba(120,200,255,0.22)');
    halo.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = halo;
    g.beginPath(); g.arc(px, py, pr * 1.14, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
    // esfera iluminada desde arriba-izquierda
    const sph = g.createRadialGradient(px - pr * 0.4, py - pr * 0.45, pr * 0.1, px, py, pr);
    sph.addColorStop(0, '#7fae5c');
    sph.addColorStop(0.55, '#4d7a42');
    sph.addColorStop(1, '#27422a');
    g.fillStyle = sph;
    g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
    // continentes
    g.save();
    g.beginPath(); g.arc(px, py, pr, 0, 7); g.clip();
    g.fillStyle = 'rgba(58,98,52,0.9)';
    g.beginPath(); g.ellipse(px - pr * 0.3, py - pr * 0.3, pr * 0.34, pr * 0.22, 0.5, 0, 7); g.fill();
    g.beginPath(); g.ellipse(px + pr * 0.35, py + pr * 0.05, pr * 0.26, pr * 0.34, -0.4, 0, 7); g.fill();
    g.fillStyle = 'rgba(90,150,200,0.55)';
    g.beginPath(); g.ellipse(px - pr * 0.05, py + pr * 0.42, pr * 0.3, pr * 0.16, 0.2, 0, 7); g.fill();
    // banda de nubes en movimiento
    g.fillStyle = 'rgba(255,255,255,0.28)';
    const cOff = (t * 0.02) % 2;
    g.beginPath(); g.ellipse(px + pr * (cOff - 1) * 0.8, py - pr * 0.12, pr * 0.5, pr * 0.09, 0.1, 0, 7); g.fill();
    g.beginPath(); g.ellipse(px - pr * (cOff - 0.6) * 0.9, py + pr * 0.25, pr * 0.4, pr * 0.07, -0.1, 0, 7); g.fill();
    // terminador nocturno
    g.fillStyle = 'rgba(8,12,20,0.5)';
    g.beginPath(); g.ellipse(px + pr * 0.55, py + pr * 0.35, pr * 0.9, pr * 0.9, 0, 0, 7); g.fill();
    g.restore();
  }

  /* ---------------- astronauta (final) ---------------- */
  function drawAstro(x, y, S, t, walk) {
    const bob = Math.sin(t * (walk ? 9 : 2.2)) * (walk ? S * 0.06 : S * 0.03);
    g.save();
    g.translate(x, y + bob);
    // piernas
    const step = walk ? Math.sin(t * 9) * S * 0.16 : 0;
    g.strokeStyle = '#d8dde3'; g.lineWidth = S * 0.16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-S * 0.08, S * 0.35); g.lineTo(-S * 0.1 + step, S * 0.72); g.stroke();
    g.beginPath(); g.moveTo(S * 0.08, S * 0.35); g.lineTo(S * 0.1 - step, S * 0.72); g.stroke();
    // cuerpo
    g.fillStyle = '#e8ecf1';
    g.beginPath(); g.roundRect(-S * 0.24, -S * 0.1, S * 0.48, S * 0.52, S * 0.16); g.fill();
    g.fillStyle = '#e8862c';
    g.beginPath(); g.roundRect(-S * 0.24, S * 0.08, S * 0.48, S * 0.1, S * 0.04); g.fill();
    // mochila
    g.fillStyle = '#9aa3ad';
    g.beginPath(); g.roundRect(-S * 0.34, -S * 0.06, S * 0.12, S * 0.36, S * 0.05); g.fill();
    // casco
    g.fillStyle = '#f2f5f8';
    g.beginPath(); g.arc(0, -S * 0.3, S * 0.24, 0, 7); g.fill();
    g.fillStyle = '#2a3038';
    g.beginPath(); g.arc(S * 0.05, -S * 0.3, S * 0.15, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.arc(S * 0.1, -S * 0.36, S * 0.045, 0, 7); g.fill();
    g.restore();
  }

  /* ---------------- fotograma ---------------- */
  function frame(now) {
    if (!introRaf) return;
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;
    if (t >= T.end) { finishIntro(); return; }
    introRaf = requestAnimationFrame(frame);

    const W = window.innerWidth, H = window.innerHeight;
    const dp = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== W * dp || cv.height !== H * dp) {
      cv.width = W * dp; cv.height = H * dp;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    g.setTransform(dp, 0, 0, dp, 0, 0);
    g.textBaseline = 'alphabetic';
    const S = Math.min(W, 760) / 7.6;

    /* ------ fases ------ */
    const atmo = ez(seg(t, T.dive, T.dive + 2.2));            // espacio → cielo
    const alarmK = seg(t, T.alarm, T.alarm + 0.5);
    const barH = ez(seg(t, 0, 0.9)) * Math.max(26, H * 0.075); // barras de cine

    /* ------ cielo ------ */
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, `rgb(${lerp(5, 96, atmo) | 0},${lerp(7, 148, atmo) | 0},${lerp(16, 186, atmo) | 0})`);
    grd.addColorStop(1, `rgb(${lerp(10, 140, atmo) | 0},${lerp(12, 182, atmo) | 0},${lerp(26, 212, atmo) | 0})`);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);

    /* nebulosas */
    if (atmo < 1) {
      for (const nb of nebulae) {
        const nr = nb.r * Math.max(W, H);
        const ng = g.createRadialGradient(nb.x * W, nb.y * H, 0, nb.x * W, nb.y * H, nr);
        ng.addColorStop(0, `rgba(${nb.c},${0.12 * (1 - atmo)})`);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = ng;
        g.fillRect(0, 0, W, H);
      }
    }

    /* estrellas con paralaje y parpadeo */
    const speed = lerp(12, 480, ezi(seg(t, T.alarm, T.impact)));
    for (const s of stars) {
      const lv = (s.L + 1) / 3;
      const sx = ((s.x * W - t * speed * lv * 0.6) % W + W) % W;
      const twk = 0.55 + Math.sin(t * s.tw + s.phi) * 0.45;
      g.globalAlpha = (1 - atmo) * twk * (0.4 + lv * 0.6);
      g.fillStyle = '#e8eef8';
      const stretch = 1 + speed / 90 * lv;
      g.fillRect(sx, s.y * H, s.s * stretch, s.s);
    }
    g.globalAlpha = 1;

    /* ------ planeta ------ */
    if (t < T.dive + 1.4) {
      // crecimiento lento al principio y vertiginoso al final (easing de entrada)
      const grow = ezi(seg(t, T.space + 0.4, T.dive + 0.6));
      const pr = lerp(Math.min(W, H) * 0.15, Math.max(W, H) * 1.15, grow);
      const px = lerp(W * 0.82, W * 0.5, ez(seg(t, T.dive - 1, T.dive + 0.8)));
      const py = lerp(H * 0.72, H + pr * 0.6, ez(seg(t, T.dive - 0.6, T.dive + 1.2)));
      g.globalAlpha = 1 - seg(t, T.dive + 0.8, T.dive + 1.4);
      drawPlanet(px, py, pr, t);
      g.globalAlpha = 1;
    }

    /* ------ suelo (últimos segundos del descenso) ------ */
    if (t > T.impact - 1.5) {
      const gy = lerp(H * 1.08, H * 0.8, ezo(seg(t, T.impact - 1.5, T.impact)));
      const gg = g.createLinearGradient(0, gy, 0, H);
      gg.addColorStop(0, '#5c8347'); gg.addColorStop(1, '#3d5c31');
      g.fillStyle = gg;
      g.beginPath();
      g.moveTo(0, gy + 16);
      for (let x = 0; x <= W + 40; x += 44)
        g.quadraticCurveTo(x + 22, gy - 10 + Math.sin(x * 0.02 + 2) * 9, x + 44, gy + 12);
      g.lineTo(W, H); g.lineTo(0, H);
      g.closePath(); g.fill();
    }

    /* ------ nave por fases ------ */
    let sx = 0, sy = 0, ang = 0, flame = 0, fire = 0, amp = 0;
    let showShip = true;

    if (t < T.space) {                                       // cartel de título
      showShip = false;
    } else if (t < T.alarm) {                                // crucero
      const k = ezo(seg(t, T.space, T.space + 1.6));
      sx = lerp(-S, W * 0.32, k);
      sy = H * 0.38 + Math.sin(t * 1.5) * 8 + Math.sin(t * 0.7) * 5;
      ang = 0.04 + Math.sin(t * 0.9) * 0.02;
      flame = 1;
    } else if (t < T.dive) {                                 // alarma
      sx = W * 0.32 + Math.sin(t * 2) * 4;
      sy = H * 0.38 + Math.sin(t * 1.5) * 6;
      ang = lerp(0.05, 0.32, ez(seg(t, T.alarm, T.dive)));
      flame = Math.sin(t * 23) > 0.2 ? 0.7 : 0.1;
      amp = 2.6;
      if (rng() < 0.5) spawn('spark', 1, p => {
        p.x = sx - S * 0.68; p.y = sy + (rng() - 0.5) * S * 0.2;
        p.vx = -60 - rng() * 90; p.vy = (rng() - 0.5) * 120;
        p.life = 0.5; p.size = 2.2;
      });
      if (rng() < 0.16) spawn('smoke', 1, p => {
        p.x = sx - S * 0.7; p.y = sy;
        p.vx = -40; p.vy = (rng() - 0.5) * 30;
        p.life = 1.3; p.size = S * 0.12;
      });
    } else if (t < T.impact) {                               // reentrada en picado
      const k = ez(seg(t, T.dive, T.impact));
      sx = lerp(W * 0.32, W * 0.58, k);
      sy = lerp(H * 0.38, H * 0.79, k * k);
      ang = lerp(0.32, 0.58, k);
      fire = ez(seg(t, T.dive + 0.5, T.dive + 1.8));
      amp = 2 + k * 8;
      if (fire > 0.1) spawn('fire', 3, p => {
        p.x = sx + Math.cos(ang) * S * 0.8 + (rng() - 0.5) * S * 0.5;
        p.y = sy + Math.sin(ang) * S * 0.8 + (rng() - 0.5) * S * 0.5;
        p.vx = -120 - rng() * 160; p.vy = -60 - rng() * 120;
        p.life = 0.55; p.size = S * (0.1 + rng() * 0.14);
      });
    } else {                                                 // en el suelo
      showShip = false;
      amp = Math.max(0, 9 * (1 - seg(t, T.impact, T.impact + 0.8)));
    }

    const sh = shk(t, amp);
    g.save();
    g.translate(sh.x, sh.y);

    if (showShip) drawShip(S, sx, sy, ang, { flame, fire, t });

    /* impacto: destello, escombros y anillo de polvo */
    const gx = W * 0.6, gy2 = H * 0.815;
    if (t >= T.impact) {
      const k = t - T.impact;
      if (k < 0.06) {
        spawn('debris', 4, p => {
          p.x = gx; p.y = gy2;
          const a = -0.4 - rng() * 2.2;
          const v = 140 + rng() * 260;
          p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
          p.life = 1.1; p.size = 3 + rng() * 5;
        });
        spawn('dust', 2, p => {
          p.x = gx; p.y = gy2 + 6; p.life = 1.4; p.size = 10;
        });
      }
      // surco y nave estrellada
      g.fillStyle = '#5c4029';
      g.beginPath(); g.ellipse(gx - S * 0.5, gy2 + S * 0.24, S * 1.5, S * 0.24, -0.05, 0, 7); g.fill();
      g.save();
      g.translate(gx, gy2);
      g.rotate(-0.14);
      const hull2 = g.createLinearGradient(0, -S * 0.3, 0, S * 0.3);
      hull2.addColorStop(0, '#aeb6c0'); hull2.addColorStop(1, '#6c7580');
      g.fillStyle = hull2;
      g.beginPath(); g.roundRect(-S * 0.6, -S * 0.26, S * 1.2, S * 0.52, S * 0.24); g.fill();
      g.fillStyle = 'rgba(40,48,58,0.5)';
      g.beginPath(); g.roundRect(-S * 0.58, S * 0.04, S * 1.16, S * 0.2, S * 0.1); g.fill();
      g.fillStyle = '#243440';
      g.beginPath(); g.arc(S * 0.13, -S * 0.03, S * 0.15, 0, 7); g.fill();
      g.fillStyle = '#c96a24';
      g.beginPath();
      g.moveTo(-S * 0.28, -S * 0.22); g.lineTo(-S * 0.5, -S * 0.5); g.lineTo(-S * 0.08, -S * 0.24);
      g.closePath(); g.fill();
      g.restore();
      // morro enterrado
      g.fillStyle = '#6b4a2f';
      g.beginPath(); g.ellipse(gx + S * 0.58, gy2 + S * 0.1, S * 0.3, S * 0.2, 0.3, 0, 7); g.fill();
      // humo continuo y brasas
      if (rng() < 0.35) spawn('smoke', 1, p => {
        p.x = gx - S * 0.15 + (rng() - 0.5) * S * 0.5; p.y = gy2 - S * 0.3;
        p.vx = (rng() - 0.5) * 14; p.vy = -32 - rng() * 22;
        p.life = 2.4; p.size = S * 0.1;
      });
      if (rng() < 0.2) spawn('ember', 1, p => {
        p.x = gx + (rng() - 0.5) * S; p.y = gy2 - rng() * S * 0.3;
        p.vx = (rng() - 0.5) * 26; p.vy = -46 - rng() * 40;
        p.life = 1.2; p.size = 1.8;
      });
      // el astronauta baja de la nave
      const walkK = seg(t, T.after + 0.9, T.after + 2.3);
      if (walkK > 0) {
        const ax = gx - S * 0.7 - ezo(walkK) * S * 0.85;
        drawAstro(ax, gy2 - S * 0.28, S * 0.42, t, walkK < 1);
      }
    }

    /* partículas */
    parts = parts.filter(p => {
      p.age += dt;
      if (p.age >= p.life) return false;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const k = p.age / p.life;
      if (p.type === 'fire') {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,${170 - k * 110 | 0},40,${0.5 * (1 - k)})`;
        g.beginPath(); g.arc(p.x, p.y, p.size * (1 - k * 0.4), 0, 7); g.fill();
        g.globalCompositeOperation = 'source-over';
      } else if (p.type === 'spark') {
        g.strokeStyle = `rgba(255,220,120,${1 - k})`;
        g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
      } else if (p.type === 'smoke') {
        g.fillStyle = `rgba(120,120,120,${0.4 * (1 - k)})`;
        g.beginPath(); g.arc(p.x, p.y, p.size * (0.6 + k * 1.6), 0, 7); g.fill();
      } else if (p.type === 'debris') {
        p.vy += 620 * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillStyle = `rgba(110,86,60,${1 - k})`;
        g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        g.restore();
      } else if (p.type === 'ember') {
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = `rgba(255,${140 + Math.sin(p.age * 20) * 60 | 0},50,${1 - k})`;
        g.beginPath(); g.arc(p.x, p.y, p.size, 0, 7); g.fill();
        g.globalCompositeOperation = 'source-over';
      } else if (p.type === 'dust') {
        g.strokeStyle = `rgba(150,125,95,${0.5 * (1 - k)})`;
        g.lineWidth = 5 * (1 - k) + 1;
        g.beginPath(); g.ellipse(p.x, p.y, p.size + k * 130, (p.size + k * 130) * 0.32, 0, Math.PI, 7.1); g.stroke();
      }
      return true;
    });

    g.restore(); // sacudida

    /* destello del impacto */
    if (t >= T.impact && t < T.impact + 0.4) {
      g.fillStyle = `rgba(255,250,235,${ 1 - seg(t, T.impact, T.impact + 0.4)})`;
      g.fillRect(0, 0, W, H);
    }

    /* alarma: pulso rojo en los bordes */
    if (t >= T.alarm && t < T.dive) {
      const pulse = (Math.sin((t - T.alarm) * 9) + 1) / 2;
      const rg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      rg.addColorStop(0, 'rgba(255,40,20,0)');
      rg.addColorStop(1, `rgba(255,40,20,${0.3 * pulse * alarmK})`);
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }

    /* ------ barras de cine ------ */
    g.fillStyle = '#04050a';
    g.fillRect(0, 0, W, barH);
    g.fillRect(0, H - barH, W, barH);

    /* ------ textos ------ */
    g.textAlign = 'center';
    if (t < T.space + 0.6) {                                  // cartel de título
      const aIn = ez(seg(t, 0.5, 1.4));
      const aOut = 1 - ez(seg(t, T.space - 0.5, T.space + 0.5));
      const a = Math.min(aIn, aOut);
      const spread = lerp(14, 5, ez(seg(t, 0.5, 2.4)));
      const size = fitFont('FACTORÍA', W - 80, 44, 800);
      titleText(W, H * 0.42, 'FACTORÍA', size, spread, '#f2efe4', a);
      g.globalAlpha = a * 0.9;
      g.font = `700 12px 'Segoe UI', system-ui, sans-serif`;
      g.fillStyle = '#f5a13c';
      g.fillText('U N A   M I S I Ó N   D E   F I C S I T', W / 2, H * 0.42 + 30);
      g.globalAlpha = 1;
    }
    if (t >= T.space + 0.4 && t < T.alarm) {
      const a = Math.min(ez(seg(t, T.space + 0.6, T.space + 1.4)), 1 - ez(seg(t, T.alarm - 0.6, T.alarm)));
      caption(W, H, barH, 'Espacio profundo', 'Rumbo a un planeta por colonizar', a);
    }
    if (t >= T.alarm && t < T.dive) {
      const a = ez(seg(t, T.alarm, T.alarm + 0.35));
      const blink = Math.sin(t * 10) > -0.4;
      if (blink) {
        g.globalAlpha = a;
        const sz = fitFont('¡FALLO CRÍTICO DEL MOTOR!', W - 56, 22, 800);
        g.fillStyle = '#ff6650';
        g.shadowColor = 'rgba(255,60,30,0.7)'; g.shadowBlur = 14;
        g.fillText('¡FALLO CRÍTICO DEL MOTOR!', W / 2, H * 0.2);
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      }
      caption(W, H, barH, 'Alerta', 'Los sistemas de propulsión no responden', a);
    }
    if (t >= T.dive + 0.3 && t < T.impact - 0.2) {
      const a = Math.min(ez(seg(t, T.dive + 0.4, T.dive + 1)), 1 - ez(seg(t, T.impact - 0.7, T.impact - 0.2)));
      caption(W, H, barH, 'Reentrada', 'Entrando en la atmósfera a 8 km/s', a);
    }
    if (t >= T.after + 0.8) {
      const a = ez(seg(t, T.after + 0.9, T.after + 1.7));
      g.globalAlpha = a;
      const sz = fitFont('Has sobrevivido… por poco.', W - 56, 24, 800);
      g.fillStyle = '#f2efe4';
      g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 10;
      g.fillText('Has sobrevivido… por poco.', W / 2, H * 0.26);
      g.shadowBlur = 0;
      g.globalAlpha = 1;
      caption(W, H, barH, 'Protocolo FICSIT', 'Recupera los restos y construye el HUB', a);
    }

    /* fundido de salida */
    if (t > T.end - 0.7) {
      wrap.style.opacity = String(c01(1 - seg(t, T.end - 0.7, T.end - 0.05)));
    }
  }

  introRaf = requestAnimationFrame(frame);
}
