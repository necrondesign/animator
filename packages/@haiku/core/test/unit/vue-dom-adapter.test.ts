import * as tape from 'tape';
import * as TestHelpers from '../TestHelpers';

import HaikuDOMAdapter from '@core/adapters/dom/HaikuDOMAdapter';
import HaikuVueDOMAdapter from '@core/adapters/vue-dom/HaikuVueDOMAdapter';
import code1 from '../fixtures/code1';

tape('vue-dom adapter: mounts, updates and unmounts under Vue 3', (t) => {
  TestHelpers.createDOM(async (err, win, mount) => {
    if (err) {
      throw err;
    }

    // Vue checks for DOM globals when it loads, so load it after createDOM installed them.
    for (const name of ['SVGElement', 'MathMLElement', 'Element', 'Node']) {
      (global as any)[name] = (global as any)[name] || win[name];
    }
    const {createApp, h, nextTick, ref} = require('vue');

    const Animation = HaikuVueDOMAdapter(HaikuDOMAdapter(code1));
    const loop = ref(false);
    let instance;
    const events = [];
    const app = createApp({
      render: () => h(Animation, {
        loop: loop.value,
        ref: (component) => {
          instance = component || instance;
        },
        onHaikuComponentDidMount: () => events.push('didMount'),
      }),
    });
    app.mount(mount);
    await nextTick();

    const host = mount.firstElementChild;
    t.ok(host && host.id.startsWith('haiku-vueroot-'), 'renders the host element');
    t.ok(instance && instance.haiku, 'creates the Haiku component on mount');
    const component = instance.haiku;
    component.context.tick();
    t.ok(host.children.length > 0, 'the animation renders into the host element');
    t.equal(component.config.loop, false, 'props become config');

    const hostId = host.id;
    loop.value = true;
    await nextTick();
    t.equal(component.config.loop, true, 'reactive prop changes reach the component');
    t.equal(mount.firstElementChild.id, hostId, 'the host element keeps its id across updates');

    let unmounted = false;
    const callUnmount = component.callUnmount.bind(component);
    component.callUnmount = () => {
      unmounted = true;
      return callUnmount();
    };
    app.unmount();
    t.ok(unmounted, 'unmounting the app unmounts the component');

    component.context.clock.GLOBAL_ANIMATION_HARNESS.cancel();
    win.close();
    t.end();
  });
});
