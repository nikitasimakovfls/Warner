const fs = require('fs');
const path = require('path');

const REPORTS = path.join(__dirname, 'reports');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.log') ? [p] : [];
  });
}

function parse(file) {
  const rows = [];
  rows.settings = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!rows.settings && /^settings: /.test(line)) rows.settings = line.slice(10);
    const i = line.indexOf(' | timing | ');
    if (i < 0) continue;
    const label = line.slice(0, i).replace(/^\[[^\]]+\]\s*/, '');
    const row = { label };
    for (const part of line.slice(i + 12).split(' | ')) {
      const [k, v] = part.split('=');
      row[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
    rows.push(row);
  }
  return rows;
}

const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.round((s.length - 1) * q)]; };
const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

const args = process.argv.slice(2);
const files = args.length ? args : walk(REPORTS).filter(f => parse(f).length).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(0, 1);
if (!files.length) { console.log('timing: no logs with timing data'); process.exit(1); }

for (const file of files) {
  const rows = parse(file);
  console.log(`log: ${path.relative(__dirname, file)}`);
  console.log(`settings: ${rows.settings || '-'}`);
  console.log(`scenarios: ${rows.length}`);
  if (!rows.length) continue;
  const phases = ['goto', 'prep', 'scroll', 'images', 'idle', 'pause', 'sliders', 'settle', 'final', 'paint', 'total'];
  const sumTotal = rows.reduce((a, r) => a + (r.total || 0), 0);
  console.log(['phase', 'avg', 'p50', 'p90', 'max', 'share'].map(s => s.padEnd(8)).join(''));
  for (const ph of phases) {
    const v = rows.map(r => r[ph]).filter(n => Number.isFinite(n));
    if (!v.length) continue;
    const share = ph === 'total' ? '' : `${Math.round(v.reduce((a, b) => a + b, 0) / sumTotal * 100)}%`;
    console.log([ph, avg(v), pct(v, 0.5), pct(v, 0.9), Math.max(...v), share].map(s => String(s).padEnd(8)).join(''));
  }
  console.log(`idleTimeout: ${rows.filter(r => r.idleTimeout).length}/${rows.length}`);
  console.log(`lateImages: ${rows.filter(r => r.lateImages).map(r => `${r.label}=${r.lateImages}/${r.stillLateImages}`).join(', ') || 0}`);
  console.log(`lowresImages: ${rows.filter(r => r.lowresImages).map(r => `${r.label}=${r.lowresImages}`).join(', ') || 0}`);
  console.log(`height avg: ${avg(rows.map(r => r.height || 0))} | max: ${Math.max(...rows.map(r => r.height || 0))}`);
  console.log('slowest:');
  for (const r of [...rows].sort((a, b) => b.total - a.total).slice(0, 8)) {
    console.log(`  ${r.label} | total=${r.total} | goto=${r.goto} | scroll=${r.scroll} | idle=${r.idle} | height=${r.height} | idleTimeout=${r.idleTimeout}`);
  }
}
