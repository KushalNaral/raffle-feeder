const COLORS = ['#ff6b57', '#3d5bff', '#c8f44a', '#ffb347', '#ff8fc8', '#ffffff'];

/** A short confetti burst from an element. */
export function burst(fromEl) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const r = fromEl?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const ox = r.left + r.width / 2;
  const oy = r.top + r.height / 2;
  const parts = Array.from({ length: 120 }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 4 + Math.random() * 9;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 6,
      s: 5 + Math.random() * 7,
      r: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      round: Math.random() > 0.6,
    };
  });
  const start = performance.now();
  const frame = (t) => {
    const age = t - start;
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalAlpha = Math.max(0, 1 - age / 1600);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.c;
      if (p.round) {
        g.beginPath();
        g.arc(0, 0, p.s / 2, 0, Math.PI * 2);
        g.fill();
      } else g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    if (age < 1600) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
