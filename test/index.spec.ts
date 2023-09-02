import { locateV8 } from '../lib';

export class TestClass {
}

export function TestFunction() {
}

describe('locateV8', () => {
    test('class path', () => {
        const functionLocation = locateV8(TestClass);
        console.log(functionLocation);
    });
    test('function path', () => {
        const functionLocation = locateV8(TestFunction);
        console.log(functionLocation);
    });
});
