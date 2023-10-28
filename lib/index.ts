const locateOs = process.platform === 'win32' ? './locate-win.node' : './locate.node';

export function locateV8(input: Function) {
    const {locate} = require(locateOs);
    return locate(input);
}