import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw, Trash2, ScanLine, LoaderCircle, TriangleAlert } from 'lucide-react';
import Sheet from './Sheet';
import { loadImage, renderRotated, canvasToBlob } from '../image';
import { readNumber } from '../ocr';
import { normalize, uid } from '../util';
import type { Box, Rotation, Ticket } from '../types';

type Status = 'loading' | 'reading' | 'read' | 'none' | 'manual' | 'error';

interface Item {
  id: string;
  file: File;
  rotation: Rotation;
  number: string;
  status: Status;
  /** Where the number was found on the photo. */
  box: Box | null;
  src: string | null;
}

// Room around the found number so the outline frames the digits instead of covering them.
const padX = (b: Box) => Math.max(b.h * 0.5, 0.012);
const padY = (b: Box) => Math.max(b.h * 0.6, 0.012);

/** The photo, with the spot the number was read from outlined. */
function Photo({ src, box, label }: { src: string | null; box: Box | null; label: string }) {
  return (
    <div className="spot" role="img" aria-label={label}>
      {src ? <img src={src} alt="" draggable={false} /> : <div className="spot-loading" />}
      {src && box ? (
        <div
          className="spot-box"
          style={{
            left: `${(box.x - padX(box)) * 100}%`,
            top: `${(box.y - padY(box)) * 100}%`,
            width: `${(box.w + 2 * padX(box)) * 100}%`,
            height: `${(box.h + 2 * padY(box)) * 100}%`,
          }}
        />
      ) : null}
    </div>
  );
}

const STATUS: Record<Status, string> = {
  loading: 'Opening photo…',
  reading: 'Reading the number…',
  read: 'Found on the photo. Check it matches.',
  none: 'Couldn’t find the number. Type it in.',
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

  /** Find the number by itself. Turns the photo upright if it had to read it sideways. */
  const recognise = useCallback(
    async (id: string) => {
      const m = media.current.get(id);
      const it = itemsRef.current.find((x) => x.id === id);
      if (!m?.canvas || !it) return;
      patch(id, { status: 'reading', box: null });
      try {
        const res = await readNumber(m.canvas);
        const cur = itemsRef.current.find((x) => x.id === id);
        if (!cur || cur.status === 'manual') return;
        if (!res) return patch(id, { status: 'none' });
        if (res.rotation) await render(id, ((it.rotation + res.rotation) % 360) as Rotation);
        const now = itemsRef.current.find((x) => x.id === id);
        if (!now || now.status === 'manual') return;
        patch(id, { number: res.number, status: 'read', box: res.box });
      } catch (err) {
        console.error(err);
        patch(id, { status: 'none' });
      }
    },
    [patch, render],
  );

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
      <ol className="review-list">
        {items.map((it, i) => {
          const k = normalize(it.number);
          const dupe = k && (existingSet.has(k) || (counts.get(k) ?? 0) > 1);
          return (
            <li key={it.id} className={`review-item status-${it.status}`}>
              <div className="review-photo">
                <Photo src={it.src} box={it.box} label={`Photo ${i + 1}`} />
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
