import { useMemo, useState } from 'react';
import { Camera, Images, ArrowDownUp } from 'lucide-react';
import TicketCard from './TicketCard';
import { byNumber } from '../util';
import type { Ticket } from '../types';

type Filter = 'all' | 'called' | 'won';

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['called', 'Called'],
  ['won', 'Won'],
];

interface WalletProps {
  tickets: Ticket[];
  thumbs: Record<string, string | null>;
  onOpen: (id: string) => void;
  onCamera: () => void;
  onGallery: () => void;
}

export default function Wallet({ tickets, thumbs, onOpen, onCamera, onGallery }: WalletProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'number' | 'recent'>('number');

  const counts = useMemo<Record<Filter, number>>(
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
        <div className="tcard tcard-grid tone-ghost empty-card" aria-hidden>
          <span className="tcard-no">???</span>
          <span className="tcard-photo" />
          <span className="strip strip-foil">
            <span>Your first ticket</span>
          </span>
        </div>
        <h2 id="empty-title">No tickets yet</h2>
        <p>
          Snap your raffle tickets. Confirm each number once, and at the draw you’ll know in one tap if it’s
          yours.
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
        <div className="chips" role="tablist" aria-label="Filter tickets">
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
          data-tip={sort === 'number' ? 'Sorted by number' : 'Newest first'}
        >
          <ArrowDownUp size={20} />
          <span className="sort-label">{sort === 'number' ? '1–9' : 'New'}</span>
        </button>
      </div>

      {list.length ? (
        <ol className="deck">
          {list.map((t, i) => (
            <li key={t.id} style={{ '--i': i }}>
              <TicketCard ticket={t} thumbUrl={thumbs[t.id]} onOpen={() => onOpen(t.id)} />
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
