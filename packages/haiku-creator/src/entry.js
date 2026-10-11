import * as electron from 'electron';
import setup from './dom';
import {SentryReporter} from 'haiku-sdk-creator/lib/bll/Error';
import {DISABLED_ERROR_REPORTING_DSN, shouldEmitErrors} from 'haiku-common/lib/environments';

electron.ipcRenderer.on('haiku', (_, haiku) => {

  if (haiku.dotenv) {
    Object.assign(global.process.env, haiku.dotenv);
  }

  global.sentryReporter = new SentryReporter();
  window.Raven.config(DISABLED_ERROR_REPORTING_DSN, {
    environment: process.env.NODE_ENV,
    release: process.env.HAIKU_RELEASE_VERSION,
    dataCallback: global.sentryReporter.callback.bind(global.sentryReporter),
    shouldSendCallback: shouldEmitErrors,
  });

  window.Raven.install();

  try {
    setup(haiku);
  } catch (e) {
    Raven.captureException(e, () => {
      throw e;
    });
  }
});
