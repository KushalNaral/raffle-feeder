import { Check, Trophy } from 'lucide-react';
import { fmtDate, fmtTime, toneFor } from '../util.js';

export function StateChip({ ticket }) {
  if (ticket.prize)
    return (
      <span className="chip chip-won">
        <Trophy size={14} strokeWidth={2.4} aria-hidden /> Won
      </span>
    );
  if (ticket.called)
    return (
      <span className="chip chip-called">
        <Check size={14} strokeWidth={2.8} aria-hidden /> Called
      </span>
    );
  return null;
}

export default function Pass({ ticket, thumbUrl, onOpen, lifted = false, as = 'button' }) {
  const Tag = as;
  const status = ticket.prize
    ? `Won ${ticket.prize}`
    : ticket.called
      ? `Called${ticket.calledAt ? ` at ${fmtTime(ticket.calledAt)}` : ''}`
      : 'Waiting for the draw';
  return (
    <div className={`pass-wrap${lifted ? ' is-lifted' : ''}`}>
      <Tag
        className={`pass tone-${toneFor(ticket.number)}${ticket.called || ticket.prize ? ' is-called' : ''}`}
        onClick={onOpen}
        {...(Tag === 'button' ? { type: 'button', 'aria-label': `Ticket ${ticket.number}. ${status}` } : {})}
      >
        <div className="pass-head">
          <span className="pass-no">{ticket.number}</span>
          <StateChip ticket={ticket} />
        </div>
        <div className="pass-body">
          <div className="pass-photo">{thumbUrl ? <img src={thumbUrl} alt="" loading="lazy" /> : null}</div>
          <dl className="pass-meta">
            <div>
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>{fmtDate(ticket.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </Tag>
    </div>
  );
}
