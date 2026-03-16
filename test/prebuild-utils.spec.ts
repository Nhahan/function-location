const {
  parseTargetList,
  parsePrebuildArgs,
  buildPrebuildArgs,
  getExpectedPrebuildFiles,
  getNodeAbiForVersion,
  getPlatformPackageByRuntime,
  getPlatformPackages,
  getReleasePrebuildPlan,
  getReleasePrebuildTargets,
  getRootPackageName,
  getSupportedNodeTargets,
} = require('../scripts/prebuild-utils');

function withDefaultStrip(args: string[]) {
  return process.platform === 'win32' ? args : args.concat('--strip');
}

describe('prebuild-utils', () => {
  test('normalizes shorthand targets to supported release versions', () => {
    expect(parseTargetList('22.x', '24.14.0')[0]).toBe('22.22.1');
    expect(parseTargetList('22', '24.14.0')[0]).toBe('22.22.1');
    expect(parseTargetList('22.5', '24.14.0')[0]).toBe('22.5.0');
  });

  test('normalizes full version target', () => {
    expect(parseTargetList('22.18.1', '22.18.0')[0]).toBe('22.18.1');
  });

  test('rejects unsupported majors below 16', () => {
    expect(() => parseTargetList('14.x', '22.18.0')).toThrow(/Unsupported prebuild target/);
  });

  test('normalizes wildcard targets to the supported release version for that major', () => {
    expect(parseTargetList('20.x', '22.18.0')[0]).toBe('20.20.1');
  });

  test('build args include expected defaults', () => {
    const options = parsePrebuildArgs([], { PREBUILD_TARGETS: '22.18.0' }, '22.18.0');
    expect(buildPrebuildArgs(options)).toEqual(withDefaultStrip(['-t', '22.18.0', '--no-napi']));
  });

  test('build args include explicit CLI toggles', () => {
    const options = parsePrebuildArgs(
      ['--target=22.x', '--napi', '--no-strip'],
      { PREBUILD_TARGETS: 'ignored' },
      '22.18.0',
    );
    expect(buildPrebuildArgs(options)).toEqual(['-t', '22.22.1', '--napi']);
  });

  test('uses the 16+ target table', () => {
    expect(getSupportedNodeTargets()).toEqual([
      { major: 16, version: '16.20.2', abi: '93' },
      { major: 18, version: '18.20.8', abi: '108' },
      { major: 20, version: '20.20.1', abi: '115' },
      { major: 22, version: '22.22.1', abi: '127' },
      { major: 24, version: '24.14.0', abi: '137' },
    ]);
  });

  test('maps exact target versions to known ABIs', () => {
    expect(getNodeAbiForVersion('16.20.2')).toBe('93');
    expect(getNodeAbiForVersion('22.22.1')).toBe('127');
  });

  test('uses the same 16+ plan for every supported platform package', () => {
    expect(getReleasePrebuildTargets()).toEqual([
      '16.20.2',
      '18.20.8',
      '20.20.1',
      '22.22.1',
      '24.14.0',
    ]);
    expect(getReleasePrebuildPlan()).toEqual([
      { major: 16, version: '16.20.2', abi: '93' },
      { major: 18, version: '18.20.8', abi: '108' },
      { major: 20, version: '20.20.1', abi: '115' },
      { major: 22, version: '22.22.1', abi: '127' },
      { major: 24, version: '24.14.0', abi: '137' },
    ]);
  });

  test('computes expected ABI-tagged prebuild filenames', () => {
    expect(getExpectedPrebuildFiles('linux', 'x64', getRootPackageName())).toEqual([
      'function-location.abi93.node',
      'function-location.abi108.node',
      'function-location.abi115.node',
      'function-location.abi127.node',
      'function-location.abi137.node',
    ]);
  });

  test('exposes the supported platform package table', () => {
    expect(getPlatformPackages()).toEqual([
      {
        name: 'function-location-linux-x64',
        dir: 'packages/function-location-linux-x64',
        platform: 'linux',
        arch: 'x64',
        os: ['linux'],
        cpu: ['x64'],
        libc: ['glibc'],
      },
      {
        name: 'function-location-win32-x64',
        dir: 'packages/function-location-win32-x64',
        platform: 'win32',
        arch: 'x64',
        os: ['win32'],
        cpu: ['x64'],
      },
      {
        name: 'function-location-darwin-x64',
        dir: 'packages/function-location-darwin-x64',
        platform: 'darwin',
        arch: 'x64',
        os: ['darwin'],
        cpu: ['x64'],
      },
      {
        name: 'function-location-darwin-arm64',
        dir: 'packages/function-location-darwin-arm64',
        platform: 'darwin',
        arch: 'arm64',
        os: ['darwin'],
        cpu: ['arm64'],
      },
    ]);
  });

  test('maps runtime tuples to the correct platform package', () => {
    expect(getPlatformPackageByRuntime('linux', 'x64')?.name).toBe('function-location-linux-x64');
    expect(getPlatformPackageByRuntime('linux', 'arm64')).toBeNull();
  });
});
