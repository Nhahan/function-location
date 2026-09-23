# function-location

`locateV8()` returns the absolute source file path for a function or class at runtime.

[![npm](https://img.shields.io/npm/v/function-location.svg)](https://www.npmjs.com/package/function-location)
[![CI](https://img.shields.io/github/actions/workflow/status/Nhahan/function-location/ci.yml?branch=main)](https://github.com/Nhahan/function-location/actions/workflows/ci.yml)

## Install

```bash
npm install function-location
```

Supports Node.js `20` through `26` on Linux x64 (glibc), Windows x64, and macOS (x64 and arm64).

## Usage

```ts
import { locateV8 } from 'function-location';

class ExampleClass {}
function exampleFunction() {}

locateV8(ExampleClass);     // /path/to/file.ts
locateV8(exampleFunction);  // /path/to/file.ts
```

## API

`locateV8(input: Function): string | undefined`

- Works for classes, functions, methods, arrow functions, and async/generator functions, named or anonymous.
- Bound functions resolve to the location of their target function.
- Functions compiled with `vm` resolve to the script `filename`.
- Returns `undefined` when no source file exists: builtins (`Math.max`, `Array`), functions created by `eval` or `new Function`, and proxies.
- Throws `TypeError: Function argument expected` when `input` is not a function.

## Performance sample

This library uses a synchronous native addon lookup instead of the inspector protocol.

Sample comparison against an inspector-protocol baseline:

| Approach | Median time / call | Relative speed |
| --- | ---: | ---: |
| `locateV8` | `0.0254 µs` | `14438.93x faster` |
| `inspector protocol` | `367.4543 µs` | `baseline` |

![Locating performance (example run)](./docs/benchmark-locate.png)

Results vary by environment; treat them as sample measurements only.
Methodology and raw samples: [docs/BENCHMARK.md](./docs/BENCHMARK.md)

## Links

- [Contributing / support matrix](./CONTRIBUTING.md)
- [MIT License](https://github.com/Nhahan/function-location/blob/main/LICENSE)
