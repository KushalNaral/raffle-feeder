import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

const PAD = 8;
const GAP = 14;

const findTarget = (step) => {
  for (const sel of [].concat(step.target)) {
    const el = document.querySelector(sel);
    if (el && el.getClientRects().length) return el;
  }
  return null;
};

/** Coach-mark tour: spotlights one element at a time with an annotated note. */
export default function Tour({ steps, onClose }) {
  const live = steps.filter((s) => findTarget(s));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [place, setPlace] = useState(null);
  const noteRef = useRef(null);
  const step = live[i];

  const measure = useCallback(() => {
    const el = step && findTarget(step);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, r: step.round ? 999 : 20 });
  }, [step]);

  useEffect(() => {
    const el = step && findTarget(step);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(measure, 320);
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, measure]);

  // Place the note below the target when it fits, otherwise above; keep it on screen.
  useLayoutEffect(() => {
    if (!rect || !noteRef.current) return;
    const n = noteRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.y + rect.h + GAP + n.height < vh - 8;
    const top = below ? rect.y + rect.h + GAP : Math.max(8, rect.y - GAP - n.height);
    const cx = rect.x + rect.w / 2;
    const left = Math.min(vw - n.width - 12, Math.max(12, cx - n.width / 2));
    setPlace({ top, left, below, arrow: Math.min(n.width - 28, Math.max(28, cx - left)) });
  }, [rect, i]);

  useEffect(() => {
    noteRef.current?.focus();
  }, [i]);

  const close = useCallback(() => onClose(), [onClose]);
  const next = useCallback(() => (i < live.length - 1 ? setI(i + 1) : close()), [i, live.length, close]);
  const back = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, next, back]);

  if (!step) return null;
  const last = i === live.length - 1;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Quick tour">
      <div className="tour-catch" onClick={next} />
      {rect ? (
        <div
          className="tour-spot"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: rect.r }}
        />
      ) : null}
      <div
        ref={noteRef}
        tabIndex={-1}
        className={`tour-note${place?.below === false ? ' is-above' : ''}`}
        style={place ? { top: place.top, left: place.left, '--arrow': `${place.arrow}px` } : { visibility: 'hidden' }}
        key={i}
      >
        <div className="tour-head">
          <span className="tour-count">
            {i + 1} of {live.length}
          </span>
          <button type="button" className="tour-skip" onClick={close}>
            {last ? 'Close' : 'Skip tour'}
            <X size={16} aria-hidden />
          </button>
        </div>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          {i > 0 ? (
            <button type="button" className="btn btn-quiet tour-back" onClick={back} aria-label="Previous tip">
              <ArrowLeft size={18} aria-hidden />
            </button>
          ) : null}
          <button type="button" className="btn btn-win" onClick={next}>
            {last ? 'Let’s go' : 'Next'}
            {last ? null : <ArrowRight size={18} aria-hidden />}
          </button>
        </div>
        <div className="tour-dots" aria-hidden>
          {live.map((_, d) => (
            <span key={d} className={d === i ? 'is-on' : ''} />
          ))}
        </div>
      </div>
    </div>
  );
}
