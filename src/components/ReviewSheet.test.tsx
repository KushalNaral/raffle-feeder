import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewSheet from './ReviewSheet';
import { guessWhole, readBox } from '../ocr';
import type { Ticket } from '../types';

// jsdom can't decode images or draw on canvas, and OCR needs the real engine: stub both layers.
vi.mock('../image', () => ({
  loadImage: vi.fn(async () => ({}) as HTMLImageElement),
  renderRotated: vi.fn(() => document.createElement('canvas')),
  canvasToBlob: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
}));
vi.mock('../ocr', () => ({
  guessWhole: vi.fn(),
  readBox: vi.fn(),
}));

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

function setup(count: number, existing: string[] = []) {
  const onSave = vi.fn<(t: Ticket[]) => Promise<void>>(async () => {});
  const onClose = vi.fn();
  const files = Array.from({ length: count }, (_, i) => photo(`p${i}.jpg`));
  render(<ReviewSheet files={files} existing={existing} onClose={onClose} onSave={onSave} />);
  return { onSave, onClose };
}

const numberInputs = () => screen.getAllByLabelText('Ticket number') as HTMLInputElement[];
const addButton = () => screen.getByRole('button', { name: /^Add/ });

describe('ReviewSheet', () => {
  beforeEach(() => {
    vi.mocked(guessWhole).mockReset();
    vi.mocked(readBox).mockReset();
  });

  it('fills in numbers the OCR reads and saves them', async () => {
    vi.mocked(guessWhole).mockResolvedValueOnce({ number: '361', confidence: 90 }).mockResolvedValueOnce({ number: '042', confidence: 90 });
    const { onSave } = setup(2);

    await waitFor(() => expect(numberInputs().map((i) => i.value)).toEqual(['361', '042']));
    expect(screen.getByText('All numbers set')).toBeInTheDocument();

    fireEvent.click(addButton());
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0]?.[0] ?? [];
    expect(saved.map((t) => t.number)).toEqual(['361', '42']);
    expect(saved.every((t) => t.called === false && t.image instanceof Blob)).toBe(true);
  });

  it('keeps Add disabled until every photo has a number', async () => {
    vi.mocked(guessWhole).mockResolvedValue(null);
    setup(2);
    await waitFor(() => expect(screen.getByText('2 still need a number')).toBeInTheDocument());
    expect(addButton()).toBeDisabled();

    const [a, b] = numberInputs();
    fireEvent.change(a!, { target: { value: '12' } });
    expect(addButton()).toBeDisabled();
    fireEvent.change(b!, { target: { value: '13' } });
    expect(addButton()).toBeEnabled();
  });

  it('Enter jumps to the next empty number, then adds the batch', async () => {
    vi.mocked(guessWhole).mockResolvedValue(null);
    const { onSave } = setup(3);
    await waitFor(() => expect(screen.getByText('3 still need a number')).toBeInTheDocument());
    const [a, b, c] = numberInputs();

    fireEvent.change(a!, { target: { value: '1' } });
    expect(a).toHaveAttribute('enterkeyhint', 'next');
    fireEvent.keyDown(a!, { key: 'Enter' });
    expect(b).toHaveFocus();

    fireEvent.change(b!, { target: { value: '2' } });
    fireEvent.keyDown(b!, { key: 'Enter' });
    expect(c).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(c!, { target: { value: '3' } });
    expect(c).toHaveAttribute('enterkeyhint', 'done');
    fireEvent.keyDown(c!, { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });

  it('typing overrides a later OCR result', async () => {
    let finish: (v: { number: string; confidence: number }) => void = () => {};
    vi.mocked(guessWhole).mockImplementation(() => new Promise((r) => (finish = r)));
    setup(1);
    await waitFor(() => expect(guessWhole).toHaveBeenCalled());

    fireEvent.change(numberInputs()[0]!, { target: { value: '77' } });
    await act(async () => finish({ number: '11', confidence: 90 }));
    expect(numberInputs()[0]).toHaveValue('77');
  });

  it('warns about numbers already saved or repeated in the batch', async () => {
    vi.mocked(guessWhole).mockResolvedValue({ number: '5', confidence: 90 });
    setup(2, ['361']);
    await waitFor(() => expect(screen.getAllByText('5 appears twice in this batch.')).toHaveLength(2));

    fireEvent.change(numberInputs()[0]!, { target: { value: '361' } });
    expect(screen.getByText('361 is already in your tickets.')).toBeInTheDocument();
  });

  it('removes a photo from the batch', async () => {
    vi.mocked(guessWhole).mockResolvedValue({ number: '5', confidence: 90 });
    setup(2);
    await waitFor(() => expect(numberInputs()).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove photo' })[0]!);
    expect(numberInputs()).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Confirm your ticket' })).toBeInTheDocument();
  });

  it('uses a remembered number spot to read the whole batch', async () => {
    localStorage.setItem('rf:spot', JSON.stringify({ rotation: 0, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.1 } }));
    vi.mocked(readBox).mockResolvedValue({ number: '808', confidence: 80 });
    setup(2);
    await waitFor(() => expect(numberInputs().map((i) => i.value)).toEqual(['808', '808']));
    expect(guessWhole).not.toHaveBeenCalled();
    expect(screen.getByText(/Number spot saved/)).toBeInTheDocument();
  });
});
