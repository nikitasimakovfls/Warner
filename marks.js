const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'reports', 'marks.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}; } catch (e) { return {}; }
}

function list(target) {
  return new Set(load()[target] || []);
}

function set(target, key, marked) {
  const all = load();
  const keys = new Set(all[target] || []);
  if (marked) keys.add(key); else keys.delete(key);
  if (keys.size) all[target] = [...keys].sort(); else delete all[target];
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  fs.renameSync(tmp, FILE);
  return marked;
}

module.exports = { list, set, FILE };
