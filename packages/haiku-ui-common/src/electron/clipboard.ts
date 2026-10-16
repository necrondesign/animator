import {ipcRenderer} from 'electron';

// Electron 44 no longer exposes `clipboard` to renderer processes and made it asynchronous, so renderers go through
// the main process (handlers in registerBridgeHandlers, ./bridge.ts).
export const CLIPBOARD_READ_TEXT = 'clipboard:read-text';
export const CLIPBOARD_WRITE_TEXT = 'clipboard:write-text';

export const clipboard = {
  readText: (): Promise<string> => ipcRenderer.invoke(CLIPBOARD_READ_TEXT),
  writeText: (text: string): Promise<void> => ipcRenderer.invoke(CLIPBOARD_WRITE_TEXT, text),
};
