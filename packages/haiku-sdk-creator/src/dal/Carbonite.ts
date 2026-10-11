// @ts-ignore
import * as logger from 'haiku-serialization/src/utils/LoggerInstance';

/**
 * Crash report uploads ("Carbonite") are disabled: this fork never zips or uploads user
 * projects. The function keeps its former signature so callers keep compiling.
 */
export const crashReportFork = (
  projectPath: string,
  zipName?: string,
  zipPath?: string,
  finalUrl?: string,
) => {
  logger.info('[carbonite] crash report upload is disabled; nothing was sent');
};
