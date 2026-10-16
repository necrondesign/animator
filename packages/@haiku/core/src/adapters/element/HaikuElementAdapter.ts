// Wraps a component factory from the DOM adapter as a Custom Element (a "web component"), so an animation can be used
// as a tag such as <my-card></my-card> on any page and in any framework.

// Boolean attributes mapped onto the runtime config, e.g. <my-card loop autoplay="false">.
const BOOLEAN_ATTRIBUTES = ['autoplay', 'loop'];

const HOST_STYLES = ':host{display:block;position:relative}' +
  '.haiku-element-mount{position:relative;width:100%;height:100%;margin:0;padding:0;border:0}';

/**
 * Turns a project or package name into a valid custom element name: lowercase letters, digits and dashes, starting with
 * a letter and containing a dash ("Card" -> "motion-card", "my-card" stays "my-card").
 */
export const toCustomElementName = (name: string): string => {
  const cleaned = String(name || '')
    .toLowerCase()
    .replace(/^@[^/]*\//, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/-+$/, '');
  if (!cleaned) {
    return 'motion-component';
  }
  return cleaned.includes('-') ? cleaned : `motion-${cleaned}`;
};

/**
 * Returns a Custom Element class rendering the component made by `haikuComponentFactory`. With `tagName`, also
 * registers it (if that name isn't registered yet). Returns undefined outside a browser.
 */
export default function HaikuElementAdapter (haikuComponentFactory, tagName?: string) {
  if (typeof HTMLElement === 'undefined' || typeof customElements === 'undefined') {
    return undefined;
  }

  class HaikuElement extends HTMLElement {
    static get observedAttributes () {
      return BOOLEAN_ATTRIBUTES;
    }

    // The Haiku component instance, once the element has been connected.
    haiku;
    mount: HTMLElement;

    connectedCallback () {
      if (!this.mount) {
        const root = this.attachShadow({mode: 'open'});
        const style = document.createElement('style');
        style.textContent = HOST_STYLES;
        this.mount = document.createElement('div');
        this.mount.className = 'haiku-element-mount';
        root.appendChild(style);
        root.appendChild(this.mount);
      }

      if (this.haiku) {
        // Moved or re-inserted into the page.
        this.haiku.callRemount(this.readConfig());
      } else {
        this.haiku = haikuComponentFactory(this.mount, this.readConfig());
      }
    }

    disconnectedCallback () {
      if (this.haiku) {
        this.haiku.callUnmount();
      }
    }

    attributeChangedCallback () {
      if (this.haiku) {
        this.haiku.assignConfig(this.readConfig());
      }
    }

    readConfig () {
      const config = {};
      for (const attribute of BOOLEAN_ATTRIBUTES) {
        if (this.hasAttribute(attribute)) {
          config[attribute] = this.getAttribute(attribute) !== 'false';
        }
      }
      return config;
    }

    get component () {
      return this.haiku;
    }

    setState (states, transition?) {
      if (this.haiku) {
        this.haiku.setState(states, transition);
      }
    }

    play () {
      if (this.haiku) {
        this.haiku.getDefaultTimeline().play();
      }
    }

    pause () {
      if (this.haiku) {
        this.haiku.getDefaultTimeline().pause();
      }
    }
  }

  if (tagName && !customElements.get(tagName)) {
    customElements.define(tagName, HaikuElement);
  }

  return HaikuElement;
}
