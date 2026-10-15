import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { GrayImage, Pixels } from './detect';
import { readTicketNumber, type Mode, type NumberRead, type Recognize } from './readNumber';

const base = import.meta.env.BASE_URL;
let workerPromise: Promise<Worker> | null = null;
let chain: Promise<unknown> = Promise.resolve();

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: `${base}tesseract/worker.min.js`,
      corePath: `${base}tesseract`,
      langPath: `${base}tesseract/lang`,
      gzip: true,
    })
      .then(async (w) => {
        await w.setParameters({ tessedit_char_whitelist: '0123456789' });
        return w;
      })
      .catch((err) => {
        workerPromise = null;
        throw err;
      });
  }
  return workerPromise;
}

// Tesseract handles one job at a time; serialize so parameters don't collide.
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.catch(() => {});
  return run;
}

/** A grayscale image as a binary PGM file, which Tesseract reads directly. */
export function toPgm(img: GrayImage): Uint8Array {
  const head = new TextEncoder().encode(`P5\n${img.width} ${img.height}\n255\n`);
  const out = new Uint8Array(head.length + img.data.length);
  out.set(head);
  out.set(img.data, head.length);
  return out;
}

const PSM_FOR: Record<Mode, PSM> = { line: PSM.SINGLE_LINE, word: PSM.SINGLE_WORD };

type ImageInput = Parameters<Worker['recognize']>[0];

/**
 * Recognize digits on one crop with a given Tesseract worker. Browsers take the image
 * as a Blob; Node (tests) needs a Buffer, so the wrapping is swappable.
 */
export const recognizerFor =
  (worker: Worker, wrap: (bytes: Uint8Array) => ImageInput = (b) => new Blob([b])): Recognize =>
  async (crop, mode) => {
    await worker.setParameters({ tessedit_pageseg_mode: PSM_FOR[mode] });
    const { data } = await worker.recognize(wrap(toPgm(crop)));
    return { text: data.text, confidence: data.confidence };
  };

/** Find and read the ticket number on a photo, without any help from the user. */
export function readNumber(canvas: HTMLCanvasElement): Promise<NumberRead | null> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return Promise.resolve(null);
  const photo: Pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return enqueue(async () => readTicketNumber(photo, recognizerFor(await getWorker())));
}

export function warmUp(): void {
  getWorker().catch(() => {});
}
