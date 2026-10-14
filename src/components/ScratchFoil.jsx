import { useEffect, useRef } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function paintFoil(ctx, w, h, label) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#c9ccd6');
  base.addColorStop(0.5, '#eef0f5');
  base.addColorStop(1, '#b9bdc9');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // Holographic sheen bands.
  const holo = ctx.createLinearGradient(0, h, w, 0);
  ['#ffb3e6', '#b3f0ff', '#e4ffb0', '#ffd9b3', '#d4c2ff'].forEach((c, i, a) => holo.addColorStop(i / (a.length - 1), c));
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = holo;
  ctx.fillRect(0, 0, w, h);
  // Sparkle grain.
  ctx.globalAlpha = 1;
  const n = Math.round((w * h) / 90);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.75)' : 'rgba(90,95,120,0.22)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
  }
  // Repeating "scratch" lettering, like the real thing.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.18);
  ctx.font = `800 11px 'Bricolage Grotesque Variable', sans-serif`;
  ctx.fillStyle = 'rgba(70,74,96,0.16)';
  for (let y = -h; y < h; y += 18)
    for (let x = -w; x < w; x += 74) ctx.fillText('SCRATCH', x + ((y / 18) % 2) * 37, y);
  ctx.restore();
  if (label) {
    ctx.font = `800 ${Math.min(24, Math.max(15, h * 0.2))}px 'Bricolage Grotesque Variable', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(48,40,80,0.78)';
    ctx.fillText(label.toUpperCase(), w / 2, h / 2);
  }
}

/** A canvas foil layer. Set `revealed` to scratch it off; `rub` lets fingers scratch it too. */
export default function ScratchFoil({ revealed, label, rub = true }) {
  const ref = useRef(null);
  const size = useRef({ w: 0, h: 0 });
  const anim = useRef(0);
  const labelRef = useRef(label);
  labelRef.current = label;

  const ctx = () => ref.current?.getContext('2d');

  const repaint = () => {
    const c = ref.current;
    if (!c) return;
    const { w, h } = size.current;
    const g = ctx();
    g.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    paintFoil(g, w, h, labelRef.current);
  };

  useEffect(() => {
    const c = ref.current;
    const ro = new ResizeObserver(() => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size.current = { w: r.width, h: r.height };
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      if (!c.classList.contains('is-gone')) repaint();
    });
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const c = ref.current;
    cancelAnimationFrame(anim.current);
    if (!revealed) {
      c.classList.remove('is-gone');
      repaint();
      return;
    }
    if (reduced()) {
      c.classList.add('is-gone');
      return;
    }
    // Auto-scratch: a zig-zag stroke sweeping left to right.
    const { w, h } = size.current;
    const g = ctx();
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(28, h * 0.42);
    const pts = [];
    const steps = Math.max(6, Math.round(w / 34));
    for (let i = 0; i <= steps; i++) pts.push([(w * i) / steps, i % 2 ? h * 0.82 : h * 0.18]);
    const start = performance.now();
    const dur = 620;
    let drawn = 0;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const upto = Math.floor(p * (pts.length - 1));
      g.beginPath();
      g.moveTo(...pts[Math.max(0, drawn)]);
      for (let i = drawn + 1; i <= upto; i++) g.lineTo(...pts[i]);
      g.stroke();
      drawn = upto;
      if (p < 1) anim.current = requestAnimationFrame(tick);
      else c.classList.add('is-gone');
    };
    anim.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(anim.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  useEffect(() => {
    if (!revealed) repaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  const scratching = useRef(false);
  const scratchAt = (e) => {
    const r = ref.current.getBoundingClientRect();
    const g = ctx();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(e.clientX - r.left, e.clientY - r.top, 18, 0, Math.PI * 2);
    g.fill();
  };

  return (
    <canvas
      ref={ref}
      className="foil-canvas"
      aria-hidden
      onPointerDown={
        rub
          ? (e) => {
              scratching.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              scratchAt(e);
            }
          : undefined
      }
      onPointerMove={rub ? (e) => scratching.current && scratchAt(e) : undefined}
      onPointerUp={() => (scratching.current = false)}
      onPointerCancel={() => (scratching.current = false)}
    />
  );
}
