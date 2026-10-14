import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, Trash2, ScanLine, LoaderCircle, TriangleAlert, Crosshair } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { loadImage, renderRotated, canvasToBlob } from '../image.js';
import { readBox, guessWhole } from '../ocr.js';
import { normalize, readLocal, uid, writeLocal } from '../util.js';

const TAP_W = 0.3;
const TAP_H = 0.12;

/** Drag (or tap) a box over the number on the photo. */
function SpotPicker({ src, box, onBox, label }) {
  const ref = useRef(null);
  const [draft, setDraft] = useState(null);
  const start = useRef(null);

  const point = (e) => {
    const r = ref.current.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const onDown = (e) => {
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    start.current = point(e);
    setDraft({ ...start.current, w: 0, h: 0 });
  };
  const onMove = (e) => {
    if (!start.current) return;
    const p = point(e);
    const s = start.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = (e) => {
    if (!start.current) return;
    const s = start.current;
    start.current = null;
    let b = draft;
    if (!b || b.w < 0.04 || b.h < 0.02) {
      // A tap: centre a sensible box on the tap point.
      const p = point(e);
      b = {
        x: Math.min(1 - TAP_W, Math.max(0, p.x - TAP_W / 2)),
        y: Math.min(1 - TAP_H, Math.max(0, (p.y ?? s.y) - TAP_H / 2)),
        w: TAP_W,
        h: TAP_H,
      };
    }
    setDraft(null);
    onBox(b);
  };

  const shown = draft || box;
  return (
    <div
      className="spot"
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        start.current = null;
        setDraft(null);
      }}
      role="img"
      aria-label={label}
    >
      {src ? <img src={src} alt="" draggable={false} /> : <div className="spot-loading" />}
      {shown ? (
        <div
          className="spot-box"
          style={{
            left: `${shown.x * 100}%`,
            top: `${shown.y * 100}%`,
            width: `${shown.w * 100}%`,
            height: `${shown.h * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}

const STATUS = {
  loading: 'Opening photo…',
  reading: 'Reading the number…',
  read: 'Read from the marked spot. Check it.',
  guessed: 'Best guess. Check it, or drag a box over the number.',
  none: 'Couldn’t read it. Drag a box over the number, or type it.',
  manual: 'Typed by you.',
  error: 'This photo couldn’t be opened.',
};

export default function ReviewSheet({ files, existing, onClose, onSave }) {
  const [items, setItems] = useState(() =>
    files.map((file) => ({ id: uid(), file, rotation: 0, number: '', status: 'loading', box: null, src: null })),
  );
  const [spot, setSpot] = useState(() => readLocal('rf:spot', null));
  const [saving, setSaving] = useState(false);
  const media = useRef(new Map()); // id -> { img, canvas }
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = useCallback((id, p) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it))), []);

  const render = useCallback(
    async (id, rotation) => {
      const m = media.current.get(id);
      if (!m) return null;
      m.canvas = renderRotated(m.img, rotation, 1600);
      const blob = await canvasToBlob(m.canvas, 0.8);
      const src = URL.createObjectURL(blob);
      setItems((list) =>
        list.map((it) => {
          if (it.id !== id) return it;
          if (it.src) URL.revokeObjectURL(it.src);
          return { ...it, src, rotation };
        }),
      );
      return m.canvas;
    },
    [],
  );

  const recognise = useCallback(
    async (id, { box, auto }) => {
      const m = media.current.get(id);
      if (!m?.canvas) return;
      patch(id, { status: 'reading', box: box || null });
      try {
        const res = box ? await readBox(m.canvas, box) : await guessWhole(m.canvas);
        const cur = itemsRef.current.find((x) => x.id === id);
        if (!cur || (auto && cur.status === 'manual')) return;
        if (res?.number) patch(id, { number: res.number, status: box ? 'read' : 'guessed' });
        else patch(id, { status: 'none' });
      } catch (err) {
        console.error(err);
        patch(id, { status: 'none' });
      }
    },
    [patch],
  );

  // Decode every photo, then read numbers (with the saved spot when there is one).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const it of itemsRef.current) {
        if (cancelled) return;
        try {
          const url = URL.createObjectURL(it.file);
          const img = await loadImage(url);
          URL.revokeObjectURL(url);
          media.current.set(it.id, { img, canvas: null });
          const rotation = spot?.rotation ?? 0;
          await render(it.id, rotation);
          patch(it.id, { status: 'reading' });
        } catch {
          patch(it.id, { status: 'error' });
        }
      }
      for (const it of itemsRef.current) {
        if (cancelled) return;
        if (!media.current.get(it.id)?.canvas) continue;
        await recognise(it.id, { box: spot?.box || null, auto: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      for (const it of itemsRef.current) if (it.src) URL.revokeObjectURL(it.src);
    },
    [],
  );

  const onBox = async (id, box) => {
    const it = itemsRef.current.find((x) => x.id === id);
    const next = { rotation: it.rotation, box };
    setSpot(next);
    writeLocal('rf:spot', next);
    patch(id, { status: 'reading', own: true });
    await recognise(id, { box });
    // Re-use this spot for the rest of the batch that the user hasn't settled yet.
    for (const other of itemsRef.current) {
      if (other.id === id || other.status === 'manual' || other.status === 'error') continue;
      if (other.own) continue;
      if (other.rotation !== next.rotation) await render(other.id, next.rotation);
      await recognise(other.id, { box, auto: true });
    }
  };

  const rotate = async (id) => {
    const it = itemsRef.current.find((x) => x.id === id);
    const r = (it.rotation + 90) % 360;
    await render(id, r);
    if (spot && spot.rotation === r) recognise(id, { box: spot.box, auto: true });
    else patch(id, { box: null, own: false, status: it.status === 'manual' ? 'manual' : 'none' });
  };

  const remove = (id) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (it?.src) URL.revokeObjectURL(it.src);
    media.current.delete(id);
    setItems((l) => l.filter((x) => x.id !== id));
  };

  const forgetSpot = () => {
    setSpot(null);
    writeLocal('rf:spot', null);
  };

  const existingSet = new Set(existing.map(normalize));
  const counts = new Map();
  for (const it of items) {
    const k = normalize(it.number);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const usable = items.filter((it) => it.status !== 'error');
  const ready = usable.length > 0 && usable.every((it) => normalize(it.number));
  const busy = items.some((it) => it.status === 'loading' || it.status === 'reading');

  const save = async () => {
    setSaving(true);
    try {
      const out = [];
      for (const it of usable) {
        const m = media.current.get(it.id);
        const image = await canvasToBlob(m.canvas, 0.82);
        const thumb = await canvasToBlob(renderRotated(m.img, it.rotation, 520), 0.8);
        out.push({
          id: uid(),
          number: normalize(it.number),
          image,
          thumb,
          createdAt: Date.now(),
          called: false,
          calledAt: null,
          prize: '',
        });
      }
      await onSave(out);
    } finally {
      setSaving(false);
    }
  };

  const missing = usable.filter((it) => !normalize(it.number)).length;

  return (
    <Sheet
      title={items.length === 1 ? 'Confirm your ticket' : `Confirm ${items.length} tickets`}
      onClose={onClose}
      wide
      footer={
        <>
          <p className="foot-note">
            {busy ? 'Reading numbers…' : missing ? `${missing} still need a number` : 'All numbers set'}
          </p>
          <button type="button" className="btn btn-primary btn-lg" disabled={!ready || saving} onClick={save}>
            {saving ? (
              <LoaderCircle size={20} className="spin" aria-hidden />
            ) : null}
            Add {usable.length === 1 ? 'ticket' : `${usable.length} tickets`}
          </button>
        </>
      }
    >
      <div className={`spot-banner${spot ? ' is-set' : ''}`}>
        <Crosshair size={20} aria-hidden />
        {spot ? (
          <p>
            Number spot saved. It’s applied to every photo, so tickets shot the same way read themselves.{' '}
            <button type="button" className="link" onClick={forgetSpot}>
              Forget spot
            </button>
          </p>
        ) : (
          <p>
            Handwritten numbers read best when you <strong>drag a box over the number</strong> on one photo. The
            same spot is then used for the rest.
          </p>
        )}
      </div>

      <ol className="review-list">
        {items.map((it, i) => {
          const k = normalize(it.number);
          const dupe = k && (existingSet.has(k) || counts.get(k) > 1);
          return (
            <li key={it.id} className={`review-item status-${it.status}`}>
              <div className="review-photo">
                <SpotPicker
                  src={it.src}
                  box={it.box}
                  onBox={(b) => onBox(it.id, b)}
                  label={`Photo ${i + 1}. Drag over the ticket number to read it.`}
                />
                <div className="review-photo-tools">
                  <button type="button" className="icon-btn on-photo" onClick={() => rotate(it.id)} aria-label="Rotate photo">
                    <RotateCw size={20} />
                  </button>
                  <button type="button" className="icon-btn on-photo" onClick={() => remove(it.id)} aria-label="Remove photo">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              <div className="review-fields">
                <label htmlFor={`n-${it.id}`}>Ticket number</label>
                <div className="number-field">
                  <input
                    id={`n-${it.id}`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    maxLength={6}
                    value={it.number}
                    placeholder="—"
                    disabled={it.status === 'error'}
                    onChange={(e) =>
                      patch(it.id, { number: e.target.value.replace(/\D/g, ''), status: 'manual' })
                    }
                  />
                  {it.status === 'reading' || it.status === 'loading' ? (
                    <LoaderCircle size={22} className="spin field-icon" aria-hidden />
                  ) : (
                    <ScanLine size={22} className="field-icon" aria-hidden />
                  )}
                </div>
                <p className="review-status" aria-live="polite">
                  {STATUS[it.status]}
                </p>
                {dupe ? (
                  <p className="review-warn">
                    <TriangleAlert size={16} aria-hidden />
                    {existingSet.has(k) ? `${k} is already in your wallet.` : `${k} appears twice in this batch.`}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
