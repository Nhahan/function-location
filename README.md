# Description

You can retrieve the path of a class or function using this library, and it supports not only `node` command but also 
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

function TestFunction() {
}

// below returns the location of class or function
locateV8(TestClass);
locateV8(TestFunction);
```

# Return Value

The `locateV8()` function returns the source file path of the currently executing function as a string.

# License

This library is licensed under the [MIT license](https://github.com/Nhahan/function-location).