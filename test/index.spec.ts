import { locateV8 } from '../dist/lib';

export class TestClass {
}

export function TestFunction() {
}

describe('locateV8', () => {
  test('class path success', () => {
    const classPath = locateV8(TestClass);
    expect(classPath).toEqual(__filename);
  });

  test('function path success', () => {
    const functionPath = locateV8(TestFunction);
    expect(functionPath).toEqual(__filename);
  });

  test('throws when input is not a function', () => {
    expect(() => locateV8({} as unknown as Function)).toThrow(
      'Function argument expected',
    );
  });
});
