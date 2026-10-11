const log = require('./log');

// Keep in sync with .nvmrc and "engines" in package.json.
const MIN_NODE_MAJOR = 24;

module.exports = () => {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < MIN_NODE_MAJOR) {
    log.warn(`WARNING: you are using Node ${process.version}. Node ${MIN_NODE_MAJOR} LTS or newer is required.`);
    log.warn(`  nvm install ${MIN_NODE_MAJOR} && nvm use ${MIN_NODE_MAJOR}   (or see .nvmrc)`);
  } else {
    log.hat(`Using Node ${process.version}`);
  }
};
