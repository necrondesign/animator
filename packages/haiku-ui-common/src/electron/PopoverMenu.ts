import {EventEmitter} from 'events';
import {ContextMenuItem, showContextMenu} from './bridge';

const DISPLAY_HACK_TIMEOUT = 100;

export interface MenuSpec {
  type?: ('normal' | 'separator' | 'submenu' | 'checkbox' | 'radio');
  label?: string;
  enabled?: boolean;
  submenu?: MenuSpec[] | false;
  onClick?: (...args: any[]) => void;
}

export interface MenuItemLaunchConfig {
  event?: any;
  items: MenuSpec[];
}

/**
 * Native context menu for the renderers. The main process shows the menu (see bridge.ts) and reports which item was
 * chosen; the item's onClick then runs here, in the renderer that launched the menu.
 */
export class PopoverMenu extends EventEmitter {
  launch ({items}: MenuItemLaunchConfig) {
    const handlers = new Map<string, () => void>();

    const describe = (specs: MenuSpec[]): ContextMenuItem[] => specs.map((spec) => {
      const item: ContextMenuItem = {type: spec.type, label: spec.label, enabled: spec.enabled};
      if (spec.submenu && spec.submenu.length > 0) {
        item.submenu = describe(spec.submenu);
      }
      if (spec.onClick) {
        item.id = String(handlers.size);
        handlers.set(item.id, spec.onClick);
      }
      return item;
    });

    const template = describe(items);

    setTimeout(
      () => {
        showContextMenu(template).then((chosenId) => {
          const handler = chosenId === null ? undefined : handlers.get(chosenId);
          if (handler) {
            handler();
          }
        }, () => {
          // Not running in Electron (e.g. unit tests under JSDOM): there is no menu to show.
        });
      },
      DISPLAY_HACK_TIMEOUT,
    );
  }
}

const singleton = new PopoverMenu();

export default singleton;
