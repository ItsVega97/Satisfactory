/* =========================================================
   Factoría 2D — Intro cinemática
   Un astronauta de FICSIT viaja por el espacio, su nave falla,
   entra en la atmósfera y se estrella en el planeta.
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

  const t0 = performance.now();
  const rng = mulberry32(2077);
  const stars = [];
  for (let i = 0; i < 130; i++) stars.push({ x: rng(), y: rng(), s: 0.4 + rng() * 1.8, p: 0.2 + rng() * 0.8 });

  const IMPACT = 10.6;
  const DUR = IMPACT + 2.9;
  const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
  const ease = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

  function drawShip(S, x, y, ang, flame, fire, shake) {
    g.save();
    g.translate(x + (Math.random() - 0.5) * shake, y + (Math.random() - 0.5) * shake);
    g.rotate(ang);
    // estela de fuego (reentrada)
    if (fire > 0) {
      for (let i = 0; i < 7; i++) {
        const d = i / 7;
        g.fillStyle = `rgba(255,${140 + 80 * (1 - d)},40,${fire * (1 - d) * 0.65})`;
        g.beginPath();
        g.ellipse(-S * 0.7 - d * S * 1.7 + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * S * 0.3,
          S * 0.5 * (1 - d * 0.5), S * 0.26 * (1 - d * 0.4), 0, 0, 7);
        g.fill();
      }
    }
    // llama del propulsor
    if (flame > 0) {
      g.fillStyle = `rgba(120,190,255,${0.45 + 0.4 * Math.random()})`;
      g.beginPath();
      g.moveTo(-S * 0.62, -S * 0.1);
      g.lineTo(-S * 0.62 - S * 0.55 * flame * (0.7 + Math.random() * 0.5), 0);
      g.lineTo(-S * 0.62, S * 0.1);
      g.closePath(); g.fill();
    }
    // cuerpo de la nave
    g.fillStyle = '#c8cfd8';
    g.beginPath(); g.roundRect(-S * 0.65, -S * 0.28, S * 1.3, S * 0.56, S * 0.28); g.fill();
    g.fillStyle = '#96a0ac';
    g.beginPath(); g.roundRect(-S * 0.62, S * 0.02, S * 1.22, S * 0.24, S * 0.12); g.fill();
    // aleta
    g.fillStyle = '#e6934f';
    g.beginPath();
    g.moveTo(-S * 0.32, -S * 0.24); g.lineTo(-S * 0.62, -S * 0.6); g.lineTo(-S * 0.1, -S * 0.24);
    g.closePath(); g.fill();
    // morro
    g.beginPath();
    g.moveTo(S * 0.58, -S * 0.22); g.lineTo(S * 0.98, 0); g.lineTo(S * 0.58, S * 0.22);
    g.closePath(); g.fill();
    // ventana con el astronauta
    g.fillStyle = '#2c3a46';
    g.beginPath(); g.arc(S * 0.16, -S * 0.02, S * 0.18, 0, 7); g.fill();
    g.fillStyle = '#eef1f5';
    g.beginPath(); g.arc(S * 0.15, 0, S * 0.115, 0, 7); g.fill();
    g.fillStyle = '#2b2f3a';
    g.beginPath(); g.arc(S * 0.18, 0, S * 0.068, 0, 7); g.fill();
    g.strokeStyle = '#78848f'; g.lineWidth = S * 0.035;
    g.beginPath(); g.arc(S * 0.16, -S * 0.02, S * 0.18, 0, 7); g.stroke();
    g.restore();
  }

  function frame(now) {
    if (!introRaf) return;
    const t = (now - t0) / 1000;
    if (t >= DUR) { finishIntro(); return; }
    introRaf = requestAnimationFrame(frame);

    const W = window.innerWidth, H = window.innerHeight;
    const dp = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== W * dp || cv.height !== H * dp) {
      cv.width = W * dp; cv.height = H * dp;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    g.setTransform(dp, 0, 0, dp, 0, 0);
    const S = Math.min(W, 800) / 8.5;

    // cielo: del espacio profundo a la atmósfera
    const atmo = ease((t - 6.5) / 3.5);
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgb(${lerp(6, 74, atmo) | 0},${lerp(8, 132, atmo) | 0},${lerp(18, 172, atmo) | 0})`);
    grad.addColorStop(1, `rgb(${lerp(11, 128, atmo) | 0},${lerp(13, 175, atmo) | 0},${lerp(28, 205, atmo) | 0})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // estrellas con paralaje (se aceleran y desvanecen)
    const speed = lerp(30, 420, ease((t - 4) / 5));
    g.fillStyle = '#dfe6f0';
    for (const s of stars) {
      const sx = ((s.x * W - t * speed * s.p) % W + W) % W;
      g.globalAlpha = (1 - atmo) * 0.9;
      g.fillRect(sx, s.y * H * 0.92, s.s * (1 + speed / 180), s.s);
    }
    g.globalAlpha = 1;

    // planeta creciendo / suelo
    if (t < 9) {
      const pr = lerp(44, Math.max(W, H) * 1.25, ease((t - 1) / 7.6));
      const px = lerp(W * 0.86, W * 0.5, ease((t - 3) / 5));
      const py = lerp(H * 0.74, H + pr * 0.72, ease((t - 3) / 6));
      g.strokeStyle = 'rgba(150,205,255,0.4)'; g.lineWidth = 9;
      g.beginPath(); g.arc(px, py, pr + 7, 0, 7); g.stroke();
      g.fillStyle = '#4d7a42';
      g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
      g.fillStyle = 'rgba(62,100,54,0.8)';
      g.beginPath(); g.arc(px - pr * 0.32, py - pr * 0.34, pr * 0.24, 0, 7); g.fill();
      g.beginPath(); g.arc(px + pr * 0.33, py - pr * 0.12, pr * 0.17, 0, 7); g.fill();
      g.fillStyle = 'rgba(90,140,200,0.5)';
      g.beginPath(); g.arc(px + pr * 0.05, py - pr * 0.52, pr * 0.12, 0, 7); g.fill();
    } else {
      const gy = lerp(H * 1.06, H * 0.78, ease((t - 9) / 1.7));
      g.fillStyle = '#557d43';
      g.beginPath();
      g.moveTo(0, gy + 14);
      for (let x = 0; x <= W; x += 40) g.quadraticCurveTo(x + 20, gy - 8 + Math.sin(x * 0.02) * 8, x + 40, gy + 10);
      g.lineTo(W, H); g.lineTo(0, H);
      g.closePath(); g.fill();
    }

    // nave por fases
    let sx = 0, sy = 0, ang = 0, flame = 0.8, fire = 0, shake = 0;
    if (t < 5) {
      sx = lerp(W * 0.12, W * 0.46, t / 5);
      sy = H * 0.36 + Math.sin(t * 1.7) * 10;
      ang = 0.05;
    } else if (t < 6.5) {
      sx = lerp(W * 0.46, W * 0.5, (t - 5) / 1.5);
      sy = H * 0.36 + Math.sin(t * 9) * 4;
      ang = lerp(0.05, 0.3, (t - 5) / 1.5);
      flame = Math.random() > 0.45 ? 0.6 : 0;
      shake = 3;
    } else if (t < IMPACT) {
      const k = ease((t - 6.5) / (IMPACT - 6.5));
      sx = lerp(W * 0.5, W * 0.62, k);
      sy = lerp(H * 0.36, H * 0.8, k * k);
      ang = lerp(0.3, 0.55, k);
      flame = 0;
      fire = Math.min(1, (t - 7) / 1.4);
      shake = 2 + k * 8;
    }
    if (t < IMPACT) drawShip(S, sx, sy, ang, flame, fire, shake);

    // impacto y restos
    if (t >= IMPACT) {
      const k = t - IMPACT;
      const gx = W * 0.62, gy2 = H * 0.8;
      // surco y tierra levantada
      g.fillStyle = '#6b4a2f';
      g.beginPath(); g.ellipse(gx - S * 0.5, gy2 + S * 0.26, S * 1.5, S * 0.26, -0.06, 0, 7); g.fill();
      // nave estrellada
      g.save(); g.translate(gx, gy2); g.rotate(-0.16);
      g.fillStyle = '#8a939e';
      g.beginPath(); g.roundRect(-S * 0.6, -S * 0.26, S * 1.2, S * 0.52, S * 0.24); g.fill();
      g.fillStyle = '#5d666f';
      g.beginPath(); g.roundRect(-S * 0.58, 0, S * 1.16, S * 0.24, S * 0.12); g.fill();
      g.fillStyle = '#2c3a46';
      g.beginPath(); g.arc(S * 0.14, -S * 0.03, S * 0.15, 0, 7); g.fill();
      g.restore();
      // humo
      for (let i = 0; i < 5; i++) {
        const p = (t * 0.55 + i * 0.21) % 1;
        g.fillStyle = `rgba(95,95,95,${0.55 * (1 - p)})`;
        g.beginPath();
        g.arc(gx - S * 0.2 + Math.sin(i * 3.1) * S * 0.4, gy2 - S * 0.45 - p * S * 1.7, S * (0.16 + p * 0.38), 0, 7);
        g.fill();
      }
      // destello del impacto
      if (k < 0.5) {
        g.fillStyle = `rgba(255,252,235,${1 - k * 2})`;
        g.fillRect(0, 0, W, H);
      }
      // texto final
      if (k > 1.0) {
        g.globalAlpha = Math.min(1, k - 1.0);
        g.fillStyle = '#e8e6d8';
        g.textAlign = 'center';
        g.font = 'bold 21px sans-serif';
        g.fillText('Has sobrevivido... por poco.', W / 2, H * 0.28);
        g.font = '14px sans-serif';
        g.fillText('Recupera lo que quede de la nave y construye el HUB.', W / 2, H * 0.28 + 30);
        g.globalAlpha = 1;
      }
      // fundido de salida
      if (k > 2.3) wrap.style.opacity = String(Math.max(0, 1 - (k - 2.3) / 0.55));
    }

    // subtítulos
    g.textAlign = 'center';
    if (t > 0.8 && t < 4.6) {
      g.fillStyle = 'rgba(232,230,216,0.9)';
      g.font = '15px sans-serif';
      g.fillText('Espacio profundo · Misión FICSIT: colonizar un nuevo planeta', W / 2, H * 0.12);
    } else if (t > 5 && t < 6.6) {
      if (Math.sin(t * 12) > -0.3) {
        g.fillStyle = '#ff6655';
        g.font = 'bold 22px sans-serif';
        g.fillText('¡FALLO CRÍTICO DEL MOTOR!', W / 2, H * 0.14);
      }
    } else if (t > 7 && t < 10.2) {
      g.fillStyle = 'rgba(255,214,79,0.95)';
      g.font = 'bold 16px sans-serif';
      g.fillText('Entrando en la atmósfera...', W / 2, H * 0.12);
    }
  }

  introRaf = requestAnimationFrame(frame);
}
