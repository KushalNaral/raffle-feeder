import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReviewSheet from './ReviewSheet';
import { readNumber } from '../ocr';
import { renderRotated } from '../image';
import type { NumberRead } from '../readNumber';
import type { Ticket } from '../types';

// jsdom can't decode images or draw on canvas, and OCR needs the real engine: stub both layers.
vi.mock('../image', () => ({
  loadImage: vi.fn(async () => ({}) as HTMLImageElement),
  renderRotated: vi.fn(() => document.createElement('canvas')),
  canvasToBlob: vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' })),
}));
vi.mock('../ocr', () => ({ readNumber: vi.fn() }));

const found = (number: string, extra: Partial<NumberRead> = {}): NumberRead => ({
  number,
  confidence: 90,
  box: { x: 0.4, y: 0.6, w: 0.1, h: 0.05 },
  rotation: 0,
  ...extra,
});
const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

function setup(count: number, existing: string[] = []) {
  const onSave = vi.fn<(t: Ticket[]) => Promise<void>>(async () => {});
  const files = Array.from({ length: count }, (_, i) => photo(`p${i}.jpg`));
  render(<ReviewSheet files={files} existing={existing} onClose={vi.fn()} onSave={onSave} />);
  return { onSave };
}

const numberInputs = () => screen.getAllByLabelText('Ticket number') as HTMLInputElement[];
const field = (i: number) => {
  const el = numberInputs()[i];
  if (!el) throw new Error(`no number field ${i}`);
  return el;
};
const addButton = () => screen.getByRole('button', { name: /^Add/ });

describe('ReviewSheet', () => {
  beforeEach(() => {
    vi.mocked(readNumber).mockReset();
    vi.mocked(renderRotated).mockClear();
  });

  it('finds each number by itself and saves them', async () => {
    vi.mocked(readNumber).mockResolvedValueOnce(found('361')).mockResolvedValueOnce(found('042'));
    const { onSave } = setup(2);

    await waitFor(() => expect(numberInputs().map((i) => i.value)).toEqual(['361', '042']));
    expect(screen.getAllByText('Found on the photo. Check it matches.')).toHaveLength(2);
    expect(screen.getByText('All numbers set')).toBeInTheDocument();

    fireEvent.click(addButton());
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0]?.[0] ?? [];
    expect(saved.map((t) => t.number)).toEqual(['361', '42']);
    expect(saved.every((t) => t.called === false && t.image instanceof Blob)).toBe(true);
  });

  it('never asks you to mark where the number is', async () => {
    vi.mocked(readNumber).mockResolvedValue(found('5'));
    setup(1);
    await waitFor(() => expect(field(0)).toHaveValue('5'));
    expect(screen.queryByText(/drag/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/spot/i)).not.toBeInTheDocument();
  });

  it('outlines where the number was found', async () => {
    vi.mocked(readNumber).mockResolvedValue(found('5', { box: { x: 0.25, y: 0.5, w: 0.1, h: 0.05 } }));
    const { container } = render(
      <ReviewSheet files={[photo('a.jpg')]} existing={[]} onClose={vi.fn()} onSave={vi.fn(async () => {})} />,
    );
    await waitFor(() => expect(container.ownerDocument.querySelector('.spot-box')).not.toBeNull());
    const outline = container.ownerDocument.querySelector<HTMLElement>('.spot-box');
    // Framed with a little room around the number.
    expect(parseFloat(outline?.style.left ?? '')).toBeCloseTo(22.5, 1);
    expect(parseFloat(outline?.style.top ?? '')).toBeCloseTo(47, 1);
    expect(parseFloat(outline?.style.width ?? '')).toBeGreaterThan(10);
  });

  it('turns a sideways photo upright when that is how the number read', async () => {
    vi.mocked(readNumber).mockResolvedValue(found('77', { rotation: 90 }));
    setup(1);
    await waitFor(() => expect(field(0)).toHaveValue('77'));
    expect(vi.mocked(renderRotated).mock.calls.map((c) => c[1])).toEqual([0, 90]);
  });

  it('asks you to type the number when it can’t be found', async () => {
    vi.mocked(readNumber).mockResolvedValue(null);
    setup(2);
    await waitFor(() => expect(screen.getByText('2 still need a number')).toBeInTheDocument());
    expect(screen.getAllByText('Couldn’t find the number. Type it in.')).toHaveLength(2);
    expect(addButton()).toBeDisabled();

    fireEvent.change(field(0), { target: { value: '12' } });
    expect(addButton()).toBeDisabled();
    fireEvent.change(field(1), { target: { value: '13' } });
    expect(addButton()).toBeEnabled();
  });

  it('treats an OCR failure as not found', async () => {
    vi.mocked(readNumber).mockRejectedValue(new Error('worker crashed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setup(1);
    await waitFor(() => expect(screen.getByText('Couldn’t find the number. Type it in.')).toBeInTheDocument());
  });

  it('Enter jumps to the next empty number, then adds the batch', async () => {
    vi.mocked(readNumber).mockResolvedValue(null);
    const { onSave } = setup(3);
    await waitFor(() => expect(screen.getByText('3 still need a number')).toBeInTheDocument());

    fireEvent.change(field(0), { target: { value: '1' } });
    expect(field(0)).toHaveAttribute('enterkeyhint', 'next');
    fireEvent.keyDown(field(0), { key: 'Enter' });
    expect(field(1)).toHaveFocus();

    fireEvent.change(field(1), { target: { value: '2' } });
    fireEvent.keyDown(field(1), { key: 'Enter' });
    expect(field(2)).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(field(2), { target: { value: '3' } });
    expect(field(2)).toHaveAttribute('enterkeyhint', 'done');
    fireEvent.keyDown(field(2), { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });

  it('typing overrides a later OCR result', async () => {
    let finish: (v: NumberRead) => void = () => {};
    vi.mocked(readNumber).mockImplementation(() => new Promise((r) => (finish = r)));
    setup(1);
    await waitFor(() => expect(readNumber).toHaveBeenCalled());

    fireEvent.change(field(0), { target: { value: '77' } });
    await act(async () => finish(found('11')));
    expect(field(0)).toHaveValue('77');
    expect(screen.getByText('Typed by you.')).toBeInTheDocument();
  });

  it('reads again after you rotate the photo', async () => {
    vi.mocked(readNumber).mockResolvedValueOnce(null).mockResolvedValueOnce(found('808'));
    setup(1);
    await waitFor(() => expect(screen.getByText('Couldn’t find the number. Type it in.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Rotate photo' }));
    await waitFor(() => expect(field(0)).toHaveValue('808'));
    expect(vi.mocked(renderRotated).mock.calls.map((c) => c[1])).toEqual([0, 90]);
  });

  it('warns about numbers already saved or repeated in the batch', async () => {
    vi.mocked(readNumber).mockResolvedValue(found('5'));
    setup(2, ['361']);
    await waitFor(() => expect(screen.getAllByText('5 appears twice in this batch.')).toHaveLength(2));

    fireEvent.change(field(0), { target: { value: '361' } });
    expect(screen.getByText('361 is already in your tickets.')).toBeInTheDocument();
  });

  it('removes a photo from the batch', async () => {
    vi.mocked(readNumber).mockResolvedValue(found('5'));
    setup(2);
    await waitFor(() => expect(numberInputs()).toHaveLength(2));
    const [first] = screen.getAllByRole('button', { name: 'Remove photo' });
    if (!first) throw new Error('no remove button');
    fireEvent.click(first);
    expect(numberInputs()).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Confirm your ticket' })).toBeInTheDocument();
  });
});
