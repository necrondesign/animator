import * as tape from 'tape';
import {handleWebviewConsoleMessage} from '@creator/react/components/webviewConsole';

const route = (level, message) => {
  const notices = [];
  handleWebviewConsoleMessage({level, message}, (notice) => notices.push(notice), 'test');
  return notices;
};

tape('webviewConsole: warnings are logged, not shown to the user', (t) => {
  t.deepEqual(route(2, '[haiku core] adding missing timelines object'), [], 'no notice for a warning');
  t.end();
});

tape('webviewConsole: errors become error notices', (t) => {
  t.deepEqual(
    route(3, 'TypeError: x is undefined'),
    [{type: 'error', title: 'Error', message: 'TypeError: x is undefined'}],
    'one error notice',
  );
  t.end();
});

tape('webviewConsole: developer noise logged via console.error is not shown', (t) => {
  t.deepEqual(route(3, 'Warning: Accessing PropTypes via the main React package is deprecated'), [], 'React warning');
  t.deepEqual(route(3, 'Failed to load resource: net::ERR_FILE_NOT_FOUND'), [], 'resource load failure');
  t.end();
});

tape('webviewConsole: [notice] logs become info notices', (t) => {
  t.deepEqual(
    route(0, '[notice] Component created'),
    [{type: 'info', title: 'Notice', message: 'Component created'}],
    'info notice without the prefix',
  );
  t.deepEqual(route(0, 'plain log line'), [], 'ordinary logs are ignored');
  t.end();
});
