import {TestClass} from "../test/test-class";

const {locate} = require('./locate.node');

export function locateV8(input: Function) {
    return locate(input);
}

console.log(locateV8(TestClass));