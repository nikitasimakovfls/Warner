const fs = require('fs');
const path = require('path');

const ENVIRONMENTS = require('./environments');

const ROOT = path.join(__dirname, 'reports', 'imgstate');
const TEST_ROOT = path.join(__dirname, 'backstop_data', 'bitmaps_test');
const RUN_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/;
const toMs = id => { const m = RUN_RE.exec(id); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : NaN; };

function testRun(host, vp, stamp) {
  const target = Object.keys(ENVIRONMENTS).find(t => ENVIRONMENTS[t].includes(host));
  const m = /^([A-Za-z]+)_(\d+x\d+)$/.exec(vp);
  if (!target || !m) return { id: '-', status: '-' };
  const dir = path.join(TEST_ROOT, target, m[1].toLowerCase(), m[2]);
  if (!fs.existsSync(dir)) return { id: '-', status: '-' };
  const t0 = toMs(stamp);
  const id = fs.readdirSync(dir).filter(d => RUN_RE.test(d) && toMs(d) >= t0 && toMs(d) - t0 <= 120000).sort()[0];
  if (!id) return { id: '-', status: 'reference or no test run' };
  try {
    const t = (JSON.parse(fs.readFileSync(path.join(dir, id, 'report.json'), 'utf8')).tests || []).find(x => x.pair.label === label);
    return { id, status: t ? (t.status === 'pass' ? 'PASS' : `FAIL ${t.pair.diff ? t.pair.diff.misMatchPercentage + '%' : ''}`.trim()) : 'not in run' };
  } catch (e) { return { id, status: 'no report' }; }
}
const [label, vpFilter] = process.argv.slice(2);
if (!label) { console.log('usage: node imgstate.js <scenario label> [viewport dir, e.g. Desktop_1920x1080]'); process.exit(1); }

const runs = [];
for (const host of fs.existsSync(ROOT) ? fs.readdirSync(ROOT) : []) {
  for (const vp of fs.readdirSync(path.join(ROOT, host))) {
    if (vpFilter && vp !== vpFilter) continue;
    for (const stamp of fs.readdirSync(path.join(ROOT, host, vp))) {
      const file = path.join(ROOT, host, vp, stamp, `${label}.json`);
      if (fs.existsSync(file)) runs.push({ host, vp, stamp, imgs: JSON.parse(fs.readFileSync(file, 'utf8')) });
    }
  }
}
if (!runs.length) { console.log(`imgstate: no data for ${label}`); process.exit(1); }
runs.sort((a, b) => (a.stamp < b.stamp ? -1 : 1));
for (const r of runs) Object.assign(r, { test: testRun(r.host, r.vp, r.stamp) });

const key = i => `${i.file}@${i.x},${i.y}`;
const val = i => `requested=${i.requested},natural=${i.natural},rendered=${i.rendered}`;
const all = new Map();
for (const r of runs) for (const i of r.imgs) {
  if (!all.has(key(i))) all.set(key(i), new Map());
  all.get(key(i)).set(r.stamp, val(i));
}

console.log(`scenario: ${label}`);
console.log('runs:');
for (const r of runs) console.log(`  ${r.stamp} | ${r.vp} | test run: ${r.test.id} | ${r.test.status} | imgs: ${r.imgs.length}`);
let diffs = 0;
for (const [k, m] of all) {
  const vals = runs.map(r => m.get(r.stamp) || '-');
  if (new Set(vals).size === 1) continue;
  diffs++;
  console.log(k);
  runs.forEach((r, i) => console.log(`  ${r.stamp} ${r.test.status.padEnd(10)} ${vals[i]}`));
}
console.log(`differing images: ${diffs}/${all.size}`);
