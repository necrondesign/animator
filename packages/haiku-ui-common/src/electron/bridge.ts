import {
  BrowserWindow,
  clipboard,
  dialog,
  IpcMain,
  ipcRenderer,
  Menu,
  MenuItemConstructorOptions,
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
  WebContents,
} from 'electron';
import {CLIPBOARD_READ_TEXT, CLIPBOARD_WRITE_TEXT} from './clipboard';

// Main-process services for the renderers (Creator, Glass, Timeline), reached over IPC instead of @electron/remote.
// Renderers import the helpers below; the main process calls registerBridgeHandlers once.

const CHANNELS = {
  showOpenDialog: 'bridge:show-open-dialog',
  showSaveDialog: 'bridge:show-save-dialog',
  showMessageBox: 'bridge:show-message-box',
  openDevTools: 'bridge:open-dev-tools',
  closeDevToolsIfFocused: 'bridge:close-dev-tools-if-focused',
  destroyWindow: 'bridge:destroy-window',
  showContextMenu: 'bridge:show-context-menu',
};

// Outside Electron (unit tests under JSDOM) there is no ipcRenderer; calls then reject instead of throwing.
const invoke = <T>(channel: string, ...args: any[]): Promise<T> => ipcRenderer
  ? ipcRenderer.invoke(channel, ...args)
  : Promise.reject(new Error(`${channel} is only available in Electron`));

export interface ContextMenuItem {
  id?: string;
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
  label?: string;
  enabled?: boolean;
  submenu?: ContextMenuItem[];
}

export const dialogs = {
  showOpenDialog: (options: OpenDialogOptions): Promise<OpenDialogReturnValue> =>
    invoke(CHANNELS.showOpenDialog, options),
  showSaveDialog: (options: SaveDialogOptions): Promise<SaveDialogReturnValue> =>
    invoke(CHANNELS.showSaveDialog, options),
  showMessageBox: (options: MessageBoxOptions): Promise<MessageBoxReturnValue> =>
    invoke(CHANNELS.showMessageBox, options),
};

export const devTools = {
  open: (): Promise<void> => invoke(CHANNELS.openDevTools),
  closeIfFocused: (): Promise<void> => invoke(CHANNELS.closeDevToolsIfFocused),
};

export const currentWindow = {
  destroy: (): Promise<void> => invoke(CHANNELS.destroyWindow),
};

/**
 * Shows a native context menu at the cursor; resolves with the id of the chosen item, or null if none was chosen.
 */
export const showContextMenu = (items: ContextMenuItem[]): Promise<string | null> =>
  invoke(CHANNELS.showContextMenu, items);

// A <webview> belongs to the Creator window that hosts it.
const windowOf = (contents: WebContents) => BrowserWindow.fromWebContents(contents.hostWebContents || contents);

const buildMenu = (items: ContextMenuItem[], choose: (id: string) => void): Menu => Menu.buildFromTemplate(
  items.map((item): MenuItemConstructorOptions => ({
    type: item.type,
    label: item.label,
    enabled: item.enabled,
    submenu: item.submenu && item.submenu.length > 0 ? buildMenu(item.submenu, choose) : undefined,
    click: item.id ? () => choose(item.id) : undefined,
  })),
);

export const registerBridgeHandlers = (ipcMain: IpcMain) => {
  ipcMain.handle(CLIPBOARD_READ_TEXT, () => clipboard.readText());
  ipcMain.handle(CLIPBOARD_WRITE_TEXT, (_, text) => clipboard.writeText(String(text)));
  ipcMain.handle(CHANNELS.showOpenDialog, (event, options: OpenDialogOptions) =>
    dialog.showOpenDialog(windowOf(event.sender), options));
  ipcMain.handle(CHANNELS.showSaveDialog, (event, options: SaveDialogOptions) =>
    dialog.showSaveDialog(windowOf(event.sender), options));
  ipcMain.handle(CHANNELS.showMessageBox, (event, options: MessageBoxOptions) =>
    dialog.showMessageBox(windowOf(event.sender), options));
  ipcMain.handle(CHANNELS.openDevTools, (event) => {
    event.sender.openDevTools();
  });
  ipcMain.handle(CHANNELS.closeDevToolsIfFocused, (event) => {
    if (event.sender.isDevToolsFocused()) {
      event.sender.closeDevTools();
    }
  });
  ipcMain.handle(CHANNELS.destroyWindow, (event) => {
    const window = windowOf(event.sender);
    if (window) {
      window.destroy();
    }
  });
  ipcMain.handle(CHANNELS.showContextMenu, (event, items: ContextMenuItem[]) => new Promise((resolve) => {
    const menu = buildMenu(items, resolve);
    // The close callback can run before the click handler, so give a click the chance to resolve first.
    menu.popup({window: windowOf(event.sender), callback: () => setTimeout(() => resolve(null), 50)});
  }));
};
