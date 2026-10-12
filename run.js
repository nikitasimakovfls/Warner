const ENVIRONMENTS = require('./environments');

const COMMANDS = {
  reference: 'reference',
  test: 'test',
  approve: 'approve',
  report: 'openReport',
  summary: null
};

const [command, target, filter] = process.argv.slice(2);
const usage = `Usage: npm run <${Object.keys(COMMANDS).join('|')}> <${Object.keys(ENVIRONMENTS).join('|')}> [filter]`;

if (!(command in COMMANDS) || !ENVIRONMENTS[target]) {
  console.error(usage);
  process.exit(1);
}

process.env.TARGET = target;
const config = require('./backstop.config.js');
const backstop = require('backstopjs');

console.log(`target: ${target} | ${ENVIRONMENTS[target]}${filter ? ` | filter: ${filter}` : ''}`);

const { build } = require('./summary');

const writeSummary = () => {
  const r = build(target, ENVIRONMENTS[target], config, filter);
  if (!r) {
    console.log('summary: no test runs');
    return;
  }
  console.log(`summary: ${r.total - r.failed}/${r.total} passed`);
  console.log(`summary md: ${r.md}`);
  console.log(`summary txt: ${r.txt}`);
};

if (command === 'summary') {
  writeSummary();
} else {
  backstop(COMMANDS[command], { config, filter })
    .then(() => { process.exitCode = 0; })
    .catch(() => { process.exitCode = 1; })
    .finally(() => { if (command === 'test') writeSummary(); });
}
