const fs = require('fs');
const path = require('path');

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

function rows(report, refDir) {
  return report.tests.map((t, i) => {
    const p = t.pair;
    const diff = p.diff || {};
    const raw = typeof diff.rawMisMatchPercentage === 'number' ? diff.rawMisMatchPercentage : 0;
    const dim = diff.dimensionDifference || { width: 0, height: 0 };
    const refFile = path.join(refDir, p.fileName);
    const refTime = fs.existsSync(refFile) ? fmtDate(fs.statSync(refFile).mtime) : '-';
    return {
      n: i + 1,
      label: p.label,
      url: p.url,
      viewport: p.viewportLabel,
      status: t.status === 'pass' ? 'PASS' : 'FAIL',
      mismatch: `${raw.toFixed(4)}%`,
      threshold: `${p.misMatchThreshold}%`,
      size: dim.width || dim.height ? `${dim.width >= 0 ? '+' : ''}${dim.width} x ${dim.height >= 0 ? '+' : ''}${dim.height} px` : '0',
      reference: refTime
    };
  });
}

function build(target, baseUrl, config, filter) {
  const testDir = path.resolve(config.paths.bitmaps_test);
  const refDir = path.resolve(config.paths.bitmaps_reference);
  const run = latestRun(testDir);
  if (!run) return null;

  const report = JSON.parse(fs.readFileSync(path.join(testDir, run, 'report.json'), 'utf8'));
  const data = rows(report, refDir).sort((a, b) => (a.status === b.status ? a.n - b.n : a.status === 'FAIL' ? -1 : 1));
  const failed = data.filter(r => r.status === 'FAIL').length;
  const viewports = [...new Set(config.viewports.map(v => `${v.label} ${v.width}x${v.height}`))].join(', ');

  const meta = [
    ['Result', failed ? 'FAILED' : 'PASSED'],
    ['Environment', `${target} (${baseUrl})`],
    ['Run', `${runDate(run)} (${run})`],
    ['Scenarios', `${data.length}`],
    ['Passed', `${data.length - failed}`],
    ['Failed', `${failed}`],
    ['Viewports', viewports],
    ['Filter', filter || '-'],
    ['Tool', `BackstopJS ${require('backstopjs/package.json').version}`]
  ];
  const cols = [
    ['#', 'n'], ['Scenario', 'label'], ['URL', 'url'], ['Viewport', 'viewport'], ['Status', 'status'],
    ['Mismatch', 'mismatch'], ['Threshold', 'threshold'], ['Size diff', 'size'], ['Reference captured', 'reference']
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
    ...data.map(r => `| ${cols.map(c => c[1] === 'status' ? `**${r.status}**` : r[c[1]]).join(' | ')} |`),
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

  const outDir = path.resolve('reports', target);
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `${target}_${run}`);
  fs.writeFileSync(`${base}.md`, md);
  fs.writeFileSync(`${base}.txt`, txt);
  return { md: `${base}.md`, txt: `${base}.txt`, failed, total: data.length };
}

module.exports = { build };
