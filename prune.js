const fs = require('fs');
const path = require('path');
const { TYPES, parseViewport } = require('./viewports');
const { DIR: HTML_DIR } = require('./html-report');

const RUN_RE = /^\d{8}-\d{6}$/;
const TEST_ROOT = path.join(__dirname, 'backstop_data', 'bitmaps_test');

function sizeOf(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs.readdirSync(p).reduce((n, f) => n + sizeOf(path.join(p, f)), 0);
}

function hasImages(runDir) {
  return fs.existsSync(runDir) && fs.readdirSync(runDir).some(f => f.endsWith('.png'));
}

function pruneDir(dir, keep) {
  const res = { runs: 0, bytes: 0 };
  if (!keep || !fs.existsSync(dir)) return res;
  const runs = fs.readdirSync(dir).filter(d => RUN_RE.test(d) && fs.existsSync(path.join(dir, d, 'report.json'))).sort().reverse();
  for (const id of runs.slice(Math.max(1, keep))) {
    const runDir = path.join(dir, id);
    const targets = fs.readdirSync(runDir).filter(f => f.endsWith('.png') || f === HTML_DIR).map(f => path.join(runDir, f));
    if (!targets.length) continue;
    for (const t of targets) {
      res.bytes += sizeOf(t);
      fs.rmSync(t, { recursive: true, force: true });
    }
    res.runs++;
  }
  return res;
}

function pruneTarget(target, keep, only) {
  const total = { runs: 0, bytes: 0 };
  for (const type of TYPES) {
    const tdir = path.join(TEST_ROOT, target, type);
    if (!fs.existsSync(tdir)) continue;
    for (const size of fs.readdirSync(tdir)) {
      const vp = parseViewport(`${type}:${size}`);
      if (!vp || (only && only !== vp.key)) continue;
      const r = pruneDir(path.join(tdir, size), keep);
      total.runs += r.runs;
      total.bytes += r.bytes;
    }
  }
  return total;
}

function pruneAll(keep) {
  const total = { runs: 0, bytes: 0 };
  if (!fs.existsSync(TEST_ROOT)) return total;
  for (const target of fs.readdirSync(TEST_ROOT)) {
    if (!fs.statSync(path.join(TEST_ROOT, target)).isDirectory()) continue;
    const r = pruneTarget(target, keep);
    total.runs += r.runs;
    total.bytes += r.bytes;
  }
  return total;
}

const mb = b => `${(b / 1048576).toFixed(1)} MB`;

module.exports = { pruneTarget, pruneAll, hasImages, mb };
