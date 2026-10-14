import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingsSheet from './SettingsSheet';

const setup = (count = 3) => {
  const props = { onClose: vi.fn(), onExport: vi.fn(), onImport: vi.fn(), onClearAll: vi.fn(), onClearChecks: vi.fn() };
  const { container } = render(<SettingsSheet count={count} {...props} />);
  return { ...props, container };
};

describe('SettingsSheet', () => {
  it('exports and clears checked numbers', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: /Export backup/ }));
    fireEvent.click(screen.getByRole('button', { name: /Clear checked numbers/ }));
    expect(p.onExport).toHaveBeenCalledOnce();
    expect(p.onClearChecks).toHaveBeenCalledOnce();
  });

  it('imports the chosen file', () => {
    const p = setup();
    const input = p.container.ownerDocument.querySelector<HTMLInputElement>('input[type=file]');
    if (!input) throw new Error('missing file input');
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(p.onImport).toHaveBeenCalledWith(file);
  });

  it('confirms before deleting everything', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: /Delete all tickets/ }));
    expect(p.onClearAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
    expect(p.onClearAll).toHaveBeenCalledOnce();
  });

  it('disables export and delete with no tickets', () => {
    setup(0);
    expect(screen.getByRole('button', { name: /Export backup/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete all tickets/ })).toBeDisabled();
  });
});
