import {FILE_PATHS} from '@haiku/sdk-client';
import {Registry} from '../dal/Registry';
import EnvoyHandler from '../envoy/EnvoyHandler';

export const USER_CHANNEL = 'user';

export enum UserSettings {
  DefaultTimeDisplayMode = 'defaultTimeDisplayMode',
  TimeDisplayModes = 'timeDisplayModes',
  FigmaToken = 'figmaToken',
  // #FIXME: capitalize after conflict resolution.
  DoNotDisplayConfirmGroupPopoup = 'doNotDisplayConfirmGroupPopoup',
}

/**
 * Local editor settings (kept in ~/.haiku/registry.json). There are no user accounts.
 */
export class UserHandler extends EnvoyHandler {
  protected registry = new Registry(FILE_PATHS.HAIKU_HOME);
}
