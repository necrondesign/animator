import * as Radium from 'radium';
import * as React from 'react';
import {ISSUES_URL, PRODUCT_NAME} from 'haiku-common/lib/branding';
import {ipcRenderer} from 'electron';
import Palette from 'haiku-ui-common/lib/Palette';
import * as Color from 'color';
import {BTN_STYLES} from '../styles/btnShared';
import ExportModal from './ExportModal';
import {
  EyeIconSVG, ComponentIconSVG, EventsBoltIcon,
} from 'haiku-ui-common/lib/react/OtherIcons';
import * as Element from 'haiku-serialization/src/bll/Element';
import * as ElementSelectionProxy from 'haiku-serialization/src/bll/ElementSelectionProxy';
import * as logger from 'haiku-serialization/src/utils/LoggerInstance';
import {
  isPreviewMode,
  isEditMode,
  isCodeEditorMode,
  showGlassOnStage,
} from 'haiku-ui-common/lib/interactionModes';
import AlignToolBox from './AlignToolBox';

const STYLES = {
  hide: {
    display: 'none',
  },
  frame: {
    backgroundColor: Palette.COAL,
    position: 'relative',
    top: 0,
    height: '36px',
    padding: '6px',
    minWidth: 500,
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
  sharePopover: {
    position: 'absolute',
    top: 34,
    backgroundColor: Palette.FATHER_COAL,
    width: 204,
    padding: '13px 9px',
    fontSize: 17,
    color: Palette.ROCK,
    textAlign: 'center',
    borderRadius: 4,
    boxShadow: '0 6px 25px 0 ' + Palette.FATHER_COAL,
  },
  popoverClose: {
    color: 'white',
    position: 'absolute',
    top: 5,
    right: 10,
    fontSize: 15,
    textTransform: 'lowercase',
  },
  footer: {
    backgroundColor: Color(Palette.DARK_GRAY).fade(0.7),
    height: 25,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    fontSize: 10,
    borderBottomRightRadius: 3,
    borderBottomLeftRadius: 3,
    paddingTop: 5,
  },
  time: {
    fontWeight: 'bold',
    marginLeft: 5,
  },
  copy: {
    position: 'absolute',
    height: '100%',
    width: 25,
    right: 0,
    paddingTop: 2,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Palette.DARK_GRAY,
  },
  copyLoading: {
    paddingTop: 0,
    paddingBottom: 6,
    pointerEvents: 'none',
  },
  linkHolster: {
    height: 29,
    position: 'relative',
    borderRadius: 3,
    marginTop: 3,
    cursor: 'pointer',
    backgroundColor: Color(Palette.DARK_GRAY).fade(0.68),
    border: '1px solid ' + Palette.DARK_GRAY,
  },
  link: {
    fontSize: 10,
    color: Color(Palette.LIGHT_BLUE).lighten(0.37),
    position: 'absolute',
    left: 7,
    top: 7,
    cursor: 'pointer',
  },
  generatingLink: {
    color: Palette.ROCK,
    cursor: 'default',
    fontStyle: 'italic',
  },
  popupNotice: {
    display: 'inline-block',
    marginTop: '10px',
    fontSize: '13px',
    fontStyle: 'oblique',
  },
  toggleHolster: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    borderRadius: 3,
    zIndex: 1,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    backgroundColor: Palette.LIGHTEST_PINK,
  },
  activeIndicatorLeft: {
    borderBottomLeftRadius: 4,
  },
  activeIndicatorRight: {
    borderBottomRightRadius: 4,
  },
};

class StageTitleBar extends React.Component {
  constructor (props) {
    super(props);

    this.handleShowEventHandlersEditor = this.handleShowEventHandlersEditor.bind(this);
    this.handleConglomerateComponent = this.handleConglomerateComponent.bind(this);
    this.showExportModal = this.showExportModal.bind(this);
    this.handleSaveOnRawCodeEditor = this.handleSaveOnRawCodeEditor.bind(this);
    this.handleSaveOnGlass = this.handleSaveOnGlass.bind(this);

    this._isMounted = false;

    this.state = {
      showExportModal: false,
    };

    ipcRenderer.on('global-menu:save', () => {
      // Skip if event handler editor is open
      if (!this._isMounted || this.props.showEventHandlerEditor) {
        return;
      }

      if (showGlassOnStage(this.props.interactionMode)) {
        this.handleSaveOnGlass();
      } else {
        this.handleSaveOnRawCodeEditor();
      }
    });
  }

  componentDidMount () {
    this._isMounted = true;

    // It's kind of weird to have this heartbeat logic buried all the way down here inside StateTitleBar;
    // it probably should be moved up to the Creator level so it's easier to find #FIXME
    this._fetchMasterStateInterval = setInterval(() => {
      if (this.props.projectModel) {
        return this.props.projectModel.masterHeartbeat((heartbeatErr, masterState) => {
          if (heartbeatErr || !masterState) {
            // If master disconnects we might not even get an error, so create a fake error in its place
            if (!heartbeatErr) {
              // tslint:disable-next-line:no-parameter-reassignment
              heartbeatErr = new Error('Unknown problem with master heartbeat');
            }
            logger.error(heartbeatErr);

            // If master has disconnected, stop running this interval so we don't get pulsing error messages
            clearInterval(this._fetchMasterStateInterval);

            // But the first time we get this, display a user notice - they probably need to restart Haiku to get
            // into a better state, at least until we can resolve what the cause of this problem is
            return this.props.createNotice({
              type: 'danger',
              title: 'Uh oh!',
              message: `${PRODUCT_NAME} is having a problem accessing your project. 😢  Please restart ${PRODUCT_NAME}. If you see this error again, please report it at ${ISSUES_URL}.`,
            });
          }

          ipcRenderer.send('topmenu:update', {
            isSaving: !!masterState.isSaving,
            ...this.props.projectModel.describeTopMenu(),
          });
        });
      }
    }, 1000);

    ipcRenderer.on('global-menu:export', this.showExportModal);
  }

  componentWillUnmount () {
    this._isMounted = false;
    clearInterval(this._fetchMasterStateInterval);
    ipcRenderer.removeListener('global-menu:export', this.showExportModal);
  }

  showExportModal () {
    if (!this._isMounted) {
      return;
    }

    this.setState({showExportModal: true});
  }

  handleSaveOnRawCodeEditor () {
    this.props.saveCodeFromEditorToDisk();
  }

  handleSaveOnGlass () {
    const noticeNotice = this.props.createNotice({
      type: 'info',
      title: 'No need to save!',
      message: `${PRODUCT_NAME} saves your work automatically`,
    });

    window.setTimeout(() => {
      if (noticeNotice) {
        this.props.removeNotice(undefined, noticeNotice.id);
      }
    }, 2500);
  }

  getActiveComponent () {
    return this.props.projectModel && this.props.projectModel.getCurrentActiveComponent();
  }

  fetchProxyElementForSelection () {
    const component = this.getActiveComponent();
    if (component) {
      return ElementSelectionProxy.fromSelection(Element.where({component, _isSelected: true}), component);
    }
  }

  getConglomerateComponentButtonColor () {
    const proxy = this.fetchProxyElementForSelection();
    if (proxy) {
      if (proxy.canEditComponentFromSelection()) {
        return Palette.LIGHT_BLUE;
      }
    }
  }

  handleConglomerateComponent () {
    const proxy = this.fetchProxyElementForSelection();

    if (proxy.canEditComponentFromSelection()) {
      this.props.websocket.send({
        type: 'broadcast',
        from: 'creator',
        name: 'edit-component',
        folder: this.props.projectModel.getFolder(), // required when sent via Creator
      });
    } else {
      this.props.conglomerateComponent({
        isBlankComponent: proxy.selection.length === 0,
        skipInstantiateInHost: proxy.selection.length === 0,
      });
    }
  }

  isEventHandlersEditorAvailable () {
    const proxy = this.fetchProxyElementForSelection();
    // If nothing is selected, assume the user wants to add events to the artboard
    return proxy && (proxy.doesManageSingleElement() || proxy.hasNothingInSelection());
  }

  isAlignPanelAvailable () {
    // This would show the align panel only when elements are selected:
    // const proxy = this.fetchProxyElementForSelection();
    // return proxy && !proxy.hasNothingInSelection();
    // But it feels better (in zb's opinion at authoring time) to keep it shown at all times glass is shown
    return showGlassOnStage(this.props.interactionMode);
  }

  handleShowEventHandlersEditor () {
    if (this.isEventHandlersEditorAvailable()) {
      const element = this.getProxySelectionElement();

      if (element) {

        this.props.onShowEventHandlerEditor(element.getPrimaryKey(), {}, null);
      }
    }
  }

  getProxySelectionElement () {
    let element = this.fetchProxyElementForSelection().selection[0];

    // Fallback to the artboard element if nothing is currently selected
    if (!element) {
      element = this.getActiveComponent().getArtboard().getElement();
    }

    return element;
  }

  getEventHandlersEditorButtonColor () {
    const proxy = this.fetchProxyElementForSelection();

    if (proxy) {
      if (proxy.doesManageSingleElement() || proxy.hasNothingInSelection()) {
        const element = this.getProxySelectionElement();

        if (element && element.hasVisibleEventHandlers()) {
          return Color(Palette.LIGHT_BLUE).lighten(0.37);
        }
      }
    }
  }

  get conglomerateComponentButton () {
    return (
      <button
        key="conglomerate-component-button"
        id="conglomerate-component-button"
        aria-label="Create a new Component"
        data-tooltip={true}
        data-tooltip-bottom-right={true}
        onClick={this.handleConglomerateComponent}
        style={[
          BTN_STYLES.btnIcon,
          BTN_STYLES.leftBtns,
        ]}>
        <ComponentIconSVG color={this.getConglomerateComponentButtonColor()} />
      </button>
    );
  }

  get eventHandlerEditorButton () {
    if (this.isEventHandlersEditorAvailable()) {
      return (
        <button
          key="show-event-handlers-editor-button"
          id="show-event-handlers-editor-button"
          aria-label="Edit element Actions"
          data-tooltip={true}
          data-tooltip-bottom-right={true}
          onClick={this.handleShowEventHandlersEditor}
          style={[
            BTN_STYLES.btnIcon,
            BTN_STYLES.leftBtns,
          ]}>
          <EventsBoltIcon color={this.getEventHandlersEditorButtonColor()} />
        </button>
      );
    }
  }

  render () {
    const isEditModeActive = isEditMode(this.props.interactionMode);
    const isCodeModeActive = isCodeEditorMode(this.props.interactionMode);

    return (
      <div style={STYLES.frame} className="frame">
        {isEditModeActive && [
          this.conglomerateComponentButton,
          this.eventHandlerEditorButton,
        ]}

        {this.isAlignPanelAvailable() && <AlignToolBox
          websocket={this.props.websocket}
          projectModel={this.props.projectModel}
        />}

        <div style={STYLES.toggleHolster}>
          <button
            key="toggle-design"
            id="toggle-design"
            aria-label="Switch to Design Mode"
            data-tooltip={!isEditModeActive}
            data-tooltip-bottom={!isEditModeActive}
            onClick={this.props.tryToSwitchToEditMode}
            style={[
              BTN_STYLES.btnText,
              BTN_STYLES.centerBtns,
              {
                display: 'inline-block',
                marginRight: '0px',
                borderBottomRightRadius: 0,
                borderTopRightRadius: 0,
                ':hover': {
                  backgroundColor: Color(Palette.DARKEST_COAL).darken(.3),
                },
              }]}>
            <span style={{marginLeft: 7}}>DESIGN</span>
            {isEditModeActive && <span style={{...STYLES.activeIndicator, ...STYLES.activeIndicatorLeft}} />}
          </button>

          <button
            key="toggle-code"
            id="toggle-code"
            aria-label="Switch to Code Mode"
            data-tooltip={!isCodeModeActive}
            data-tooltip-bottom={!isCodeModeActive}
            onClick={this.props.setGlassInteractionToCodeEditorMode}
            style={[
              BTN_STYLES.btnText,
              BTN_STYLES.centerBtns,
              {
                display: 'inline-block',
                marginRight: '0px',
                borderBottomLeftRadius: 0,
                borderTopLeftRadius: 0,
                ':hover': {
                  backgroundColor: Color(Palette.DARKEST_COAL).darken(.3),
                },
              }]}>
            <span style={{marginLeft: 7}}>CODE</span>
            {isCodeModeActive && <span style={{...STYLES.activeIndicator, ...STYLES.activeIndicatorRight}} />}
          </button>
        </div>

        <button
          key="export"
          id="export"
          aria-label="Export"
          onClick={this.showExportModal}
          disabled={!this.props.isTimelineReady}
          style={[
            BTN_STYLES.btnText,
            BTN_STYLES.rightBtns,
            {marginTop: 5, marginRight: 8},
            !this.props.isTimelineReady && STYLES.disabled,
          ]}
        >
          EXPORT
        </button>

        <button
          key="toggle-preview"
          id="preview"
          aria-label="Toggle preview"
          onClick={this.props.onPreviewModeToggled}
          disabled={!this.props.isTimelineReady}
          style={[
            BTN_STYLES.btnIcon,
            BTN_STYLES.rightBtns,
            {border: '1px solid ' + Palette.COAL, padding: '4px 5px'},
            !this.props.isTimelineReady && STYLES.disabled,
            isPreviewMode(this.props.interactionMode) && {border: '1px solid ' + Palette.PINK},
          ]}
        >
          <EyeIconSVG color={this.getConglomerateComponentButtonColor()} />
        </button>

        {this.state.showExportModal &&
          <ExportModal
            folder={this.props.folder}
            onExport={this.props.onExport}
            createNotice={this.props.createNotice}
            onClose={() => this.setState({showExportModal: false})}
          />
        }
      </div>
    );
  }
}

StageTitleBar.propTypes = {
  folder: React.PropTypes.string.isRequired,
  projectName: React.PropTypes.string,
  websocket: React.PropTypes.object.isRequired,
  createNotice: React.PropTypes.func.isRequired,
  removeNotice: React.PropTypes.func.isRequired,
  onExport: React.PropTypes.func.isRequired,
};

export default Radium(StageTitleBar);
