import * as EventEmitter from 'events';
import * as path from 'path';
import {parse, pathToFileURL} from 'url';
import {inherits} from 'util';

import {BrowserWindow, app, clipboard, ipcMain, net, protocol, systemPreferences} from 'electron';
import * as qs from 'qs';

import TopMenu from 'haiku-common/lib/electron/TopMenu';
import {CLIPBOARD_READ_TEXT, CLIPBOARD_WRITE_TEXT} from 'haiku-ui-common/lib/electron/clipboard';
import {PRODUCT_NAME, PRODUCT_PROTOCOL} from 'haiku-common/lib/branding';
import * as ensureTrailingSlash from 'haiku-serialization/src/utils/ensureTrailingSlash';
import * as logger from 'haiku-serialization/src/utils/LoggerInstance';
import {isMac} from 'haiku-common/lib/environments/os';
import _ from 'lodash';
import { writeJSON } from 'fs-extra';

if (!app) {
  throw new Error('You can only run electron.js from an electron process');
}

app.setName(PRODUCT_NAME);
app.setAsDefaultProtocolClient(PRODUCT_PROTOCOL);

const PROJECT_PROTOCOL = 'web+haikuroot';

// Haiku main window
let browserWindow = null;

const handleUrl = (url) => {
  if (!browserWindow) {
    logger.warn(`[creator] unable to handle custom protocol URL ${url}; browserWindow not ready`);
    return;
  }
  logger.info(`[creator] handling custom protocol URL ${url}`);
  const parsedUrl = parse(url);
  browserWindow.webContents.send(`open-url:${parsedUrl.host}`, parsedUrl.pathname, qs.parse(parsedUrl.query));
};

// Disable "Start Dictation" and "Emoji & Symbols" menu items on MAC
if (isMac()) {
  systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
  systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);
}

app.on('login', (event, webContents, request, authInfo, authenticate) => {
  // We are currently not equipped to authenticate requests that are intercepted by a proxy but require login
  // credentials when we encounter interference at this stage. When this functionality is added:
  //   - `event.preventDefault()` will prevent the default behavior of Electron blocking the request.
  //   - Invoking the callback like `authenticate(username, password)` should allow the authenticated-proxied request
  //     through.
  // For now, log the authorization info so we can at least see what's going on.
  logger.warn('[unexpected proxy interference]', authInfo);
});

// See bottom
function CreatorElectron () {
  EventEmitter.apply(this);
}
inherits(CreatorElectron, EventEmitter);
const creator = new CreatorElectron();

const appUrl = 'file://' + path.join(__dirname, '..', 'index.html');

// Plumbing starts up this process, and it uses HAIKU_ENV to forward to us data about
// how it has been set up, e.g. what ports it is using for websocket server, envoy, etc.
// This is sent into the DOM part of the app at did-finish load; see below.
const haiku = global.process.env.HAIKU_ENV
  ? JSON.parse(global.process.env.HAIKU_ENV)
  : {};



app.on('window-all-closed', () => {
  app.quit();
});

if (!haiku.plumbing) {
  haiku.plumbing = {};
}

if (!haiku.plumbing.url) {
  if (global.process.env.NODE_ENV !== 'test' && !global.process.env.HAIKU_PLUMBING_PORT) {
    throw new Error(`Oops! You must define a HAIKU_PLUMBING_PORT env var!`);
  }

  // tslint:disable-next-line:max-line-length
  haiku.plumbing.url = `http://${global.process.env.HAIKU_PLUMBING_HOST || '0.0.0.0'}:${global.process.env.HAIKU_PLUMBING_PORT}/?token=${process.env.HAIKU_WS_SECURITY_TOKEN}`;
}

function createWindow () {
  // A folder given at startup (HAIKU_PROJECT_FOLDER, as `yarn start` scenarios and tests use) opens directly;
  // otherwise the Creator window shows the start screen. Handed to the renderer in the 'haiku' message.
  haiku.folder = global.process.env.HAIKU_PROJECT_FOLDER || undefined;

  logger.view = 'main';

  browserWindow = new BrowserWindow({
    title: PRODUCT_NAME,
    show: false, // Don't show the window until we are ready-to-show (see below)
    titleBarStyle: 'hiddenInset',
    minWidth: 700,
    minHeight: 650,
    backgroundColor: '#343f41',
    webPreferences: {
      // Legacy renderer semantics; see LEGACY_RENDERER_PREFERENCES in index.js.
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      // Glass (stage) and Timeline are hosted as <webview>s inside the Creator window.
      webviewTag: true,
    },
  });

  const topmenu = new TopMenu(browserWindow.webContents);

  const topmenuOptions = {
    projectsList: [],
    isSaving: false,
    isProjectOpen: false,
    subComponents: [],
    undoState: {canUndo: false, canRedo: false},
  };

  topmenu.create(topmenuOptions);

  // Renderers (Creator, Glass, Timeline) reach the clipboard through these handlers.
  ipcMain.handle(CLIPBOARD_READ_TEXT, () => clipboard.readText());
  ipcMain.handle(CLIPBOARD_WRITE_TEXT, (_, text) => clipboard.writeText(String(text)));

  ipcMain.on('topmenu:update', (_, nextTopmenuOptions) => {
    topmenu.update(nextTopmenuOptions);
  });

  ipcMain.on('restart', () => {
    app.relaunch();
    browserWindow.close();
  });

  // Emitted by Creator during project bootstrapping, this ensures image URLs like web+haikuroot://assets/designs/…
  // display correctly in thumbnails.
  ipcMain.on('protocol:register', (_, projectPath) => {
    if (protocol.isProtocolHandled(PROJECT_PROTOCOL)) {
      protocol.unhandle(PROJECT_PROTOCOL);
    }
    protocol.handle(PROJECT_PROTOCOL, (request) => {
      const relpath = decodeURIComponent(request.url.substr(`${PROJECT_PROTOCOL}://`.length).split(/[?#]/)[0]);
      return net.fetch(pathToFileURL(ensureTrailingSlash(projectPath) + relpath).toString());
    });
  });

  // We also need to be able to tear down the protocol when a project is shut down.
  ipcMain.on('protocol:unregister', () => {
    if (protocol.isProtocolHandled(PROJECT_PROTOCOL)) {
      protocol.unhandle(PROJECT_PROTOCOL);
    }
  });

  browserWindow.setTitle(PRODUCT_NAME);
  browserWindow.maximize();
  browserWindow.loadURL(appUrl);

  if (process.env.DEV === '1' || process.env.DEV === 'creator') {
    browserWindow.webContents.openDevTools();
  }

  // Sending our haiku configuration into the view so it can correctly set up
  // its own websocket connections to our plumbing server, etc.
  browserWindow.webContents.on('did-finish-load', () => {
    browserWindow.webContents.send('haiku', haiku);
    if (global.process.env.HAIKU_INITIAL_URL) {
      handleUrl(global.process.env.HAIKU_INITIAL_URL);
      delete global.process.env.HAIKU_INITIAL_URL;
    }
  });

  browserWindow.on('closed', () => {
    browserWindow = null;
  });

  browserWindow.on('ready-to-show', () => {
    browserWindow.show();
  });
}

// Transmit motion-side://foo/bar?baz=bat as the "open-url:foo" event with arguments [_, "/bar", {"baz": "bat"}]
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleUrl(url);
});

// On Windows and Linux only one instance may run at a time; a second launch focuses the first one and forwards
// PRODUCT_PROTOCOL:// URLs. (macOS keeps apps single-instance itself and delivers URLs through 'open-url'.)
if (!isMac() && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    logger.info(`[creator] Received command line on second instance ${commandLine}`);

    // Handle the custom protocol on second instance (Windows and Linux pass it as an argument)
    for (const arg of commandLine) {
      if (arg.startsWith(`${PRODUCT_PROTOCOL}://`)) {
        handleUrl(arg);
        break;
      }
    }

    if (browserWindow) {
      if (browserWindow.isMinimized()) {
        browserWindow.restore();
      }
      browserWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

// Hacky: When plumbing launches inside an Electron process it expects an EventEmitter-like
// object as the export, so we expose this here even though it doesn't do much
module.exports = {
  default: creator,
};
