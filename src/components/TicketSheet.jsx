import { useEffect, useState } from 'react';
import { Trash2, Maximize2, X } from 'lucide-react';
import Sheet from './Sheet.jsx';
import { StateChip } from './Pass.jsx';
import { fmtDate, fmtTime, normalize, toneFor } from '../util.js';

export default function TicketSheet({ ticket, onClose, onUpdate, onDelete }) {
  const [url, setUrl] = useState(null);
  const [number, setNumber] = useState(ticket.number);
  const [prize, setPrize] = useState(ticket.prize || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    if (!ticket.image) return;
    const u = URL.createObjectURL(ticket.image);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [ticket.image]);

  const commitNumber = () => {
    const n = normalize(number);
    if (n && n !== ticket.number) onUpdate(ticket.id, { number: n });
    else setNumber(ticket.number);
  };
  const commitPrize = () => {
    const p = prize.trim();
    if (p === (ticket.prize || '')) return;
    onUpdate(ticket.id, p ? { prize: p, called: true, calledAt: ticket.calledAt || Date.now() } : { prize: '' });
  };

  return (
    <Sheet title={`Ticket ${ticket.number}`} onClose={onClose}>
      <div className={`ticket-hero tone-${toneFor(ticket.number)}`}>
        <span className="pass-no">{ticket.number}</span>
        <StateChip ticket={ticket} />
      </div>

      <button type="button" className="ticket-photo" onClick={() => setZoom(true)} aria-label="View photo full screen">
        {url ? <img src={url} alt={`Photo of ticket ${ticket.number}`} /> : null}
        <span className="zoom-hint">
          <Maximize2 size={16} aria-hidden /> Full screen
        </span>
      </button>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="t-number">Ticket number</label>
          <input
            id="t-number"
            className="input-number"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
            onBlur={commitNumber}
          />
        </div>

        <label className="switch-row">
          <span>
            <strong>Called in the draw</strong>
            <small>{ticket.called && ticket.calledAt ? `Marked at ${fmtTime(ticket.calledAt)}, ${fmtDate(ticket.calledAt)}` : 'Not called yet'}</small>
          </span>
          <input
            type="checkbox"
            className="switch"
            checked={!!ticket.called}
            onChange={(e) => {
              if (e.target.checked) onUpdate(ticket.id, { called: true, calledAt: Date.now() });
              else {
                onUpdate(ticket.id, { called: false, calledAt: null, prize: '' });
                setPrize('');
              }
            }}
          />
        </label>

        <div className="field">
          <label htmlFor="t-prize">Prize won</label>
          <input
            id="t-prize"
            value={prize}
            maxLength={60}
            placeholder="Leave empty if no prize"
            onChange={(e) => setPrize(e.target.value)}
            onBlur={commitPrize}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </div>
      </div>

      <div className="danger-zone">
        {confirmDelete ? (
          <>
            <p>Delete ticket {ticket.number} and its photo?</p>
            <div className="row">
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button type="button" className="btn btn-danger" onClick={() => onDelete(ticket.id)}>
                <Trash2 size={18} aria-hidden /> Delete
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={18} aria-hidden /> Delete ticket
          </button>
        )}
      </div>

      {zoom && url ? (
        <div className="zoom" role="dialog" aria-label={`Photo of ticket ${ticket.number}`} onClick={() => setZoom(false)}>
          <img src={url} alt={`Photo of ticket ${ticket.number}`} />
          <button type="button" className="icon-btn on-photo zoom-close" aria-label="Close photo">
            <X size={22} />
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
