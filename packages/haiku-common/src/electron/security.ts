import {app, Session, shell, WebContents} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';

// The editor's renderers have Node integration, so they must only ever show the app's own pages: remote content
// in such a renderer could run arbitrary code on the user's machine. These guards keep it that way.

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

let appRoot: string | undefined;
const getAppRoot = () => {
  if (appRoot === undefined) {
    appRoot = fs.realpathSync(app.getAppPath());
  }
  return appRoot;
};

/**
 * True for file:// URLs of HTML pages shipped inside the app (Creator, Glass, Timeline, the bakery oven).
 */
export const isAppPage = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') {
      return false;
    }
    const file = fs.realpathSync(fileURLToPath(parsed));
    return file.startsWith(getAppRoot() + path.sep) && file.endsWith('.html');
  } catch (exception) {
    return false;
  }
};

/**
 * Opens web and mail links in the user's browser or mail app; anything else is ignored.
 */
export const openExternalSafely = (url: string) => {
  try {
    if (EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) {
      shell.openExternal(url);
    }
  } catch (exception) {
    // Not a valid URL: nothing to open.
  }
};

const denyAllPermissions = (session: Session) => {
  session.setPermissionRequestHandler((_, __, callback) => callback(false));
};

/**
 * Applies the navigation, window-opening, <webview> and permission guards to a newly created WebContents.
 * `webviewPreferences` are forced onto every <webview> the page attaches (the app's own Glass and Timeline only).
 */
export const secureWebContents = (contents: WebContents, webviewPreferences: Electron.WebPreferences) => {
  // App windows and their <webview>s show app pages; leave internal contents (e.g. DevTools) alone.
  const type = contents.getType();
  if (type !== 'window' && type !== 'webview') {
    return;
  }

  denyAllPermissions(contents.session);

  const guardNavigation = (event: Electron.Event, url: string) => {
    if (!isAppPage(url)) {
      event.preventDefault();
      openExternalSafely(url);
    }
  };
  contents.on('will-navigate', guardNavigation);
  contents.on('will-redirect', guardNavigation);

  contents.setWindowOpenHandler(({url}) => {
    openExternalSafely(url);
    return {action: 'deny'};
  });

  contents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!isAppPage(params.src)) {
      event.preventDefault();
      return;
    }
    delete webPreferences.preload;
    Object.assign(webPreferences, webviewPreferences);
  });
};
