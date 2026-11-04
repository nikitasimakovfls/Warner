const fs = require('fs');
const path = require('path');
const { PRESETS, TYPES, parseViewport, viewportLabel, typeForWidth } = require('./viewports');

const FILE = path.join(__dirname, 'reports', 'viewports.json');
const REF_ROOT = path.join(__dirname, 'backstop_data', 'bitmaps_reference');
const NAME_RE = /^[\p{L}\p{N} ._()+\-]{1,40}$/u;
const presetSpecs = () => Object.values(PRESETS).map(p => `${p.type}:${p.width}x${p.height}`);

function seed() {
  const specs = new Set();
  if (fs.existsSync(REF_ROOT)) {
    for (const env of fs.readdirSync(REF_ROOT)) {
      for (const type of TYPES) {
        const dir = path.join(REF_ROOT, env, type);
        if (!fs.existsSync(dir)) continue;
        for (const size of fs.readdirSync(dir)) {
          const vp = parseViewport(`${type}:${size}`);
          if (vp) specs.add(vp.spec);
        }
      }
    }
  }
  return [...specs].filter(s => !presetSpecs().includes(s)).sort().map(spec => {
    const vp = parseViewport(spec);
    return { name: `${viewportLabel(vp.type)} ${vp.size}`, spec };
  });
}

function save(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
  return list;
}

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')).filter(v => v && v.name && parseViewport(v.spec)); } catch (e) {}
  return save(seed());
}

function add(name, width, height) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(n)) return { error: 'name: 1-40 letters, digits, spaces, . _ ( ) + -' };
  const w = Number(width), h = Number(height);
  if (!Number.isInteger(w) || !Number.isInteger(h)) return { error: 'width and height must be integers' };
  const vp = parseViewport(`${typeForWidth(w)}:${w}x${h}`);
  if (!vp) return { error: 'width 200-7680, height 200-4320' };
  const list = load();
  if (presetSpecs().includes(vp.spec)) return { error: `${vp.size} is a preset` };
  if (list.some(v => v.name.toLowerCase() === n.toLowerCase())) return { error: `name already used: ${n}` };
  const same = list.find(v => v.spec === vp.spec);
  if (same) return { error: `${vp.size} already added as "${same.name}"` };
  list.push({ name: n, spec: vp.spec });
  save(list);
  return { list, spec: vp.spec };
}

function remove(specs) {
  const drop = new Set(specs || []);
  return save(load().filter(v => !drop.has(v.spec)));
}

module.exports = { load, add, remove, FILE };
