/**
 * Open-source assistive tools that run in the browser:
 * - Tesseract.js (Apache-2.0) for OCR, used across many BLV readers
 * - ZXing (Apache-2.0) + Barcode Detection API for product/QR codes
 * - Named-color mapping in the style of Seeing AI / Lookout color channels
 */

import { createWorker } from 'tesseract.js';
import { BrowserMultiFormatReader } from '@zxing/browser';

let ocrWorker = null;
let ocrLoading = null;
const zxingReader = new BrowserMultiFormatReader();

export async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  if (ocrLoading) return ocrLoading;
  ocrLoading = createWorker('eng').then((worker) => {
    ocrWorker = worker;
    return worker;
  }).finally(() => { ocrLoading = null; });
  return ocrLoading;
}

export async function recognizeText(source) {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(source);
  const text = (data?.text || '').replace(/\s+/g, ' ').trim();
  const confidence = typeof data?.confidence === 'number' ? data.confidence : 0;
  return { text, confidence };
}

export async function decodeBarcode(canvas) {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      const detector = new BarcodeDetector({
        formats: formats.length ? formats : ['qr_code', 'ean_13', 'ean_8', 'upc_a', 'code_128'],
      });
      const codes = await detector.detect(canvas);
      if (codes?.length) {
        const first = codes[0];
        return { raw: String(first.rawValue || '').trim(), format: first.format || 'unknown' };
      }
    } catch {
      /* fall through to ZXing */
    }
  }

  try {
    const result = zxingReader.decodeFromCanvas(canvas);
    const raw = result?.getText?.() || result?.text || '';
    if (raw) {
      const format = result?.getBarcodeFormat?.() ?? 'unknown';
      return { raw: String(raw).trim(), format: String(format) };
    }
  } catch {
    /* no code in frame */
  }
  return null;
}

const NAMED_COLORS = [
  ['black', 20, 20, 20],
  ['white', 245, 245, 245],
  ['gray', 128, 128, 128],
  ['red', 200, 40, 40],
  ['orange', 230, 120, 30],
  ['yellow', 230, 210, 50],
  ['green', 40, 160, 70],
  ['teal', 30, 150, 150],
  ['blue', 40, 90, 200],
  ['purple', 130, 60, 180],
  ['pink', 230, 110, 160],
  ['brown', 120, 75, 40],
  ['beige', 210, 190, 150],
];

export function nameColor(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const size = Math.max(8, Math.round(Math.min(w, h) * 0.12));
  const x = Math.max(0, Math.round(w / 2 - size / 2));
  const y = Math.max(0, Math.round(h / 2 - size / 2));
  const sample = ctx.getImageData(x, y, size, size).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < sample.length; i += 4) {
    r += sample[i];
    g += sample[i + 1];
    b += sample[i + 2];
    n += 1;
  }
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);

  let best = NAMED_COLORS[0][0];
  let bestDist = Infinity;
  for (const [name, nr, ng, nb] of NAMED_COLORS) {
    const dist = (r - nr) ** 2 + (g - ng) ** 2 + (b - nb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }

  const brightness = (r + g + b) / 3;
  const shade = brightness < 70 ? 'dark ' : brightness > 200 ? 'light ' : '';
  return { name: `${shade}${best}`.trim(), rgb: [r, g, b] };
}
