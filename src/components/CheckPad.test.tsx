import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckPad from './CheckPad';
import { makeTicket } from '../test/fixtures';
import type { Ticket, TicketPatch } from '../types';

const SETTLE_MS = 1300;

function setup(tickets: Ticket[], active = true) {
  const onUpdate = vi.fn<(id: string, patch: TicketPatch) => void>();
  const onOpen = vi.fn<(id: string) => void>();
  const utils = render(<CheckPad tickets={tickets} thumbs={{}} onUpdate={onUpdate} onOpen={onOpen} active={active} />);
  return { ...utils, onUpdate, onOpen };
}

const type = (digits: string) => {
  for (const d of digits) fireEvent.click(screen.getByRole('button', { name: d }));
};
const settle = () => act(() => vi.advanceTimersByTime(SETTLE_MS));
const entry = () => screen.getByText((_, el) => el?.tagName === 'OUTPUT');

describe('CheckPad', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says “It’s yours!” for a ticket you hold', () => {
    setup([makeTicket('361')]);
    type('361');
    expect(screen.getByText(/It’s yours!/)).toBeInTheDocument();
  });

  it('says “Not this time” for a number you don’t hold', () => {
    setup([makeTicket('361')]);
    type('55');
    expect(screen.getByText('Not this time')).toBeInTheDocument();
  });

  it('matches regardless of leading zeros', () => {
    setup([makeTicket('0361')]);
    type('361');
    expect(screen.getByText(/It’s yours!/)).toBeInTheDocument();
  });

  it('counts duplicates of the same number', () => {
    setup([makeTicket('7'), makeTicket('7')]);
    type('7');
    expect(screen.getByText(/You hold 2 of these/)).toBeInTheDocument();
  });

  it('shows how many tickets share a prefix while you type', () => {
    setup([makeTicket('361'), makeTicket('362'), makeTicket('42')]);
    type('36');
    expect(screen.getAllByText('2 of your tickets start with 36').length).toBeGreaterThan(0);
  });

  it('marks a match as called once the number settles, not before', () => {
    const t = makeTicket('361');
    const { onUpdate } = setup([t]);
    type('361');
    expect(onUpdate).not.toHaveBeenCalled();
    settle();
    expect(onUpdate).toHaveBeenCalledWith(t.id, expect.objectContaining({ called: true }));
    expect(screen.getByText(/Marked as called/)).toBeInTheDocument();
  });

  it('does not re-mark a ticket that is already called', () => {
    const { onUpdate } = setup([makeTicket('361', { called: true, calledAt: 1 })]);
    type('361');
    settle();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not mark a shorter number on the way to a longer one', () => {
    const short = makeTicket('36');
    const { onUpdate } = setup([short, makeTicket('361')]);
    type('361');
    settle();
    expect(onUpdate).not.toHaveBeenCalledWith(short.id, expect.anything());
  });

  it('starts a new number with the next digit once a result has settled', () => {
    setup([makeTicket('361')]);
    type('55');
    settle();
    expect(screen.getByText('Type the next number')).toBeInTheDocument();
    type('3');
    expect(entry()).toHaveTextContent(/^3$/);
  });

  it('keeps appending digits before the result settles', () => {
    setup([makeTicket('361')]);
    type('3');
    act(() => vi.advanceTimersByTime(500));
    type('6');
    expect(entry()).toHaveTextContent(/^36$/);
  });

  it('logs settled checks but not half-typed numbers', () => {
    setup([makeTicket('361')]);
    type('36');
    settle();
    expect(screen.queryByText('Checked so far')).not.toBeInTheDocument();

    type('1');
    settle();
    type('55');
    settle();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('button', { name: '361, yours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '55, not yours' })).toBeInTheDocument();
  });

  it('remembers checked numbers across reloads', () => {
    const { unmount } = setup([makeTicket('361')]);
    type('361');
    settle();
    unmount();
    setup([makeTicket('361')]);
    expect(screen.getByRole('button', { name: '361, yours' })).toBeInTheDocument();
  });

  it('re-checks a number from the log', () => {
    setup([makeTicket('361')]);
    type('361');
    settle();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: '361, yours' }));
    expect(entry()).toHaveTextContent(/^361$/);
    type('2');
    expect(entry()).toHaveTextContent(/^3612$/);
  });

  it('backspace and clear edit the entry', () => {
    setup([makeTicket('361')]);
    type('361');
    fireEvent.click(screen.getByRole('button', { name: 'Delete last digit' }));
    expect(entry()).toHaveTextContent(/^36$/);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(entry()).toHaveTextContent('000');
  });

  it('caps entries at six digits', () => {
    setup([]);
    type('12345678');
    expect(entry()).toHaveTextContent(/^123456$/);
  });

  it('accepts the physical keyboard when active', () => {
    setup([makeTicket('42')]);
    fireEvent.keyDown(window, { key: '4' });
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByText(/It’s yours!/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(entry()).toHaveTextContent(/^4$/);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(entry()).toHaveTextContent('000');
  });

  it('ignores the keyboard when inactive', () => {
    setup([makeTicket('42')], false);
    fireEvent.keyDown(window, { key: '4' });
    expect(entry()).toHaveTextContent('000');
  });

  it('undoes a called mark and records a prize', () => {
    const t = makeTicket('361', { called: true, calledAt: 1 });
    const { onUpdate } = setup([t]);
    type('361');

    fireEvent.click(screen.getByRole('button', { name: /Undo/ }));
    expect(onUpdate).toHaveBeenLastCalledWith(t.id, { called: false, calledAt: null, prize: '' });

    fireEvent.click(screen.getByRole('button', { name: /I won!/ }));
    fireEvent.change(screen.getByLabelText('What did you win?'), { target: { value: '  Rice cooker ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate).toHaveBeenLastCalledWith(t.id, expect.objectContaining({ called: true, prize: 'Rice cooker' }));
  });
});
