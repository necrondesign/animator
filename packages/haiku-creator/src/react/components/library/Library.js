import * as React from 'react';
import * as lodash from 'lodash';
import * as Radium from 'radium';
import {shell} from 'electron';
import {UserSettings} from 'haiku-sdk-creator/lib/bll/User';
import {isMac} from 'haiku-common/lib/environments/os';
import Palette from 'haiku-ui-common/lib/Palette';
import {LoadingTopBar} from 'haiku-ui-common/lib/react/LoadingTopBar';
import {didAskedForSketch} from 'haiku-serialization/src/utils/HaikuHomeDir';
import * as Asset from 'haiku-serialization/src/bll/Asset';
import {Figma, MAX_ITEMS_TO_IMPORT} from 'haiku-serialization/src/bll/Figma';
import * as sketchUtils from 'haiku-serialization/src/utils/sketchUtils';
import SketchDownloader from '../SketchDownloader';
import AssetList from './AssetList';
import FileImporter from './FileImporter';
import DesignFileCreator from './DesignFileCreator';
import {statSync} from 'fs';
import {basename} from 'path';

const openWithDefaultProgram = (asset) => {
  shell.openPath(asset.getAbspath());
};

const STYLES = {
  scrollwrap: {
    overflowY: 'auto',
    height: 'calc(100% - 35px)',
  },
  sectionHeader: {
    cursor: 'default',
    // height: 25, // See note in StateInspector
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    padding: '12px 14px 0',
    fontSize: 15,
    justifyContent: 'space-between',
  },
  assetsWrapper: {
    paddingTop: 6,
    paddingBottom: 6,
    position: 'relative',
    minHeight: '300px',
    overflow: 'hidden',
  },
  fileDropWrapper: {
    pointerEvents: 'none',
  },
  startText: {
    color: Palette.COAL,
    fontSize: 25,
    padding: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  primaryAssetText: {
    color: Palette.DARK_ROCK,
    fontSize: 16,
    padding: 24,
    textAlign: 'center',
  },
  loadingWrapper: {
    position: 'relative',
    width: '100%',
    height: 2,
  },
};

class Library extends React.Component {
  constructor (props) {
    super(props);

    this.state = {
      error: null,
      assets: [],
      previewImageTime: null,
      overDropTarget: false,
      isLoading: false,
      loadingProgress: null,
      loadingSpeed: null,
      lockLoadingFromWatchers: false,
      figma: null,
      sketchDownloader: {
        isVisible: false,
        shouldAskForSketch: !didAskedForSketch(),
      },
    };

    this.onAssetDoubleClick = this.onAssetDoubleClick.bind(this);
    this.handleAssetDeletion = this.handleAssetDeletion.bind(this);
    this.importFigmaAsset = this.importFigmaAsset.bind(this);
    this.setFigmaToken = this.setFigmaToken.bind(this);
    this.onSketchDialogDismiss = this.onSketchDialogDismiss.bind(this);

    // Debounced to avoid 'flicker' when multiple updates are received quickly
    this.handleAssetsChanged = lodash.debounce(this.handleAssetsChanged.bind(this), 250);

    this.broadcastListener = this.broadcastListener.bind(this);

    // We call this here because this is an expensive operation and we want to avoid
    // executing it when the user tries to open a Sketch file. This first call
    // sets a cache in the module so further calls are very quick.
    sketchUtils.checkIfInstalled();
  }

  broadcastListener ({name, assets, data}) {
    switch (name) {
      case 'assets-changed':
        const additionalState = {};

        if (!this.state.lockLoadingFromWatchers) {
          additionalState.isLoading = false;
        }

        return this.handleAssetsChanged(assets, additionalState);
    }
  }

  handleAssetsChanged (assetsDictionary, otherStates) {
    const assets = Asset.ingestAssets(this.props.projectModel, assetsDictionary);
    this.setState({assets, ...otherStates});
  }

  componentDidMount () {
    this.setState({isLoading: true});
    this.reloadAssetList();

    this.props.websocket.on('broadcast', this.broadcastListener);

    // TODO: perform an actual check for Illustrator
    this.isIllustratorInstalled = true;

    this.props.user.getConfig(UserSettings.FigmaToken).then((figmaToken) => {
      figmaToken = process.env.FIGMA_TOKEN || figmaToken;
      const figma = new Figma({token: figmaToken});
      this.setState({figma});
    });
  }

  componentWillUnmount () {
    this.props.websocket.removeListener('broadcast', this.broadcastListener);
  }

  /**
   * Stores (or, with no argument, forgets) the Figma personal access token used for imports.
   */
  setFigmaToken (token) {
    const figmaToken = token ? token.trim() : undefined;
    this.props.user.setConfig(UserSettings.FigmaToken, figmaToken);
    this.setState({figma: new Figma({token: figmaToken})});
  }

  reloadAssetList () {
    return this.props.projectModel.listAssets((error, assets) => {
      if (error) {
        return this.setState({error});
      }
      this.handleAssetsChanged(assets, {isLoading: false});
    });
  }

  importFigmaAsset (url, warnOnComplexFile = false) {
    if (!this.props.servicesEnvoyClient) {
      return;
    }

    this.setState({isLoading: true, loadingProgress: 80, loadingSpeed: '20s', lockLoadingFromWatchers: true});
    const projectFolder = this.props.projectModel.folder;
    return this.props.servicesEnvoyClient.figmaImportSVG({url, projectFolder}, this.state.figma.token)
      .then((numberOfItems) => {
        this.setState({isLoading: false, loadingProgress: null, loadingSpeed: null, lockLoadingFromWatchers: false});
        if (numberOfItems >= MAX_ITEMS_TO_IMPORT && warnOnComplexFile) {
          this.props.createNotice({
            type: 'warning',
            title: 'Warning',
            message: (
              <span>
                This project seems to be a complex project and we imported a limited amount of elements.
              </span>
            ),
          });
        }
      })
      .catch((error = {}) => {
        const message = error.err || 'We had a problem connecting with Figma. Please check your internet connection and try again.';
        this.setState({isLoading: false, loadingProgress: null, loadingSpeed: null, lockLoadingFromWatchers: false});

        if (error.status === 403) {
          this.setFigmaToken();
          return this.props.createNotice({
            type: 'danger',
            title: 'Error',
            message: 'Figma rejected the access token. Open the Figma importer again to enter a new personal access token.',
          });
        }

        if (error.status === 404) {
          return this.props.createNotice({
            type: 'danger',
            title: 'Error',
            message: 'We could not access this file. Make sure it exists and that the account that created the token can open it.',
          });
        }

        if (error.status === 424) {
          return this.props.createNotice({
            type: 'info',
            title: 'Info',
            message,
          });
        }

        this.props.createNotice({
          type: 'danger',
          title: 'Error',
          message,
        });
      });
  }

  handleFileLaunch (asset) {
    openWithDefaultProgram(asset);
  }

  handleSketchLaunch (asset) {
    sketchUtils.checkIfInstalled().then((isSketchInstalled) => {
      if (isSketchInstalled) {
        openWithDefaultProgram(asset);
        // On library Sketch asset double click, ask to download Sketch only if on mac
      } else if (isMac()) {
        this.setState({sketchDownloader: {...this.state.sketchDownloader, isVisible: true}});
      }
    });
  }

  handleIllustratorLaunch (asset) {
    if (this.isIllustratorInstalled) {
      openWithDefaultProgram(asset);
    } else {
      this.props.createNotice({type: 'error', title: 'Error', message: 'You need to have Adobe Illustrator installed to open that file.'});
    }
  }

  handleFigmaLaunch (asset) {
    if (asset.relpath !== 'hacky-figma-file[1]') {
      shell.openExternal(Figma.buildFigmaLinkFromPath(asset.relpath));
    }
  }

  onSketchDialogDismiss (shouldAskForSketch) {
    this.setState({sketchDownloader: {isVisible: false, shouldAskForSketch}});
    sketchUtils.unsetSketchInstalledCache();
  }

  handleComponent (asset) {
    const scenename = asset.getSceneName();
    if (scenename) {
      this.props.projectModel.setCurrentActiveComponent(scenename, {from: 'creator'}, () => {});
    }
  }

  onAssetDoubleClick (asset) {
    if (!asset) {
      return;
    }

    switch (asset.kind) {
      case Asset.KINDS.SKETCH:
        this.handleSketchLaunch(asset);
        break;
      case Asset.KINDS.ILLUSTRATOR:
        this.handleIllustratorLaunch(asset);
        break;
      case Asset.KINDS.FIGMA:
        this.handleFigmaLaunch(asset);
        break;
      case Asset.KINDS.VECTOR:
        if (asset.isOrphanSvg()) {
          this.handleFileLaunch(asset);
        } else {
          this.onAssetDoubleClick(asset.parent);
        }
        break;
      case Asset.KINDS.COMPONENT:
        this.handleComponent(asset);
        break;
      case Asset.KINDS.FOLDER:
        this.onAssetDoubleClick(asset.parent);
        break;
    }
  }

  handleAssetDeletion (asset) {
    this.setState({isLoading: true});

    return this.props.projectModel.unlinkAsset(
      asset.getRelpath(),
      (error, assets) => {
        if (error) {
          return this.setState({error, isLoading: false});
        }

        this.handleAssetsChanged(assets, {isLoading: false});
      },
    );
  }

  warnComplexFiles (filePaths) {
    filePaths.forEach((path) => {
      if (statSync(path).size > 30000000) { // 30MB, number found by experimentation
        this.props.createNotice({
          type: 'warning',
          title: 'Warning',
          message: `${basename(path)} is a large file, you may experience performance problems.`,
        });
      }
    });
  }

  handleFileDrop = (filePaths) => {
    this.warnComplexFiles(filePaths);
    this.setState({isLoading: true});

    this.props.projectModel.bulkLinkAssets(
      filePaths,
      (error) => {
        if (error) {
          return this.setState({error, isLoading: false});
        }
      },
    );
  };

  shouldDisplayAssetList () {
    const componentshostFolder = this.state.assets.find((asset) => asset.isComponentsHostFolder());
    const designsFolder = this.state.assets.find((asset) => asset.isDesignsHostFolder());

    if (!componentshostFolder || !designsFolder) {
      return false;
    }

    return (
      componentshostFolder &&
      designsFolder &&
      (componentshostFolder.getChildAssets().length !== 0 || designsFolder.getChildAssets().length !== 0)
    );
  }

  shouldDisplayAssetCreator () {
    const designsFolder = this.state.assets.find((asset) => asset.isDesignsHostFolder());

    return (
      designsFolder &&
      designsFolder.getChildAssets().length === 0
    );
  }

  onAssetCreatorStart = () => {
    this.setState({isLoading: true});
  };

  render () {
    return (
      <div
        id="library-wrapper"
        style={{display: this.props.visible ? 'initial' : 'none'}}>
        <div style={STYLES.loadingWrapper}>
          <LoadingTopBar
            progress={this.state.loadingProgress || 100}
            done={!this.state.isLoading}
            speed={this.state.loadingSpeed || '0.5s'}
          />
        </div>
        <div
          id="library-scroll-wrap"
          style={STYLES.sectionHeader}>
          Library
          <FileImporter
            websocket={this.props.websocket}
            projectModel={this.props.projectModel}
            onImportFigmaAsset={this.importFigmaAsset}
            onSetFigmaToken={this.setFigmaToken}
            figma={this.state.figma}
            conglomerateComponent={this.props.conglomerateComponent}
            onFileDrop={this.handleFileDrop}
          />
        </div>
        <div
          id="library-scroll-wrap"
          style={STYLES.scrollwrap}>
          <div style={STYLES.assetsWrapper}>
            {this.shouldDisplayAssetList() && (
              <AssetList
                websocket={this.props.websocket}
                projectModel={this.props.projectModel}
                onDragStart={this.props.onDragStart}
                onDragEnd={this.props.onDragEnd}
                onAssetDoubleClick={this.onAssetDoubleClick}
                figma={this.state.figma}
                onImportFigmaAsset={this.importFigmaAsset}
                onRefreshFigmaAsset={this.importFigmaAsset}
                onSetFigmaToken={this.setFigmaToken}
                deleteAsset={this.handleAssetDeletion}
                indent={0}
                assets={this.state.assets}
                conglomerateComponent={this.props.conglomerateComponent}
              />
            )}
            {this.shouldDisplayAssetCreator() && (
              <DesignFileCreator
                projectModel={this.props.projectModel}
                websocket={this.props.websocket}
                figma={this.state.figma}
                onSetFigmaToken={this.setFigmaToken}
                onImportFigmaAsset={this.importFigmaAsset}
                onRefreshFigmaAsset={this.importFigmaAsset}
                onStart={this.onAssetCreatorStart}
              />
            )}
          </div>
        </div>
        {
          this.state.sketchDownloader.isVisible &&
          this.state.sketchDownloader.shouldAskForSketch && (
            <SketchDownloader
              onDismiss={this.onSketchDialogDismiss}
            />
          )
        }
      </div>
    );
  }
}

Library.propTypes = {
  projectModel: React.PropTypes.object.isRequired,
};

export default Radium(Library);
