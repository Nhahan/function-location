import vm from 'vm';

import { locateV8 } from '../dist/lib';

export class TestClass {
  method() {}

  static staticMethod() {}
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

  test.each([
    ['instance method', TestClass.prototype.method],
    ['static method', TestClass.staticMethod],
    ['arrow function', () => {}],
    ['anonymous function', (function () {}) as Function],
    ['async function', async function () {}],
    ['generator function', function* () {}],
  ])('%s path success', (_label, input) => {
    expect(locateV8(input)).toEqual(__filename);
  });

  test('bound functions resolve to the target function location', () => {
    expect(locateV8(TestFunction.bind(null))).toEqual(__filename);
    expect(locateV8(TestFunction.bind(null).bind(null))).toEqual(__filename);
  });

  test('functions from vm scripts resolve to the script filename', () => {
    const input = vm.runInNewContext('(function () {})', {}, { filename: '/virtual/vm-script.js' });

    expect(locateV8(input)).toEqual('/virtual/vm-script.js');
  });

  test.each([
    ['builtin function', Math.max],
    ['builtin constructor', Array],
    ['Function constructor', new Function('return 1')],
    ['proxy', new Proxy(TestFunction, {})],
  ])('%s returns undefined', (_label, input) => {
    expect(locateV8(input)).toBeUndefined();
  });

  test('throws when input is not a function', () => {
    expect(() => locateV8({} as unknown as Function)).toThrow(
      'Function argument expected',
    );
  });
});
