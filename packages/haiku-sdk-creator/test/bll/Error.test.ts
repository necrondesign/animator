import {describeError, ErrorReport, ErrorReporter} from '@sdk-creator/bll/Error';
import * as tape from 'tape';

tape('describeError', (t) => {
  const error = new Error('boom');
  t.equal(describeError(error).message, 'boom', 'uses the error message');
  t.ok(describeError(error).stack.includes('boom'), 'keeps the stack');
  t.equal(describeError('plain text').message, 'plain text', 'accepts strings');
  t.equal(describeError(undefined).message, 'Unknown error', 'handles missing values');
  t.end();
});

tape('ErrorReporter queues reports until the error channel is attached', async (t) => {
  const reporter = new ErrorReporter();
  const received: ErrorReport[] = [];

  reporter.report(new Error('early'));
  t.equal(received.length, 0, 'nothing sent without a target');

  reporter.envoy = {reportError: (report) => {
    received.push(report);
  }};
  t.deepEqual(received.map((report) => report.message), ['early'], 'queued report is flushed');

  reporter.report('late');
  t.deepEqual(received.map((report) => report.message), ['early', 'late'], 'later reports go straight through');

  reporter.envoy = {reportError: () => Promise.reject(new Error('channel closed'))};
  reporter.report('ignored');
  await new Promise((resolve) => setTimeout(resolve, 10));
  t.pass('a failing error channel does not cause an unhandled rejection');
  t.end();
});
