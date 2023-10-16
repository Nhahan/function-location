export function locateV8(input: Function) {
    const {locate} = require(process.platform === 'win32' ? './locate-win.node' : './locate.node');
    return locate(input);
}
