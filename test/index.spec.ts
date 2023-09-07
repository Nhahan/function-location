import { locateV8 } from '../lib';

export class TestClass {
}

export function TestFunction() {
}

describe('locateV8', () => {
    test('class path', () => {
        const functionLocation = locateV8(TestClass);
        expect(functionLocation).toContain('/test/index.spec.ts');
    });
    test('function path', () => {
        const functionLocation = locateV8(TestFunction);
        console.log(functionLocation);
    });
});
