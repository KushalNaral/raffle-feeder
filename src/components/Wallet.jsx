import { useMemo, useState } from 'react';
import { Camera, Images, ArrowDownUp } from 'lucide-react';
import Pass from './Pass.jsx';
import { byNumber } from '../util.js';

const FILTERS = [
  ['all', 'All'],
  ['called', 'Called'],
  ['won', 'Won'],
];

export default function Wallet({ tickets, thumbs, onOpen, onCamera, onGallery }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('number');

  const counts = useMemo(
    () => ({
      all: tickets.length,
      called: tickets.filter((t) => t.called && !t.prize).length,
      won: tickets.filter((t) => t.prize).length,
    }),
    [tickets],
  );

  const list = useMemo(() => {
    const l = tickets.filter((t) =>
      filter === 'all' ? true : filter === 'won' ? !!t.prize : t.called && !t.prize,
    );
    return sort === 'number' ? l.sort(byNumber) : l.sort((a, b) => b.createdAt - a.createdAt);
  }, [tickets, filter, sort]);

  if (!tickets.length) {
    return (
      <section className="wallet wallet-empty" aria-labelledby="empty-title">
        <div className="ghost-pass" aria-hidden>
          <span />
        </div>
        <h2 id="empty-title">Your wallet is empty</h2>
        <p>
          Photograph your raffle tickets. You confirm each number once, then checking a called number takes a
          single tap.
        </p>
        <div className="empty-actions">
          <button type="button" className="btn btn-primary" onClick={onCamera}>
            <Camera size={20} aria-hidden /> Take a photo
          </button>
          <button type="button" className="btn btn-quiet" onClick={onGallery}>
            <Images size={20} aria-hidden /> Choose photos
          </button>
        </div>
        <p className="fineprint">Photos stay on this device. Nothing is uploaded.</p>
      </section>
    );
  }

  return (
    <section className="wallet" aria-label="Your tickets">
      <div className="wallet-tools">
        <div className="segmented" role="tablist" aria-label="Filter tickets">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? 'is-on' : ''}
              onClick={() => setFilter(id)}
            >
              {label} <span className="count">{counts[id]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setSort((s) => (s === 'number' ? 'recent' : 'number'))}
          aria-label={sort === 'number' ? 'Sorted by number. Sort by most recent' : 'Sorted by most recent. Sort by number'}
          title={sort === 'number' ? 'Sorted by number' : 'Sorted by most recent'}
        >
          <ArrowDownUp size={20} />
          <span className="sort-label">{sort === 'number' ? '1–9' : 'New'}</span>
        </button>
      </div>

      {list.length ? (
        <ol className="stack">
          {list.map((t) => (
            <li key={t.id}>
              <Pass ticket={t} thumbUrl={thumbs[t.id]} onOpen={() => onOpen(t.id)} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="filter-empty">
          {filter === 'won' ? 'No prizes recorded yet. Fingers crossed.' : 'None of your tickets have been called yet.'}
        </p>
      )}
    </section>
  );
}
