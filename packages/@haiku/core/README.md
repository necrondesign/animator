# Animator Core

[![NPM](https://nodei.co/npm/@haiku/core.png)](https://nodei.co/npm/@haiku/core/)

Animator Core is the runtime and rendering engine for [motion-side](https://github.com/necrondesign/motion-side) (based on Haiku Animator) and the components you create with it.  This engine is a dependency for any Haiku Animator components that are run on the web.

Note that for iOS and Android, the editor also exports to Lottie.  Animator Core is only used when rendering Animator components for the web.

<br>
<p align="center">
  <img width="80%" src="docs/assets/gif-of-animated-or-interactive-haiku-component.gif">
</p>
<br>

<br>

### Compatible with modern browsers

<br>

Animator Core is compatible with all major modern web browsers: Firefox, Chrome, Safari, and Edge. Its footprint is ~50kB gzipped.

<br>
<p align="center">
  <img width="40%" src='docs/assets/browser-logos.png' />
</p>
<br>


### Hackable + compatible with existing codebases

Animator Core provides a simple and familiar API for runtime manipulation of components that were built in Animator. You can play and pause animations, react to events, and even pass in dynamic data.

<br>

### Getting started

Every project made in [motion-side](https://github.com/necrondesign/motion-side) is an npm package that contains its
components and this runtime:

1. Design a component in motion-side.
2. Install the project folder into your app: `$ npm install <path to the project folder>`
3. Use it — the editor's Export window shows the exact snippets for your project:
   - web component, on any page or in any framework: `import '<package>/element'` and use the tag it registers
     (named after the package, e.g. `<my-card></my-card>`; attributes `autoplay` and `loop`; methods `play()`,
     `pause()`, `setState()`)
   - plain JavaScript: `require('<package>')(document.getElementById('mount'))`
   - React 18 or 19: `import Animation from '<package>/react'` and render `<Animation />`
   - Vue: `import Animation from '<package>/vue'`

<br>

#### Direct installation

To develop with the runtime directly, use this repository's `packages/@haiku/core` (it is not published to npm by
this fork).

<br>

### API / Docs

The original Haiku documentation site is gone. The type definitions in `src/api/index.ts` describe the component API,
and the examples below cover the common cases.

<br>

### Usage examples

Simple:

    import AnimatorCore from "@haiku/core/dom";
    const definition = {template: {elementName: 'div', children: ['Hello Animator!']}};
    const factory = AnimatorCore(definition);
    const component = factory(document.getElementById("mount"));

Animated:

    import AnimatorCore from "@haiku/core/dom";
    const definition = {
      timelines: {
        Default: {
          "#box": {
            "style.width": { 0: { value: "100px" }},
            "style.height": { 0: { value: "100px" }},
            "style.backgroundColor": { 0: { value: "red" }},
            "rotation.z": {
              0: { value: 0, curve: "linear" },
              1000: { value: 3.14159 },
            },
          },
        },
      },
      template: {
        elementName: 'div',
        attributes: {id: 'box'},
        children: ['Hello Animation!'],
      },
    };
    const factory = AnimatorCore(definition);
    const component = factory(document.getElementById("mount"));

Interactive:

    import AnimatorCore from "@haiku/core/dom";
    const definition = {
      options: {
        autoplay: false,
      },
      states: {
        clicks: {
          value: 0,
        },
      },
      eventHandlers: {
        "#box": {
          "click": {
            handler: function () {
              this.state.clicks += 1;
              this.getTimeline("Default").play();
            },
          },
        },
      },
      timelines: {
        Default: {
          "#box": {
            "content": { 0: {
              value: function (clicks) {
                return clicks + "";
              },
            }},
            "style.width": { 0: { value: "100px" }},
            "style.height": { 0: { value: "100px" }},
            "style.backgroundColor": { 0: { value: "red" }},
            "rotation.z": {
              0: { value: 0, curve: "linear" },
              1000: { value: 3.14159 },
            },
          },
        },
      },
      template: {
        elementName: 'div',
        attributes: {id: 'box'},
      },
    };
    const factory = AnimatorCore(definition);
    const component = factory(document.getElementById("mount"));

<br>

## Tracking / Analytics

The runtime sends no telemetry. Built-in Mixpanel tracking and the branded right-click
menu were removed in this fork; the `mixpanel` and `contextMenu` options are still
accepted for backward compatibility but are ignored.

<br>

## Bugs / Feature Requests / Troubleshooting

Please use [GitHub Issues](https://github.com/necrondesign/motion-side/issues).

<br>

## Contributing

Please send contributions via [pull request](https://github.com/HaikuTeam/core/pulls).

<br>

## Roadmap

**Code improvements**

- Use arrow functions throughout _(in progress!)_
- Improve test coverage
- Inline source code docs
- Types

**Features**

- Alternative component formats
- Improved Lottie integration
- More comprehensive programmatic API

<br>

## Development

To develop Animator Core locally:

1. Fork the repo
2. `$ yarn install`

Compile with:

    $ yarn compile

Test with:

    $ yarn test

Find formatting problems with:

    $ yarn lint

Run demos in your browser:

    $ yarn demos

<br>

## License / Copyright

MIT. Please refer to LICENSE.txt. Copyright (c) 2016-2018 Haiku Systems Inc.
