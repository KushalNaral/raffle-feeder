import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TicketSheet from './TicketSheet';
import { makeTicket } from '../test/fixtures';
import type { Ticket } from '../types';

const setup = (ticket: Ticket) => {
  const props = { onClose: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn() };
  render(<TicketSheet ticket={ticket} {...props} />);
  return props;
};

describe('TicketSheet', () => {
  it('saves a corrected number on blur, normalized', () => {
    const t = makeTicket('361');
    const { onUpdate } = setup(t);
    const input = screen.getByLabelText('Ticket number');
    fireEvent.change(input, { target: { value: '0381' } });
    fireEvent.blur(input);
    expect(onUpdate).toHaveBeenCalledWith(t.id, { number: '381' });
  });

  it('restores the number when cleared', () => {
    const { onUpdate } = setup(makeTicket('361'));
    const input = screen.getByLabelText('Ticket number');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(input).toHaveValue('361');
  });

  it('toggles called, clearing the prize when unmarked', () => {
    const t = makeTicket('361', { called: true, calledAt: 1, prize: 'TV' });
    const { onUpdate } = setup(t);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith(t.id, { called: false, calledAt: null, prize: '' });
  });

  it('recording a prize also marks the ticket called', () => {
    const t = makeTicket('361');
    const { onUpdate } = setup(t);
    const prize = screen.getByLabelText('Prize won');
    fireEvent.change(prize, { target: { value: ' Rice cooker ' } });
    fireEvent.blur(prize);
    expect(onUpdate).toHaveBeenCalledWith(t.id, expect.objectContaining({ prize: 'Rice cooker', called: true }));
  });

  it('asks before deleting', () => {
    const t = makeTicket('361');
    const { onDelete } = setup(t);
    fireEvent.click(screen.getByRole('button', { name: /Delete ticket/ }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    fireEvent.click(screen.getByRole('button', { name: /Delete ticket/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(t.id);
  });

  it('closes on Escape', () => {
    const { onClose } = setup(makeTicket('361'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
