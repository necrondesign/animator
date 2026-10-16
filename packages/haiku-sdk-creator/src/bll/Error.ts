import {MaybeAsync} from '../envoy';
import EnvoyHandler from '../envoy/EnvoyHandler';

export const ERROR_CHANNEL = 'error';

/**
 * What Creator shows for an uncaught error. Errors are only displayed locally; nothing is sent anywhere.
 */
export interface ErrorReport {
  message: string;
  stack?: string;
}

interface ErrorTarget {
  reportError(report: ErrorReport): MaybeAsync<void>;
}

const MAX_PENDING_REPORTS = 10;

export const describeError = (error: any): ErrorReport => {
  if (error && typeof error === 'object') {
    return {
      message: String(error.message || error.toString()),
      stack: typeof error.stack === 'string' ? error.stack : undefined,
    };
  }

  return {message: error === undefined || error === null || error === '' ? 'Unknown error' : String(error)};
};

/**
 * Collects uncaught errors of the plumbing process and forwards them to the ERROR_CHANNEL handler, which tells Creator
 * to show a notice. (Creator shows its own window errors directly, and those of the Glass/Timeline webviews via their
 * console output.) Errors raised before the envoy handler is attached are queued.
 */
export class ErrorReporter {
  private target?: ErrorTarget;
  private pending: ErrorReport[] = [];

  set envoy (target: ErrorTarget) {
    this.target = target;
    const pending = this.pending;
    this.pending = [];
    pending.forEach((report) => this.send(report));
  }

  report (error: any) {
    const report = describeError(error);
    if (this.target) {
      this.send(report);
    } else if (this.pending.length < MAX_PENDING_REPORTS) {
      this.pending.push(report);
    }
  }

  private send(report: ErrorReport) {
    Promise.resolve(this.target.reportError(report)).catch (() => {
      // The error channel is gone (e.g. while shutting down); there is nobody left to tell.
    });
  }
}

export class ErrorHandler extends EnvoyHandler {
  reportError (report: ErrorReport): MaybeAsync<void>  {
    this.server.emit(ERROR_CHANNEL, {
      payload: report,
      name: `${ERROR_CHANNEL}:error`,
    });
  }
}
