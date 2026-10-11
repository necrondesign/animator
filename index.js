const path = require('path');
const cp = require('child_process');
const os = require('os');

if (!global.process.env.NODE_ENV || global.process.env.NODE_ENV === 'production') {
  process.env.HAIKU_GLASS_URL_MODE = 'distro';
  process.env.HAIKU_TIMELINE_URL_MODE = 'distro';
  process.env.HAIKU_INTERPRETER_URL_MODE = 'distro';
  if (process.env.HAIKU_APP_LAUNCH_CLI === '1') {
    process.env.HAIKU_APP_SKIP_LOG = '1';
  }
  try {
    // Optional release-time configuration (env defaults); absent in source checkouts.
    require('./config');
  } catch (exception) {
    if (exception.code !== 'MODULE_NOT_FOUND') {
      throw exception;
    }
  }
}

// On Windows and Linux, custom protocol handler is passed as argument
const haikuURI = process.argv.find((arg) => arg.startsWith('haiku://'));

if (process.env.HAIKU_APP_LAUNCH_CLI === '1') {
  require('@haiku/cli');
} else {
  const {app, dialog} = require('electron');

  // The editor's renderers (Creator window, and the Glass/Timeline <webview>s inside it) were written for
  // Electron 2 defaults: Node integration, no context isolation, no sandbox, and the `remote` module.
  // Keep those semantics explicitly until the renderers are moved to IPC + preload scripts.
  const remoteMain = require('@electron/remote/main');
  remoteMain.initialize();

  const LEGACY_RENDERER_PREFERENCES = {
    nodeIntegration: true,
    contextIsolation: false,
    sandbox: false,
  };

  app.on('web-contents-created', (_, webContents) => {
    remoteMain.enable(webContents);

    webContents.on('will-attach-webview', (__, webPreferences) => {
      Object.assign(webPreferences, LEGACY_RENDERER_PREFERENCES);
    });
  });

  if (process.env.NODE_ENV === 'production' && os.platform() === 'darwin' && !app.isInApplicationsFolder()) {
    dialog.showErrorBox(
      'Move to Applications folder',
      'You cannot run Animator from the current folder. Please move Animator to the Applications folder and try again.',
    );
    global.process.exit(0);
  }

  app.once('open-url', (event, url) => {
    global.process.env.HAIKU_INITIAL_URL = url;
  });

  if (haikuURI) {
    global.process.env.HAIKU_INITIAL_URL = haikuURI;
  }

  const haikuHelperArgs = {stdio: 'inherit'};
  if (global.process.env.HAIKU_DEBUG) {
    haikuHelperArgs.execArgv = ['--inspect=9221'];
  }

  global.haikuHelper = cp.fork(path.join(__dirname, 'HaikuHelper'), haikuHelperArgs);
  global.haikuHelper.on('message', (data) => {
    if (!data || typeof data !== 'object' || !data.message) {
      return;
    }

    const {message} = data;
    switch (message) {
      case 'launchCreator':
        global.process.env.HAIKU_ENV = JSON.stringify(data.haiku);
        require('haiku-creator/lib/electron');
        break;
      case 'bakePngSequence':
        require('haiku-creator/lib/bakery/electron').default(
          data,
          () => {
            global.haikuHelper.send({type: 'bakePngSequenceComplete'});
          },
        );
        break;
    }
  });

  global.haikuHelper.on('exit', global.process.exit);
  global.process.on('exit', () => {
    haikuHelper.kill('SIGKILL');
  });
}
