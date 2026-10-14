import { Check, Trophy } from 'lucide-react';
import { fmtTime, toneFor } from '../util';
import type { Ticket } from '../types';

export function FoilStrip({ ticket }: { ticket: Ticket }) {
  if (ticket.prize)
    return (
      <span className="strip strip-won">
        <Trophy size={15} strokeWidth={2.6} aria-hidden />
        <span>Winner · {ticket.prize}</span>
      </span>
    );
  if (ticket.called)
    return (
      <span className="strip strip-called">
        <Check size={15} strokeWidth={3} aria-hidden />
        <span>Called{ticket.calledAt ? ` · ${fmtTime(ticket.calledAt)}` : ''}</span>
      </span>
    );
  return (
    <span className="strip strip-foil">
      <span>Draw pending</span>
    </span>
  );
}

interface TicketCardProps {
  ticket: Ticket;
  thumbUrl: string | null | undefined;
  onOpen: () => void;
}

export default function TicketCard({ ticket, thumbUrl, onOpen }: TicketCardProps) {
  const status = ticket.prize ? `won ${ticket.prize}` : ticket.called ? 'called' : 'waiting for the draw';
  return (
    <button
      type="button"
      className={`tcard tcard-grid tone-${toneFor(ticket.number)}`}
      onClick={onOpen}
      aria-label={`Ticket ${ticket.number}, ${status}`}
    >
      <span className="tcard-no">{ticket.number}</span>
      <span className="tcard-photo">{thumbUrl ? <img src={thumbUrl} alt="" loading="lazy" /> : null}</span>
      <FoilStrip ticket={ticket} />
    </button>
  );
}
