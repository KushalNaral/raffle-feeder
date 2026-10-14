export interface Ticket {
  id: string;
  number: string;
  image: Blob | null;
  thumb: Blob | null;
  createdAt: number;
  called: boolean;
  calledAt: number | null;
  prize: string;
}

export type TicketPatch = Partial<Omit<Ticket, 'id'>>;

/** A box in normalized (0..1) image coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rotation = 0 | 90 | 180 | 270;

export interface CheckEntry {
  n: string;
  hit: boolean;
}
