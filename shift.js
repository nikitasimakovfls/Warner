const fs = require('fs');
const crypto = require('crypto');
const { PNG } = require('pngjs');

const MAX_D = 3000;
const MERGE_GAP = 16;
const MAX_DX = 40;
const SEG_GAP = 8;

function readRows(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width, height, data } = png;
  const stride = width * 4;
  const hashes = new Array(height);
  const uniform = new Uint8Array(height);
  for (let y = 0; y < height; y++) {
    const start = y * stride;
    hashes[y] = crypto.createHash('sha1').update(data.subarray(start, start + stride)).digest('base64');
    const first = data.readUInt32LE(start);
    let same = 1;
    for (let i = start + 4; i < start + stride; i += 4) {
      if (data.readUInt32LE(i) !== first) { same = 0; break; }
    }
    uniform[y] = same;
  }
  return { width, height, hashes, uniform, data };
}

function toIds(a, b) {
  const dict = new Map();
  const map = arr => Int32Array.from(arr, h => {
    let id = dict.get(h);
    if (id === undefined) { id = dict.size; dict.set(h, id); }
    return id;
  });
  return [map(a), map(b)];
}

function myers(A, B) {
  const N = A.length, M = B.length;
  const max = Math.min(N + M, MAX_D);
  const off = max + 1;
  const V = new Int32Array(2 * max + 3);
  const trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(V.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = (k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])) ? V[off + k + 1] : V[off + k - 1] + 1;
      let y = x - k;
      while (x < N && y < M && A[x] === B[y]) { x++; y++; }
      V[off + k] = x;
      if (x >= N && y >= M) return backtrack(trace, d, N, M);
    }
  }
  return null;
}

function backtrack(trace, D, N, M) {
  const ops = [];
  let x = N, y = M;
  for (let d = D; d > 0; d--) {
    const v = trace[d];
    const at = k => v[k + d + 1];
    const k = x - y;
    const prevK = (k === -d || (k !== d && at(k - 1) < at(k + 1))) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push('='); x--; y--; }
    ops.push(prevK === k + 1 ? '+' : '-');
    x = prevX; y = prevY;
  }
  while (x > 0 && y > 0) { ops.push('='); x--; y--; }
  return ops.reverse();
}

function hunks(a, b) {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const A = a.subarray(s, ea), B = b.subarray(s, eb);
  if (!A.length && !B.length) return [];
  if (!A.length || !B.length) return [{ a: s, al: A.length, b: s, bl: B.length }];
  const ops = myers(A, B);
  if (!ops) return null;
  const out = [];
  let i = 0, j = 0, cur = null;
  for (const op of ops) {
    if (op === '=') { if (cur) { out.push(cur); cur = null; } i++; j++; continue; }
    if (!cur) cur = { a: s + i, al: 0, b: s + j, bl: 0 };
    if (op === '-') { cur.al++; i++; } else { cur.bl++; j++; }
  }
  if (cur) out.push(cur);
  return out;
}

function isSpacing(rows, start, len) {
  const before = start > 0 ? rows.hashes[start - 1] : null;
  const after = start + len < rows.height ? rows.hashes[start + len] : null;
  for (let y = start; y < start + len; y++) {
    if (rows.uniform[y]) continue;
    const h = rows.hashes[y];
    if (h !== before && h !== after) return false;
  }
  return true;
}

function merge(list) {
  const out = [];
  for (const c of list) {
    const last = out[out.length - 1];
    if (last && c.refY - (last.refY + last.refH) <= MERGE_GAP && c.testY - (last.testY + last.testH) <= MERGE_GAP) {
      last.refH = c.refY + c.refH - last.refY;
      last.testH = c.testY + c.testH - last.testY;
    } else out.push({ ...c });
  }
  return out;
}

function diffColumns(ref, test, y0, h, yt) {
  const W = ref.width, cols = new Uint8Array(W);
  for (let r = 0; r < h; r++) {
    const ra = (y0 + r) * W * 4, tb = (yt + r) * W * 4;
    for (let x = 0; x < W; x++) if (ref.data.readUInt32LE(ra + x * 4) !== test.data.readUInt32LE(tb + x * 4)) cols[x] = 1;
  }
  const segs = [];
  let cur = null;
  for (let x = 0; x < W; x++) {
    if (!cols[x]) continue;
    if (cur && x - cur.x1 <= SEG_GAP + 1) cur.x1 = x;
    else { cur = { x0: x, x1: x }; segs.push(cur); }
  }
  return segs;
}

function segmentMatches(ref, test, y0, h, yt, x0, x1, dx) {
  const W = ref.width;
  for (let r = 0; r < h; r++) {
    const ra = (y0 + r) * W * 4, tb = (yt + r) * W * 4;
    for (let x = x0; x <= x1; x++) {
      const sx = x - dx;
      const rv = sx >= 0 && sx < W ? ref.data.readUInt32LE(ra + sx * 4) : null;
      if (rv !== test.data.readUInt32LE(tb + x * 4)) return false;
    }
  }
  return true;
}

function findMove(ref, test, y0, h, yt) {
  const segs = diffColumns(ref, test, y0, h, yt);
  if (!segs.length) return null;
  const parts = [];
  for (const sg of segs) {
    let found = null;
    for (let k = 1; k <= MAX_DX && found === null; k++) {
      for (const dx of [-k, k]) {
        if (segmentMatches(ref, test, y0, h, yt, sg.x0, sg.x1, dx)) { found = dx; break; }
      }
    }
    if (found === null) return null;
    parts.push({ x0: sg.x0, x1: sg.x1, dx: found });
  }
  return { y: yt, h, parts };
}

function analyze(refFile, testFile) {
  if (!fs.existsSync(refFile) || !fs.existsSync(testFile)) return { status: 'error', note: 'missing file' };
  const ref = readRows(refFile);
  const test = readRows(testFile);
  const base = { refHeight: ref.height, testHeight: test.height, shifts: [], moves: [], changes: [] };
  if (ref.width !== test.width) return { ...base, status: 'changed', note: `width ${ref.width} -> ${test.width}` };
  const [a, b] = toIds(ref.hashes, test.hashes);
  const list = hunks(a, b);
  if (!list) return { ...base, status: 'changed', note: 'too many differences' };
  for (const h of list) {
    if (h.al === 0 && isSpacing(test, h.b, h.bl)) base.shifts.push({ y: h.a, delta: h.bl });
    else if (h.bl === 0 && isSpacing(ref, h.a, h.al)) base.shifts.push({ y: h.a, delta: -h.al });
    else {
      const mv = h.al === h.bl ? findMove(ref, test, h.a, h.al, h.b) : null;
      if (mv) base.moves.push(mv);
      else base.changes.push({ refY: h.a, refH: h.al, testY: h.b, testH: h.bl });
    }
  }
  base.changes = merge(base.changes);
  base.status = base.changes.length ? 'changed' : base.shifts.length || base.moves.length ? 'shift' : 'same';
  return base;
}

function describe(r, limit = Infinity) {
  if (!r) return '-';
  const list = (items, fmt) => {
    const shown = items.slice(0, limit).map(fmt).join(', ');
    return items.length > limit ? `${shown} (+${items.length - limit} more)` : shown;
  };
  const parts = [];
  if (r.note) parts.push(r.note);
  if (r.changes && r.changes.length) parts.push(`changed: ${list(r.changes, c => `y=${c.testY}..${c.testY + c.testH}`)}`);
  if (r.moves && r.moves.length) {
    parts.push(`moved: ${list(r.moves, m => {
      const dxs = [...new Set(m.parts.map(p => p.dx))].sort((a, b) => a - b);
      const sg = d => `${d > 0 ? '+' : ''}${d}`;
      return `dx=${dxs.length === 1 ? sg(dxs[0]) : `${sg(dxs[0])}..${sg(dxs[dxs.length - 1])}`}@y=${m.y}..${m.y + m.h}${m.parts.length > 1 ? ` (${m.parts.length} parts)` : ''}`;
    })}`);
  }
  if (r.shifts && r.shifts.length) {
    const net = r.shifts.reduce((n, x) => n + x.delta, 0);
    parts.push(`shifts: ${list(r.shifts, x => `${x.delta > 0 ? '+' : ''}${x.delta}px@y=${x.y}`)}`);
    parts.push(`net ${net > 0 ? '+' : ''}${net}px`);
  }
  return parts.join(' | ') || '-';
}

module.exports = { analyze, describe };
