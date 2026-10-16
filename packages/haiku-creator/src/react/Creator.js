import {shell, ipcRenderer, webFrame} from 'electron';
import {clipboard} from 'haiku-ui-common/lib/electron/clipboard';
import {devTools, dialogs} from 'haiku-ui-common/lib/electron/bridge';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {CSSTransition} from 'react-transition-group';
import * as lodash from 'lodash';
import * as EventEmitter from 'event-emitter';
import * as path from 'path';
import * as BaseModel from 'haiku-serialization/src/bll/BaseModel';
import * as Project from 'haiku-serialization/src/bll/Project';
import * as File from 'haiku-serialization/src/bll/File';
import * as Asset from 'haiku-serialization/src/bll/Asset';
import EventHandlerEditor from './components/EventHandlerEditor';
import StartScreen, {
  chooseExistingProjectFolder,
  chooseNewProjectFolder,
  getRecentProjects,
  rememberRecentProject,
} from './components/StartScreen';
import {ensureProjectIsTrusted} from './projectTrust';
import {ISSUES_URL, PRODUCT_NAME} from 'haiku-common/lib/branding';
import SideBar from './components/SideBar';
import Library from './components/library/Library';
import StateInspector from './components/StateInspector/StateInspector';
import SplitPanel from './components/SplitPanel';
import Stage from './components/Stage';
import Timeline from './components/Timeline';
import Toast from './components/notifications/Toast';
import Tour from './components/Tour/Tour';
import {DASH_STYLES} from './styles/dashShared';
import ProjectLoader from './components/ProjectLoader';
import EnvoyClient from 'haiku-sdk-creator/lib/envoy/EnvoyClient';
import {EXPORTER_CHANNEL, ExporterFormat} from 'haiku-sdk-creator/lib/exporter';
import {TOUR_CHANNEL} from 'haiku-sdk-creator/lib/tour';
import {SERVICES_CHANNEL} from 'haiku-sdk-creator/lib/services';
import {ERROR_CHANNEL, describeError} from 'haiku-sdk-creator/lib/bll/Error';
import {USER_CHANNEL} from 'haiku-sdk-creator/lib/bll/User';
import {
  InteractionMode,
  isPreviewMode,
} from 'haiku-ui-common/lib/interactionModes';
import Palette from 'haiku-ui-common/lib/Palette';
import * as requestElementCoordinates from 'haiku-serialization/src/utils/requestElementCoordinates';
import * as logger from 'haiku-serialization/src/utils/LoggerInstance';
import * as opn from 'opn';
import ConfirmGroupUngroupPopup from './components/Popups/ConfirmGroupUngroup';
import Globals from 'haiku-ui-common/lib/Globals';

// Useful debugging originator of calls in shared model code
process.env.HAIKU_SUBPROCESS = 'creator';

const pkg = require('./../../package.json');

const isNumeric = (n) => {
  return !isNaN(parseFloat(n)) && isFinite(n);
};

if (webFrame) {
  // Disable pinch-to-zoom of the whole UI.
  webFrame.setVisualZoomLevelLimits(1, 1);
}

const MENU_ACTION_DEBOUNCE_TIME = 100;
const MAX_VISIBLE_NOTICES = 5;
const NOTICE_RERENDER_INTERVAL_MS = 500;
const FIGMA_IMPORT_TIMEOUT = 1000 * 60 * 5; /* 5 minutes */

export default class Creator extends React.Component {
  constructor (props) {
    super(props);

    this.launchProject = this.launchProject.bind(this);
    this.removeNotice = this.removeNotice.bind(this);
    this.createNotice = this.createNotice.bind(this);
    this.renderNotice = this.renderNotice.bind(this);
    this.handleFindElementCoordinates = this.handleFindElementCoordinates.bind(this);
    this.handleFindWebviewCoordinates = this.handleFindWebviewCoordinates.bind(this);
    this.onTimelineMounted = this.onTimelineMounted.bind(this);
    this.onTimelineUnmounted = this.onTimelineUnmounted.bind(this);
    this.onNavigateToDashboard = this.onNavigateToDashboard.bind(this);
    this.setGlassInteractionToPreviewMode = this.setGlassInteractionToPreviewMode.bind(this);
    this.setGlassInteractionToEditMode = this.setGlassInteractionToEditMode.bind(this);
    this.setGlassInteractionToCodeEditorMode = this.setGlassInteractionToCodeEditorMode.bind(this);
    this.togglePreviewMode = this.togglePreviewMode.bind(this);
    this.tryToChangeCurrentActiveComponent = this.tryToChangeCurrentActiveComponent.bind(this);
    this.launchFolder = this.launchFolder.bind(this);
    this.switchActiveNav = this.switchActiveNav.bind(this);
    this.onLibraryDragEnd = this.onLibraryDragEnd.bind(this);
    this.onLibraryDragStart = this.onLibraryDragStart.bind(this);
    this.showEventHandlersEditor = this.showEventHandlersEditor.bind(this);
    this.handleShowEventHandlersEditor = this.handleShowEventHandlersEditor.bind(this);
    this.handleShowConfirmGroupPopup = this.handleShowConfirmGroupPopup.bind(this);
    this.hideConfirmGroupUngroupPopup = this.hideConfirmGroupUngroupPopup.bind(this);
    this.layout = new EventEmitter();
    // Keep tracks of not found identifiers and notice id
    this.identifiersNotFound = [];
    this.identifiersNotFoundNotice = undefined;

    this.debouncedForceUpdate = lodash.debounce(() => {
      this.forceUpdate();
    }, 100, {leading: false, trailing: true});

    // Stores creator widget state, so when we leave preview, it can be restored
    this.lastWidgetState = {activeNav: 'library', interactionMode: InteractionMode.GLASS_EDIT};

    this.state = {
      error: null,
      projectFolder: this.props.folder,
      projectObject: null,
      projectModel: null, // Instance of the Project model
      dashboardVisible: !this.props.folder,
      notices: [],
      softwareVersion: pkg.version,
      didPlumbingNoticeCrash: false,
      activeNav: 'library',
      doShowProjectLoader: false,
      projectLaunching: false,
      tearingDown: false,
      interactionMode: InteractionMode.GLASS_EDIT,
      artboardDimensions: null,
      servicesEnvoyClient: null,
      showEventHandlerEditor: false,
      eventHandlerEditorOptions: {},
      showConfirmGroupUngroupPopup: false,
      groupOrUngroup: 'group',
    };

    this.envoyOptions = {
      token: this.props.haiku.envoy.token,
      port: this.props.haiku.envoy.port,
      host: this.props.haiku.envoy.host,
      WebSocket: window.WebSocket,
    };

    // fileOptions is something of a misnomer, but we pass these into Project so they
    // can be forwarded to file. They're also used to configure the Project model itself.
    this.fileOptions = {};

    if (process.env.DEV === '1' || process.env.DEV === 'creator') {
      devTools.open();
    }

    // Uncaught errors and unhandled rejections in this window are shown as notices; they are never sent anywhere.
    const showUncaughtError = (error) => {
      this.createNotice({
        message: describeError(error).message,
        type: 'error',
        title: 'Oh no!',
        closeText: 'Okay',
        lightScheme: true,
      });
    };
    window.addEventListener('error', (event) => showUncaughtError(event.error || event.message));
    window.addEventListener('unhandledrejection', (event) => showUncaughtError(event.reason));

    document.addEventListener('mousemove', (nativeEvent) => {
      this._lastMouseX = nativeEvent.clientX;
      this._lastMouseY = nativeEvent.clientY;
    });
    document.addEventListener('selectionchange', () => {
      // Repress weird Select All behaviors that negatively affect drag and drop from Library.
      const selection = window.getSelection();
      if (selection.anchorNode && selection.anchorNode.className === 'react-draggable') {
        selection.removeAllRanges();
      }
    });
    document.addEventListener('drag', (nativeEvent) => {
      // When the drag ends, for some reason the position goes to 0, so hack this...
      if (nativeEvent.clientX > 0 && nativeEvent.clientY > 0) {
        this._lastMouseX = nativeEvent.clientX;
        this._lastMouseY = nativeEvent.clientY;
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (this.editor && this.state.showEventHandlerEditor) {
        const node = ReactDOM.findDOMNode(this.editor);
        const pnode = ReactDOM.findDOMNode(this.refs.stage);
        if (!node.contains(e.target) && pnode.contains(e.target)) {
          this.safelyHideEventHandlersEditor();
        }
      }
    });

    ipcRenderer.on('global-menu:open-dev-tools', lodash.debounce(() => {
      devTools.open();
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'timeline',
        name: 'global-menu:open-dev-tools',
      });
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'glass',
        name: 'global-menu:open-dev-tools',
      });
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:close-dev-tools', lodash.debounce(() => {
      devTools.closeIfFocused();
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'timeline',
        name: 'global-menu:close-dev-tools',
      });
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'glass',
        name: 'global-menu:close-dev-tools',
      });
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:open-finder', lodash.debounce(() => {
      logger.info(`[creator] global-menu:open-finder`);
      this.openFinder();
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:open-terminal', lodash.debounce(() => {
      logger.info(`[creator] global-menu:open-terminal`);
      this.openTerminal();
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:open-text-editor', lodash.debounce(() => {
      logger.info(`[creator] global-menu:open-text-editor`);
      this.openTextEditor();
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:set-active-component', lodash.debounce((ipcEvent, scenename) => {
      logger.info(`[creator] global-menu:set-active-component`);
      this.tryToChangeCurrentActiveComponent(scenename);
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:zoom-in', lodash.debounce(() => {
      logger.info(`[creator] global-menu:zoom-in`);
      // Timeline will send to Glass if it doesn't want to zoom
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'glass',
        name: 'global-menu:zoom-in',
      });
    }, 50, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:zoom-out', lodash.debounce(() => {
      // Timeline will send to Glass if it doesn't want to zoom
      logger.info(`[creator] global-menu:zoom-out`);
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'glass',
        name: 'global-menu:zoom-out',
      });
    }, 50, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:reset-viewport', lodash.debounce(() => {
      // Timeline will send to Glass if it doesn't want to zoom
      logger.info(`[creator] global-menu:reset-viewport`);
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'timeline',
        name: 'global-menu:reset-viewport',
      });
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:group', lodash.debounce(() => {
      // Timeline will send to Glass if it doesn't want to group
      logger.info(`[creator] global-menu:group`);
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'timeline',
        name: 'global-menu:group',
      });
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:ungroup', lodash.debounce(() => {
      // Timeline will send to Glass if it doesn't want to ungroup
      logger.info(`[creator] global-menu:ungroup`);
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'timeline',
        name: 'global-menu:ungroup',
      });
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:undo', lodash.debounce(() => {
      // Timeline will send to Glass if it doesn't want to undo
      logger.info(`[creator] global-menu:undo`);
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'timeline',
        name: 'global-menu:undo',
        time: Date.now(),
      });
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:redo', lodash.debounce(() => {
      // Timeline will send to Glass if it doesn't want to undo
      logger.info(`[creator] global-menu:redo`);
      this.props.websocket.send({
        type: 'relay',
        from: 'creator',
        view: 'timeline',
        name: 'global-menu:redo',
        time: Date.now(),
      });
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:copy', lodash.debounce(() => {
      // Only delegate copy if we don't have anything in selection
      if (!this.isTextSelected()) {
        logger.info(`[creator] global-menu:copy`);
        this.props.websocket.send({
          type: 'relay',
          from: 'creator',
          view: 'timeline',
          name: 'global-menu:copy',
        });
      } else {
        clipboard.writeText(window.getSelection().toString());
      }
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:cut', lodash.debounce(() => {
      // Only delegate cut if we don't have anything in selection
      if (!this.isTextSelected()) {
        logger.info(`[creator] global-menu:cut`);
        this.props.websocket.send({
          type: 'relay',
          from: 'creator',
          view: 'timeline',
          name: 'global-menu:cut',
        });
      }
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:selectAll', lodash.debounce(() => {
      // Only select all if we haven't activated a text element
      if (!this.isTextInputFocused()) {
        logger.info(`[creator] global-menu:selectAll`);
        this.props.websocket.send({
          type: 'relay',
          from: 'creator',
          view: 'timeline',
          name: 'global-menu:selectAll',
        });
      }
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:paste', lodash.debounce(() => {
      // Only paste if we haven't activated a text element
      if (!this.isTextInputFocused()) {
        logger.info(`[creator] global-menu:paste`);
        this.props.websocket.send({
          type: 'relay',
          from: 'creator',
          view: 'timeline',
          name: 'global-menu:paste',
        });
      }
    }, MENU_ACTION_DEBOUNCE_TIME, {leading: true, trailing: false}));

    ipcRenderer.on('global-menu:new-project', () => {
      chooseNewProjectFolder().then((folder) => this.switchToProjectFolder(folder, {isNew: true}), (error) => {
        this.createNotice({type: 'error', title: 'Unable to create project', message: error.message});
      });
    });

    ipcRenderer.on('global-menu:open-project', () => {
      chooseExistingProjectFolder().then((folder) => this.switchToProjectFolder(folder));
    });

    ipcRenderer.on('global-menu:preview', () => {
      this.togglePreviewMode();
    });

    window.addEventListener('dragover', (dragEvent) => {
      if (this.state.assetDragging) {
        return dragEvent.preventDefault();
      }

      Asset.preventDefaultDrag(dragEvent);
    }, false);

    window.addEventListener('blur', () => {
      Globals.allKeysUp();
    });

    window.addEventListener(
      'drop',
      (event) => {
        if (this.state.projectModel) {
          this.state.projectModel.linkExternalAssetOnDrop(event, (error) => {
            if (error) {
              this.setState({error});
            }
            this.forceUpdate();
          });
        }
      },
      false,
    );

    // Flexibly keep track of states in the various subviews as broadcasted to us.
    // TODO: Move to Envoy. Put here to avoid boiling the ocean on multi-component.
    // This is a dictionary of state changes broadcasted to us via the subviews.
    // Structure looks like this:
    // {
    //   some/folder: {
    //     someStatename: {
    //       creator: creatorStateValue,
    //       master: masterStateValue,
    //       ...
    //     }
    //   }
    // }
    // With such an object, we can track all registrars for some known state name.
    this._projectStates = {};

    if (process.env.NODE_ENV !== 'production') {
      // For debugging
      window.creator = this;
      window.view = this; // Easy to run same instruction in different tools
    }
  }

  isTextInputFocused () {
    const tagName = (
      document.activeElement &&
      document.activeElement.tagName &&
      document.activeElement.tagName.toLowerCase()
    );

    return (
      tagName && (
        tagName === 'input' ||
        tagName === 'textarea'
      )
    );
  }

  isTextSelected () {
    return window.getSelection().type === 'Range';
  }

  isCreatorExplicitlyFocused () {
    return document.hasFocus() && !this.isWebviewFocused();
  }

  isWebviewFocused () {
    return this.isTimelineFocused() || this.isGlassFocused();
  }

  isTimelineFocused () {
    const webview = this.getTimelineWebview();
    return webview && webview === document.activeElement;
  }

  isGlassFocused () {
    const webview = this.getGlassWebview();
    return webview && webview === document.activeElement;
  }

  getTimelineWebview () {
    return (
      this.refs &&
      this.refs.timeline &&
      this.refs.timeline.mount &&
      this.refs.timeline.mount.children &&
      this.refs.timeline.mount.children[0]
    );
  }

  getGlassWebview () {
    return (
      this.refs &&
      this.refs.stage &&
      this.refs.stage.mount &&
      this.refs.stage.mount.children &&
      this.refs.stage.mount.children[0]
    );
  }

  getActiveComponent () {
    return this.state.projectModel && this.state.projectModel.getCurrentActiveComponent();
  }

  openFinder () {
    if (this.state.projectModel) {
      try {
        logger.info('[creator] finder opening', shell.openPath(this.state.projectModel.getFolder()));
      } catch (exception) {
        logger.error(exception);
      }
    }
  }

  openTerminal () {
    if (this.state.projectModel) {
      try {
        logger.info('[creator] terminal opening', opn(this.state.projectModel.getFolder(), {app: 'terminal'}));
      } catch (exception) {
        logger.error(exception);
      }
    }
  }

  openTextEditor () {
    if (this.state.projectModel) {
      const relpath = this.state.projectModel.getCurrentActiveComponentRelpath();
      if (relpath) {
        this.openFileInTextEditor(
          path.join(this.state.projectModel.getFolder(), relpath),
        );
      }
    }
  }

  openFileInTextEditor (abspath) {
    const editorEnv = process.env.EDITOR;

    // TODO: App names are platform-specific; need to support Windows and Linux too
    let editorApp;
    if (typeof editorEnv !== 'string') {
      editorApp = 'textedit';
    }
    if (editorEnv.match(/subl/)) {
      editorApp = 'sublime text';
    }
    if (editorEnv.match(/vsc/)) {
      editorApp = 'visual studio code';
    }
    if (editorEnv.match(/code/)) {
      editorApp = 'visual studio code';
    }
    if (editorEnv.match(/visual/)) {
      editorApp = 'visual studio code';
    }
    if (editorEnv.match(/atom/)) {
      editorApp = 'atom';
    }
    if (editorEnv.match(/webstorm/)) {
      editorApp = 'webstorm';
    }
    // if (editorEnv.match(/vim/)) editorApp = 'vim' // TODO: open specific file?
    // if (editorEnv.match(/emacs/)) editorApp = 'emacs' // TODO: open specific file?
    if (!editorApp) {
      editorApp = 'textedit';
    }

    try {
      logger.info(`[creator] editor ${editorEnv || '?'}->${editorApp} opening`, opn(abspath, {app: editorApp}));
    } catch (exception) {
      logger.error(exception);
    }
  }

  componentDidMount () {
    this.props.websocket.on('broadcast', (message) => {
      switch (message.name) {
        case 'remote-model:receive-sync':
          BaseModel.receiveSync(message);
          break;

        case 'component:reload':
          if (this.getActiveComponent()) {
            this.getActiveComponent().moduleReplace(() => {});
          }
          break;

        case 'project-state-change':
          this.handleConnectedProjectModelStateChange(message);
          break;

        case 'dimensions-reset':
          this.setState({artboardDimensions: message.data});
          break;

        case 'show-event-handlers-editor':
          this.handleShowEventHandlersEditor(
            message.elid,
            message.opts,
            message.frame,
          );
          break;

        case 'show-confirm-group-popup':
          this.handleShowConfirmGroupPopup(message.groupOrUngroup);
          break;

        case 'assets-changed':
          File.cache.clear();
          break;
      }
    });

    this.envoyClient = new EnvoyClient(this.envoyOptions);

    this.envoyClient.get(EXPORTER_CHANNEL).then((exporterChannel) => {
      this.envoyExporter = exporterChannel;
      ipcRenderer.on('global-menu:save-as', (_, extension, request) => {
        this.exportAs(extension, request.framerate);
      });
    });

    this.envoyClient.get(ERROR_CHANNEL).then(
      (error) => {
        // Errors reported by the plumbing process (see haiku-plumbing/src/errorReporting.js).
        this.error = error;
        this.error.on(`${ERROR_CHANNEL}:error`, ({message}) => {
          this.createNotice({
            message,
            type: 'error',
            title: 'Error',
          });
        });
      },
    );

    // The user channel is only used for local settings (e.g. "don't show again" choices, a Figma token) kept in
    // ~/.haiku/registry.json; there are no accounts.
    this.envoyClient.get(USER_CHANNEL).then((user) => {
      this.user = user;

      // A folder given at startup (HAIKU_PROJECT_FOLDER) opens directly, skipping the start screen. Plumbing's
      // services are reachable once Envoy answers, so this is a safe moment to launch.
      if (this.props.folder) {
        // Given explicitly at startup (HAIKU_PROJECT_FOLDER, e.g. `yarn start` scenarios and tests): trusted.
        this.openProjectFolder(this.props.folder, {isNew: true});
      }
    });

    this.envoyClient.get(SERVICES_CHANNEL, {timeout: FIGMA_IMPORT_TIMEOUT}).then((servicesEnvoyClient) => {
      this.setState({servicesEnvoyClient});
    });

    this.envoyClient.get(TOUR_CHANNEL).then((tourChannel) => {
      this.tourChannel = tourChannel;

      tourChannel.on('tour:requestElementCoordinates', this.handleFindElementCoordinates);

      tourChannel.on('tour:requestWebviewCoordinates', this.handleFindWebviewCoordinates);

      tourChannel.on('tour:requestShowStep', this.setGlassInteractionToEditMode);

      ipcRenderer.on('global-menu:start-tour', this.startTourFromGlobalMenu);

      window.addEventListener('resize', lodash.throttle(() => {
        tourChannel.updateLayout();
      }), 300);
    });
  }

  componentWillUnmount () {
    this.tourChannel.off('tour:requestElementCoordinates', this.handleFindElementCoordinates);
    this.tourChannel.off('tour:requestWebviewCoordinates', this.handleFindWebviewCoordinates);
    this.tourChannel.off('tour:requestShowStep', this.setGlassInteractionToEditMode);
  }

  handleConnectedProjectModelStateChange ({from, folder, what, value}) {
    if (!this._projectStates[folder]) {
      this._projectStates[folder] = {};
    }
    if (!this._projectStates[folder][what]) {
      this._projectStates[folder][what] = {};
    }
    this._projectStates[folder][what][from] = (value !== undefined)
      ? value // Let the originator specify the state...
      : true; // ...Otherwise it is simply a status of true
  }

  haveAllProjectsRegisteredStateNameForFolder (folder, what, value = true) {
    return (
      this._projectStates[folder] &&
      this._projectStates[folder][what] &&
      this._projectStates[folder][what].creator === value &&
      this._projectStates[folder][what].glass === value &&
      this._projectStates[folder][what].timeline === value &&
      this._projectStates[folder][what].master === value
    );
  }

  /**
   * @methjod awaitAllProjectModelsState
   * @description Long-poll our local registry until all of the subviews for the given folder
   * have registered as having entered the named state.
   */
  awaitAllProjectModelsState (folder, what, value = true, cb) {
    if (
      this.state.projectModel && // Sanity check
      this.state.projectModel.getFolder() === folder &&
      this.haveAllProjectsRegisteredStateNameForFolder(folder, what, value)
    ) {
      return cb();
    }

    return setTimeout(() => {
      return this.awaitAllProjectModelsState(folder, what, value, cb);
    }, 100);
  }

  unsetAllProjectModelsState (folder, what) {
    if (!this._projectStates[folder]) {
      return null;
    }
    // All states transition to an undefined state
    this._projectStates[folder][what] = {};
  }

  handleFindElementCoordinates ({selector, webview}) {
    requestElementCoordinates({
      currentWebview: 'creator',
      requestedWebview: webview,
      selector,
      shouldNotifyEnvoy:
        this.tourChannel &&
        this.envoyClient &&
        !this.envoyClient.isInMockMode(),
      tourClient: this.tourChannel,
    });
  }

  handleFindWebviewCoordinates () {
    this.tourChannel.receiveWebviewCoordinates('creator', {top: 0, left: 0});
  }

  renderNotice (content, i) {
    return (
      <Toast
        toastType={content.type}
        toastTitle={content.title}
        toastMessage={content.message}
        toastCount={content.count || 1}
        closeText={content.closeText}
        key={i + content.title}
        myKey={i}
        removeNotice={this.removeNotice}
        lightScheme={content.lightScheme} />
    );
  }

  handleInteractionModeChange (interactionMode) {
    if (this.state.interactionMode === interactionMode) {
      return;
    }

    // When exiting preview mode:
    // - Pressing toggle preview button: restore creator creator (open design + restore left
    //     panel) or (open code editor + state inspector)
    // - Pressing design button: go to desing and restore left panel
    // - Pressing code button: go to code editor and open state inspector on left panel
    if (interactionMode === InteractionMode.GLASS_PREVIEW) {
      this.forceHideEventHandlersEditor({trySave: true});
    } else if (this.state.interactionMode === InteractionMode.GLASS_PREVIEW && interactionMode === InteractionMode.GLASS_EDIT) {
      this.setState({activeNav: this.lastWidgetState.activeNav});
    } else if (interactionMode === InteractionMode.GLASS_EDIT) {
      this.setState({activeNav: 'library'});
    } else if (interactionMode === InteractionMode.CODE_EDITOR) {
      this.setState({activeNav: 'state_inspector'});
    }

    this.lastWidgetState = {interactionMode: this.state.interactionMode, activeNav: this.state.activeNav};

    this.setState({interactionMode}, () => {
      if (interactionMode === InteractionMode.CODE_EDITOR) {
        this.refs.stage.focusCodeEditor();
      }
    });
  }

  setInteractionMode (interactionMode) {
    if (this.state.projectModel) {
      this.state.projectModel.setInteractionMode(interactionMode, {from: 'creator', integrity: false}, () => {});
    }
  }

  togglePreviewMode () {
    // We delegate to state, so stage can check if code editor has any content
    if (isPreviewMode(this.state.interactionMode)) {
      this.setInteractionMode(this.lastWidgetState.interactionMode);
    } else {
      this.refs.stage.tryToSwitchToPreviewMode();
    }
  }

  setGlassInteractionToPreviewMode () {
    this.setInteractionMode(InteractionMode.GLASS_PREVIEW);
  }

  setGlassInteractionToEditMode () {
    this.setInteractionMode(InteractionMode.GLASS_EDIT);
  }

  setGlassInteractionToCodeEditorMode () {
    this.setInteractionMode(InteractionMode.CODE_EDITOR);
  }

  switchActiveNav (activeNav) {
    this.setState({activeNav});

  }

  startTourFromGlobalMenu = () => {
    // Don't start the tour if is called via the main menu
    // while a project is loading.
    //
    // TODO: disable the TopMenu option. Setting a timeout here
    // to start the tour once the project is loaded leads to weird
    // flashes (loading screen => project => loading screen)
    if (this.shouldShowProjectLoader()) {
      return;
    }

    if (this.state.projectModel) {
      this.teardownMaster({shouldFinishTour: false});
    } else {
      this.setState({dashboardVisible: true, doShowProjectLoader: false});
    }

    // Put it at the bottom of the event loop
    setTimeout(() => {
      this.tourChannel.start(true);
    });
  };

  onProjectLaunchError () {
    this.setState({projectLaunching: false, doShowProjectLoader: false, dashboardVisible: true}, () => {
      this.createNotice({
        type: 'error',
        title: 'Oh no!',
        message: `We couldn't open this project. 😩 Please check that the folder is readable and try again. If this keeps happening, please report it at ${ISSUES_URL}.`,
        closeText: 'Okay',
        lightScheme: true,
      });
    });
  }

  launchProject (projectObject, cb) {
    // VERY IMPORTANT - if not set to true, we can end up in a situation where we overwrite freshly cloned content from the remote!
    projectObject.skipContentCreation = true;

    this.setState({
      doShowProjectLoader: true,
      dashboardVisible: false,
    });

    const {projectName, projectPath} = projectObject;

    // Async: ensure our web+haikuroot:// URLs work as expected.
    ipcRenderer.send('protocol:register', projectObject.projectPath);

    return this.props.websocket.request({method: 'bootstrapProject', params: [projectObject]}, (err) => {
      if (err) {
        return this.onProjectLaunchError();
      }

      return this.props.websocket.request({method: 'startProject', params: [projectObject]}, (startProjectError, applicationImage) => {
        if (startProjectError) {
          return this.onProjectLaunchError();
        }

        return Project.setup(
          projectObject.projectPath,
          'creator', // alias
          this.props.websocket, // websocket (already initialized)
          window, // platform
          this.props.userconfig, // userconfig
          this.fileOptions,
          this.envoyOptions,
          (projectSetupError, projectModel) => {
            if (projectSetupError) {
              return cb(projectSetupError);
            }

            // Notify... ourselves that we've successfully set up the project model for this folder
            // Is it weird to put this here, or weirder to put a conditional hack over there?
            this.handleConnectedProjectModelStateChange({
              from: 'creator',
              folder: projectPath,
              what: 'project:ready',
            });

            // Assign, not merge, since we don't want to clobber any variables already set, like project name
            lodash.assign(projectObject, applicationImage.project);

            this.setState({
              projectModel,
              projectFolder: projectPath,
              applicationImage,
              projectObject,
              projectName,
            }, () => {
              this.setState({doShowProjectLoader: false, projectLaunching: true});
              // Once the Timeline/Stage are being rendered, we await the point that their
              // own Project models have loaded before initiating a switch to the current
              // active component. This also waits for MasterProcess to be bootstrapped
              return this.awaitAllProjectModelsState(projectPath, 'project:ready', true, () => {
                const ac = this.state.projectModel.getCurrentActiveComponent();
                if (ac) {
                  // Even if we already have an active component set up and assigned in memory,
                  // we still need to notify Timeline/Stage since they have been completely recreated
                  ac.setAsCurrentActiveComponent({from: 'creator'}, () => { });
                } else {
                  // And if we don't have anything assigned, assume we're editing the main component
                  this.state.projectModel.setCurrentActiveComponent('main', {from: 'creator'}, () => { });
                }

                ipcRenderer.send('topmenu:update', {isProjectOpen: true});
              });
            });

            // This safely reinitializes websockets and Envoy clients.
            // We need to do this here in Creator because our process
            // remains alive even as the user navs between projects.
            projectModel.connectClients();

            // Clear the undo/redo stack (etc) from the previous editing session if any is left over
            projectModel.actionStack.resetData();

            projectModel.on('update', (what, ...args) => {
              // console.info(`[creator] local update ${what}, args:`,args)

              switch (what) {
                case 'updateMenu':
                  this.updateMenu();
                  break;

                case 'setCurrentActiveComponent':
                  this.handleActiveComponentReady();
                  break;

                case 'componentDeactivating':
                  this.handleComponentDeactivating();
                  break;

                case 'setInteractionMode':
                  this.handleInteractionModeChange(...args);
                  break;
              }
            });

            projectModel.on('remote-update', (what, ...args) => {
              switch (what) {
                case 'setCurrentActiveComponent':
                case 'selectElement':
                case 'unselectElement':
                case 'batchUpsertEventHandlers':
                  this.debouncedForceUpdate();
                  break;

                case 'setInteractionMode':
                  this.handleInteractionModeChange(...args);
                  break;
              }
            });

            // Trigger tab UI and library panel updates
            projectModel.on('active-component:upserted', () => {
              this.forceUpdate();
            });
          },
        );
      });
    });
  }

  handleComponentDeactivating () {
    this.getActiveComponent().removeAllListeners('sustained-check:start');
  }

  updateMenu () {
    ipcRenderer.send('topmenu:update', this.state.projectModel.describeTopMenu());
  }

  handleActiveComponentReady () {
    this.mountHaikuComponent();

    // Reset not found identifiers in case we are switching current active component
    this.identifiersNotFound = [];

    this.getActiveComponent().on('sustained-check:start', () => {
      const activeComponent = this.getActiveComponent();

      // If activeComponent is null, delete any identifiersNotFound notice and skip it
      if (!activeComponent) {
        this.deleteIdentifierNotFoundNotice();
        return;
      }

      // Check sustained warnings
      activeComponent.checkSustainedWarnings();

      const currentIdentifiersNotFound = activeComponent.sustainedWarningsChecker.notFoundIdentifiers;

      // If changed, delete current notice and display a new notice if num identifier not found > 0
      if (!lodash.isEqual(currentIdentifiersNotFound, this.identifiersNotFound)) {
        // Delete old notice
        this.deleteIdentifierNotFoundNotice();

        // Create new notice if has any not found indentifier
        if (currentIdentifiersNotFound.length > 0) {
          this.identifiersNotFoundNotice = this.createNotice({
            title: 'Uh oh',
            type: 'warning',
            message: `One or more of your expressions refers to an undefined state variable(s): ${currentIdentifiersNotFound.join(', ')}. Please edit your expressions to remove these references.`,
          });
        }

        // Update list of identifiers not found
        this.identifiersNotFound = currentIdentifiersNotFound;
      }
    });

    // For mc, this triggers re-render of the Component Tab UI, State Inspector UI, Library UI
    // in the context of whatever the current component is.
    if (this.state.projectFolder) {
      this.awaitAllProjectModelsState(this.state.projectFolder, 'component:mounted', true, () => {
        this.setState({
          projectLaunching: false,
        });
      });
    }
  }

  mountHaikuComponent () {
    // The Timeline UI doesn't display the component, so we don't bother giving it a ref
    this.getActiveComponent().mountApplication(null, {
      freeze: true, // No display means no need for overflow settings, etc
    }, () => {
      this.handleConnectedProjectModelStateChange({
        from: 'creator',
        folder: this.state.projectFolder,
        what: 'component:mounted',
      });
    });
  }

  /**
   * Opens the project in `folder` (an empty folder becomes a new project) and remembers it in the start screen's
   * recent projects.
   */
  /**
   * Opens a folder chosen from the menu, closing the current project first if one is open.
   */
  switchToProjectFolder (folder, {isNew = false} = {}) {
    if (!folder) {
      return;
    }
    if (!this.state.projectModel) {
      this.openProjectFolder(folder, {isNew});
      return;
    }
    // Ask about trust before closing the current project, so cancelling keeps it open.
    this.ensureProjectIsTrusted(folder, isNew).then((trusted) => {
      if (!trusted) {
        return;
      }
      ipcRenderer.send('topmenu:update', {subComponents: [], undoState: {canUndo: false, canRedo: false}, isProjectOpen: false});
      this.teardownMaster({shouldFinishTour: true}, () => this.launchProjectFolder(folder));
    });
  }

  ensureProjectIsTrusted (folder, isNew) {
    return ensureProjectIsTrusted({
      folder,
      isNew,
      user: this.user,
      recentProjects: getRecentProjects(),
      showMessageBox: dialogs.showMessageBox,
    });
  }

  /**
   * Opens a project folder once it is trusted (see projectTrust.js). `isNew`: the folder was just created here.
   */
  openProjectFolder (folder, {isNew = false} = {}) {
    this.ensureProjectIsTrusted(folder, isNew).then((trusted) => {
      if (trusted) {
        this.launchProjectFolder(folder);
      }
    });
  }

  launchProjectFolder (folder) {
    rememberRecentProject(folder);
    this.launchFolder(
      // Load up the necessary metadata in Plumbing to launch normally. Local projects have no organization; the npm
      // package name comes from the folder name (see getNpmPackageName).
      {
        projectPath: folder,
        authorName: PRODUCT_NAME,
        projectName: path.basename(folder),
        branchName: 'master',
      },
      (launchError) => {
        if (launchError) {
          logger.error(launchError);
          this.setState({folderLoadingError: launchError, dashboardVisible: true, doShowProjectLoader: false});
          this.createNotice({
            type: 'error',
            title: 'Oh no!',
            message: `We were unable to open ${folder}. 😢 If this keeps happening, please report it at ${ISSUES_URL}.`,
            closeText: 'Okay',
            lightScheme: true,
          });
        }
      },
    );
  }

  /**
   * Asks where to save and exports the open project as a Lottie JSON ('json'), GIF ('gif') or video ('mp4').
   * Used by the Export modal and the app menu.
   */
  exportAs = (extension, framerate) => {
    if (!this.envoyExporter) {
      return;
    }

    const request = {framerate, outlet: 'timeline'};
    switch (extension) {
      case 'gif':
        request.format = ExporterFormat.AnimatedGif;
        break;
      case 'mp4':
        request.format = ExporterFormat.Video;
        break;
      case 'json':
        request.format = ExporterFormat.Bodymovin;
        break;
    }

    dialogs.showSaveDialog({
      defaultPath: this.state.projectObject ? this.state.projectObject.projectName : undefined,
      filters: [{
        name: request.format, extensions: [extension],
      }],
    }).then(({canceled, filePath}) => {
      if (canceled || !filePath) {
        return;
      }

      request.filename = filePath;
      this.envoyExporter.save(request);
    });
  };

  launchFolder (projectOptions, cb) {

    return this.launchProject(projectOptions, cb);
  }

  removeNotice (index, id) {
    const notices = this.state.notices;
    if (index !== undefined) {
      this.setState({
        notices: [...notices.slice(0, index), ...notices.slice(index + 1)],
      });
    } else if (id !== undefined) {
      // Hackaroo
      lodash.each(notices, (notice, noticeIndex) => {
        if (notice.id === id) {
          this.removeNotice(noticeIndex);
        }
      });
    }
  }

  shouldNoticeBeSkipped (notice) {
    // Assume that any notice without a string or a react element isn't usable, so just skip it
    if (!notice || typeof notice.message !== 'string' && !React.isValidElement(notice.message)) {
      return true;
    }

    if (typeof notice.message === 'string') {
      // HACK: Skip human-unfriendly duplicate errors that originate from ActiveComponent action calls
      if (notice.message.match(/\[active/)) {
        return true;
      }

      // Avoid scary error messages (752175308356950)
      if (notice.message.match(/EventEmitter/)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Expects the object:
   *
   * { type: string (info, success, danger (or error), warning)
   *   title: string,
   *   message: string,
   *   closeText: string (optional, defaults to 'close')
   *   lightScheme: bool (optional, defaults to dark)
   * }
   */
  createNotice (notice) {
    if (this.shouldNoticeBeSkipped(notice)) {
      return;
    }

    const notices = this.state.notices;
    const now = Date.now();

    // A repeated notice only bumps the counter of the one already shown. Re-render it at most twice a second so an
    // error raised on every frame can't cause an update death spiral.
    const existing = notices.find((shown) => shown.type === notice.type && shown.message === notice.message);
    if (existing) {
      existing.count += 1;
      if (now - existing.timestamp >= NOTICE_RERENDER_INTERVAL_MS) {
        existing.timestamp = now;
        this.setState({notices});
      }
      return existing;
    }

    if (notice.type === 'error') {
      logger.error(notice.message);
    }

    // Don't stack up more than five notices at a time
    if (notices.length >= MAX_VISIBLE_NOTICES) {
      return;
    }

    notice.id = Math.random() + '';
    notice.count = 1;
    notice.timestamp = now;
    notices.unshift(notice);
    this.setState({notices});

    return notice;
  }

  onLibraryDragEnd (asset) {
    this.setState({assetDragging: null});
    if (asset) {
      this.refs.stage.handleDrop(asset, this._lastMouseX, this._lastMouseY);
    }
  }

  onLibraryDragStart (asset) {
    this.setState({assetDragging: asset});
  }

  onTimelineMounted () {
    this.setState({isTimelineReady: true});
  }

  onTimelineUnmounted () {
    this.setState({isTimelineReady: false});
  }

  onNavigateToDashboard () {
    // Redundant with a future call, but ensures we will show the loading spinner ASAP.
    this.setState({tearingDown: true});
    this.teardownMaster({shouldFinishTour: true});
    ipcRenderer.send('topmenu:update', {subComponents: [], undoState: {canUndo: false, canRedo: false}, isProjectOpen: false});
  }

  teardownMaster ({shouldFinishTour}, cb) {
    ipcRenderer.send('protocol:unregister');
    this.setState({tearingDown: true});
    // Delete identifier not found notice on teardown
    this.deleteIdentifierNotFoundNotice();

    // We teardownMaster FIRST because we want to close the websocket connections before
    // destroying the webviews, which leads to EPIPE/"not opened" crashes.
    // Previously we were relying on dropped connections to deallocate websockets,
    // which made it difficult to know how to handle actual errors
    return this.props.websocket.request(
      {method: 'teardownMaster', params: [this.state.projectModel.getFolder()]},
      () => {
        logger.info('[creator] master torn down');
        this.setState({dashboardVisible: true, tearingDown: false, notices: []});
        this.onTimelineUnmounted();

        this.unsetAllProjectModelsState(this.state.projectModel.getFolder(), 'project:ready');
        this.unsetAllProjectModelsState(this.state.projectModel.getFolder(), 'component:mounted');

        if (shouldFinishTour) {
          this.tourChannel.finish(false);
        }

        this.state.projectModel.getAllActiveComponents().forEach((ac) => {
          if (ac.$instance) {
            ac.$instance.context.destroy();
          }
        });

        // The stale project doesn't want to receive methods destined for new project models
        if (this.state.projectModel) {
          this.state.projectModel.stopHandlingMethods();
        }

        // Clean up our litany of BaseModel extension collections in case an errant reload finds something better left
        // unfound.
        BaseModel.extensions.forEach((klass) => klass.purge());

        this.forceHideEventHandlersEditor();

        this.setState({
          projectModel: null,
          activeNav: 'library', // Prevents race+crash loading StateInspector when switching projects
          interactionMode: InteractionMode.GLASS_EDIT, // So that the asset library will not be obscured on reentry
        });

        if (cb) {
          cb();
        }
      },
    );
  }

  deleteIdentifierNotFoundNotice () {
    if (this.identifiersNotFoundNotice) {
      this.removeNotice(undefined, this.identifiersNotFoundNotice.id);
      this.identifiersNotFoundNotice = undefined;
    }
  }

  tryToChangeCurrentActiveComponent (scenename) {
    // Delegate to Stage, as it contains nonSavedContentOnCodeEditor state
    this.refs.stage.tryToChangeCurrentActiveComponent(scenename);
  }

  saveEventHandlers (targetElement, serializedEvents) {
    const selectorName = 'haiku:' + targetElement.getComponentId();
    this.getActiveComponent().batchUpsertEventHandlers(selectorName, serializedEvents, {from: 'creator'}, () => {});
  }

  forceHideEventHandlersEditor ({trySave} = {trySave: false}) {
    if (trySave && this.editor && !this.editor.canBeClosedExternally()) {
      this.editor.doSave();
    }

    this.setState({
      targetElement: null,
      showEventHandlerEditor: false,
      eventHandlerEditorOptions: {},
    });

    this.state.projectModel.broadcastPayload({
      name: 'event-handlers-editor-closed',
    });
  }

  safelyHideEventHandlersEditor = () => {
    if (this.editor && this.editor.canBeClosedExternally()) {
      this.forceHideEventHandlersEditor();
    }
  };

  showEventHandlersEditor (clickEvent, targetElement, options) {
    if (isPreviewMode(this.state.interactionMode) || !targetElement) {
      return;
    }

    logger.info(`showing actions editor`, options);

    this.setState({
      targetElement,
      showEventHandlerEditor: true,
      eventHandlerEditorOptions: options,
    });

    this.state.projectModel.broadcastPayload({
      name: 'event-handlers-editor-open',
    });
  }

  handleShowEventHandlersEditor (elementUID, options, frame) {
    // The EventHandlerEditor uses this field to know whether to launch in frame mode vs event mode
    if (isNumeric(frame)) {
      options.frame = frame;
    }

    this.showEventHandlersEditor(
      null,
      this.getActiveComponent().findElementByUid(elementUID),
      options,
    );
  }

  handleShowConfirmGroupPopup (groupOrUngroup) {
    this.setState({showConfirmGroupUngroupPopup: true, groupOrUngroup});
    this.state.projectModel.broadcastPayload({name: 'confirm-group-ungroup-popup-open', groupOrUngroup});
  }

  hideConfirmGroupUngroupPopup (userConfirmedGroup, groupOrUngroup) {
    this.setState({showConfirmGroupUngroupPopup: false});
    this.state.projectModel.broadcastPayload({name: 'confirm-group-ungroup-popup-closed', confirmed: userConfirmedGroup, groupOrUngroup});
  }

  conglomerateComponent = (
    {
      isBlankComponent,
      skipInstantiateInHost,
    } = {
      isBlankComponent: false,
      skipInstantiateInHost: false,
    },
  ) => {
    this.props.websocket.send({
      type: 'broadcast',
      from: 'creator',
      folder: this.state.projectModel.getFolder(),
      name: 'conglomerate-component',
      isBlankComponent,
      skipInstantiateInHost,
    });
  };

  shouldShowProjectLoader () {
    return this.state.doShowProjectLoader || this.state.projectLaunching;
  }

  render () {
    return (
      <div style={{position: 'relative', width: '100%', height: '100%'}}>
        <CSSTransition
          classNames="toast"
          timeout={{enter: 500, exit: 300}}
        >
          <div style={{position: 'absolute', right: 0, top: 44, width: 300}}>
            {lodash.map(this.state.notices, this.renderNotice)}
          </div>
        </CSSTransition>
        {!this.state.tearingDown && this.envoyClient &&
          <Tour
            show={!this.shouldShowProjectLoader()}
            envoyClient={this.envoyClient}
            startTourOnMount={true}
          />
        }
        {this.state.dashboardVisible && !this.shouldShowProjectLoader() && !this.state.tearingDown && <StartScreen
          onOpenProject={(folder, options) => this.openProjectFolder(folder, options)}
          createNotice={this.createNotice}
        />
        }
        {this.shouldShowProjectLoader() && (
          <ProjectLoader
            softwareVersion={this.state.softwareVersion}
            message="Initializing project…"
          />
        )}
        {!this.state.dashboardVisible && !this.state.doShowProjectLoader && this.state.projectModel && <div style={{position: 'absolute', width: '100%', height: '100%', top: 0, left: 0}}>
          <div className="layout-box" style={{overflow: 'visible'}}>
            <SplitPanel split="horizontal" minSize={300} defaultSize={'62vh'}>
              <SplitPanel split="vertical" minSize={300} defaultSize={300}>
                <SideBar
                  projectModel={this.state.projectModel}
                  switchActiveNav={this.switchActiveNav}
                  onNavigateToDashboard={this.onNavigateToDashboard}
                  activeNav={this.state.activeNav}>
                  {
                    isPreviewMode(this.state.interactionMode) && (
                      <div
                        style={{
                          opacity: 0.6,
                          position: 'absolute',
                          top: 34,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 999999,
                          backgroundColor: Palette.COAL,
                        }}
                        onClick={this.setGlassInteractionToEditMode}
                      />
                    )
                  }
                  <Library
                    servicesEnvoyClient={this.state.servicesEnvoyClient}
                    user={this.user}
                    projectModel={this.state.projectModel}
                    layout={this.layout}
                    folder={this.state.projectFolder}
                    haiku={this.props.haiku}
                    websocket={this.props.websocket}
                    onDragEnd={this.onLibraryDragEnd}
                    onDragStart={this.onLibraryDragStart}
                    createNotice={this.createNotice}
                    removeNotice={this.removeNotice}
                    conglomerateComponent={this.conglomerateComponent}
                    visible={this.state.activeNav === 'library'} />
                  <StateInspector
                    projectModel={this.state.projectModel}
                    createNotice={this.createNotice}
                    removeNotice={this.removeNotice}
                    folder={this.state.projectFolder}
                    websocket={this.props.websocket}
                    visible={this.state.activeNav === 'state_inspector'} />
                </SideBar>
                <div style={{position: 'relative', width: '100%', height: '100%'}}>
                  {
                    !isPreviewMode(this.state.interactionMode) && (
                      <EventHandlerEditor
                        element={this.state.targetElement}
                        save={(targetElement, serializedEvent) => {
                          this.saveEventHandlers(targetElement, serializedEvent);
                        }}
                        close={this.safelyHideEventHandlersEditor}
                        visible={this.state.showEventHandlerEditor}
                        options={this.state.eventHandlerEditorOptions}
                        ref={(editor) => {
                          this.editor = editor;
                        }}
                      />
                    )
                  }
                  {
                    this.state.showConfirmGroupUngroupPopup &&
                        <ConfirmGroupUngroupPopup
                          user={this.user}
                          setGroupUngroupAnswerAndClose={this.hideConfirmGroupUngroupPopup}
                          groupOrUngroup={this.state.groupOrUngroup}
                        />
                  }
                  <Stage
                    ref="stage"
                    folder={this.state.projectFolder}
                    onExport={this.exportAs}
                    projectModel={this.state.projectModel}
                    envoyClient={this.envoyClient}
                    haiku={this.props.haiku}
                    websocket={this.props.websocket}
                    project={this.state.projectObject}
                    createNotice={this.createNotice}
                    removeNotice={this.removeNotice}
                    isTimelineReady={this.state.isTimelineReady}
                    interactionMode={this.state.interactionMode}
                    onShowEventHandlerEditor={this.handleShowEventHandlersEditor}
                    onPreviewModeToggled={this.togglePreviewMode}
                    artboardDimensions={this.state.artboardDimensions}
                    setGlassInteractionToPreviewMode={this.setGlassInteractionToPreviewMode}
                    setGlassInteractionToEditMode={this.setGlassInteractionToEditMode}
                    setGlassInteractionToCodeEditorMode={this.setGlassInteractionToCodeEditorMode}
                    tryToChangeCurrentActiveComponent={this.tryToChangeCurrentActiveComponent}
                    showEventHandlerEditor={this.state.showEventHandlerEditor}
                    conglomerateComponent={this.conglomerateComponent}
                  />
                  {(this.state.assetDragging)
                    ? <div style={{width: '100%', height: '100%', backgroundColor: 'white', opacity: 0.01, position: 'absolute', top: 0, left: 0}} />
                    : ''}
                </div>
              </SplitPanel>
              <div
                id="timeline-container"
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}>
                <div
                  id="timeline-wrapper"
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    top: '0px',
                    overflow: 'auto',
                  }}>
                  <Timeline
                    ref="timeline"
                    folder={this.state.projectFolder}
                    envoyClient={this.envoyClient}
                    haiku={this.props.haiku}
                    username={this.state.username}
                    organizationName={this.state.organizationName}
                    createNotice={this.createNotice}
                    removeNotice={this.removeNotice}
                    onReady={this.onTimelineMounted} />
                </div>
              </div>
            </SplitPanel>
          </div>
        </div>}
        {this.state.tearingDown && <div style={DASH_STYLES.dashOverlay} />}
      </div>
    );
  }
}
