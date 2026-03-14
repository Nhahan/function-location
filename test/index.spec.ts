import { locateV8 } from '../dist';

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

  test('function path success', () => {
    const functionPath = locateV8(TestFunction);
    expect(functionPath).toEqual(__filename);
  });

  test('function path fail', () => {
    const functionPath = locateV8(TestFunction);
    expect(functionPath).not.toEqual(__dirname);
  });

  test('throws when input is not a function', () => {
    expect(() => locateV8({} as unknown as Function)).toThrow(
      'Function argument expected',
    );
  });
});
