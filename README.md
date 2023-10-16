# Description

You can retrieve the path of a class or function using this library, and it supports not only `node` command but also 
`ts-node`.

# Installation

```bash
npm i function-location
```

# Usage

```ts
import { locateV8 } from 'function-location';

class TestClass {
}

function TestFunction() {
}

// below returns the location of class or function
locateV8(TestClass);
locateV8(TestFunction);
```

# Return Value

The `locate()` function returns the source file path of the currently executing function as a string.

# License

This library is provided under the [MIT license](https://github.com/Nhahan/function-location). The copyright for the relevant code is subject to that license.