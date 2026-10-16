import * as path from 'path';

import * as qs from 'qs';
import {app, BrowserWindow, ipcMain} from 'electron';

import TopMenu from 'haiku-common/lib/electron/TopMenu';

/**
 * This file is bypassed when loaded in the full app.
 * This is only used as a harness for developin on glass standalone.
 */

if (!app) {
  throw new Error('You can only run electron.js from an electron process');
}

const params = {
  email: 'dev@localhost',
  folder: process.env.HAIKU_PROJECT_FOLDER,
  plumbing: process.env.HAIKU_PLUMBING_URL,
};

if (process.env.MOCK_ENVOY) {
  params.envoy = {mock: true};
}

const query = qs.stringify(params);

const url = `file://${path.join(__dirname, '..', 'index.html')}?${query}`;

const {registerBridgeHandlers} = require('haiku-ui-common/lib/electron/bridge');
registerBridgeHandlers(ipcMain);

let mainWindow = null;

app.on('window-all-closed', () => {
  app.quit();
});

function createWindow () {
  mainWindow = new BrowserWindow({
    webPreferences: {
      // Legacy renderer semantics (Node integration, no isolation); see index.js in the repo root.
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  mainWindow.maximize();
  mainWindow.loadURL(url);

  if (process.env.DEV === '1' || process.env.DEV === 'timeline') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const topmenu = new TopMenu({
    send: (name, data) => {
      mainWindow.webContents.send('relay', {name, data, from: 'electron'});
    },
  });

  topmenu.create({
    projectsList: [],
    isSaving: false,
    isProjectOpen: true,
    subComponents: [],
    undoState: {canUndo: false, canRedo: false},
  });

  ipcMain.on('topmenu:update', (ipcEvent, nextTopmenuOptions) => {
    topmenu.update(nextTopmenuOptions);
  });
}

app.on('ready', createWindow);
