
/**
 * Copyright (c) Haiku 2016-2018. All rights reserved.
 */

import {BytecodeNode} from '../../api';
import HaikuComponent from '../../HaikuComponent';
import getParsedProperty from '../../helpers/getParsedProperty';
import {randomString} from '../../helpers/StringUtils';

// Vue 3 (installed by the app). Loaded on use, so the runtime works without Vue when this adapter is not used.
const vue = () => require('vue');

const EMITTED_EVENTS = [
  'haikuComponentWillInitialize',
  'haikuComponentDidInitialize',
  'haikuComponentWillMount',
  'haikuComponentDidMount',
  'haikuComponentWillUnmount',
];

// Element and component vnodes from the default slot (Vue 3 slots are functions; text and comments are skipped).
const slotElements = (vueComponent) => (vueComponent.$slots.default ? vueComponent.$slots.default() : [])
  .filter((node: any) => node && (typeof node.type === 'string' || typeof node.type === 'object'));

const clearProps = (props): Object => {
  const result = {};

  for (const verboseKeyName in props) {
    if (props[verboseKeyName] === undefined) {
      continue;
    }

    Object.assign(result, getParsedProperty(props, verboseKeyName));
  }

  return result;
};

const allProps = (vueComponent) => {
  return Object.assign(
    clearProps(vueComponent.$props),
    {
      ref: vueComponent.$el,
      onHaikuComponentWillInitialize: (component) => {
        vueComponent.$emit('haikuComponentWillInitialize', component);
      },
      onHaikuComponentDidMount: (component) => {
        vueComponent.$emit('haikuComponentDidMount', component);
      },
      onHaikuComponentWillMount: (component) => {
        vueComponent.$emit('haikuComponentWillMount', component);
      },
      onHaikuComponentDidInitialize: (component) => {
        vueComponent.$emit('haikuComponentDidInitialize', component);
      },
      onHaikuComponentWillUnmount: (component) => {
        vueComponent.$emit('haikuComponentWillUnmount', component);
      },
      children: slotElements(vueComponent),
      vanities: {
        'controlFlow.placeholder': (
          element: BytecodeNode,
          surrogate,
          value,
          context,
          timeline,
          receiver,
          sender: HaikuComponent,
        ) => {

          if (element.__memory.placeholder.surrogate === surrogate || !element.__memory.targets) {
            return;
          }

          const node = element.__memory.targets[0];
          if (node) {
            const vueElement = surrogate.el;
            const div = document.createElement('div');
            node.parentNode.replaceChild(div, node);

            node.style.visibility = 'hidden';
            if (vueElement) {
              div.appendChild(vueElement);
            }

            window.requestAnimationFrame(() => {
              element.__memory.placeholder.surrogate = surrogate;
              node.style.visibility = 'visible';
            });
            sender.markHorizonElement(element);
            sender.markForFullFlush();
          }
        },
      },
    },
  );
};

export default function HaikuVueDOMAdapter (haikuComponentFactory): {} {
  return {
    emits: EMITTED_EVENTS,
    props: {
      // We use null (which is the equivalent of 'any') for Boolean values
      // because Vue does typecasting for us, which sets undefined to false.
      automount: null,
      autoplay: null,
      forceFlush: null,
      freeze: null,
      loop: null,
      alwaysComputeSizing: null,
      seed: String,
      sizing: String,
      timestamp: Number,
      frame: Function,
      clock: Object,
      preserve3d: String,
      contextMenu: String,
      position: String,
      overflowX: String,
      overflowY: String,
      overflow: String,
      mixpanel: String,
      interactionMode: Object,
      states: Object,
      eventHandlers: Object,
      timelines: Object,
      vanities: Object,
      children: Array,
      placeholder: Object,
      // LEGACY
      haikuOptions: Object,
    },
    created () {
      // Stable across re-renders.
      this.hostId = `haiku-vueroot-${randomString(24)}`;
    },
    mounted () {
      this.haiku = haikuComponentFactory(this.$el, allProps(this));
    },
    updated () {
      this.haiku.assignConfig(allProps(this));
    },
    unmounted () {
      this.haiku.callUnmount();
    },
    render () {
      return vue().h('div', {
        id: this.hostId,
        style: {
          position: 'relative',
          margin: 0,
          padding: 0,
          border: 0,
          width: '100%',
          height: '100%',
          transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
        },
      }, this.$slots.default ? this.$slots.default() : undefined);
    },
  };
}
