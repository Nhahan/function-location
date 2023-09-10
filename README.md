# Description

The function-location library is a tool for finding the location of the currently executing function in a JavaScript environment. By utilizing this library, you can extract the source file path of the executing function.

# Installation

```bash
npm i function-location
```

# Usage

```ts
import { locate } from 'function-location';

function myFunction() {
    const sourceFilePath = locate();
    console.log(sourceFilePath);
}

myFunction();
```

# Return Value

The `locate()` function returns the source file path of the currently executing function as a string. If the function's location cannot be determined, it returns `undefined`.

# License

This library is provided under the [MIT license](https://github.com/Nhahan/function-location). The copyright for the relevant code is subject to that license.