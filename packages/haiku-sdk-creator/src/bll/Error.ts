import {shouldEmitErrors} from 'haiku-common/lib/environments';
import {basename} from 'path';
import {crashReportFork} from '../dal/Carbonite';
import {MaybeAsync} from '../envoy';
import EnvoyHandler from '../envoy/EnvoyHandler';

export const ERROR_CHANNEL = 'error';

const UPLOAD_INTERVAL = 10;

export interface CrashMetadata {
  zipPath: string;
  uniqueId: string;
  finalUrl: string;
}

export interface SentryExtraData {
  carbonite?: string;
  projectName?: string;
  projectPath?: string;
  organizationName?: string;
}

export interface SentryCallbackData {
  extra?: SentryExtraData;
  exception?: {
    values?: {
      value?: string;
    }[];
    [index: number]: {
      value?: string;
    };
  };
  culprit?: string;
}

const getErrorMetadata = (data: SentryCallbackData) => ({
  message: (data.exception && data.exception[0] && data.exception[0].value) || 'Unknown',
  culprit: data.culprit,
});

// Returns true iff a culprit is from a local component file.
export const isUserlandCulprit = (culprit: string) => culprit && basename(culprit) === 'code.js';

export class SentryReporter {
  /**
   * An ErrorHandler instance that should be attached to a SentryReporter instance as soon as it's ready.
   * Because ErrorHandler instances will be resolved asynchronously in webviews, we typically won't have a handle
   * on the envoy handler at construction-time for this class.
   */
  envoy?: ErrorHandler;

  /**
   * Project snapshots for crash reports are disabled; only the local error notice is emitted.
   */
  freezeInCarbonite (data: SentryCallbackData, emit = true): string|undefined {
    if (this.envoy) {
      Promise.resolve(this.envoy.crashReport(emit, data));
    }
    return undefined;
  }

  /**
   * Sentry callback for Node and JS clients. If an error handler is bound, attach a carbonite URL (if appropriate)
   * and emit.
   */
  callback (data: SentryCallbackData, emit = true): SentryCallbackData {
    if (!this.envoy) {
      return data;
    }

    if (!data.extra) {
      data.extra = {};
    }

    if (data.extra.projectPath && shouldEmitErrors()) {
      this.freezeInCarbonite(data, emit);
    } else {
      Promise.resolve(this.envoy.crashReport(emit, data));
    }

    return data;
  }
}

export class ErrorHandler extends EnvoyHandler {
  private lastUploadTime: number;

  get shouldSendCrashReport () {
    return !this.lastUploadTime || Date.now() >= UPLOAD_INTERVAL * 60000 + this.lastUploadTime;
  }

  clearLastUploadTime (): MaybeAsync<void> {
    this.lastUploadTime = undefined;
  }

  crashReport (
    emit: boolean,
    data: SentryCallbackData,
    projectPath?: string,
    zipName?: string,
    zipPath?: string,
    uniqueId?: string,
    finalUrl?: string,
  ): MaybeAsync<void> {
    if (projectPath && this.shouldSendCrashReport) {
      this.lastUploadTime = Date.now();

      crashReportFork(projectPath, zipName, zipPath, finalUrl);
      if (emit) {
        this.server.emit(ERROR_CHANNEL, {
          payload: {uniqueId, ...getErrorMetadata(data)},
          name: `${ERROR_CHANNEL}:error`,
        });
      }

      return;
    }

    if (emit) {
      this.server.emit(ERROR_CHANNEL, {
        payload: getErrorMetadata(data),
        name: `${ERROR_CHANNEL}:error`,
      });
    }
  }
}
