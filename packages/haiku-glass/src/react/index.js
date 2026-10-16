import {ipcRenderer} from 'electron';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as qs from 'qs';
import * as Websocket from 'haiku-serialization/src/ws/Websocket';
import * as MockWebsocket from 'haiku-serialization/src/ws/MockWebsocket';
import Glass from './Glass';
import * as logger from 'haiku-serialization/src/utils/LoggerInstance';
import {fetchProjectConfigInfo} from '@haiku/sdk-client/lib/ProjectDefinitions';

// We are in a webview; use query string parameters for boot-up configuration
const search = (window.location.search || '').split('?')[1] || '';
const params = qs.parse(search, {plainObjects: true});
const config = Object.assign({}, params);
if (config.dotenv) {
  Object.assign(global.process.env, config.dotenv);
}

try {
  if (!config.folder) {
    throw new Error('A folder (the absolute path to the user project) is required');
  }

  function _fixPlumbingUrl (url) {
    return url.replace(/^http/, 'ws');
  }

  fetchProjectConfigInfo(config.folder, (err, userconfig) => {
    if (err) {
      throw err;
    }

    const websocket = (config.plumbing)
      ? new Websocket(_fixPlumbingUrl(config.plumbing), config.folder, 'controllee', 'glass', null, config.socket.token)
      : new MockWebsocket(ipcRenderer);

    window.isWebview = config.webview;

    ReactDOM.render(
      <Glass
        envoy={config.envoy}
        userconfig={userconfig}
        websocket={websocket}
        folder={config.folder}
        projectName={userconfig.project || 'untitled'}
      />,
      document.getElementById('root'),
    );
  });
} catch (e) {
  // Creator shows console errors of this webview as notices (see webviewConsole.js).
  console.error(e);
}
