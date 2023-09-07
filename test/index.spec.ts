import { locateV8 } from '../lib';

export class TestClass {
}

export function TestFunction() {
}

describe('locateV8', () => {
    test('class path', () => {
        const classPath = locateV8(TestClass);
        expect(classPath).toContain('/test/index.spec.ts');
    });
    test('function path', () => {
        const functionPath = locateV8(TestFunction);
        expect(functionPath).toContain('/test/index.spec.ts');
    });
});
