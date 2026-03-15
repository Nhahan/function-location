import path from 'node:path';

const {
  createPrebuildInvocation,
  resolvePlatformPackage,
  resolvePrebuildifyBin,
} = require('../scripts/prebuild');

describe('prebuild script', () => {
  test('resolves the package-local prebuildify entrypoint', () => {
    const resolved = resolvePrebuildifyBin(process.cwd());
    expect(resolved).toContain(path.join('prebuildify', 'bin.js'));
  });

  test('defaults to the current platform package', () => {
    const platformPackage = resolvePlatformPackage([], {});
    expect(platformPackage.platform).toBe(process.platform);
    expect(platformPackage.arch).toBe(process.arch);
  });

  test('can resolve an explicit platform package name', () => {
    const platformPackage = resolvePlatformPackage(['--package=function-location-linux-x64'], {});
    expect(platformPackage.name).toBe('function-location-linux-x64');
  });

  test('invokes prebuildify from the root package into the platform package directory', () => {
    const platformPackage = resolvePlatformPackage(['--package=function-location-linux-x64'], {});
    const invocation = createPrebuildInvocation(
      {
        all: false,
        targets: ['22.22.1'],
        useNapi: false,
        strip: false,
      },
      platformPackage,
      process.cwd(),
    );

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.cwd).toBe(process.cwd());
    expect(invocation.args[0]).toContain(path.join('prebuildify', 'bin.js'));
    expect(invocation.args.slice(1)).toEqual([
      process.cwd(),
      '--out',
      path.join(process.cwd(), 'packages/function-location-linux-x64'),
      '--name',
      'function-location',
      '-t',
      '22.22.1',
      '--no-napi',
    ]);
    expect(invocation.env.PREBUILD_PLATFORM).toBe('linux');
    expect(invocation.env.PREBUILD_ARCH).toBe('x64');
    expect(invocation.env.PREBUILD_LIBC).toBe('glibc');
  });
});
