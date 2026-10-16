import * as fs from 'fs';
import * as path from 'path';
import {PRODUCT_NAME} from 'haiku-common/lib/branding';
import {UserSettings} from 'haiku-sdk-creator/lib/bll/User';

// Opening a project runs its code (code.js, expressions, event handlers) with full access to the computer, so a project
// from someone else is as dangerous as running their program. Like "workspace trust" in code editors, a project opens
// only after the user has trusted it once; projects created here are trusted automatically.

export const TRUSTED_PROJECTS_SETTING = UserSettings.TrustedProjects;

const OPEN_BUTTON = 0;

export const normalizeProjectFolder = (folder) => {
  try {
    return fs.realpathSync(folder);
  } catch (exception) {
    return path.resolve(folder);
  }
};

/**
 * Resolves with the list of trusted project folders. Before this feature existed, every recent project had already
 * been opened (and its code run), so on first use the recent projects become the trusted list.
 */
const loadTrustedProjects = (user, recentProjects) => Promise.resolve(user.getConfig(TRUSTED_PROJECTS_SETTING))
  .then((trusted) => {
    if (Array.isArray(trusted)) {
      return trusted;
    }
    const seeded = recentProjects.map(normalizeProjectFolder);
    user.setConfig(TRUSTED_PROJECTS_SETTING, seeded);
    return seeded;
  });

export const trustProject = (user, trusted, folder) => {
  const normalized = normalizeProjectFolder(folder);
  if (!trusted.includes(normalized)) {
    user.setConfig(TRUSTED_PROJECTS_SETTING, trusted.concat(normalized));
  }
};

/**
 * Resolves with true if the project may be opened: it is already trusted, it was just created (`isNew`), or the user
 * chose to trust it in the warning dialog. Without a settings store (`user`), the user is asked every time.
 */
export const ensureProjectIsTrusted = ({folder, isNew = false, user, recentProjects = [], showMessageBox}) => {
  const trustedList = user ? loadTrustedProjects(user, recentProjects) : Promise.resolve([]);

  return trustedList.then((trusted) => {
    if (isNew || trusted.includes(normalizeProjectFolder(folder))) {
      if (isNew && user) {
        trustProject(user, trusted, folder);
      }
      return true;
    }

    return showMessageBox({
      type: 'warning',
      buttons: ['Open Project', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: `Do you trust the project "${path.basename(folder)}"?`,
      detail: `Opening a project runs its code (its components, expressions and event handlers) with full access to ` +
        `your computer, like running a program. Only open projects you made yourself or got from someone you ` +
        `trust.\n\n${PRODUCT_NAME} remembers your choice for this folder.\n\n${folder}`,
    }).then(({response}) => {
      if (response !== OPEN_BUTTON) {
        return false;
      }
      if (user) {
        trustProject(user, trusted, folder);
      }
      return true;
    });
  });
};
