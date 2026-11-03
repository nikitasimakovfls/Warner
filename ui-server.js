const http = require('http');
const fs = require('fs');
const path = require('path');
const { writeRunHtml, DIR: HTML_DIR } = require('./html-report');
const { spawn } = require('child_process');
const ENVIRONMENTS = require('./environments');
const { PRESETS, TYPES, parseViewport } = require('./viewports');
const history = require('./history');
const settings = require('./settings');
const { pruneAll, hasImages, mb } = require('./prune');

const HOST = '127.0.0.1';
const PORT = Number(process.env.UI_PORT || 3210);
const ROOT = __dirname;
const COMMANDS = ['reference', 'test'];
const MAX_LOG = 5000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const state = { running: false, job: null, command: null, target: null, viewports: [], current: null, index: 0, labels: [], startedAt: null, finishedAt: null, exitCode: null, stopped: false, log: [] };
let child = null;
const clients = new Set();

const stripAnsi = s => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

function pushLog(text) {
  const lines = stripAnsi(text).split(/\r?\n/).filter(l => l.length);
  if (!lines.length) return;
  state.log.push(...lines);
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
  broadcast('log', lines);
}

function publicState() {
  const { log, ...rest } = state;
  return rest;
}

function loadScenarios(target) {
  const prev = process.env.TARGET;
  process.env.TARGET = target;
  const file = require.resolve('./backstop.config.js');
  delete require.cache[file];
  try {
    const cfg = require(file);
    return cfg.scenarios.map(s => ({ label: s.label, url: s.url }));
  } finally {
    delete require.cache[file];
    if (prev === undefined) delete process.env.TARGET; else process.env.TARGET = prev;
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listSets(target) {
  const base = path.join(ROOT, 'backstop_data', 'bitmaps_reference', target);
  const sets = [];
  for (const type of TYPES) {
    const tdir = path.join(base, type);
    if (!fs.existsSync(tdir)) continue;
    for (const size of fs.readdirSync(tdir)) {
      const vp = parseViewport(`${type}:${size}`);
      if (!vp) continue;
      const files = fs.readdirSync(path.join(tdir, size)).filter(f => f.endsWith('.png'));
      const labels = files.map(f => f.replace(/_(Desktop|Mobile)\.png$/, ''));
      sets.push({ spec: vp.spec, key: vp.key, type, size: vp.size, labels });
    }
  }
  return sets;
}

const runDirOf = (target, key) => path.join(ROOT, 'backstop_data', 'bitmaps_test', target, ...key.split('/'));
const refDirOf = (target, key) => path.join(ROOT, 'backstop_data', 'bitmaps_reference', target, ...key.split('/'));
const runIdToIso = id => {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(id);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString();
};

function listRows(target, page, size) {
  const tests = new Map();
  const base = path.join(ROOT, 'backstop_data', 'bitmaps_test', target);
  for (const type of TYPES) {
    const tdir = path.join(base, type);
    if (!fs.existsSync(tdir)) continue;
    for (const sz of fs.readdirSync(tdir)) {
      const vp = parseViewport(`${type}:${sz}`);
      if (!vp) continue;
      const dir = path.join(tdir, sz);
      for (const id of fs.readdirSync(dir)) if (/^\d{8}-\d{6}$/.test(id) && fs.existsSync(path.join(dir, id, 'report.json'))) tests.set(`${vp.key}|${id}`, { vp, id });
    }
  }
  const used = new Set();
  const groups = new Map();
  for (const e of history.read().filter(e => e.target === target)) {
    const key = e.job || e.startedAt;
    if (!groups.has(key)) groups.set(key, { startedAt: e.startedAt, command: e.command, scenarios: e.scenarios, items: [] });
    const g = groups.get(key);
    if (e.startedAt < g.startedAt) g.startedAt = e.startedAt;
    const runKey = e.runId && tests.has(`${e.viewport}|${e.runId}`) ? `${e.viewport}|${e.runId}` : null;
    if (runKey) used.add(runKey);
    g.items.push({ viewport: e.viewport, exitCode: e.exitCode, stopped: !!e.stopped, runKey, logRel: e.log || null, approvedRun: e.approvedRun || null });
  }
  const rows = [...groups.values()];
  for (const [k, t] of tests) if (!used.has(k)) rows.push({ startedAt: runIdToIso(t.id), command: 'test', scenarios: null, items: [{ viewport: t.vp.key, exitCode: null, stopped: false, runKey: k, logRel: null }] });
  rows.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(Math.max(1, page), pages);
  const latest = new Map();
  for (const t of tests.values()) if (!latest.has(t.vp.key) || t.id > latest.get(t.vp.key)) latest.set(t.vp.key, t.id);
  const slice = rows.slice((cur - 1) * size, cur * size).map(row => {
    const items = row.items.map(it => {
      const t = it.runKey ? tests.get(it.runKey) : null;
      const run = t ? runInfo(target, t.vp, t.id) : null;
      if (run) run.approvable = latest.get(t.vp.key) === t.id && isApprovable(target, t.vp, run);
      const log = it.logRel && fs.existsSync(path.join(ROOT, 'reports', ...it.logRel.split('/'))) ? `/reports/${it.logRel}` : run ? run.log : null;
      return { viewport: it.viewport, exitCode: it.exitCode, stopped: it.stopped, run, log, approvedRun: it.approvedRun || null };
    });
    const scenarios = row.scenarios === null ? (items[0].run ? items[0].run.total : 0) : row.scenarios;
    return { startedAt: row.startedAt, command: row.command, scenarios, items };
  });
  return { rows: slice, total, page: cur, pages, size };
}

function runInfo(target, vp, id) {
  const dir = path.join(ROOT, 'backstop_data', 'bitmaps_test', target, ...vp.key.split('/'));
  return [id].map(id => {
      let tests = [];
      try { tests = JSON.parse(fs.readFileSync(path.join(dir, id, 'report.json'), 'utf8')).tests || []; } catch (e) {}
      let shifts = null;
      try { shifts = JSON.parse(fs.readFileSync(path.join(dir, id, 'shift.json'), 'utf8')); } catch (e) {}
      const failed = tests.filter(t => t.status !== 'pass').map(t => {
        const sh = shifts && shifts[t.pair.label];
        return {
          label: t.pair.label,
          file: t.pair.fileName,
          kind: sh ? (sh.status === 'shift' || sh.status === 'same' ? 'shift' : 'fail') : null
        };
      });
      const base = `${target}_${id}`;
      const reportsDir = path.join(ROOT, 'reports', target, ...vp.key.split('/'));
      const rel = `/reports/${target}/${vp.key}/${base}`;
      const hard = failed.filter(f => f.kind !== 'shift').length;
      return {
        id,
        viewport: vp.key,
        total: tests.length,
        failed,
        status: !failed.length ? 'Success' : hard ? 'FAILED' : 'SHIFT',
        html: `/run-html/${target}/${vp.key}/${id}`,
        images: hasImages(path.join(dir, id)),
        txt: fs.existsSync(path.join(reportsDir, `${base}.txt`)) ? `${rel}.txt` : null,
        md: fs.existsSync(path.join(reportsDir, `${base}.md`)) ? `${rel}.md` : null,
        log: fs.existsSync(path.join(reportsDir, `${base}.log`)) ? `${rel}.log` : null
      };
    })[0];
}

function isApprovable(target, vp, run) {
  if (!run || !run.images || !['FAILED', 'SHIFT'].includes(run.status) || !run.failed.length) return false;
  const since = new Date(runIdToIso(run.id)).getTime();
  const refDir = refDirOf(target, vp.key);
  return !run.failed.some(f => {
    const file = path.join(refDir, f.file);
    return fs.existsSync(file) && fs.statSync(file).mtimeMs >= since;
  });
}

function approveTarget(target, key, id) {
  const vp = parseViewport(String(key || '').replace('/', ':'));
  if (!ENVIRONMENTS[target] || !vp || !/^\d{8}-\d{6}$/.test(String(id))) return { error: 'bad target, viewport or run' };
  const dir = runDirOf(target, vp.key);
  if (!fs.existsSync(path.join(dir, id, 'report.json'))) return { error: 'run not found' };
  if (history.latestRunId(dir) !== id) return { error: 'only the latest test run can be approved' };
  const run = runInfo(target, vp, id);
  if (!isApprovable(target, vp, run)) return { error: 'run cannot be approved' };
  return { vp, labels: run.failed.map(f => f.label) };
}

function checkRun(command, target, vps, labels) {
  const all = loadScenarios(target).map(s => s.label);
  const selected = (labels || []).filter(l => all.includes(l));
  if (!selected.length) return { error: 'no scenarios selected' };
  if (command === 'test') {
    const missing = {};
    for (const vp of vps) {
      const m = history.missingRefs(refDirOf(target, vp.key), selected, vp.type);
      if (m.length) missing[vp.key] = m;
    }
    if (Object.keys(missing).length) return { error: 'missing references', missing };
  }
  return { selected, filter: selected.length === all.length ? null : `^(${selected.map(escapeRe).join('|')})$` };
}

function startRun(command, target, vps, selected, filter, extraEnv = {}) {
  const job = new Date().toISOString();
  Object.assign(state, { running: true, job, command, target, viewports: vps.map(v => v.key), current: null, index: 0, labels: selected, startedAt: job, finishedAt: null, exitCode: null, stopped: false, log: [] });
  broadcast('state', publicState());
  const finish = () => {
    child = null;
    Object.assign(state, { running: false, current: null, finishedAt: new Date().toISOString() });
    broadcast('state', publicState());
    broadcast('runs', { target });
  };
  const next = i => {
    if (i >= vps.length || state.stopped) return finish();
    const vp = vps[i];
    const args = ['run.js', command, target, vp.spec];
    if (filter) args.push(filter);
    const before = command === 'test' ? history.latestRunId(runDirOf(target, vp.key)) : null;
    const started = new Date().toISOString();
    Object.assign(state, { current: vp.key, index: i });
    broadcast('state', publicState());
    const lines = [`> node ${args.join(' ')}`];
    pushLog(lines[0]);
    child = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...extraEnv, UI_RUN: '1', FORCE_COLOR: '0' }, windowsHide: true });
    const out = d => { const t = d.toString(); lines.push(t.replace(/\r?\n$/, '')); pushLog(t); };
    child.stdout.on('data', out);
    child.stderr.on('data', out);
    child.on('close', code => {
      const after = command === 'test' ? history.latestRunId(runDirOf(target, vp.key)) : null;
      const exitCode = code === null ? 1 : code;
      const runId = after && after !== before ? after : null;
      lines.push(state.stopped ? 'stopped' : `exit code: ${code}`);
      let log = null;
      try { log = history.writeLog(history.logRel(target, vp.key, command, runId, started), lines.join('\n')); } catch (e) {}
      history.append({ job, command, target, viewport: vp.key, filter, scenarios: selected.length, startedAt: started, finishedAt: new Date().toISOString(), exitCode, stopped: state.stopped, runId, approvedRun: extraEnv.APPROVE_RUN || null, log });
      state.exitCode = Math.max(state.exitCode || 0, exitCode);
      pushLog(`exit code: ${code}`);
      broadcast('runs', { target });
      next(i + 1);
    });
  };
  next(0);
}

function stopRun() {
  if (!state.running) return;
  state.stopped = true;
  broadcast('state', publicState());
  if (!child) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

function sendJson(res, code, data) {
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function serveFile(res, baseDir, relPath) {
  const base = path.resolve(baseDir);
  const file = path.resolve(base, '.' + path.sep + decodeURIComponent(relPath).replace(/\\/g, '/'));
  if (file !== base && !file.startsWith(base + path.sep)) {
    res.writeHead(403); res.end(); return;
  }
  fs.stat(file, (err, st) => {
    if (err) { res.writeHead(404); res.end(); return; }
    const target = st.isDirectory() ? path.join(file, 'index.html') : file;
    fs.readFile(target, (e, data) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  try {
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return serveFile(res, path.join(ROOT, 'ui'), 'index.html');
    if (req.method === 'GET' && p === '/api/meta') {
      const envs = Object.entries(ENVIRONMENTS).map(([name, base]) => ({ name, base, scenarios: loadScenarios(name), sets: listSets(name) }));
      const presets = Object.values(PRESETS).map(p => parseViewport(`${p.type}:${p.width}x${p.height}`));
      return sendJson(res, 200, { envs, presets, types: TYPES });
    }
    if (req.method === 'GET' && p === '/api/state') return sendJson(res, 200, { ...publicState(), log: state.log });
    if (req.method === 'GET' && p === '/api/runs') {
      const target = url.searchParams.get('target');
      if (!ENVIRONMENTS[target]) return sendJson(res, 400, { error: 'unknown target' });
      const size = Math.min(Math.max(Number(url.searchParams.get('size')) || 10, 1), 200);
      const page = Number(url.searchParams.get('page')) || 1;
      return sendJson(res, 200, { ...listRows(target, page, size), sets: listSets(target) });
    }
    if (req.method === 'GET' && p === '/api/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'POST' && p === '/api/run') {
      if (state.running) return sendJson(res, 409, { error: 'run in progress' });
      const { command, target, viewports, viewport, labels } = await readBody(req);
      const specs = [...new Set(Array.isArray(viewports) ? viewports : [viewport])];
      const vps = specs.map(parseViewport);
      if (!COMMANDS.includes(command) || !ENVIRONMENTS[target] || !vps.length || vps.some(v => !v)) return sendJson(res, 400, { error: 'bad command, target or viewport' });
      const chk = checkRun(command, target, vps, labels);
      if (chk.error) return sendJson(res, 400, chk);
      startRun(command, target, vps, chk.selected, chk.filter);
      return sendJson(res, 200, publicState());
    }
    if (req.method === 'POST' && p === '/api/approve') {
      if (state.running) return sendJson(res, 409, { error: 'run in progress' });
      const { target, viewport, runId } = await readBody(req);
      const chk = approveTarget(target, viewport, runId);
      if (chk.error) return sendJson(res, 400, chk);
      const all = loadScenarios(target).map(s => s.label);
      const labels = chk.labels.filter(l => all.includes(l));
      const filter = labels.length === all.length ? null : `^(${labels.map(escapeRe).join('|')})$`;
      startRun('approve', target, [chk.vp], labels, filter, { APPROVE_RUN: runId });
      return sendJson(res, 200, publicState());
    }
    if (req.method === 'POST' && p === '/api/stop') {
      stopRun();
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p === '/api/settings') return sendJson(res, 200, { ...settings.load(), keepOptions: settings.KEEP_OPTIONS });
    if (req.method === 'POST' && p === '/api/settings') {
      if (state.running) return sendJson(res, 409, { error: 'run in progress' });
      const { keepTestImages } = await readBody(req);
      if (!settings.KEEP_OPTIONS.includes(keepTestImages)) return sendJson(res, 400, { error: 'bad keepTestImages' });
      const saved = settings.save({ keepTestImages });
      const pruned = pruneAll(saved.keepTestImages);
      if (pruned.runs) pushLog(`prune: ${pruned.runs} run(s) | ${mb(pruned.bytes)} | keep: ${saved.keepTestImages}`);
      for (const t of Object.keys(ENVIRONMENTS)) broadcast('runs', { target: t });
      return sendJson(res, 200, { ...saved, pruned });
    }
    if (req.method === 'POST' && p === '/api/log/clear') {
      state.log = [];
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p.startsWith('/run-html/')) {
      const m = /^\/run-html\/([^/]+)\/(desktop|mobile)\/(\d{2,5}x\d{2,5})\/(\d{8}-\d{6})$/.exec(p);
      const vp = m && parseViewport(`${m[2]}:${m[3]}`);
      if (!m || !ENVIRONMENTS[m[1]] || !vp) return sendJson(res, 400, { error: 'bad run' });
      const key = [m[1], ...vp.key.split('/')];
      const runDir = path.join(ROOT, 'backstop_data', 'bitmaps_test', ...key, m[4]);
      const refDir = path.join(ROOT, 'backstop_data', 'bitmaps_reference', ...key);
      if (fs.existsSync(path.join(runDir, 'report.json')) && !hasImages(runDir)) { res.writeHead(410, { 'Content-Type': MIME['.txt'] }); return res.end('images removed'); }
      if (!writeRunHtml(runDir, refDir)) return sendJson(res, 404, { error: 'run not found' });
      res.writeHead(302, { Location: `/data/bitmaps_test/${key.join('/')}/${m[4]}/${HTML_DIR}/index.html` });
      return res.end();
    }
    if (req.method === 'GET' && p.startsWith('/data/')) return serveFile(res, path.join(ROOT, 'backstop_data'), p.slice('/data/'.length));
    if (req.method === 'GET' && p.startsWith('/reports/')) return serveFile(res, path.join(ROOT, 'reports'), p.slice('/reports/'.length));
    res.writeHead(404); res.end();
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  const addr = `http://${HOST}:${PORT}`;
  console.log(`ui: ${addr}`);
  if (process.platform === 'win32' && !process.env.UI_NO_OPEN) {
    spawn('cmd', ['/c', 'start', '', addr], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
  }
});

process.on('SIGINT', () => { stopRun(); process.exit(0); });
