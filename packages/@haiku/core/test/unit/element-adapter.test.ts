import * as tape from 'tape';
import * as TestHelpers from '../TestHelpers';

import HaikuDOMAdapter from '@core/adapters/dom/HaikuDOMAdapter';
import HaikuElementAdapter, {toCustomElementName} from '@core/adapters/element/HaikuElementAdapter';
import code1 from '../fixtures/code1';

tape('element adapter: custom element names', (t) => {
  t.equal(toCustomElementName('my-card'), 'my-card', 'valid names stay');
  t.equal(toCustomElementName('Card'), 'motion-card', 'a dash is added when missing');
  t.equal(toCustomElementName('@scope/Hero Banner'), 'hero-banner', 'scope and spaces');
  t.equal(toCustomElementName('2d_shapes'), 'd-shapes', 'must start with a letter');
  t.equal(toCustomElementName(''), 'motion-component', 'fallback');
  t.end();
});

tape('element adapter: renders as a custom element and follows the page lifecycle', (t) => {
  TestHelpers.createDOM((err, win) => {
    if (err) {
      throw err;
    }
    const globals = global as any;
    globals.HTMLElement = win.HTMLElement;
    globals.customElements = win.customElements;

    const ElementClass = HaikuElementAdapter(HaikuDOMAdapter(code1), 'test-card');
    t.equal(win.customElements.get('test-card'), ElementClass, 'registers the tag');
    t.equal(HaikuElementAdapter(HaikuDOMAdapter(code1), 'test-card') !== undefined, true, 'defining twice is harmless');

    const element = win.document.createElement('test-card');
    element.setAttribute('loop', '');
    win.document.body.appendChild(element);

    const component = element.component;
    t.ok(component, 'creates the component when connected');
    t.equal(component.config.loop, true, 'boolean attributes become config');
    t.ok(element.shadowRoot && element.shadowRoot.querySelector('.haiku-element-mount'), 'renders into its shadow root');
    component.context.tick();
    t.ok(element.shadowRoot.querySelector('.haiku-element-mount').children.length > 0, 'the animation is rendered');

    element.setAttribute('loop', 'false');
    t.equal(component.config.loop, false, 'attribute changes update the config');

    let unmounted = 0;
    let remounted = 0;
    const callUnmount = component.callUnmount.bind(component);
    const callRemount = component.callRemount.bind(component);
    component.callUnmount = () => {
      unmounted++;
      return callUnmount();
    };
    component.callRemount = (config) => {
      remounted++;
      return callRemount(config);
    };
    element.remove();
    t.equal(unmounted, 1, 'removing the element unmounts the component');
    win.document.body.appendChild(element);
    t.equal(remounted, 1, 're-inserting it remounts the same component');
    t.equal(element.component, component, 'without creating a new one');

    component.context.clock.GLOBAL_ANIMATION_HARNESS.cancel();
    // Remounting restarted the clock on this window's timers; closing the window stops them.
    win.close();
    t.end();
  });
});
