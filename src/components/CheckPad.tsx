import { useEffect, useMemo, useRef, useState } from 'react';
import { Delete, Check, Trophy, Undo2, PartyPopper } from 'lucide-react';
import ScratchFoil from './ScratchFoil';
import { FoilStrip } from './TicketCard';
import { burst } from '../confetti';
import { normalize, readLocal, toneFor, writeLocal } from '../util';
import type { CheckEntry, Ticket, TicketPatch } from '../types';

type Key = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'clear' | 'back';

const KEYS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
const isDigit = (k: string): k is Key => /^\d$/.test(k);
const MAX = 6;

interface CheckPadProps {
  tickets: Ticket[];
  thumbs: Record<string, string | null>;
  onUpdate: (id: string, patch: TicketPatch) => void;
  onOpen: (id: string) => void;
  active: boolean;
}

export default function CheckPad({ tickets, thumbs, onUpdate, onOpen, active }: CheckPadProps) {
  const [entry, setEntry] = useState('');
  const [prizeFor, setPrizeFor] = useState<string | null>(null);
  const [prize, setPrize] = useState('');
  const [log, setLog] = useState<CheckEntry[]>(() => readLocal<CheckEntry[]>('rf:checks', []));
  const [settled, setSettled] = useState('');
  const settledRef = useRef('');
  settledRef.current = settled;
  const loggedRef = useRef('');
  const cardRef = useRef<HTMLDivElement>(null);

  const index = useMemo(() => {
    const m = new Map<string, Ticket[]>();
    for (const t of tickets) {
      const k = normalize(t.number);
      const list = m.get(k);
      if (list) list.push(t);
      else m.set(k, [t]);
    }
    return m;
  }, [tickets]);

  const key = normalize(entry);
  const matches = key ? index.get(key) || [] : [];
  const prefix = useMemo(
    () => (key && !matches.length ? [...index.keys()].filter((k) => k.startsWith(key)).length : 0),
    [index, key, matches.length],
  );
  const state = !key ? 'idle' : matches.length ? 'match' : prefix ? 'partial' : 'miss';
  const revealed = state === 'match' || state === 'miss';

  const press = (k: Key) => {
    setPrizeFor(null);
    const fresh = !!settledRef.current;
    settledRef.current = '';
    setSettled('');
    if (k === 'clear') return setEntry('');
    if (k === 'back') return setEntry((e) => e.slice(0, -1));
    // Once a result has settled, the next digit starts the next called number.
    setEntry((e) => (fresh ? k : e.length >= MAX ? e : e + k));
  };

  // Celebrate each new match once.
  const celebrated = useRef('');
  useEffect(() => {
    if (state === 'match' && celebrated.current !== key) {
      celebrated.current = key;
      const id = setTimeout(() => burst(cardRef.current), 240);
      return () => clearTimeout(id);
    }
    if (state !== 'match') celebrated.current = '';
  }, [state, key]);

  // Once the entry has settled for a moment: log it, and mark matching tickets as called.
  useEffect(() => {
    if (!key) return;
    const id = setTimeout(() => {
      const hits = index.get(key) || [];
      if (!hits.length && [...index.keys()].some((k) => k.startsWith(key))) return; // still mid-number
      setSettled(key);
      if (loggedRef.current === key) return;
      loggedRef.current = key;
      for (const t of hits) if (!t.called) onUpdate(t.id, { called: true, calledAt: Date.now() });
      setLog((l) => {
        const next = [{ n: key, hit: hits.length > 0 }, ...l.filter((x) => x.n !== key)].slice(0, 12);
        writeLocal('rf:checks', next);
        return next;
      });
    }, 1200);
    return () => clearTimeout(id);
  }, [key, index, onUpdate]);

  // Physical keyboard support when the pad is on screen.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('.sheet-layer')) return;
      if (isDigit(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape' || e.key === 'Delete') press('clear');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const markCalled = (t: Ticket) => onUpdate(t.id, { called: true, calledAt: t.calledAt || Date.now() });
  const undoCalled = (t: Ticket) => onUpdate(t.id, { called: false, calledAt: null, prize: '' });
  const savePrize = (t: Ticket) => {
    onUpdate(t.id, { called: true, calledAt: t.calledAt || Date.now(), prize: prize.trim() || 'Prize' });
    setPrizeFor(null);
    setPrize('');
  };

  const foilLabel = state === 'partial' ? 'Keep typing…' : 'Key in a number';
  const tone = state === 'match' ? toneFor(key) : 'ink';

  return (
    <section className={`check state-${state}`} aria-label="Check a called number">
      <div className={`check-card tone-${tone}`} ref={cardRef}>
        <h2 className="check-title">Called number</h2>
        <output className="check-entry" data-empty={!entry}>
          {entry || '000'}
        </output>
        <div className="reveal">
          <p className="reveal-text" role="status" aria-live="polite">
            {state === 'match' && (
              <>
                <PartyPopper size={26} strokeWidth={2.4} aria-hidden />
                <span>
                  It’s yours!
                  {matches.length > 1 ? <small> You hold {matches.length} of these.</small> : null}
                </span>
              </>
            )}
            {state === 'miss' && <span className="miss">Not this time</span>}
            {state === 'partial' && (
              <span className="sr-only">
                {prefix} of your tickets start with {key}
              </span>
            )}
          </p>
          <ScratchFoil revealed={revealed} label={foilLabel} />
        </div>
        {state === 'partial' ? (
          <p className="check-hint">
            {prefix} of your tickets start with {key}
          </p>
        ) : settled && settled === key ? (
          <p className="check-hint">{state === 'match' ? 'Marked as called. ' : ''}Type the next number</p>
        ) : null}
      </div>

      <div className="check-result">
        {state === 'match' &&
          matches.map((t) => (
            <div key={t.id} className="match">
              <button type="button" className="match-ticket" onClick={() => onOpen(t.id)} aria-label={`Open ticket ${t.number}`}>
                <span className="match-photo">{thumbs[t.id] ? <img src={thumbs[t.id] ?? undefined} alt="" /> : null}</span>
                <FoilStrip ticket={t} />
              </button>
              {prizeFor === t.id ? (
                <form
                  className="prize-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    savePrize(t);
                  }}
                >
                  <label htmlFor={`prize-${t.id}`}>What did you win?</label>
                  <div className="prize-row">
                    <input
                      id={`prize-${t.id}`}
                      autoFocus
                      value={prize}
                      onChange={(e) => setPrize(e.target.value)}
                      placeholder="e.g. Rice cooker"
                      maxLength={60}
                    />
                    <button className="btn btn-win" type="submit">
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <div className="match-actions">
                  {t.called ? (
                    <button type="button" className="btn btn-quiet" onClick={() => undoCalled(t)}>
                      <Undo2 size={18} aria-hidden /> Undo
                    </button>
                  ) : (
                    <button type="button" className="btn btn-mint" onClick={() => markCalled(t)}>
                      <Check size={18} strokeWidth={3} aria-hidden /> Mark called
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-win"
                    onClick={() => {
                      setPrizeFor(t.id);
                      setPrize(t.prize || '');
                    }}
                  >
                    <Trophy size={18} aria-hidden /> {t.prize ? 'Edit prize' : 'I won!'}
                  </button>
                </div>
              )}
            </div>
          ))}
        {state !== 'match' && log.length > 0 && (
          <div className="check-log">
            <h3>Checked so far</h3>
            <ul>
              {log.map((c) => (
                <li key={c.n}>
                  <button
                    type="button"
                    className={`log-chip${c.hit ? ' is-hit' : ''}`}
                    onClick={() => {
                      setSettled('');
                      setEntry(c.n);
                    }}
                    aria-label={`${c.n}, ${c.hit ? 'yours' : 'not yours'}`}
                  >
                    {c.n}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="keypad" role="group" aria-label="Number keypad">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className={`key${k.length > 1 ? ' key-fn' : ''}`}
            onClick={() => press(k)}
            aria-label={k === 'back' ? 'Delete last digit' : k === 'clear' ? 'Clear' : k}
          >
            {k === 'back' ? <Delete size={26} aria-hidden /> : k === 'clear' ? 'Clear' : k}
          </button>
        ))}
      </div>
    </section>
  );
}
