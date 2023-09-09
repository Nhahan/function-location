import { locateV8 } from '../lib';

export class TestClass {
}

export function TestFunction() {
}

describe('locateV8', () => {
    test('class path', () => {
        const classPath = locateV8(TestClass);
        expect(classPath).toBe(__filename);
    });
    test('function path', () => {
        const functionPath = locateV8(TestFunction);
        expect(functionPath).toBe(__filename);
    });
});
