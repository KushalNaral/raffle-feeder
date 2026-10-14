import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { clearTickets, exportBackup, loadTickets, saveTicket } from './db';
import { makeTicket } from './test/fixtures';

vi.mock('./ocr', () => ({ warmUp: vi.fn(), guessWhole: vi.fn(async () => null), readBox: vi.fn(async () => null) }));

const tabbar = () => screen.getByRole('navigation', { name: 'Sections' });

describe('App', () => {
  beforeEach(async () => {
    await clearTickets();
    localStorage.setItem('rf:toured', 'true');
  });

  it('starts on the empty wallet with no tickets', async () => {
    render(<App />);
    expect(await screen.findByText('No tickets yet', { selector: 'h2' })).toBeInTheDocument();
    expect(within(tabbar()).getByRole('button', { name: 'Tickets' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens on Check when tickets are saved, and auto-marks a match as called', async () => {
    const t = makeTicket('361');
    await saveTicket(t);
    render(<App />);

    expect(await screen.findByText('1 ticket · 0 called')).toBeInTheDocument();
    expect(within(tabbar()).getByRole('button', { name: 'Check' })).toHaveAttribute('aria-current', 'page');

    for (const d of '361') fireEvent.click(screen.getByRole('button', { name: d }));
    expect(screen.getByText(/It’s yours!/)).toBeInTheDocument();

    await screen.findByText('1 ticket · 1 called', {}, { timeout: 3000 });
    await waitFor(async () => expect((await loadTickets())[0]?.called).toBe(true));
  });

  it('the + button opens the photo picker directly', async () => {
    const { container } = render(<App />);
    await screen.findByText('No tickets yet', { selector: 'h2' });
    const gallery = container.querySelector<HTMLInputElement>('input[type=file][multiple]');
    if (!gallery) throw new Error('missing gallery input');
    const click = vi.spyOn(gallery, 'click');
    fireEvent.click(within(tabbar()).getByRole('button', { name: 'Add tickets' }));
    expect(click).toHaveBeenCalledOnce();
  });

  it('picking photos opens the confirm sheet', async () => {
    const { container } = render(<App />);
    await screen.findByText('No tickets yet', { selector: 'h2' });
    const gallery = container.querySelector<HTMLInputElement>('input[type=file][multiple]');
    if (!gallery) throw new Error('missing gallery input');

    // jsdom never decodes the photo; ReviewSheet.test covers reading and saving.
    fireEvent.change(gallery, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByRole('heading', { name: 'Confirm your ticket' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add ticket' })).toBeDisabled();
  });

  it('ignores non-image files', async () => {
    const { container } = render(<App />);
    await screen.findByText('No tickets yet', { selector: 'h2' });
    const gallery = container.querySelector<HTMLInputElement>('input[type=file][multiple]');
    if (!gallery) throw new Error('missing gallery input');
    fireEvent.change(gallery, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('deletes a ticket from its sheet', async () => {
    await saveTicket(makeTicket('361'));
    render(<App />);
    fireEvent.click(await within(tabbar()).findByRole('button', { name: 'Tickets' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ticket 361/ }));
    fireEvent.click(screen.getByRole('button', { name: /Delete ticket/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Ticket deleted')).toBeInTheDocument();
    expect(await loadTickets()).toEqual([]);
  });

  it('imports a backup, skipping tickets already held', async () => {
    const held = makeTicket('1');
    await saveTicket(held);
    const backup = await exportBackup([held, makeTicket('2')]);
    const { container } = render(<App />);
    await screen.findByText('1 ticket · 0 called');

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const input = container.ownerDocument.querySelector<HTMLInputElement>('input[accept*=json]');
    if (!input) throw new Error('missing import input');
    fireEvent.change(input, { target: { files: [new File([backup], 'b.json')] } });

    expect(await screen.findByText('Imported 1 tickets')).toBeInTheDocument();
    expect((await loadTickets()).map((t) => t.number).sort()).toEqual(['1', '2']);
  });

  it('shows the tour on a first visit only', async () => {
    localStorage.removeItem('rf:toured');
    // The tour skips targets with no layout box, and jsdom has no layout.
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
    const { unmount } = render(<App />);
    expect(await screen.findByRole('dialog', { name: 'Quick tour' }, { timeout: 2000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Skip tour/ }));
    expect(screen.queryByRole('dialog', { name: 'Quick tour' })).not.toBeInTheDocument();
    unmount();

    render(<App />);
    await screen.findByText('No tickets yet', { selector: 'h2' });
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByRole('dialog', { name: 'Quick tour' })).not.toBeInTheDocument();
  });
});
