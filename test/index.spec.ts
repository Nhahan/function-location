import { locateV8 } from '../lib';

export class TestClass {
}

export function TestFunction() {
}

describe('locateV8', () => {
        test('class path success', () => {
        const classPath = locateV8(TestClass);
        expect(classPath).toEqual(__filename);
    });

    test('class path fail', () => {
        const classPath = locateV8(TestClass);
        expect(classPath).not.toEqual(__dirname);
    });

    test('function path', () => {
        const functionPath = locateV8(TestFunction);
        expect(functionPath).toEqual(__filename);
    });

    test('function path', () => {
        const functionPath = locateV8(TestFunction);
        expect(functionPath).not.toEqual(__dirname);
    });

    test('should call right native addon', () => {
        const locateOs = process.platform === 'win32' ? './locate-win.node' : './locate.node';
        if (locateOs === './locate-win.node') {
            expect(locateOs).toEqual('./locate-win.node');
        } else {
            expect(locateOs).toEqual('./locate.node');
        }
    })
});
