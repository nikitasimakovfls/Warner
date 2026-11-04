const ENVIRONMENTS = require('./environments');
const { build } = require('./summary');
const history = require('./history');
const settings = require('./settings');
const { pruneTarget, mb } = require('./prune');

const captured = [];
if (!process.env.UI_RUN) {
  captured.push(`> node run.js ${process.argv.slice(2).join(' ')}\n`);
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream);
    stream.write = (chunk, ...args) => { captured.push(String(chunk)); return write(chunk, ...args); };
  }
}

const COMMANDS = {
  reference: 'reference',
  test: 'test',
  approve: 'approve',
  report: 'openReport',
  summary: null
};

const { parseViewport } = require('./viewports');

const [command, target, ...rest] = process.argv.slice(2);
const viewportArg = rest.length && parseViewport(rest[0]) ? rest.shift() : 'desktop';
const viewport = parseViewport(viewportArg);
const filter = rest[0];
const usage = `Usage: npm run <${Object.keys(COMMANDS).join('|')}> <${Object.keys(ENVIRONMENTS).join('|')}> [desktop|tablet|mobile|<type>:WxH] [filter]`;

if (!(command in COMMANDS) || !ENVIRONMENTS[target] || (rest.length && /^(desktop|tablet|mobile)(:|$)/i.test(rest[0]) && !parseViewport(rest[0]))) {
  console.error(usage);
  process.exit(1);
}

process.env.TARGET = target;
process.env.VIEWPORT = viewport.spec;
const config = require('./backstop.config.js');

console.log(`target: ${target} | ${ENVIRONMENTS[target]} | viewport: ${viewport.key}${filter ? ` | filter: ${filter}` : ''}`);

const fs = require('fs');
const path = require('path');

const latestRunId = () => history.latestRunId(path.resolve(config.paths.bitmaps_test));
const filterRe = filter ? new RegExp(filter) : null;
const selectedLabels = config.scenarios.map(s => s.label).filter(l => !filterRe || filterRe.test(l));
const startedAt = new Date().toISOString();

const runBefore = latestRunId();

const writeSummary = () => {
  if (command === 'test' && latestRunId() === runBefore) {
    console.log('summary: no new test run');
    return;
  }
  const r = build(target, ENVIRONMENTS[target], config, filter);
  if (!r) {
    console.log('summary: no test runs');
    return;
  }
  console.log(`summary: ${r.passed}/${r.total} passed | shift only: ${r.shifted} | failed: ${r.failed}`);
  console.log(`summary md: ${r.md}`);
  console.log(`summary txt: ${r.txt}`);
  if (r.html) console.log(`summary html: ${r.html}`);
};

const record = () => {
  if (process.env.UI_RUN || !['reference', 'test', 'approve'].includes(command)) return;
  const after = command === 'test' ? latestRunId() : null;
  const runId = after && after !== runBefore ? after : null;
  const code = process.exitCode || 0;
  if (command === 'approve' && approvedCount !== null) scenariosCount = approvedCount;
  captured.push(`exit code: ${code}\n`);
  const log = history.writeLog(history.logRel(target, viewport.key, command, runId, startedAt), captured.join(''));
  history.append({
    job: null,
    command,
    target,
    viewport: viewport.key,
    filter: filter || null,
    scenarios: scenariosCount,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode: code,
    stopped: false,
    runId,
    approvedRun,
    log
  });
};

let scenariosCount = selectedLabels.length;
let approvedCount = null;
let approvedRun = null;

function approve() {
  const testDir = path.resolve(config.paths.bitmaps_test);
  const refDir = path.resolve(config.paths.bitmaps_reference);
  const runId = process.env.APPROVE_RUN || latestRunId();
  const runDir = runId ? path.join(testDir, runId) : null;
  if (!runId || !/^\d{8}-\d{6}$/.test(runId) || !fs.existsSync(path.join(runDir, 'report.json'))) {
    console.log(`approve: test run not found: ${runId || '-'}`);
    process.exitCode = 1;
    return;
  }
  approvedRun = runId;
  const wanted = new Set(selectedLabels);
  const report = JSON.parse(fs.readFileSync(path.join(runDir, 'report.json'), 'utf8'));
  const failed = (report.tests || []).filter(t => t.status !== 'pass' && wanted.has(t.pair.label));
  fs.mkdirSync(refDir, { recursive: true });
  let done = 0;
  for (const t of failed) {
    const src = path.join(runDir, t.pair.fileName);
    if (!fs.existsSync(src)) { console.log(`approve: missing image: ${t.pair.label}`); process.exitCode = 1; continue; }
    fs.copyFileSync(src, path.join(refDir, t.pair.fileName));
    console.log(`approved: ${t.pair.label}`);
    done++;
  }
  approvedCount = done;
  console.log(`approve: ${done}/${failed.length} | run: ${runId} | viewport: ${viewport.key}`);
}

if (command === 'summary') {
  writeSummary();
} else if (['reference', 'test', 'approve'].includes(command) && !selectedLabels.length) {
  console.log(`no scenarios match filter: ${filter}`);
  process.exitCode = 1;
  record();
} else if (command === 'test' && history.missingRefs(path.resolve(config.paths.bitmaps_reference), selectedLabels, viewport.type).length) {
  const missing = history.missingRefs(path.resolve(config.paths.bitmaps_reference), selectedLabels, viewport.type);
  console.log(`missing references: ${missing.length}/${selectedLabels.length} | viewport: ${viewport.key}`);
  missing.forEach(l => console.log(`missing reference: ${l}`));
  process.exitCode = 2;
  record();
} else if (command === 'approve') {
  approve();
  record();
} else {
  require('backstopjs')(COMMANDS[command], { config, filter })
    .catch(() => { process.exitCode = 1; })
    .finally(() => {
      if (command === 'reference') {
        const failed = history.missingRefs(path.resolve(config.paths.bitmaps_reference), selectedLabels, viewport.type);
        failed.forEach(l => console.log(`reference failed: ${l}`));
        console.log(`reference: ${selectedLabels.length - failed.length}/${selectedLabels.length} | viewport: ${viewport.key}`);
        if (failed.length) process.exitCode = 1;
      }
      if (command === 'test') {
        writeSummary();
        const keep = settings.load().keepTestImages;
        const r = pruneTarget(target, keep, viewport.key);
        if (r.runs) console.log(`prune: ${r.runs} run(s) | ${mb(r.bytes)} | keep: ${keep}`);
      }
      record();
    });
}
