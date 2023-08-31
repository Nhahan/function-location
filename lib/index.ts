import {TestClass} from "../test/test-class";

const {locate} = require('./locate.node');
// TODO: build on win32
// const {locateWin} = require('./locate-win.node');

export function locateV8(input: Function) {
    // process.platform === 'win32' ? locate(input) : locate(locateWin(input));

    return locate(input);
}

console.log(locateV8(TestClass));