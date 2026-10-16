# @haiku/cli

> The motion-side command-line tool

Creates animation component projects without the desktop app.

## Usage

The CLI is not published to npm. From a checkout of this repository, after `yarn install` and `yarn compile-all`:

```
$ node packages/@haiku/cli/bin/motion-side generate MyComponent
```

For a list of available commands, enter:

```
$ node packages/@haiku/cli/bin/motion-side --help
```

The cloud commands of the original Haiku CLI (`login`, `list`, `clone`, `install`, …) were removed together with
Haiku's servers.

## License

MIT. See LICENSE.

## Copyright

Copyright (c) 2017 Haiku Systems
