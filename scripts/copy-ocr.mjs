// Copies the OCR engine + English data into public/ so the app self-hosts them
// (works offline, no third-party CDN at runtime).
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'tesseract');
const nm = join(root, 'node_modules');

mkdirSync(join(out, 'lang'), { recursive: true });
cpSync(join(nm, 'tesseract.js/dist/worker.min.js'), join(out, 'worker.min.js'));
for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js']) {
  cpSync(join(nm, 'tesseract.js-core', f), join(out, f));
}
cpSync(join(nm, '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'), join(out, 'lang/eng.traineddata.gz'));
if (!existsSync(join(out, 'worker.min.js'))) throw new Error('OCR copy failed');
console.log('OCR assets copied to public/tesseract');
