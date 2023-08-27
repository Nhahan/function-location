const {locate} = require('./locate.node');

export function locateV8(input: Function) {
    return locate(input);
}
