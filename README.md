vreath-cli
==========

CLI wallet for Vreath

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/vreath-cli.svg)](https://npmjs.org/package/vreath-cli)
[![Downloads/week](https://img.shields.io/npm/dw/vreath-cli.svg)](https://npmjs.org/package/vreath-cli)
[![License](https://img.shields.io/npm/l/vreath-cli.svg)](https://github.com/Vreath-core/vreath-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g vreath-cli
$ vreath-cli COMMAND
running command...
$ vreath-cli (-v|--version|version)
vreath-cli/0.0.1 darwin-x64 node-v8.0.0
$ vreath-cli --help [COMMAND]
USAGE
  $ vreath-cli COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`vreath-cli hello [FILE]`](#vreath-cli-hello-file)
* [`vreath-cli help [COMMAND]`](#vreath-cli-help-command)

## `vreath-cli hello [FILE]`

describe the command here

```
USAGE
  $ vreath-cli hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ vreath-cli hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/Vreath-core/vreath-cli/blob/v0.0.1/src/commands/hello.ts)_

## `vreath-cli help [COMMAND]`

display help for vreath-cli

```
USAGE
  $ vreath-cli help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.1.4/src/commands/help.ts)_
<!-- commandsstop -->
