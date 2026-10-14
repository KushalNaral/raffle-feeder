import { beforeEach, describe, expect, it } from 'vitest';
import { clearTickets, exportBackup, getTicket, loadTickets, parseBackup, removeTicket, saveTicket } from './db';
import { makeTicket } from './test/fixtures';

describe('ticket store', () => {
  beforeEach(() => clearTickets());

  it('saves, loads, updates and removes tickets', async () => {
    const a = makeTicket('361');
    const b = makeTicket('42');
    await saveTicket(a);
    await saveTicket(b);
    expect((await loadTickets()).map((t) => t.number).sort()).toEqual(['361', '42']);

    await saveTicket({ ...a, called: true });
    expect((await getTicket(a.id))?.called).toBe(true);

    await removeTicket(b.id);
    expect(await loadTickets()).toHaveLength(1);

    await clearTickets();
    expect(await loadTickets()).toEqual([]);
  });
});

describe('backup', () => {
  it('round-trips tickets and their photos', async () => {
    const photo = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
    const t = makeTicket('361', { image: photo, thumb: null, called: true, calledAt: 5, prize: 'Rice cooker' });

    const file = await exportBackup([t]);
    const [back] = await parseBackup(file);

    expect(back).toMatchObject({ id: t.id, number: '361', called: true, calledAt: 5, prize: 'Rice cooker', thumb: null });
    expect(await back?.image?.text()).toBe('jpeg-bytes');
  });

  it('rejects files that are not backups', async () => {
    await expect(parseBackup(new Blob(['{"app":"other","tickets":[]}']))).rejects.toThrow(/not a Raffle Feeder backup/);
    await expect(parseBackup(new Blob(['not json']))).rejects.toThrow(/not a Raffle Feeder backup/);
  });
});
