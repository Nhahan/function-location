# function-location

`locate()` returns the absolute source file path for a function or class at runtime.

[![npm](https://img.shields.io/npm/v/function-location.svg)](https://www.npmjs.com/package/function-location)
[![CI](https://img.shields.io/github/actions/workflow/status/Nhahan/function-location/ci.yml?branch=main)](https://github.com/Nhahan/function-location/actions/workflows/ci.yml)

## Install

```bash
npm install function-location
```

Supports Node.js `16+`.
On Linux x64 (glibc), Windows x64, and macOS, npm installs the matching native package automatically.

## Usage

```ts
import { locate } from 'function-location';

class ExampleClass {}
function exampleFunction() {}

locate(ExampleClass);     // /path/to/file.ts
locate(exampleFunction);  // /path/to/file.ts
```

## API

- `locate(input: Function): string | undefined`
- Throws `Function argument expected` when input is not a function/class constructor.
- Returns `undefined` for anonymous/native/builtins where metadata is unavailable.

## Performance sample

This library uses a synchronous native addon lookup instead of the inspector protocol.

Sample comparison against an inspector-protocol baseline:

| Approach | Avg. time / call | Relative speed |
| --- | ---: | ---: |
| `locate` | `0.1126 µs` | `1413x faster` |
| `inspector protocol` | `159.12 µs` | `baseline` |

![Locating performance (example run)](./docs/benchmark-locate.svg)

Results vary by environment; treat them as sample measurements only.
Methodology and raw samples: [docs/BENCHMARK.md](./docs/BENCHMARK.md)

## Links

- [Contributing / support matrix](./CONTRIBUTING.md)
- [MIT License](https://github.com/Nhahan/function-location/blob/main/LICENSE)
