const fs = require('fs');
const path = require('path');
const { analyze, describe } = require('./shift');
const { writeRunHtml } = require('./html-report');

const short = r => (r ? describe(r, 3) : '-');

const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const runDate = id => {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(id);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}` : id;
};

function latestRun(testDir) {
  if (!fs.existsSync(testDir)) return null;
  const runs = fs.readdirSync(testDir)
    .filter(d => /^\d{8}-\d{6}$/.test(d) && fs.existsSync(path.join(testDir, d, 'report.json')))
    .sort();
  return runs.length ? runs[runs.length - 1] : null;
}

function rows(report, refDir, runDir, shifts) {
  return report.tests.map((t, i) => {
    const p = t.pair;
    const diff = p.diff || {};
    const raw = typeof diff.rawMisMatchPercentage === 'number' ? diff.rawMisMatchPercentage : 0;
    const dim = diff.dimensionDifference || { width: 0, height: 0 };
    const refFile = path.join(refDir, p.fileName);
    const refTime = fs.existsSync(refFile) ? fmtDate(fs.statSync(refFile).mtime) : '-';
    let status = 'PASS';
    let shift = null;
    if (t.status !== 'pass') {
      try { shift = analyze(refFile, path.join(runDir, p.fileName)); } catch (e) { shift = { status: 'error', note: e.message, shifts: [], changes: [] }; }
      shifts[p.label] = shift;
      status = shift.status === 'shift' || shift.status === 'same' ? 'SHIFT' : 'FAIL';
    }
    return {
      n: i + 1,
      label: p.label,
      url: p.url,
      viewport: p.viewportLabel,
      status,
      mismatch: `${raw.toFixed(4)}%`,
      threshold: `${p.misMatchThreshold}%`,
      size: dim.width || dim.height ? `${dim.width >= 0 ? '+' : ''}${dim.width} x ${dim.height >= 0 ? '+' : ''}${dim.height} px` : '0',
      reference: refTime,
      changes: short(shift)
    };
  });
}

function build(target, baseUrl, config, filter) {
  const testDir = path.resolve(config.paths.bitmaps_test);
  const refDir = path.resolve(config.paths.bitmaps_reference);
  const run = latestRun(testDir);
  if (!run) return null;

  const report = JSON.parse(fs.readFileSync(path.join(testDir, run, 'report.json'), 'utf8'));
  const shifts = {};
  const runDir = path.join(testDir, run);
  const order = { FAIL: 0, SHIFT: 1, PASS: 2 };
  const data = rows(report, refDir, runDir, shifts).sort((a, b) => (a.status === b.status ? a.n - b.n : order[a.status] - order[b.status]));
  fs.writeFileSync(path.join(runDir, 'shift.json'), JSON.stringify(shifts, null, 2));
  const html = writeRunHtml(runDir, refDir);
  const failed = data.filter(r => r.status === 'FAIL').length;
  const shifted = data.filter(r => r.status === 'SHIFT').length;
  const passed = data.length - failed - shifted;
  const viewports = config.viewports.map(v => `${v.label} ${v.width}x${v.height}`).join(', ');

  const meta = [
    ['Result', failed ? 'FAILED' : shifted ? 'SHIFT ONLY' : 'PASSED'],
    ['Environment', `${target} (${baseUrl})`],
    ['Run', `${runDate(run)} (${run})`],
    ['Scenarios', `${data.length}`],
    ['Passed', `${passed}`],
    ['Shift only', `${shifted}`],
    ['Failed', `${failed}`],
    ['Viewports', viewports],
    ['Filter', filter || '-'],
    ['Tool', `BackstopJS ${require('backstopjs/package.json').version}`]
  ];
  const cols = [
    ['#', 'n'], ['Scenario', 'label'], ['URL', 'url'], ['Viewport', 'viewport'], ['Status', 'status'],
    ['Mismatch', 'mismatch'], ['Threshold', 'threshold'], ['Size diff', 'size'], ['Reference captured', 'reference'], ['Changes', 'changes']
  ];

  const md = [
    `# Visual regression report: ${target}`,
    '',
    '| | |',
    '|---|---|',
    ...meta.map(([k, v]) => `| **${k}** | ${v} |`),
    '',
    `| ${cols.map(c => c[0]).join(' | ')} |`,
    `|${cols.map(() => '---').join('|')}|`,
    ...data.map(r => `| ${cols.map(c => c[1] === 'status' ? `**${r.status}**` : String(r[c[1]]).replace(/\|/g, '\\|')).join(' | ')} |`),
    ''
  ].join('\n');

  const kw = Math.max(...meta.map(([k]) => k.length));
  const table = [cols.map(c => c[0]), ...data.map(r => cols.map(c => String(r[c[1]])))];
  const widths = cols.map((_, i) => Math.max(...table.map(row => row[i].length)));
  const line = row => row.map((v, i) => v.padEnd(widths[i])).join('  ').trimEnd();
  const txt = [
    `Visual regression report: ${target}`,
    '',
    ...meta.map(([k, v]) => `${k.padEnd(kw)}  ${v}`),
    '',
    line(table[0]),
    widths.map(w => '-'.repeat(w)).join('  '),
    ...table.slice(1).map(line),
    ''
  ].join('\r\n');

  const outDir = path.resolve('reports', target, ...(config.viewportKey || '').split('/').filter(Boolean));
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `${target}_${run}`);
  fs.writeFileSync(`${base}.md`, md);
  fs.writeFileSync(`${base}.txt`, txt);
  return { md: `${base}.md`, txt: `${base}.txt`, html, passed, shifted, failed, total: data.length };
}

module.exports = { build };
