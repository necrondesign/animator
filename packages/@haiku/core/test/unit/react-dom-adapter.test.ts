import * as tape from 'tape';
import * as TestHelpers from '../TestHelpers';

import HaikuDOMAdapter from '@core/adapters/dom/HaikuDOMAdapter';
import HaikuReactDOMAdapter from '@core/adapters/react-dom/HaikuReactDOMAdapter';
import code1 from '../fixtures/code1';

tape('react-dom adapter: mounts, updates and unmounts under React 19', (t) => {
  TestHelpers.createDOM(async (err, win, mount) => {
    if (err) {
      throw err;
    }

    // React needs the DOM globals that createDOM installs, so load it afterwards.
    (global as any).IS_REACT_ACT_ENVIRONMENT = true;
    const React = require('react');
    const {createRoot} = require('react-dom/client');
    const {act} = React;

    const Animation: any = HaikuReactDOMAdapter(HaikuDOMAdapter(code1), undefined);
    const ref = React.createRef();
    const root = createRoot(mount);

    await act(async () => {
      root.render(React.createElement(Animation, {ref, loop: false}));
    });

    const host = mount.firstChild;
    t.ok(host && host.id.startsWith('haiku-reactroot-'), 'renders the host element');
    t.ok(ref.current && ref.current.haiku, 'creates the Haiku component on mount');
    const component = ref.current.haiku;
    // Other tests may have stopped the shared animation loop, so render a frame explicitly.
    component.context.tick();
    t.ok(host.children.length > 0, 'the animation renders into the host element');

    const configs = [];
    const assignConfig = component.assignConfig.bind(component);
    component.assignConfig = (config) => {
      configs.push(config);
      return assignConfig(config);
    };

    await act(async () => {
      root.render(React.createElement(Animation, {ref, loop: true}));
    });
    t.equal(configs.length, 1, 'new props reach the component');
    t.equal(configs[0].loop, true, 'with the new values');

    let unmounted = false;
    const callUnmount = component.callUnmount.bind(component);
    component.callUnmount = () => {
      unmounted = true;
      return callUnmount();
    };

    await act(async () => {
      root.unmount();
    });
    t.ok(unmounted, 'unmounting the React tree unmounts the component');

    component.context.clock.GLOBAL_ANIMATION_HARNESS.cancel();
    t.end();
  });
});
