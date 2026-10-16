import * as electron from 'electron';
import setup from './dom';

electron.ipcRenderer.on('haiku', (_, haiku) => {

  if (haiku.dotenv) {
    Object.assign(global.process.env, haiku.dotenv);
  }

  setup(haiku);
});
