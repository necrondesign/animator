// End-to-end smoke test: launches the real Electron app on a copy of a test project, waits for the editor
// (Creator window with the Glass and Timeline webviews) to come up, saves a screenshot and fails on crashes or
// uncaught renderer errors. Run after `yarn compile-all`.
//
//   yarn smoke                      # uses packages/haiku-glass/test/projects/simple
//   SMOKE_PROJECT=<dir> yarn smoke  # any project folder (it is copied, never modified)
//   SMOKE_OUTPUT=<dir> yarn smoke   # where to write screenshots and logs (default: a temp dir)
//   SMOKE_EXECUTABLE=<path> yarn smoke  # test a packaged app binary instead of the source checkout

const fse = require('fs-extra');
const os = require('os');
const path = require('path');
const {_electron: electron} = require('playwright-core');

const log = require('./helpers/log');

const ROOT = path.join(__dirname, '..');
const SOURCE_PROJECT = process.env.SMOKE_PROJECT || path.join(ROOT, 'packages/haiku-glass/test/projects/simple');
// The bakery needs bytecode with saved metadata (metadata.folder), as written by a save in the editor.
const BAKERY_PROJECT = path.join(ROOT, 'packages/haiku-glass/test/projects/mc-anim1');
const OUTPUT = process.env.SMOKE_OUTPUT || fse.mkdtempSync(path.join(os.tmpdir(), 'animator-smoke-'));
const STARTUP_TIMEOUT_MS = 120 * 1000;
const SETTLE_MS = 8 * 1000;

// Renderer messages that are expected noise rather than failures.
const IGNORED_ERRORS = [
  /Electron Security Warning/,
  /DevTools/,
];

async function main () {
  fse.mkdirpSync(OUTPUT);
  const project = path.join(fse.mkdtempSync(path.join(os.tmpdir(), 'animator-smoke-project-')), 'project');
  fse.copySync(SOURCE_PROJECT, project);
  const home = fse.mkdtempSync(path.join(os.tmpdir(), 'animator-smoke-home-'));

  const env = {
    ...process.env,
    NODE_ENV: 'development',
    HOME: home,
    USERPROFILE: home,
    HAIKU_PROJECT_FOLDER: project,
    HAIKU_PLUMBING_PORT: process.env.HAIKU_PLUMBING_PORT || '1024',
    HAIKU_RELEASE_ENVIRONMENT: 'development',
    HAIKU_RELEASE_BRANCH: 'master',
    HAIKU_RELEASE_VERSION: require('../package.json').version,
  };

  const errors = [];
  const mainLog = [];

  log.hat(`launching Electron on ${project}`);
  const launchOptions = process.env.SMOKE_EXECUTABLE
    ? {executablePath: process.env.SMOKE_EXECUTABLE, args: []}
    : {args: [ROOT], cwd: ROOT};
  if (process.env.SMOKE_EXECUTABLE) {
    // Packaged builds run in production mode.
    delete env.NODE_ENV;
  }
  const app = await electron.launch({...launchOptions, env, timeout: STARTUP_TIMEOUT_MS});
  app.process().stdout.on('data', (chunk) => mainLog.push(chunk.toString()));
  app.process().stderr.on('data', (chunk) => mainLog.push(chunk.toString()));
  app.process().on('exit', (code) => mainLog.push(`[smoke] electron exited with ${code}\n`));

  const watchPage = (page, name) => {
    page.on('pageerror', (error) => errors.push(`[${name}] uncaught: ${error.stack || error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !IGNORED_ERRORS.some((re) => re.test(message.text()))) {
        errors.push(`[${name}] console.error: ${message.text()}`);
      }
    });
  };

  try {
    const window = await app.firstWindow({timeout: STARTUP_TIMEOUT_MS});
    watchPage(window, 'creator');
    await window.waitForLoadState('domcontentloaded');

    // Glass and Timeline are <webview>s inside the Creator window; wait until both have loaded. This is checked from
    // the main process: the Creator page has Node integration, whose globals break Playwright's in-page evaluation.
    const listWebviews = () => app.evaluate(({webContents}) => webContents.getAllWebContents()
      .filter((contents) => contents.getType() === 'webview')
      .map((contents) => ({url: contents.getURL(), loading: contents.isLoading(), crashed: contents.isCrashed()})));
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    let webviews = await listWebviews();
    while (!(webviews.length >= 2 && webviews.every((webview) => !webview.loading))) {
      if (Date.now() > deadline) {
        throw new Error(`Glass/Timeline webviews did not load in time: ${JSON.stringify(webviews)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      webviews = await listWebviews();
    }
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

    const screenshot = path.join(OUTPUT, 'creator.png');
    await window.screenshot({path: screenshot});
    log.hat(`screenshot: ${screenshot}`);

    // Export pipeline: render one still frame through the hidden "bakery" window (used for GIF/MP4/PNG export).
    const bakeryProject = path.join(fse.mkdtempSync(path.join(os.tmpdir(), 'animator-smoke-bakery-')), 'project');
    fse.copySync(BAKERY_PROJECT, bakeryProject);
    const bytecodePath = path.join(bakeryProject, 'code', 'main', 'code.js');
    const stillPath = path.join(bakeryProject, 'still.png');
    const bakeryModule = process.env.SMOKE_EXECUTABLE
      ? path.join(path.dirname(process.env.SMOKE_EXECUTABLE), '..', 'Resources', 'app.asar', 'node_modules',
        'haiku-creator', 'lib', 'bakery', 'electron.js')
      : path.join(ROOT, 'packages', 'haiku-creator', 'lib', 'bakery', 'electron.js');
    await app.evaluate(({}, {modulePath, recipe}) => new Promise((resolve, reject) => {
      const bake = process.mainModule.require(modulePath).default;
      const timer = setTimeout(() => reject(new Error('bakery timed out')), 60 * 1000);
      bake(recipe, () => {
        clearTimeout(timer);
        resolve();
      });
    }), {modulePath: bakeryModule, recipe: {abspath: bytecodePath, framerate: 1, width: 550, height: 400, still: true,
      sha1: 'smoke'}});
    const stillSize = fse.existsSync(stillPath) ? fse.statSync(stillPath).size : 0;
    if (stillSize === 0) {
      errors.push(`[smoke] bakery produced no still frame at ${stillPath}`);
    } else {
      fse.copySync(stillPath, path.join(OUTPUT, 'still.png'));
      log.log(`bakery still frame: ${stillSize} bytes`);
    }

    webviews = await listWebviews();
    if (webviews.some((webview) => webview.crashed)) {
      errors.push(`[smoke] a webview crashed: ${JSON.stringify(webviews)}`);
    }
    log.log(`webviews: ${JSON.stringify(webviews)}`);
  } catch (exception) {
    errors.push(`[smoke] ${exception.stack || exception.message}`);
  } finally {
    const pid = app.process().pid;
    await Promise.race([app.close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 10 * 1000))]);
    try {
      // Make sure nothing outlives the run (a stuck main process would keep plumbing's port busy).
      process.kill(pid, 'SIGKILL');
    } catch (exception) {
      // Already exited.
    }
    fse.writeFileSync(path.join(OUTPUT, 'main-process.log'), mainLog.join(''));
  }

  if (errors.length > 0) {
    log.err(`smoke test failed with ${errors.length} error(s):`);
    errors.forEach((error) => log.err(error));
    log.err(`main process log: ${path.join(OUTPUT, 'main-process.log')}`);
    process.exit(1);
  }

  log.hat('smoke test passed');
}

main().catch((exception) => {
  log.err(exception.stack || exception.message);
  process.exit(1);
});
