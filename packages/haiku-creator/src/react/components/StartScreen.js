import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as React from 'react';
import Palette from 'haiku-ui-common/lib/Palette';
import {ATTRIBUTION, PRODUCT_NAME} from 'haiku-common/lib/branding';

import {dialogs} from 'haiku-ui-common/lib/electron/bridge';

const RECENT_PROJECTS_KEY = 'motion-side:recent-projects';
const MAX_RECENT_PROJECTS = 10;

/**
 * Recently opened project folders, most recent first. Kept in the Creator window's localStorage, which Electron
 * persists in the app's user-data directory.
 */
export const getRecentProjects = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_PROJECTS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((entry) => typeof entry === 'string') : [];
  } catch (exception) {
    return [];
  }
};

const saveRecentProjects = (folders) => {
  try {
    window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(folders.slice(0, MAX_RECENT_PROJECTS)));
  } catch (exception) {
    // Storage unavailable; recents are a convenience only.
  }
};

export const rememberRecentProject = (folder) => {
  saveRecentProjects([folder, ...getRecentProjects().filter((entry) => entry !== folder)]);
};

const forgetRecentProject = (folder) => {
  saveRecentProjects(getRecentProjects().filter((entry) => entry !== folder));
};

const isEmptyOrMissingDirectory = (folder) => {
  if (!fs.existsSync(folder)) {
    return true;
  }
  return fs.statSync(folder).isDirectory() && fs.readdirSync(folder).length === 0;
};

const defaultProjectsDirectory = () => path.join(os.homedir(), 'Documents', PRODUCT_NAME);

const STYLES = {
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.COAL,
    color: Palette.ROCK,
    userSelect: 'none',
    zIndex: 5,
  },
  panel: {
    width: 560,
    maxWidth: '90%',
  },
  title: {
    fontSize: 44,
    fontWeight: 700,
    color: Palette.SUNSTONE,
    margin: 0,
  },
  subtitle: {
    fontSize: 15,
    color: Palette.ROCK,
    margin: '8px 0 32px',
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginBottom: 36,
  },
  primaryButton: {
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    color: Palette.SUNSTONE,
    backgroundColor: Palette.LIGHT_BLUE,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    color: Palette.ROCK,
    backgroundColor: 'transparent',
    border: `1px solid ${Palette.DARK_ROCK}`,
    borderRadius: 4,
    cursor: 'pointer',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Palette.DARK_ROCK,
    marginBottom: 8,
  },
  recentList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: 4,
    cursor: 'pointer',
    backgroundColor: Palette.GRAY,
    marginBottom: 6,
  },
  recentItemMissing: {
    cursor: 'default',
    opacity: 0.5,
  },
  recentName: {
    fontSize: 14,
    color: Palette.SUNSTONE,
  },
  recentPath: {
    fontSize: 11,
    color: Palette.DARK_ROCK,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 440,
  },
  forgetButton: {
    background: 'none',
    border: 'none',
    color: Palette.DARK_ROCK,
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 4px',
  },
  emptyRecents: {
    fontSize: 13,
    color: Palette.DARK_ROCK,
  },
  attribution: {
    marginTop: 40,
    fontSize: 11,
    color: Palette.DARK_ROCK,
  },
};

/**
 * Asks for a new project folder (it must not exist yet, or be empty) and creates it.
 * Resolves with the folder, or null if the user cancelled. Rejects with a user-facing message.
 */
export const chooseNewProjectFolder = () => dialogs.showSaveDialog({
  title: 'Create a new project',
  buttonLabel: 'Create',
  nameFieldLabel: 'Project name:',
  defaultPath: path.join(defaultProjectsDirectory(), 'Untitled'),
  properties: ['createDirectory'],
}).then(({canceled, filePath}) => {
  if (canceled || !filePath) {
    return null;
  }
  if (!isEmptyOrMissingDirectory(filePath)) {
    throw new Error(`"${filePath}" already exists and is not an empty folder. Choose another name.`);
  }
  try {
    fs.mkdirSync(filePath, {recursive: true});
  } catch (exception) {
    throw new Error(`Could not create "${filePath}": ${exception.message}`, {cause: exception});
  }
  return filePath;
});

/**
 * Asks for an existing project folder. Resolves with the folder, or null if the user cancelled.
 */
export const chooseExistingProjectFolder = () => dialogs.showOpenDialog({
  title: 'Open a project folder',
  buttonLabel: 'Open',
  properties: ['openDirectory', 'showHiddenFiles'],
}).then(({canceled, filePaths}) => (canceled || !filePaths || !filePaths.length ? null : filePaths[0]));

/**
 * Shown when no project is open: create a project, open an existing project folder, or reopen a recent one.
 * Replaces Haiku's cloud project dashboard.
 */
export default class StartScreen extends React.Component {
  constructor (props) {
    super(props);
    this.state = {recentProjects: getRecentProjects()};
  }

  refreshRecents () {
    this.setState({recentProjects: getRecentProjects()});
  }

  showError (message) {
    this.props.createNotice({
      type: 'error',
      title: 'Unable to open project',
      message,
      closeText: 'Okay',
      lightScheme: true,
    });
  }

  createProject = () => {
    chooseNewProjectFolder().then((folder) => {
      if (folder) {
        this.props.onOpenProject(folder);
      }
    }, (error) => this.showError(error.message));
  };

  openProject = () => {
    chooseExistingProjectFolder().then((folder) => {
      if (folder) {
        this.props.onOpenProject(folder);
      }
    });
  };

  openRecent (folder) {
    if (!fs.existsSync(folder)) {
      this.showError(`"${folder}" no longer exists. It was removed from the recent projects.`);
      forgetRecentProject(folder);
      this.refreshRecents();
      return;
    }
    this.props.onOpenProject(folder);
  }

  forget (event, folder) {
    event.stopPropagation();
    forgetRecentProject(folder);
    this.refreshRecents();
  }

  renderRecents () {
    const {recentProjects} = this.state;
    if (recentProjects.length === 0) {
      return <div style={STYLES.emptyRecents}>No recent projects yet.</div>;
    }

    return (
      <ul style={STYLES.recentList}>
        {recentProjects.map((folder) => {
          const exists = fs.existsSync(folder);
          return (
            <li
              key={folder}
              id={`start-screen-recent-${path.basename(folder)}`}
              style={{...STYLES.recentItem, ...(exists ? {} : STYLES.recentItemMissing)}}
              title={exists ? folder : `${folder} (not found)`}
              onClick={() => this.openRecent(folder)}
            >
              <div>
                <div style={STYLES.recentName}>{path.basename(folder)}</div>
                <div style={STYLES.recentPath}>{folder.replace(os.homedir(), '~')}</div>
              </div>
              <button
                style={STYLES.forgetButton}
                title="Remove from recent projects"
                onClick={(event) => this.forget(event, folder)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  render () {
    return (
      <div id="start-screen" style={STYLES.screen}>
        <div style={STYLES.panel}>
          <h1 style={STYLES.title}>{PRODUCT_NAME}</h1>
          <p style={STYLES.subtitle}>Interactive animations for the web.</p>
          <div style={STYLES.actions}>
            <button id="start-screen-new" style={STYLES.primaryButton} onClick={this.createProject}>
              New project…
            </button>
            <button id="start-screen-open" style={STYLES.secondaryButton} onClick={this.openProject}>
              Open project…
            </button>
          </div>
          <div style={STYLES.sectionTitle}>Recent projects</div>
          {this.renderRecents()}
          <div style={STYLES.attribution}>{ATTRIBUTION}</div>
        </div>
      </div>
    );
  }
}
