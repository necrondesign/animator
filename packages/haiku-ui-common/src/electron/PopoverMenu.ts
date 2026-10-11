import {BaseWindow, KeyboardEvent, Menu, MenuItem, MenuItemConstructorOptions} from 'electron';
import {EventEmitter} from 'events';

type Remote = typeof import('@electron/remote');

// @electron/remote only works inside an Electron renderer (it throws when required in plain Node, e.g. unit tests
// under JSDOM), so load it on first use; outside Electron the menu is simply unavailable.
let cachedRemote: Remote | null | undefined;
const getRemote = (): Remote | null => {
  if (cachedRemote === undefined) {
    try {
      cachedRemote = require('@electron/remote');
    } catch (exception) {
      cachedRemote = null;
    }
  }
  return cachedRemote;
};

const DISPLAY_HACK_TIMEOUT = 100;

export interface MenuSpec {
  type: ('normal' | 'separator' | 'submenu' | 'checkbox' | 'radio');
  label: string;
  enabled: boolean;
  submenu: MenuSpec[];
  onClick: (menuItem: MenuItem, browserWindow: BaseWindow | undefined, event: KeyboardEvent) => void;
}

export interface MenuItemLaunchConfig {
  items: MenuSpec[];
}

const buildMenuItem = (menu: Menu, {type, label, enabled, submenu, onClick}: MenuSpec) => {
  const menuSpec: MenuItemConstructorOptions = {
    type,
    label,
    enabled,
    click: onClick,
  };

  if (submenu && submenu.length > 0) {
    menuSpec.submenu = new (getRemote().Menu)();
    submenu.forEach((subitem) => {
      buildMenuItem(menuSpec.submenu as Menu, subitem);
    });
  }

  const item = new (getRemote().MenuItem)(menuSpec);

  menu.append(item);
};

export class PopoverMenu extends EventEmitter {
  menu: Menu = null;

  launch ({items}: MenuItemLaunchConfig) {
    const remote = getRemote();
    if (!remote) {
      return;
    }

    this.menu = new remote.Menu();

    items.forEach((item) => {
      buildMenuItem(this.menu as Menu, item);
    });

    this.show();
  }

  show () {
    if (!this.menu) {
      return;
    }

    setTimeout(
      () => {
        this.menu.popup({window: getRemote().getCurrentWindow()});
      },
      DISPLAY_HACK_TIMEOUT,
    );
  }
}

const singleton = new PopoverMenu();

export default singleton;
