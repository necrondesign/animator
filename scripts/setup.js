const cp = require('child_process');

const log = require('./helpers/log');
const runFlakyCommand = require('./helpers/runFlakyCommand');

const processOptions = {cwd: global.process.cwd(), stdio: 'inherit'};

runFlakyCommand(() => {
  cp.execSync('yarn install', processOptions);
  log.hat('installed dependencies');
}, 'mono yarn install', 10);
