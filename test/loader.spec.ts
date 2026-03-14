import path from 'node:path';

import { createLocateLoader } from '../lib/loader';

type MockRequire = {
  (path: string): unknown;
};

function makeRequireWithResolvedModules(modules: Record<string, unknown>): MockRequire {
  return ((modulePath: string) => {
    if (!(modulePath in modules)) {
      const error = new Error(`Cannot find module '${modulePath}'`) as NodeJS.ErrnoException;
      error.code = 'MODULE_NOT_FOUND';
      throw error;
    }

    return modules[modulePath];
  }) as MockRequire;
}

describe('native loader', () => {
  test('loads addon through node-gyp-build from package root', () => {
    const locate = (input: Function): string | undefined => input.name;
    const nodeGypBuild = jest.fn(() => ({ locate }));
    const packageDir = path.join(__dirname, '..');
    const named = function namedForLoaderTest() {};

    const located = createLocateLoader(
      makeRequireWithResolvedModules({
        'node-gyp-build': nodeGypBuild,
      }),
      packageDir,
    );

    expect(typeof located).toBe('function');
    expect(located(named as Function)).toBe('namedForLoaderTest');
    expect(nodeGypBuild).toHaveBeenCalledWith(packageDir);
  });

  test('throws when node-gyp-build is missing', () => {
    expect(() =>
      createLocateLoader(
        makeRequireWithResolvedModules({
          // intentionally missing node-gyp-build
        }),
        '/tmp/package-root',
      ),
    ).toThrow("Cannot find module 'node-gyp-build'");
  });

  test('throws when addon export is missing locate', () => {
    const nodeGypBuild = jest.fn(() => ({ notLocate: 'missing' }));

    expect(() =>
      createLocateLoader(
        makeRequireWithResolvedModules({
          'node-gyp-build': nodeGypBuild,
        }),
        '/tmp/package-root',
      ),
    ).toThrow('does not export locate()');
  });

  test('throws when locate export has invalid type', () => {
    const nodeGypBuild = jest.fn(() => ({ locate: 'not-a-function' }));

    expect(() =>
      createLocateLoader(
        makeRequireWithResolvedModules({
          'node-gyp-build': nodeGypBuild,
        }),
        '/tmp/package-root',
      ),
    ).toThrow('exports locate with invalid type');
  });
});
