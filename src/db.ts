import { createStore, get, set, del, values, clear } from 'idb-keyval';
import type { Ticket } from './types';

const store = createStore('raffle-feeder', 'tickets');

export const loadTickets = (): Promise<Ticket[]> => values<Ticket>(store);
export const saveTicket = (t: Ticket): Promise<void> => set(t.id, t, store);
export const removeTicket = (id: string): Promise<void> => del(id, store);
export const getTicket = (id: string): Promise<Ticket | undefined> => get<Ticket>(id, store);
export const clearTickets = (): Promise<void> => clear(store);

export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* best effort */
  }
}

const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const dataURLToBlob = async (url: string): Promise<Blob> => (await fetch(url)).blob();

type SerializedTicket = Omit<Ticket, 'image' | 'thumb'> & { image: string | null; thumb: string | null };

interface Backup {
  app: 'raffle-feeder';
  version: 1;
  tickets: SerializedTicket[];
}

export async function exportBackup(tickets: Ticket[]): Promise<Blob> {
  const out: SerializedTicket[] = [];
  for (const t of tickets) {
    out.push({
      ...t,
      image: t.image ? await blobToDataURL(t.image) : null,
      thumb: t.thumb ? await blobToDataURL(t.thumb) : null,
    });
  }
  const backup: Backup = { app: 'raffle-feeder', version: 1, tickets: out };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

const isBackup = (data: unknown): data is Backup =>
  typeof data === 'object' &&
  data !== null &&
  (data as Backup).app === 'raffle-feeder' &&
  Array.isArray((data as Backup).tickets);

export async function parseBackup(file: Blob): Promise<Ticket[]> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    data = null;
  }
  if (!isBackup(data)) throw new Error('This file is not a Raffle Feeder backup.');
  const tickets: Ticket[] = [];
  for (const t of data.tickets) {
    tickets.push({
      ...t,
      image: t.image ? await dataURLToBlob(t.image) : null,
      thumb: t.thumb ? await dataURLToBlob(t.thumb) : null,
    });
  }
  return tickets;
}
