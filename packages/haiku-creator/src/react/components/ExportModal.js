import {shell} from 'electron';
import {clipboard} from 'haiku-ui-common/lib/electron/clipboard';
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import {toCustomElementName} from '@haiku/core/lib/adapters/element/HaikuElementAdapter';
import Palette from 'haiku-ui-common/lib/Palette';
import {ModalHeader, ModalWrapper} from 'haiku-ui-common/lib/react/Modal';

const ANIMATION_EXPORTS = [
  {id: 'lottie', label: 'Lottie (.json)', extension: 'json', framerate: 60, hint: 'iOS, Android and web Lottie players'},
  {id: 'gif-medium', label: 'GIF, medium quality', extension: 'gif', framerate: 15},
  {id: 'gif-high', label: 'GIF, high quality', extension: 'gif', framerate: 30},
  {id: 'video', label: 'Video (.mp4)', extension: 'mp4', framerate: 30},
];

const STYLES = {
  wrapper: {
    width: 560,
    maxWidth: '90%',
    top: 80,
  },
  title: {
    fontSize: 15,
    textTransform: 'uppercase',
    color: Palette.SUNSTONE,
    margin: '7px 0',
  },
  body: {
    padding: '16px 20px 20px',
    color: Palette.ROCK,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Palette.DARK_ROCK,
    margin: '14px 0 8px',
  },
  exportGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  exportButton: {
    padding: '8px 12px',
    fontSize: 13,
    color: Palette.SUNSTONE,
    backgroundColor: Palette.GRAY,
    border: `1px solid ${Palette.LIGHTEST_GRAY}`,
    borderRadius: 4,
    cursor: 'pointer',
  },
  code: {
    fontFamily: 'Menlo, Consolas, monospace',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    backgroundColor: Palette.SPECIAL_COAL,
    color: Palette.SUNSTONE,
    borderRadius: 4,
    padding: '8px 10px',
    margin: '6px 0',
    userSelect: 'text',
  },
  row: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
  },
  linkButton: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: Palette.LIGHT_BLUE,
    cursor: 'pointer',
    fontSize: 12,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  closeButton: {
    padding: '8px 16px',
    fontSize: 13,
    color: Palette.SUNSTONE,
    backgroundColor: Palette.LIGHT_BLUE,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
};

const readPackageName = (folder) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8')).name || null;
  } catch (exception) {
    return null;
  }
};

/**
 * Local export: animation files through the exporter, plus how to use the project as a web component.
 * Replaces Haiku's cloud "Publish"/share modal.
 */
export default class ExportModal extends React.Component {
  elementSnippet (packageName) {
    const tag = toCustomElementName(packageName);
    return `import '${packageName}/element';\n\n<${tag}></${tag}>`;
  }

  copy (text) {
    clipboard.writeText(text).then(
      () => this.props.createNotice({type: 'info', title: 'Copied', message: 'Copied to the clipboard.'}),
      (error) => this.props.createNotice({type: 'danger', title: 'Error', message: `Could not copy: ${error.message}`}),
    );
  }

  renderSnippet (text) {
    return (
      <div>
        <div style={STYLES.code}>{text}</div>
        <button style={STYLES.linkButton} onClick={() => this.copy(text)}>Copy</button>
      </div>
    );
  }

  render () {
    const {folder} = this.props;
    const packageName = readPackageName(folder) || '<package name from package.json>';
    const installCommand = `npm install "${folder}"`;

    return (
      <ModalWrapper style={STYLES.wrapper} onEsc={this.props.onClose}>
        <ModalHeader>
          <h2 style={STYLES.title}>Export</h2>
        </ModalHeader>
        <div id="export-modal" style={STYLES.body}>
          <div style={STYLES.sectionTitle}>Animation files</div>
          <div style={STYLES.exportGrid}>
            {ANIMATION_EXPORTS.map(({id, label, extension, framerate, hint}) => (
              <button
                key={id}
                id={`export-${id}`}
                style={STYLES.exportButton}
                title={hint || label}
                onClick={() => {
                  this.props.onExport(extension, framerate);
                  this.props.onClose();
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={STYLES.sectionTitle}>Use as a web component</div>
          <div>This project is an npm package. Install it into your web app straight from its folder:</div>
          {this.renderSnippet(installCommand)}
          <div>Web Component (any page or framework):</div>
          {this.renderSnippet(this.elementSnippet(packageName))}
          <div>JavaScript:</div>
          {this.renderSnippet(`const mount = require('${packageName}');\nmount(document.getElementById('animation'));`)}
          <div>React:</div>
          {this.renderSnippet(`import Animation from '${packageName}/react';\n\n<Animation />`)}
          <div>Vue:</div>
          {this.renderSnippet(`import Animation from '${packageName}/vue';`)}
          <div style={STYLES.row}>
            <button style={STYLES.linkButton} onClick={() => shell.openPath(folder)}>Open project folder</button>
          </div>

          <div style={STYLES.footer}>
            <button style={STYLES.closeButton} onClick={this.props.onClose}>Done</button>
          </div>
        </div>
      </ModalWrapper>
    );
  }
}
