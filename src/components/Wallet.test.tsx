import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Wallet from './Wallet';
import { makeTicket } from '../test/fixtures';
import type { Ticket } from '../types';

const setup = (tickets: Ticket[]) => {
  const props = { onOpen: vi.fn(), onCamera: vi.fn(), onGallery: vi.fn() };
  render(<Wallet tickets={tickets} thumbs={{}} {...props} />);
  return props;
};
const cardNumbers = () =>
  within(screen.getByRole('list'))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label')?.match(/Ticket (\d+)/)?.[1]);

describe('Wallet', () => {
  it('offers camera and gallery when empty', () => {
    const { onCamera, onGallery } = setup([]);
    fireEvent.click(screen.getByRole('button', { name: /Take a photo/ }));
    fireEvent.click(screen.getByRole('button', { name: /Choose photos/ }));
    expect(onCamera).toHaveBeenCalledOnce();
    expect(onGallery).toHaveBeenCalledOnce();
  });

  it('filters by called and won, with counts', () => {
    setup([
      makeTicket('1'),
      makeTicket('2', { called: true, calledAt: 1 }),
      makeTicket('3', { called: true, calledAt: 1, prize: 'TV' }),
    ]);
    expect(screen.getByRole('tab', { name: 'All 3' })).toHaveAttribute('aria-selected', 'true');
    expect(cardNumbers()).toEqual(['1', '2', '3']);

    fireEvent.click(screen.getByRole('tab', { name: 'Called 1' }));
    expect(cardNumbers()).toEqual(['2']);

    fireEvent.click(screen.getByRole('tab', { name: 'Won 1' }));
    expect(cardNumbers()).toEqual(['3']);
  });

  it('explains an empty filter', () => {
    setup([makeTicket('1')]);
    fireEvent.click(screen.getByRole('tab', { name: /Won/ }));
    expect(screen.getByText(/No prizes recorded yet/)).toBeInTheDocument();
  });

  it('sorts by number or newest first', () => {
    setup([makeTicket('20', { createdAt: 1 }), makeTicket('3', { createdAt: 2 }), makeTicket('100', { createdAt: 3 })]);
    expect(cardNumbers()).toEqual(['3', '20', '100']);
    fireEvent.click(screen.getByRole('button', { name: /Sort by most recent/ }));
    expect(cardNumbers()).toEqual(['100', '3', '20']);
  });

  it('opens a ticket', () => {
    const t = makeTicket('361');
    const { onOpen } = setup([t]);
    fireEvent.click(screen.getByRole('button', { name: 'Ticket 361, waiting for the draw' }));
    expect(onOpen).toHaveBeenCalledWith(t.id);
  });
});
