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

# Native Distribution

`function-location` ships prebuilt binaries under `prebuilds/` for supported OS/architecture combinations.
On install, `node-gyp-build` loads the matching prebuild automatically.

This project intentionally does not commit generated binary artifacts.

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- release and branch strategy,
- CI validation workflow rules,
- dry-run release process,
- and prebuild coverage/release checklist.

# License

This library is licensed under the [MIT license](https://github.com/Nhahan/function-location).
