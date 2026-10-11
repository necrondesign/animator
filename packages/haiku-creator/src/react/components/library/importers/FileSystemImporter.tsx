import * as remote from '@electron/remote';
import {isMac} from 'haiku-common/lib/environments/os';
import {Experiment, experimentIsEnabled} from 'haiku-common/lib/experiments';
import * as React from 'react';

export interface FileSystemImporterProps {
  onFileDrop (files: string[]): void;
  style?: React.CSSProperties;
  text?: string;
}

class FileSystemImporter extends React.PureComponent<FileSystemImporterProps> {
  showImportDialog = () => {
    const validExtensions = [
      'svg',
      'ai',
    ];

    if (experimentIsEnabled(Experiment.AllowBitmapImages)) {
      validExtensions.push(
        'jpg',
        'jpeg',
        'png',
        'gif',
      );
    }

    // Only mac offers support for Sketch
    if (isMac()) {
      validExtensions.push('sketch');
    }

    remote.dialog.showOpenDialog({
      title: 'Import to Library',
      filters: [{name: 'Valid Files', extensions: validExtensions}],
      properties: ['multiSelections', 'openFile'],
    }).then(({canceled, filePaths}) => {
      // Electron 2's callback received `undefined` on cancel; keep that contract for onFileDrop.
      this.props.onFileDrop(canceled ? undefined : filePaths);
    });
  };

  render () {
    return (
      <div
        style={this.props.style}
        onClick={this.showImportDialog}
      >
        {this.props.text || 'Import From File'}
      </div>
    );
  }
}

export default FileSystemImporter;
