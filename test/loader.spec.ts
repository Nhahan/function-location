import { createLocateLoader, resolvePlatformPackageName } from '../lib/loader';

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

    const loaded = modules[modulePath];

    if (loaded instanceof Error) {
      throw loaded;
    }

    return loaded;
  }) as MockRequire;
}

describe('native loader', () => {
  test('maps the current runtime to a platform package name', () => {
    expect(resolvePlatformPackageName('linux', 'x64')).toBe('function-location-linux-x64');
    expect(resolvePlatformPackageName('win32', 'x64')).toBe('function-location-win32-x64');
    expect(resolvePlatformPackageName('darwin', 'x64')).toBe('function-location-darwin-x64');
    expect(resolvePlatformPackageName('darwin', 'arm64')).toBe('function-location-darwin-arm64');
    expect(resolvePlatformPackageName('linux', 'arm64')).toBeNull();
  });

  test('loads addon through the installed platform package when available', () => {
    const locate = (input: Function): string | undefined => input.name;
    const named = function namedForLoaderTest() {};
    const packageName = resolvePlatformPackageName();

    expect(packageName).not.toBeNull();

    const located = createLocateLoader(
      makeRequireWithResolvedModules({
        [packageName as string]: { locate },
      }),
    );

    expect(typeof located).toBe('function');
    expect(located(named as Function)).toBe('namedForLoaderTest');
  });

  test('falls back to node-gyp-build when the platform package is missing', () => {
    const locate = (input: Function): string | undefined => input.name;
    const nodeGypBuild = jest.fn(() => ({ locate }));
    const packageName = resolvePlatformPackageName();
    const named = function namedForLoaderFallbackTest() {};

    expect(packageName).not.toBeNull();

    const located = createLocateLoader(
      makeRequireWithResolvedModules({
        'node-gyp-build': nodeGypBuild,
      }),
      '/tmp/package-root',
    );

    expect(typeof located).toBe('function');
    expect(located(named as Function)).toBe('namedForLoaderFallbackTest');
    expect(nodeGypBuild).toHaveBeenCalledWith('/tmp/package-root');
  });

  test('throws when both the platform package and local fallback are unavailable', () => {
    const packageName = resolvePlatformPackageName();

    expect(packageName).not.toBeNull();

    expect(() =>
      createLocateLoader(
        makeRequireWithResolvedModules({
          // intentionally empty
        }),
        '/tmp/package-root',
      ),
    ).toThrow(`Unable to load native addon from installed platform package ${packageName}`);
  });

  test('throws when the loaded addon export is missing locate', () => {
    const packageName = resolvePlatformPackageName();

    expect(packageName).not.toBeNull();

    expect(() =>
      createLocateLoader(
        makeRequireWithResolvedModules({
          [packageName as string]: { notLocate: 'missing' },
        }),
      ),
    ).toThrow('does not export locate()');
  });

  test('throws when locate export has invalid type', () => {
    const packageName = resolvePlatformPackageName();

    expect(packageName).not.toBeNull();

    expect(() =>
      createLocateLoader(
        makeRequireWithResolvedModules({
          [packageName as string]: { locate: 'not-a-function' },
        }),
      ),
    ).toThrow('exports locate with invalid type');
  });
});
