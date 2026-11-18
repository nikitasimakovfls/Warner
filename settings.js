const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'reports', 'settings.json');
const DEFAULTS = { keepTestImages: 10, captureLimit: 4, parallelViewports: 1, pageLoad: 'load', captureMode: 'stitched', misMatchThreshold: 0.01 };
const KEEP_OPTIONS = [3, 5, 10, 20, 50, 0];
const CAPTURE_OPTIONS = [1, 2, 3, 4, 6, 8, 10, 12];
const PARALLEL_OPTIONS = [1, 2, 3, 4];
const PAGE_LOAD_OPTIONS = ['load', 'domcontentloaded'];
const CAPTURE_MODE_OPTIONS = ['stitched', 'fullpage'];
const RANGES = { misMatchThreshold: [0, 100] };
const OPTIONS = { keepTestImages: KEEP_OPTIONS, captureLimit: CAPTURE_OPTIONS, parallelViewports: PARALLEL_OPTIONS, pageLoad: PAGE_LOAD_OPTIONS, captureMode: CAPTURE_MODE_OPTIONS };

function load() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
  const out = { ...DEFAULTS };
  for (const k of Object.keys(OPTIONS)) if (OPTIONS[k].includes(saved[k])) out[k] = saved[k];
  for (const k of Object.keys(RANGES)) if (inRange(k, saved[k])) out[k] = saved[k];
  return out;
}

function inRange(k, v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= RANGES[k][0] && v <= RANGES[k][1] && Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
}

function validate(patch) {
  const clean = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (RANGES[k]) {
      if (!inRange(k, v)) return { error: `bad ${k}` };
      clean[k] = v;
      continue;
    }
    if (!OPTIONS[k]) continue;
    if (!OPTIONS[k].includes(v)) return { error: `bad ${k}` };
    clean[k] = v;
  }
  return { clean };
}

function save(patch) {
  const next = { ...load(), ...patch };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { load, save, validate, OPTIONS, RANGES, KEEP_OPTIONS, CAPTURE_OPTIONS, PARALLEL_OPTIONS, PAGE_LOAD_OPTIONS, CAPTURE_MODE_OPTIONS, DEFAULTS };
