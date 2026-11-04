const fs = require('fs');
const path = require('path');
const { viewportLabel } = require('./viewports');

const FILE = path.join(__dirname, 'reports', 'history.jsonl');
const RUN_RE = /^\d{8}-\d{6}$/;

function append(entry) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.appendFileSync(FILE, JSON.stringify(entry) + '\n');
}

function read() {
  if (!fs.existsSync(FILE)) return [];
  return fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch (e) { return null; }
  }).filter(Boolean);
}

function latestRunId(dir) {
  if (!fs.existsSync(dir)) return null;
  const runs = fs.readdirSync(dir).filter(d => RUN_RE.test(d) && fs.existsSync(path.join(dir, d, 'report.json'))).sort();
  return runs.length ? runs[runs.length - 1] : null;
}

let placeholders = null;
function loadPlaceholders() {
  if (placeholders) return placeholders;
  placeholders = new Map();
  try {
    const dir = path.join(path.dirname(require.resolve('backstopjs/package.json')), 'capture', 'resources');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.png'))) {
      const buf = fs.readFileSync(path.join(dir, f));
      if (!placeholders.has(buf.length)) placeholders.set(buf.length, []);
      placeholders.get(buf.length).push(buf);
    }
  } catch (e) {}
  return placeholders;
}

function isPlaceholder(file) {
  const list = loadPlaceholders().get(fs.statSync(file).size);
  if (!list) return false;
  const buf = fs.readFileSync(file);
  return list.some(b => b.equals(buf));
}

function hasRef(file) {
  return fs.existsSync(file) && !isPlaceholder(file);
}

function missingRefs(refDir, labels, type) {
  const suffix = viewportLabel(type);
  return labels.filter(l => !hasRef(path.join(refDir, `${l}_${suffix}.png`)));
}

const pad = n => String(n).padStart(2, '0');
const stamp = iso => {
  const d = new Date(iso);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};
const stripAnsi = s => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

function logRel(target, key, command, runId, startedAt) {
  const name = command === 'test' && runId ? `${target}_${runId}.log` : `${target}_${command}_${stamp(startedAt)}.log`;
  return [target, ...key.split('/'), name].join('/');
}

function writeLog(rel, text) {
  const file = path.join(__dirname, 'reports', ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = stripAnsi(text).split(/\r?\n/);
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  fs.writeFileSync(file, lines.join('\r\n') + '\r\n');
  return rel;
}

module.exports = { append, read, latestRunId, missingRefs, hasRef, isPlaceholder, logRel, writeLog, FILE };
