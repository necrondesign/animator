const cp = require('child_process');

const log = require('./log');

// Keep in sync with "packageManager" in package.json.
const YARN_VERSION = require('../../package.json').packageManager.replace(/^yarn@/, '');

module.exports = () => {
  let yarnVersion = null;
  try {
    yarnVersion = cp.execSync('yarn --version').toString().trim();
  } catch (exception) {
    log.warn('WARNING: yarn was not found. Enable it with `corepack enable` (ships with Node).');
    return;
  }
  if (yarnVersion !== YARN_VERSION) {
    log.warn(`WARNING: you are using yarn ${yarnVersion}. This repo expects yarn ${YARN_VERSION}.`);
    log.warn('  corepack enable   (picks up the version from "packageManager" in package.json)');
  } else {
    log.hat(`Using yarn ${YARN_VERSION}`);
  }
};
