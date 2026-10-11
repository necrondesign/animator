# Haiku Animator

> **This is an independent community fork** of
> [HaikuTeam/animator](https://github.com/HaikuTeam/animator), maintained by
> [necrondesign](https://github.com/necrondesign). It is not affiliated with or
> endorsed by Haiku Systems Inc. The original code is © Haiku Systems Inc. and is
> distributed under the AGPL-3.0 (runtime `@haiku/core`: MIT); all changes in this
> fork are released under the same licenses. See [LICENSING.md](LICENSING.md) and
> [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Project audit and roadmap:
> [docs/](docs/README.md).

Haiku Animator is a design tool for creating Lottie animations and interactive web components. It's popular among enterprise motion design teams, digital creative studios, and animation classrooms.

Some features:

 - Free-transform canvas for visual vector editing
 - Visual timeline for keyframe animations
 - Exporters for Lottie animations, GIFs, and videos 
 - Asset-linking from Figma, Illustrator, or Sketch
 - Spreadsheet-like property "Expressions" for interactions and animations
 - Code editors for interactive element actions & raw project source

<img alt="Screenshot of Haiku Animator animating its own logo" src="haiku-animator-screenshot.png" />


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

You can also set some overriding environment variables (e.g. `HAIKU_API`) by making a `.env` file in the mono root. Refer to `.env.example` for an example.

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

First lint all of the code:

    $ yarn lint-all

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

Create a PR, file an issue, or join the Slack community with [this invite link](https://join.slack.com/t/haiku-community/shared_invite/zt-4u3snz0w-vcL8qttFFHvlrZNl8NSmPg).


## License

Every project you create with Haiku Animator is entirely *yours,* to license or sell or publish however you'd like.

This project's source code is licensed AGPL.


## Status of this project

Animator was developed commercially for several years under Haiku Systems Inc., a software startup based in San Francisco, California with a team spread across the world.  This code was open-sourced in August 2021 when Haiku shut down the commercial collaboration/storage services connected to Haiku Animator.  Previously available features like publishing & sharing links have been removed.

Our hope is that open-sourcing Haiku Animator allows it to be even more useful, to more people (it's free), and lesfor longer (open source).

This project is open to new maintainers.  This codebase isn't perfect.  In fact, in its current state it has deep flaws.  That said, to a dedicated tinkerer, it has potential.  We created it chasing a dream of creative empowerment — we open-source it in hopes of that dream continuing on.

Read more at https://www.haikuanimator.com/
