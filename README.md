# Description

Retrieve the path of a class or function using this library, and it supports not only `node` command but also 
`ts-node`.

# Installation

```bash
npm install function-location
```

# Usage

```ts
import { locateV8 } from 'function-location';

class TestClass {
}

function testFunction() {
}

locateV8(TestClass);
locateV8(testFunction);
```

# Return Value

The `locateV8()` function returns the source file path of the currently executing function as a string.

# License

This library is licensed under the [MIT license](https://github.com/Nhahan/function-location).

# Native Distribution

`function-location` ships prebuilt binaries under `prebuilds/` for supported `node-gyp-build` platforms.
When no compatible prebuild exists, installation falls back to a local `node-gyp` rebuild through
`node-gyp-build` (requires local build tooling).
