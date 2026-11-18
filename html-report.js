const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(path.dirname(require.resolve('backstopjs/package.json')), 'compare', 'output');
const DIR = 'html_report';

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (!fs.existsSync(d)) fs.copyFileSync(s, d);
  }
}

function writeRunHtml(runDir, refDir, since) {
  const reportFile = path.join(runDir, 'report.json');
  if (!fs.existsSync(reportFile)) return null;
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const out = path.join(runDir, DIR);
  copyDir(TEMPLATE, out);
  const rel = f => path.relative(out, f).split(path.sep).join('/');
  for (const t of report.tests || []) {
    const p = t.pair;
    const ref = path.join(refDir, p.fileName);
    const stale = since !== undefined && fs.existsSync(ref) && fs.statSync(ref).mtimeMs >= since;
    p.reference = stale ? '' : rel(ref);
    p.test = rel(path.join(runDir, p.fileName));
    const diff = path.join(runDir, `failed_diff_${p.fileName}`);
    if (fs.existsSync(diff)) p.diffImage = rel(diff);
    else delete p.diffImage;
  }
  fs.writeFileSync(path.join(out, 'config.js'), `report(${JSON.stringify(report, null, 2)});`);
  return path.join(out, 'index.html');
}

module.exports = { writeRunHtml, DIR };
