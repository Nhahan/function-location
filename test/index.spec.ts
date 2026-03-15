import { locate } from '../dist';

export class TestClass {
}

export function TestFunction() {
}

describe('locate', () => {
  test('class path success', () => {
    const classPath = locate(TestClass);
    expect(classPath).toEqual(__filename);
  });

  test('function path success', () => {
    const functionPath = locate(TestFunction);
    expect(functionPath).toEqual(__filename);
  });

  test('throws when input is not a function', () => {
    expect(() => locate({} as unknown as Function)).toThrow(
      'Function argument expected',
    );
  });
});
