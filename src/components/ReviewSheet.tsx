import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { RotateCw, Trash2, ScanLine, LoaderCircle, TriangleAlert, Crosshair, Pointer } from 'lucide-react';
import Sheet from './Sheet';
import { loadImage, renderRotated, canvasToBlob } from '../image';
import { readBox, guessWhole } from '../ocr';
import { normalize, readLocal, uid, writeLocal } from '../util';
import type { Box, Rotation, Ticket } from '../types';

const TAP_W = 0.3;
const TAP_H = 0.12;

interface Point {
  x: number;
  y: number;
}

/** The marked number spot, remembered across batches. */
interface Spot {
  rotation: Rotation;
  box: Box;
}

type Status = 'loading' | 'reading' | 'read' | 'guessed' | 'none' | 'manual' | 'error';

interface Item {
  id: string;
  file: File;
  rotation: Rotation;
  number: string;
  status: Status;
  box: Box | null;
  src: string | null;
  /** The user marked a box on this photo themselves. */
  own?: boolean;
}

interface SpotPickerProps {
  src: string | null;
  box: Box | null;
  onBox: (box: Box) => void;
  label: string;
  hint: boolean;
}

/** Drag (or tap) a box over the number on the photo. */
function SpotPicker({ src, box, onBox, label, hint }: SpotPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const start = useRef<Point | null>(null);

  const point = (e: PointerEvent): Point => {
    const r = ref.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 1, 1);
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    const s = point(e);
    start.current = s;
    setDraft({ ...s, w: 0, h: 0 });
  };
  const onMove = (e: PointerEvent) => {
    if (!start.current) return;
    const p = point(e);
    const s = start.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = (e: PointerEvent) => {
    if (!start.current) return;
    start.current = null;
    let b = draft;
    if (!b || b.w < 0.04 || b.h < 0.02) {
      // A tap: centre a sensible box on the tap point.
      const p = point(e);
      b = {
        x: Math.min(1 - TAP_W, Math.max(0, p.x - TAP_W / 2)),
        y: Math.min(1 - TAP_H, Math.max(0, p.y - TAP_H / 2)),
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
      {hint && src && !shown ? (
        <div className="spot-hint" aria-hidden>
          <span className="spot-hint-box">
            <Pointer size={22} strokeWidth={2.4} className="spot-hint-hand" />
          </span>
          <span className="spot-hint-note">Drag a box over the ticket number</span>
        </div>
      ) : null}
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

const STATUS: Record<Status, string> = {
  loading: 'Opening photo…',
  reading: 'Reading the number…',
  read: 'Read from the marked spot. Check it.',
  guessed: 'Best guess. Check it, or drag a box over the number.',
  none: 'Couldn’t read it. Drag a box over the number, or type it.',
  manual: 'Typed by you.',
  error: 'This photo couldn’t be opened.',
};

interface ReviewSheetProps {
  files: File[];
  existing: string[];
  onClose: () => void;
  onSave: (tickets: Ticket[]) => Promise<void>;
}

export default function ReviewSheet({ files, existing, onClose, onSave }: ReviewSheetProps) {
  const [items, setItems] = useState<Item[]>(() =>
    files.map((file) => ({ id: uid(), file, rotation: 0, number: '', status: 'loading', box: null, src: null })),
  );
  const [spot, setSpot] = useState<Spot | null>(() => readLocal<Spot | null>('rf:spot', null));
  const [saving, setSaving] = useState(false);
  const [hinted, setHinted] = useState(() => readLocal('rf:hint-spot', false));
  const media = useRef(new Map<string, { img: HTMLImageElement; canvas: HTMLCanvasElement | null }>());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = useCallback((id: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it))), []);

  const render = useCallback(
    async (id: string, rotation: Rotation) => {
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
    async (id: string, { box, auto = false }: { box: Box | null; auto?: boolean }) => {
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

  const onBox = async (id: string, box: Box) => {
    if (!hinted) {
      setHinted(true);
      writeLocal('rf:hint-spot', true);
    }
    const it = itemsRef.current.find((x) => x.id === id);
    if (!it) return;
    const next: Spot = { rotation: it.rotation, box };
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

  const rotate = async (id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (!it) return;
    const r = ((it.rotation + 90) % 360) as Rotation;
    await render(id, r);
    if (spot && spot.rotation === r) recognise(id, { box: spot.box, auto: true });
    else patch(id, { box: null, own: false, status: it.status === 'manual' ? 'manual' : 'none' });
  };

  const remove = (id: string) => {
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
  const counts = new Map<string, number>();
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
      const out: Ticket[] = [];
      for (const it of usable) {
        const m = media.current.get(it.id);
        if (!m?.canvas) continue;
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

  // Enter moves to the next ticket still missing a number, or adds the batch when none are left.
  const onEnter = (id: string) => {
    const list = itemsRef.current.filter((it) => it.status !== 'error');
    const from = list.findIndex((it) => it.id === id);
    const order = [...list.slice(from + 1), ...list.slice(0, from)];
    const next = order.find((it) => !normalize(it.number));
    if (next) document.getElementById(`n-${next.id}`)?.focus();
    else if (ready && !saving) save();
  };

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
          const dupe = k && (existingSet.has(k) || (counts.get(k) ?? 0) > 1);
          return (
            <li key={it.id} className={`review-item status-${it.status}`}>
              <div className="review-photo">
                <SpotPicker
                  src={it.src}
                  box={it.box}
                  onBox={(b) => onBox(it.id, b)}
                  label={`Photo ${i + 1}. Drag over the ticket number to read it.`}
                  hint={!hinted && !spot && i === 0}
                />
                <div className="review-photo-tools">
                  <button type="button" className="icon-btn on-photo" onClick={() => rotate(it.id)} aria-label="Rotate photo" data-tip="Rotate">
                    <RotateCw size={20} />
                  </button>
                  <button type="button" className="icon-btn on-photo" onClick={() => remove(it.id)} aria-label="Remove photo" data-tip="Remove">
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
                    enterKeyHint={missing > (normalize(it.number) ? 0 : 1) ? 'next' : 'done'}
                    onChange={(e) =>
                      patch(it.id, { number: e.target.value.replace(/\D/g, ''), status: 'manual' })
                    }
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      onEnter(it.id);
                    }}
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
                    {existingSet.has(k) ? `${k} is already in your tickets.` : `${k} appears twice in this batch.`}
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
