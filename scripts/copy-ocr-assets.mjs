// Copies the on-device OCR engine (Tesseract.js worker + WASM core) and the Traditional Chinese
// model into public/ocr/, so timetable screenshots are read in the browser from our own origin —
// no API key, no CDN. Runs before dev/build; public/ocr/ is not committed.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const out = path.resolve('public/ocr');
mkdirSync(out, { recursive: true });
const tjs = path.dirname(require.resolve('tesseract.js/package.json'));
const core = path.dirname(require.resolve('tesseract.js-core/package.json', { paths: [tjs] }));
const chiTra = path.dirname(require.resolve('@tesseract.js-data/chi_tra/package.json'));
const files = [
  [path.join(tjs, 'dist/worker.min.js'), 'worker.min.js'],
  [path.join(core, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [path.join(core, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [path.join(core, 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [path.join(chiTra, '4.0.0_best_int/chi_tra.traineddata.gz'), 'chi_tra.traineddata.gz'],
];
for (const [from, name] of files) {
  const to = path.join(out, name);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
}
console.log(`ocr assets → ${path.relative(process.cwd(), out)}`);
