import * as logger from 'haiku-serialization/src/utils/LoggerInstance';

// <webview> 'console-message' levels: 0 log, 1 info, 2 warning, 3 error.
const LEVEL_LOG = 0;
const LEVEL_WARNING = 2;
const LEVEL_ERROR = 3;

const NOTICE_PREFIX = '[notice]';

// console.error output that is diagnostics for developers rather than a problem the user can act on.
const DEVELOPER_NOISE = [
  /^Warning: /, // React development warnings (React logs them via console.error)
  /^Failed to load resource/,
  /^\[Deprecation\]/,
];

/**
 * Routes console output from the Glass/Timeline webviews: `[notice] ...` logs become info notices, errors become
 * error notices, and warnings only go to the log. (Haiku showed warnings to users as "Error" notices.)
 */
export const handleWebviewConsoleMessage = (event, createNotice, source) => {
  const {level, message} = event;

  if (level === LEVEL_LOG && message.startsWith(NOTICE_PREFIX)) {
    createNotice({type: 'info', title: 'Notice', message: message.slice(NOTICE_PREFIX.length).trim()});
    return;
  }

  if (level === LEVEL_WARNING) {
    logger.warn(`[${source}] ${message}`);
    return;
  }

  if (level === LEVEL_ERROR) {
    if (DEVELOPER_NOISE.some((pattern) => pattern.test(message))) {
      logger.warn(`[${source}] ${message}`);
      return;
    }
    logger.error(`[${source}] ${message}`);
    createNotice({type: 'error', title: 'Error', message});
  }
};
