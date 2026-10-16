# motion-side

**motion-side** is a desktop editor for interactive web animations: draw on a timeline, add states and
expressions, and ship the result as a web component (vanilla JS, React, Vue) or export it to Lottie, GIF or video.

> **Based on [Haiku Animator](https://github.com/HaikuTeam/animator).** motion-side is an independent fork
> maintained by [necrondesign](https://github.com/necrondesign); it is not affiliated with or endorsed by
> Haiku Systems Inc. The original code is © Haiku Systems Inc. and is distributed under the AGPL-3.0 (runtime
> `@haiku/core`: MIT); all changes in this fork are released under the same licenses. See
> [LICENSING.md](LICENSING.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Project audit and roadmap:
> [docs/](docs/README.md) (current status: [docs/STATUS.md](docs/STATUS.md)).

Features:

 - Free-transform canvas for visual vector editing
 - Visual timeline for keyframe animations
 - States, actions and spreadsheet-like property "Expressions" for interactive components
 - Web component output for vanilla JS, React and Vue via the `@haiku/core` runtime
 - Exporters for Lottie animations, GIFs, and videos
 - Asset-linking from Sketch, Illustrator or Figma
 - Code editors for interactive element actions & raw project source

Internal package names (`@haiku/core`, `haiku-*`) and the project file format keep their original names so that
existing Haiku Animator projects and embedded components stay compatible.


# Installation

Prebuilt releases of this fork are not published yet. Run from source by following the `Development`
instructions below, or build an installer yourself (see "Build installers").


# Development

## 1. Install prerequisites

* **Node.js 24 LTS** (see `.nvmrc`), e.g. `nvm install && nvm use`
* **Yarn 1.22.22** via corepack, which ships with Node: `corepack enable`
* **git**

No Python, node-gyp toolchain or native libraries are required: the project no longer has native Node modules.

## 2. Install project dependencies

After you clone the repository, run:

    $ yarn install

Check your toolchain at any time with `yarn doctor`.

## 3. Build and test

    $ yarn compile-all    # compile all TypeScript packages
    $ yarn test-all       # run every package's tests; exits non-zero if any package fails

Tests run with `HOME` pointed at a throwaway directory, so they never touch your real `~/.haiku`.

    $ yarn smoke          # launch the real app on a test project and check that the editor comes up

## 4. Start the app

You can start all the dev servers with:

    $ yarn start

You can also skip the interactive prompt and start with good defaults with:

    $ yarn go

Environment variables can also be set in `~/.haiku/.env` (one `NAME=value` per line).

### Build installers

    $ yarn compile-all
    $ yarn dist           # installers for the current OS into dist/ (yarn dist:dir for an unpacked app)

Builds are unsigned by default. To sign and notarize macOS builds, provide a signing identity for electron-builder
(`CSC_LINK`, `CSC_KEY_PASSWORD`) and `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
Pushing a `v*` tag runs `.github/workflows/release.yml`, which builds for macOS, Windows and Linux and attaches the
installers to a draft GitHub Release.

### Watching changes

For the compiler to watch for changes as you develop, run the following command in a separate Terminal tab:

    $ yarn watch-all

### Before committing

First lint all of the code (this only reports problems):

    $ yarn lint

Safe automatic fixes (formatting, `let` → `const`) can be applied explicitly with `yarn lint:fix`.

Then run the unit tests in all of the code:

    $ yarn test-all

You might also want to run:

    $ yarn compile-all

Assuming no lint errors or test failures, push your changes:

    $ git push # and create a pull request

### Debugging

There are configurations included here for debugging any of the UI directly from inside VS Code.

**You must install the `Debugger for Chrome` VS Code extension to use these.  (cmd + shift + p, "install extensions", "Debugger for Chrome")**

To debug, first launch mono normally (see `Starting`) — then from VS Code's left-side Debug menu, select `attach-glass`, `attach-timeline`, or `attach-creator`.  You can then place breakpoints, explore stack traces, explore local values (and more) from inside VS Code.

In general, Plumbing can be debugged on port 9221 and Electron renderer processes can be debugged on port 9222.

### Profiling

To add profile to any code, you should call 

```
logger.time('<user defined name>')
<code to be profiled>
logger.timeEnd('<user defined name>')
```

And it will output
```
<timestamp>|<process>|info|d=149|<user defined name>
```
with `d` being duration between `logger.time` and `logger.timeEnd`. To do a subsequent profile with same name, you should call `logger.time` rearm again.

## Contributing

Open an issue or a pull request at [necrondesign/motion-side](https://github.com/necrondesign/motion-side).


## License

Every project you create with motion-side is entirely *yours,* to license or sell or publish however you'd like.

The editor's source code is licensed AGPL-3.0-or-later; the `@haiku/core` runtime is MIT. See [LICENSING.md](LICENSING.md).


## History

motion-side continues [Haiku Animator](https://github.com/HaikuTeam/animator), which Haiku Systems Inc.
developed commercially for several years and open-sourced in August 2021, when Haiku shut down the commercial
collaboration and storage services connected to it. In the original authors' words, they open-sourced it "in hopes
of that dream continuing on". This fork removed the dead cloud services and telemetry, modernized the toolchain and
moved the app to a current Electron; see [docs/STATUS.md](docs/STATUS.md).
