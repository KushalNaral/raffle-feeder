import type { Ticket } from '../types';

let seq = 0;
export const makeTicket = (number: string, extra: Partial<Ticket> = {}): Ticket => ({
  id: `t-${number}-${++seq}`,
  number,
  image: null,
  thumb: null,
  createdAt: 1_700_000_000_000 + seq,
  called: false,
  calledAt: null,
  prize: '',
  ...extra,
});
