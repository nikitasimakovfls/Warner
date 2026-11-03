const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'reports', 'settings.json');
const DEFAULTS = { keepTestImages: 10 };
const KEEP_OPTIONS = [3, 5, 10, 20, 50, 0];

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (e) { return { ...DEFAULTS }; }
}

function save(patch) {
  const next = { ...load(), ...patch };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { load, save, KEEP_OPTIONS, DEFAULTS };
