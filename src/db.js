import { createStore, get, set, del, values, clear } from 'idb-keyval';

const store = createStore('raffle-feeder', 'tickets');

export const loadTickets = () => values(store);
export const saveTicket = (t) => set(t.id, t, store);
export const removeTicket = (id) => del(id, store);
export const getTicket = (id) => get(id, store);
export const clearTickets = () => clear(store);

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* best effort */
  }
}

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

const dataURLToBlob = async (url) => (await fetch(url)).blob();

export async function exportBackup(tickets) {
  const out = [];
  for (const t of tickets) {
    out.push({
      ...t,
      image: t.image ? await blobToDataURL(t.image) : null,
      thumb: t.thumb ? await blobToDataURL(t.thumb) : null,
    });
  }
  return new Blob([JSON.stringify({ app: 'raffle-feeder', version: 1, tickets: out })], {
    type: 'application/json',
  });
}

export async function parseBackup(file) {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'raffle-feeder' || !Array.isArray(data.tickets)) {
    throw new Error('This file is not a Raffle Feeder backup.');
  }
  const tickets = [];
  for (const t of data.tickets) {
    tickets.push({
      ...t,
      image: t.image ? await dataURLToBlob(t.image) : null,
      thumb: t.thumb ? await dataURLToBlob(t.thumb) : null,
    });
  }
  return tickets;
}
