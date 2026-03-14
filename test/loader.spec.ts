import { createLocateLoader, resolveNativeAddonFilename } from '../lib/loader';

type MockRequire = {
  (path: string): unknown;
  resolve(
    path: string,
    options?: {
      paths?: string[];
    },
  ): string;
};

function makeMissingModuleError(requestedModule = ''): NodeJS.ErrnoException {
  const message = requestedModule
    ? `Cannot find module '${requestedModule}'`
    : 'cannot find module';
  return Object.assign(new Error(message), { code: 'MODULE_NOT_FOUND' });
}

function makeRequireWithResolve(
  onRequire: (path: string) => unknown,
  onResolve: (path: string) => string = (path) => path,
): MockRequire {
  const mockedRequire = ((path: string) => onRequire(path)) as MockRequire;
  mockedRequire.resolve = (path: string) => onResolve(path);
  return mockedRequire;
}

describe('native loader', () => {
  test('resolves linux-style filename first on non-win32', () => {
    expect(resolveNativeAddonFilename('linux')[0]).toBe('locate.node');
  });

  test('resolves win32-style filename first on win32', () => {
    expect(resolveNativeAddonFilename('win32')[0]).toBe('locate-win.node');
  });

  test('falls back to default filenames for unknown platforms', () => {
    expect(resolveNativeAddonFilename('plan9' as NodeJS.Platform)[0]).toBe('locate.node');
  });

  test('throws clear error when no addon exists', () => {
    const fn = makeRequireWithResolve(
      () => {
        throw new Error('should not reach require');
      },
      (path) => {
        throw makeMissingModuleError(path);
      },
    );
    expect(() => createLocateLoader(fn, 'win32')).toThrow(
      'Cannot load function-location native addon. Searched: ./locate-win.node, ./locate.node.',
    );
  });

  test('propagates non-module-not-found errors from resolve', () => {
    expect(() =>
      createLocateLoader(
        makeRequireWithResolve(
          () => {
            throw new Error('should not reach require');
          },
          () => {
            throw Object.assign(new Error('invalid package'), { code: 'EACCES' });
          },
        ),
        'linux',
      ),
    ).toThrow('invalid package');
  });

  test('propagates non-module-not-found errors', () => {
    expect(() =>
      createLocateLoader(
        makeRequireWithResolve(() => {
          throw new Error('addon initialization failed');
        }),
        'linux',
      ),
    ).toThrow('addon initialization failed');
  });

  test('skips candidates that are missing but continues to next valid one', () => {
    const calls: string[] = [];
    const locate = (input: Function): string | undefined => input.name;

    const mock = makeRequireWithResolve(
      (path: string) => {
        calls.push(`require:${path}`);
        if (path === './locate-win.node') {
          throw makeMissingModuleError(path);
        }
        return { locate };
      },
      (path: string) => {
        calls.push(`resolve:${path}`);
        if (path === './locate-win.node') {
          throw makeMissingModuleError(path);
        }
        return path;
      },
    );

    const located = createLocateLoader(mock, 'win32');
    expect(located).toBe(locate);
    expect(calls).toEqual([
      'resolve:./locate-win.node',
      'resolve:./locate.node',
      'require:./locate.node',
    ]);
  });

  test('throws descriptive error when addon export is invalid', () => {
    expect(() =>
      createLocateLoader(
        makeRequireWithResolve(() => ({ exports: 'wrong' })),
        'linux',
      ),
    ).toThrow('Native addon does not export locate() in locate.node.');
  });

  test('propagates missing module when resolve path exists', () => {
    expect(() =>
      createLocateLoader(
        makeRequireWithResolve(
          () => {
            throw Object.assign(new Error('cannot load binary'), { code: 'ERR_DLOPEN_FAILED' });
          },
          () => './locate.node',
        ),
        'linux',
      ),
    ).toThrow('cannot load binary');
  });

  test('propagates MODULE_NOT_FOUND from addon dependency loading', () => {
    const error = Object.assign(new Error('cannot load dependency'), { code: 'MODULE_NOT_FOUND' });
    expect(() =>
      createLocateLoader(
        makeRequireWithResolve(
          () => {
            throw error;
          },
          () => './locate.node',
        ),
        'linux',
      ),
    ).toThrow('cannot load dependency');
  });

});
