import { createWorker } from 'tesseract.js';
import { cropForOcr } from './image.js';

const base = import.meta.env.BASE_URL;
let workerPromise = null;
let chain = Promise.resolve();

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: `${base}tesseract/worker.min.js`,
      corePath: `${base}tesseract`,
      langPath: `${base}tesseract/lang`,
      gzip: true,
    }).catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

// Tesseract handles one job at a time; serialize so parameters don't collide.
function enqueue(job) {
  const run = chain.then(job, job);
  chain = run.catch(() => {});
  return run;
}

const digitsOnly = (s) => (s || '').replace(/[^0-9]/g, '');

/** Read the number inside a user-marked box. Returns { number, confidence } or null. */
export function readBox(canvas, box) {
  return enqueue(async () => {
    const worker = await getWorker();
    const attempts = [];
    // Try the box as drawn plus a slightly tighter and looser crop.
    for (const pad of [0, 0.08, -0.08]) {
      const b = {
        x: box.x - box.w * pad,
        y: box.y - box.h * pad,
        w: box.w * (1 + 2 * pad),
        h: box.h * (1 + 2 * pad),
      };
      const crop = cropForOcr(canvas, b);
      for (const psm of ['8', '7']) {
        await worker.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: '0123456789' });
        const { data } = await worker.recognize(crop);
        const n = digitsOnly(data.text);
        if (n) attempts.push({ number: n, confidence: data.confidence });
      }
      if (attempts.length >= 2 && attempts[0].number === attempts[1].number) break;
    }
    if (!attempts.length) return null;
    // Majority vote, then confidence.
    const tally = new Map();
    for (const a of attempts) {
      const t = tally.get(a.number) || { number: a.number, votes: 0, confidence: 0 };
      t.votes += 1;
      t.confidence = Math.max(t.confidence, a.confidence);
      tally.set(a.number, t);
    }
    return [...tally.values()].sort((a, b) => b.votes - a.votes || b.confidence - a.confidence)[0];
  });
}

/** Best-effort guess from the whole photo (printed numbers read well, handwriting often won't). */
export function guessWhole(canvas) {
  return enqueue(async () => {
    const worker = await getWorker();
    await worker.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' });
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    let best = null;
    for (const b of data.blocks || [])
      for (const p of b.paragraphs)
        for (const l of p.lines)
          for (const w of l.words) {
            if (!/^\d{1,6}$/.test(w.text) || w.confidence < 70) continue;
            const score = w.confidence * (w.bbox.y1 - w.bbox.y0);
            if (!best || score > best.score) best = { number: w.text, confidence: w.confidence, score };
          }
    return best;
  });
}

export function warmUp() {
  getWorker().catch(() => {});
}
