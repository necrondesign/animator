import {ErrorReporter} from 'haiku-sdk-creator/lib/bll/Error';
import * as logger from 'haiku-serialization/src/utils/LoggerInstance';

// Uncaught errors in this process are logged and shown as notices in Creator; they are never sent anywhere.
// The process keeps running, so the user can save their work and restart.
global.errorReporter = new ErrorReporter();

const handleUncaught = (kind) => (error) => {
  logger.error(`[plumbing] ${kind}`);
  logger.error(error && error.stack ? error.stack : error);
  global.errorReporter.report(error);
};

// Under test, let errors crash the run instead of hanging it.
if (process.env.NODE_ENV !== 'test') {
  process.on('uncaughtException', handleUncaught('uncaught exception'));
  process.on('unhandledRejection', handleUncaught('unhandled promise rejection'));
}
