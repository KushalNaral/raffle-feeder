import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { RotateCw, Trash2, ScanLine, LoaderCircle, TriangleAlert } from 'lucide-react';
import Sheet from './Sheet';
import { loadImage, renderRotated, canvasToBlob } from '../image';
import { locateTicket, readNumber } from '../ocr';
import { fromTicket, loadSpot, saveSpot, toTicket } from '../spot';
import { normalize, uid } from '../util';
import type { Box, Rotation, Ticket } from '../types';

type Status = 'loading' | 'reading' | 'read' | 'spot' | 'none' | 'manual' | 'error';

interface Item {
  id: string;
  file: File;
  rotation: Rotation;
  number: string;
  status: Status;
  /** Where the number was found on the photo. */
  box: Box | null;
  src: string | null;
  /** The spot the user dragged on this photo, while it's being read. */
  marked?: Box | null;
}

// Room around the found number so the outline frames the digits instead of covering them.
const padX = (b: Box) => Math.max(b.h * 0.5, 0.012);
const padY = (b: Box) => Math.max(b.h * 0.6, 0.012);

/** A drag smaller than this is a tap. */
const MIN_DRAG = 0.02;

interface PhotoProps {
  src: string | null;
  /** Where the number was found: outlined with room around it. */
  box: Box | null;
  /** A spot the user marked: outlined exactly as drawn. */
  marked: Box | null;
  label: string;
  /** A tap at a point, in photo fractions. */
  onTap: (x: number, y: number) => void;
  onMark: (box: Box) => void;
}

/** The photo, with the number outlined. Drag over it to mark where the number is. */
function Photo({ src, box, marked, label, onTap, onMark }: PhotoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);

  const point = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const spanTo = (e: PointerEvent): Box | null => {
    const s = start.current;
    if (!s) return null;
    const p = point(e);
    return { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) };
  };

  const onDown = (e: PointerEvent) => {
    if (!src) return;
    e.preventDefault();
    ref.current?.setPointerCapture?.(e.pointerId);
    start.current = point(e);
  };
  const onMove = (e: PointerEvent) => {
    if (start.current) setDraft(spanTo(e));
  };
  const onUp = (e: PointerEvent) => {
    const span = spanTo(e);
    start.current = null;
    setDraft(null);
    if (!span) return;
    if (span.w < MIN_DRAG && span.h < MIN_DRAG) onTap(span.x, span.y);
    else onMark(span);
  };

  const exact = draft ?? marked;
  const outline = exact ?? (box && { x: box.x - padX(box), y: box.y - padY(box), w: box.w + 2 * padX(box), h: box.h + 2 * padY(box) });
  return (
    <div
      ref={ref}
      className={`spot${src ? ' spot-ready' : ''}`}
      role="img"
      aria-label={label}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        start.current = null;
        setDraft(null);
      }}
    >
      {src ? <img src={src} alt="" draggable={false} /> : <div className="spot-loading" />}
      {src && outline ? (
        <div
          className={`spot-box${exact ? ' spot-box-marked' : ''}`}
          style={{
            left: `${outline.x * 100}%`,
            top: `${outline.y * 100}%`,
            width: `${outline.w * 100}%`,
            height: `${outline.h * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}

/** Does the middle of `box` fall inside `area`? */
const centredIn = (box: Box, area: Box) => {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return cx >= area.x && cx <= area.x + area.w && cy >= area.y && cy <= area.y + area.h;
};

const STATUS: Record<Status, string> = {
  loading: 'Opening photo…',
  reading: 'Reading the number…',
  read: 'Found on the photo. Check it matches.',
  spot: 'Read from your spot. Check it matches.',
  none: 'Couldn’t find the number. Drag a box over it, or type it in.',
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
  const [saving, setSaving] = useState(false);
  /** Where numbers are written, relative to the ticket; looked at first on every photo. */
  const [spot, setSpot] = useState<Box | null>(loadSpot);
  const spotRef = useRef(spot);
  spotRef.current = spot;
  const media = useRef(
    new Map<string, { img: HTMLImageElement; canvas: HTMLCanvasElement | null; ticket?: Box | null }>(),
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /** The ticket's place on a photo as currently turned, found once per render. */
  const ticketOf = (id: string): Box | null => {
    const m = media.current.get(id);
    if (!m?.canvas) return null;
    if (m.ticket === undefined) m.ticket = locateTicket(m.canvas);
    return m.ticket;
  };

  const patch = useCallback((id: string, p: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it))), []);

  const render = useCallback(
    async (id: string, rotation: Rotation) => {
      const m = media.current.get(id);
      if (!m) return null;
      m.canvas = renderRotated(m.img, rotation, 1600);
      m.ticket = undefined;
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

  /**
   * Read the number: in `marked` only, when the user just marked it; otherwise in the
   * saved spot first, then anywhere. Turns the photo upright if it had to read it sideways.
   */
  const recognise = useCallback(
    async (id: string, marked?: Box) => {
      const m = media.current.get(id);
      const it = itemsRef.current.find((x) => x.id === id);
      if (!m?.canvas || !it) return;
      patch(id, { status: 'reading', box: null, marked: marked ?? null });
      try {
        const saved = spotRef.current;
        const area = marked ?? (saved ? fromTicket(saved, ticketOf(id)) : undefined);
        const res = await readNumber(m.canvas, { area, onlyArea: !!marked });
        const cur = itemsRef.current.find((x) => x.id === id);
        if (!cur || cur.status === 'manual') return;
        if (!res) return patch(id, { status: 'none', marked: null });
        if (res.rotation) await render(id, ((it.rotation + res.rotation) % 360) as Rotation);
        const now = itemsRef.current.find((x) => x.id === id);
        if (!now || now.status === 'manual') return;
        const fromSpot = !!area && !res.rotation && centredIn(res.box, area);
        patch(id, { number: res.number, status: fromSpot || marked ? 'spot' : 'read', box: res.box, marked: null });
      } catch (err) {
        console.error(err);
        patch(id, { status: 'none', marked: null });
      }
    },
    // ticketOf only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patch, render],
  );

  /** The user marked where the number is: read it there, and remember the spot. */
  const mark = (id: string, box: Box) => {
    const next = toTicket(box, ticketOf(id));
    setSpot(next);
    spotRef.current = next;
    saveSpot(next);
    void (async () => {
      await recognise(id, box);
      // Photos that came up empty get another try in the new spot.
      for (const it of itemsRef.current)
        if (it.id !== id && it.status === 'none') await recognise(it.id);
    })();
  };

  /** A tap marks a number-sized box around that point. */
  const tap = (id: string, x: number, y: number) => {
    const t = ticketOf(id) ?? { x: 0, y: 0, w: 1, h: 1 };
    const w = t.w * 0.4;
    const h = t.h * 0.16;
    mark(id, {
      x: Math.min(1 - w, Math.max(0, x - w / 2)),
      y: Math.min(1 - h, Math.max(0, y - h / 2)),
      w,
      h,
    });
  };

  const forgetSpot = () => {
    setSpot(null);
    spotRef.current = null;
    saveSpot(null);
  };

  // Decode every photo, then read each number.
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
          await render(it.id, 0);
          patch(it.id, { status: 'reading' });
        } catch {
          patch(it.id, { status: 'error' });
        }
      }
      for (const it of itemsRef.current) {
        if (cancelled) return;
        if (!media.current.get(it.id)?.canvas) continue;
        await recognise(it.id);
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

  const rotate = async (id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (!it) return;
    await render(id, ((it.rotation + 90) % 360) as Rotation);
    if (it.status === 'manual') patch(id, { box: null });
    else await recognise(id);
  };

  const remove = (id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (it?.src) URL.revokeObjectURL(it.src);
    media.current.delete(id);
    setItems((l) => l.filter((x) => x.id !== id));
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
      <p className="review-hint">
        {spot ? (
          <>
            Looking in your saved spot first. Drag over a number to move it.{' '}
            <button type="button" className="link-btn" onClick={forgetSpot}>
              Forget spot
            </button>
          </>
        ) : (
          'Wrong number? Drag a box over it on the photo. That spot is checked first from then on.'
        )}
      </p>
      <ol className="review-list">
        {items.map((it, i) => {
          const k = normalize(it.number);
          const dupe = k && (existingSet.has(k) || (counts.get(k) ?? 0) > 1);
          return (
            <li key={it.id} className={`review-item status-${it.status}`}>
              <div className="review-photo">
                <Photo
                  src={it.src}
                  box={it.box}
                  marked={it.marked ?? null}
                  label={`Photo ${i + 1}`}
                  onTap={(x, y) => tap(it.id, x, y)}
                  onMark={(b) => mark(it.id, b)}
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
                      patch(it.id, { number: e.target.value.replace(/\D/g, ''), status: 'manual', box: null })
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
