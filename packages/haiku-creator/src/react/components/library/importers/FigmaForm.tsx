import {shell} from 'electron';
// @ts-ignore
import {Figma, FIGMA_TOKEN_HELP_URL} from 'haiku-serialization/src/bll/Figma';
// @ts-ignore
import Palette from 'haiku-ui-common/lib/Palette';
import * as React from 'react';
import {BTN_STYLES} from '../../../styles/btnShared';
import {DASH_STYLES} from '../../../styles/dashShared';

const STYLES: React.CSSProperties = {
  form: {
    position: 'absolute',
    background: Palette.COAL,
    top: '0',
    left: '0',
    height: '110px',
    borderRadius: '4px',
    padding: '15px 18px',
    zIndex: 99,
  },
  inputTitle: {
    ...DASH_STYLES.inputTitle,
    fontSize: '12px',
  },
  urlInput: {
    ...DASH_STYLES.newProjectInput,
    width: '200px',
    height: '30px',
    padding: '8px',
    fontSize: '12px',
    marginBottom: '10px',
  },
  formButton: {
    ...BTN_STYLES.btnText,
    ...BTN_STYLES.rightBtns,
    ...BTN_STYLES.btnPrimaryAlt,
  },
  helpLink: {
    color: Palette.SUNSTONE,
    textDecoration: 'underline',
    cursor: 'pointer',
    display: 'block',
    textTransform: 'initial',
    marginBottom: '10px',
  },
  error: {
    color: Palette.RED,
    float: 'left',
    textTransform: 'initial',
    marginTop: '5px',
  },
};

export interface FigmaFormProps {
  figma: any;
  onSetFigmaToken(token?: string): void;
  onImportFigmaAsset(url: string, warnOnComplexFile?: boolean): void;
  onPopoverHide(): void;
}

export interface FigmaFormState {
  isMessageVisible: boolean;
  error: null|string;
}

class FigmaForm extends React.PureComponent<FigmaFormProps, FigmaFormState> {
  private inputRef: HTMLInputElement;

  state: FigmaFormState = {
    isMessageVisible: false,
    error: null,
  };

  onTokenSubmit = (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const token = this.inputRef.value.trim();

    if (token) {
      this.setState({error: null});
      this.props.onSetFigmaToken(token);
    } else {
      this.setState({error: 'Paste a token first'});
    }
  };

  openTokenHelp = () => {
    shell.openExternal(FIGMA_TOKEN_HELP_URL);
  };

  renderTokenForm () {
    return (
      <form
        onSubmit={this.onTokenSubmit}
        style={{...STYLES.form, height: '140px'}}
      >
        <label style={STYLES.inputTitle}>Figma personal access token</label>
        <span style={STYLES.helpLink} onClick={this.openTokenHelp}>How to create a token</span>
        <input
          key="figma-token"
          autoFocus={true}
          type="password"
          style={STYLES.urlInput}
          placeholder="figd_…"
          ref={(inputRef) => {
            this.inputRef = inputRef;
          }}
        />
        {this.state.error && (
          <span style={STYLES.error}>{this.state.error}</span>
        )}
        <input style={STYLES.formButton} type="submit" value="Save" />
      </form>
    );
  }

  onFormSubmit = (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const url = this.inputRef.value;

    if (Figma.parseProjectURL(url)) {
      this.props.onImportFigmaAsset(url, true);
      this.setState({isMessageVisible: true});
    } else {
      this.setState({error: 'Invalid URL'});
    }
  };

  render () {
    return (
      <div>
        {!this.props.figma.token ? this.renderTokenForm() : this.state.isMessageVisible ? (
          <div
            style={{...STYLES.form, textTransform: 'none', height: '130px', minWidth: '200px'}}
          >
            <p>Your assets are being imported, please hold.</p>
            <span style={STYLES.formButton} onClick={this.props.onPopoverHide}>
              OK
            </span>
          </div>
        ) : (
          <form
            onSubmit={this.onFormSubmit}
            style={STYLES.form}
          >
            <label style={STYLES.inputTitle}>Project URL</label>
            <input
              key="figma-url"
              autoFocus={true}
              type="text"
              style={STYLES.urlInput}
              placeholder="https://www.figma.com/design/id/name"
              ref={(inputRef) => {
                this.inputRef = inputRef;
              }}
            />
            {this.state.error && (
              <span style={STYLES.error}>{this.state.error}</span>
            )}
            <input style={STYLES.formButton} type="submit" value="Import" />
          </form>
        )}
      </div>
    );
  }
}

export default FigmaForm;
