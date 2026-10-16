import * as qs from 'qs';
import {app, BrowserWindow, ipcMain} from 'electron';
import * as path from 'path';
import TopMenu from 'haiku-common/lib/electron/TopMenu';
import * as logger from 'haiku-serialization/src/utils/LoggerInstance';

/**
 * This file is bypassed when loaded in the full app.
 * This is only used as a harness for developin on glass standalone.
 */

let url = `file://${path.join(__dirname, '..', 'index.html')}`;

const params = {
  email: 'dev@localhost',
  folder: process.env.HAIKU_PROJECT_FOLDER,
  plumbing: process.env.HAIKU_PLUMBING_URL,
};

if (process.env.MOCK_ENVOY) {
  params.envoy = {mock: true};
}

logger.info('[glass] launching window with params', params);

const query = qs.stringify(params);

url = `${url}?${query}`;

const {registerBridgeHandlers} = require('haiku-ui-common/lib/electron/bridge');
registerBridgeHandlers(ipcMain);

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Legacy renderer semantics (Node integration, no isolation); see index.js in the repo root.
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });
  mainWindow.loadURL(url);

  if (process.env.DEV === '1' || process.env.DEV === 'glass') {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
