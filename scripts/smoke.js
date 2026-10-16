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
const PASTED_SVG = '<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">' +
  '<rect id="Pasted Rect" width="40" height="40" fill="#1FC8B5"/></svg>';
const OUTPUT = process.env.SMOKE_OUTPUT || fse.mkdtempSync(path.join(os.tmpdir(), 'animator-smoke-'));
const STARTUP_TIMEOUT_MS = 120 * 1000;
const SETTLE_MS = 8 * 1000;

// Renderer messages that are expected noise rather than failures.
// Thrown on purpose to check that uncaught errors reach the user as a notice.
const EXPECTED_ERROR = 'smoke test: deliberate uncaught error';

const IGNORED_ERRORS = [
  /Electron Security Warning/,
  /DevTools/,
  new RegExp(EXPECTED_ERROR),
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function closeApp (app) {
  const pid = app.process().pid;
  await Promise.race([app.close().catch (() => {}), sleep(10 * 1000)]);
  try {
    // Make sure nothing outlives the run (a stuck main process would keep plumbing's port busy).
    process.kill(pid, 'SIGKILL');
  } catch (exception) {
    // Already exited.
  }
}

// Glass and Timeline are <webview>s inside the Creator window; resolves once both have loaded (or on timeout).
// Checked from the main process: the Creator page has Node integration, which breaks Playwright's in-page evaluation.
async function waitForWebviews (app) {
  const listWebviews = () => app.evaluate(({webContents}) => webContents.getAllWebContents()
    .filter((contents) => contents.getType() === 'webview')
    .map((contents) => ({url: contents.getURL(), loading: contents.isLoading(), crashed: contents.isCrashed()})));
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let webviews = await listWebviews();
  while (!(webviews.length >= 2 && webviews.every((webview) => !webview.loading))) {
    if (Date.now() > deadline) {
      return {ok: false, webviews};
    }
    await sleep(1000);
    webviews = await listWebviews();
  }
  return {ok: true, webviews, listWebviews};
}

async function checkStartScreen (env, launchOptions, errors) {
  log.hat('checking the start screen (no project folder)');
  const app = await electron.launch({...launchOptions, env, timeout: STARTUP_TIMEOUT_MS});
  try {
    const window = await app.firstWindow({timeout: STARTUP_TIMEOUT_MS});
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;
    let visible = false;
    while (!visible && Date.now() < deadline) {
      // Checked through the main process: the page's Node integration breaks Playwright's in-page evaluation.
      visible = await app.evaluate(({BrowserWindow}) => {
        const [creatorWindow] = BrowserWindow.getAllWindows();
        return creatorWindow
          ? creatorWindow.webContents.executeJavaScript('!!document.getElementById("start-screen")')
          : false;
      });
      if (!visible) {
        await sleep(1000);
      }
    }
    if (!visible) {
      errors.push('[smoke] the start screen did not appear when no project folder was given');
      return;
    }
    await sleep(1500);
    const screenshot = path.join(OUTPUT, 'start-screen.png');
    await window.screenshot({path: screenshot});
    log.hat(`start screen screenshot: ${screenshot}`);

    // "New project…": answer the native save dialog with a fresh folder, click the button, and expect the editor to
    // open a newly created project there.
    const newProject = path.join(fse.mkdtempSync(path.join(os.tmpdir(), 'animator-smoke-new-')), 'My Project');
    await app.evaluate(({dialog}, filePath) => {
      dialog.showSaveDialog = async () => ({canceled: false, filePath});
    }, newProject);
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
      'document.getElementById("start-screen-new").click()'));
    const opened = await waitForWebviews(app);
    if (!opened.ok) {
      errors.push(`[smoke] "New project" did not open the editor: ${JSON.stringify(opened.webviews)}`);
      return;
    }
    const created = fse.existsSync(path.join(newProject, 'code', 'main', 'code.js'));
    if (!created) {
      errors.push(`[smoke] "New project" did not create project files in ${newProject}`);
      return;
    }
    const npmrc = path.join(newProject, '.npmrc');
    if (fse.existsSync(npmrc) && /reservoir\.haiku\.ai/.test(fse.readFileSync(npmrc, 'utf8'))) {
      errors.push('[smoke] the new project\'s .npmrc still points @haiku packages at Haiku\'s dead registry');
      return;
    }
    log.log('new project created and opened from the start screen');
  } catch (exception) {
    errors.push(`[smoke] start screen: ${exception.stack || exception.message}`);
  } finally {
    await closeApp(app);
  }
}

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

  // 1. Without a project folder the app must come up on the start screen. (Own plumbing port, so a lingering
  //    helper process from this run can't collide with the next launch.)
  await checkStartScreen(
    {...env, HAIKU_PROJECT_FOLDER: '', HAIKU_PLUMBING_PORT: String(Number(env.HAIKU_PLUMBING_PORT) + 1)},
    launchOptions,
    errors,
  );

  // 2. With a project folder the editor opens it directly.
  const app = await electron.launch({...launchOptions, env, timeout: STARTUP_TIMEOUT_MS});
  app.process().stdout.on('data', (chunk) => mainLog.push(chunk.toString()));
  app.process().stderr.on('data', (chunk) => mainLog.push(chunk.toString()));
  app.process().on('exit', (code) => mainLog.push(`[smoke] electron exited with ${code}\n`));

  const watchPage = (page, name) => {
    page.on('pageerror', (error) => {
      if (!IGNORED_ERRORS.some((re) => re.test(error.message))) {
        errors.push(`[${name}] uncaught: ${error.stack || error.message}`);
      }
    });
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

    const opened = await waitForWebviews(app);
    if (!opened.ok) {
      throw new Error(`Glass/Timeline webviews did not load in time: ${JSON.stringify(opened.webviews)}`);
    }
    const {listWebviews} = opened;
    let {webviews} = opened;
    await sleep(SETTLE_MS);

    const screenshot = path.join(OUTPUT, 'creator.png');
    await window.screenshot({path: screenshot});
    log.hat(`screenshot: ${screenshot}`);

    // Export button opens the local Export modal.
    const runInCreator = (code) => app.evaluate(({BrowserWindow}, js) => {
      const [creatorWindow] = BrowserWindow.getAllWindows().filter((browserWindow) => browserWindow.isVisible());
      return creatorWindow.webContents.executeJavaScript(js);
    }, code);
    await runInCreator('document.getElementById("export").click()');
    await sleep(1000);
    if (await runInCreator('!!document.getElementById("export-modal")')) {
      await window.screenshot({path: path.join(OUTPUT, 'export-modal.png')});
      log.log('export modal opened');
      const clipboardBefore = await app.evaluate(({clipboard}) => clipboard.readText());
      await runInCreator('Array.from(document.querySelectorAll("#export-modal button")).find((b) => b.textContent === "Copy").click()');
      const copied = await app.evaluate(({clipboard}) => clipboard.readText());
      await app.evaluate(({clipboard}, text) => clipboard.writeText(text), clipboardBefore);
      if (copied.includes('npm install')) {
        log.log('export modal copied the install command');
      } else {
        errors.push(`[smoke] the export modal Copy button did not write to the clipboard (got ${JSON.stringify(copied)})`);
      }
      await runInCreator('Array.from(document.querySelectorAll("#export-modal button")).find((b) => b.textContent === "Done").click()');
    } else {
      errors.push('[smoke] the Export button did not open the export modal');
    }

    // An uncaught error in the editor is shown to the user as a notice (local error reporting, nothing is sent).
    await runInCreator(`setTimeout(() => { throw new Error(${JSON.stringify(EXPECTED_ERROR)}); })`);
    let errorNoticeShown = false;
    for (let waited = 0; waited < 10000 && !errorNoticeShown; waited += 500) {
      await sleep(500);
      errorNoticeShown = await runInCreator(`document.body.innerText.includes(${JSON.stringify(EXPECTED_ERROR)})`);
    }
    if (errorNoticeShown) {
      log.log('uncaught error shown as a notice');
    } else {
      errors.push('[smoke] an uncaught error in Creator did not show up as a notice');
    }

    // Edit > Paste with SVG markup on the system clipboard (e.g. Figma "Copy as SVG") adds it to the stage.
    const previousClipboard = await app.evaluate(({clipboard, Menu}, svg) => {
      const text = clipboard.readText();
      clipboard.writeText(svg);
      const findItem = (items) => {
        for (const item of items) {
          if (item.label === 'Paste') {
            return item;
          }
          const found = item.submenu && findItem(item.submenu.items);
          if (found) {
            return found;
          }
        }
      };
      findItem(Menu.getApplicationMenu().items).click();
      return text;
    }, PASTED_SVG);
    const pastedFile = path.join(project, 'designs', 'Pasted 1.svg');
    const mainCode = path.join(project, 'code', 'main', 'code.js');
    let pasted = false;
    for (let waited = 0; waited < 20000 && !pasted; waited += 500) {
      await sleep(500);
      pasted = fse.existsSync(pastedFile) && fse.readFileSync(mainCode, 'utf8').includes('Pasted 1.svg');
    }
    await app.evaluate(({clipboard}, text) => clipboard.writeText(text), previousClipboard);
    if (pasted) {
      await window.screenshot({path: path.join(OUTPUT, 'pasted-svg.png')});
      log.log('pasted SVG from the clipboard onto the stage');
    } else {
      errors.push('[smoke] pasting SVG from the clipboard did not add it to the stage');
    }

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

    const identity = await app.evaluate(({app: electronApp, BrowserWindow}) => ({
      name: electronApp.getName(),
      titles: BrowserWindow.getAllWindows().map((browserWindow) => browserWindow.getTitle()),
    }));
    log.log(`app identity: ${JSON.stringify(identity)}`);

    webviews = await listWebviews();
    if (webviews.some((webview) => webview.crashed)) {
      errors.push(`[smoke] a webview crashed: ${JSON.stringify(webviews)}`);
    }
    log.log(`webviews: ${JSON.stringify(webviews)}`);
  } catch (exception) {
    errors.push(`[smoke] ${exception.stack || exception.message}`);
  } finally {
    await closeApp(app);
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
