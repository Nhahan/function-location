const {
  parseTargetList,
  parsePrebuildArgs,
  buildPrebuildArgs,
  getExpectedPrebuildFiles,
  getNodeAbiForVersion,
  getReleasePrebuildPlan,
  getReleasePrebuildTargets,
  getSupportedNodeTargets,
} = require('../scripts/prebuild-utils');

function withDefaultStrip(args: string[]) {
  return process.platform === 'win32' ? args : args.concat('--strip');
}

describe('prebuild-utils', () => {
  test('normalizes wildcard target for current Node major', () => {
    expect(parseTargetList('22.x', '22.18.0')[0]).toBe('22.18.0');
    expect(parseTargetList('22', '22.18.0')[0]).toBe('22.18.0');
    expect(parseTargetList('22.5', '22.18.0')[0]).toBe('22.5.0');
  });

  test('normalizes full version target', () => {
    expect(parseTargetList('22.18.1', '22.18.0')[0]).toBe('22.18.1');
  });

  test('throws when wildcard major mismatches current Node major', () => {
    expect(() => parseTargetList('20.x', '22.18.0')).toThrow(/must match running Node major/);
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
    expect(buildPrebuildArgs(options)).toEqual(['-t', '22.18.0', '--napi']);
  });

  test('respects explicit opt-out of N-API', () => {
    const options = parsePrebuildArgs(
      ['--target=22.x'],
      { PREBUILD_TARGETS: 'ignored', PREBUILD_NAPI: '0' },
      '22.18.0',
    );
    expect(buildPrebuildArgs(options)).toEqual(withDefaultStrip(['-t', '22.18.0', '--no-napi']));
  });

  test('can force legacy ABI mode', () => {
    const options = parsePrebuildArgs(['--target=22.x', '--no-napi'], { PREBUILD_TARGETS: 'ignored' }, '22.18.0');
    expect(buildPrebuildArgs(options)).toEqual(withDefaultStrip(['-t', '22.18.0', '--no-napi']));
  });

  test('build args switch to --all when requested', () => {
    const options = parsePrebuildArgs(['--all'], { PREBUILD_TARGETS: '22.18.0' }, '22.18.0');
    expect(buildPrebuildArgs(options).includes('--all')).toBe(true);
  });

  test('exposes the supported node target table', () => {
    expect(getSupportedNodeTargets()).toEqual([
      { major: 8, version: '8.17.0', abi: '57' },
      { major: 10, version: '10.24.1', abi: '64' },
      { major: 12, version: '12.22.12', abi: '72' },
      { major: 14, version: '14.21.3', abi: '83' },
      { major: 16, version: '16.20.2', abi: '93' },
      { major: 18, version: '18.20.8', abi: '108' },
      { major: 20, version: '20.20.1', abi: '115' },
      { major: 22, version: '22.22.1', abi: '127' },
      { major: 24, version: '24.14.0', abi: '137' },
    ]);
  });

  test('maps exact target versions to known ABIs', () => {
    expect(getNodeAbiForVersion('8.17.0')).toBe('57');
    expect(getNodeAbiForVersion('22.22.1')).toBe('127');
  });

  test('uses the full legacy-to-current target plan for x64 release platforms', () => {
    expect(getReleasePrebuildTargets('linux', 'x64', '22.18.0')).toEqual([
      '8.17.0',
      '10.24.1',
      '12.22.12',
      '14.21.3',
      '16.20.2',
      '18.20.8',
      '20.20.1',
      '22.22.1',
      '24.14.0',
    ]);
    expect(getReleasePrebuildPlan('win32', 'x64', '22.18.0')[0]).toEqual({
      major: 8,
      version: '8.17.0',
      abi: '57',
    });
  });

  test('uses the arm64 macOS target plan that starts at Node 16', () => {
    expect(getReleasePrebuildTargets('darwin', 'arm64', '24.0.0')).toEqual([
      '16.20.2',
      '18.20.8',
      '20.20.1',
      '22.22.1',
      '24.14.0',
    ]);
  });

  test('computes expected ABI-tagged prebuild filenames', () => {
    expect(getExpectedPrebuildFiles('linux', 'x64', '24.0.0')).toEqual([
      'function-location.abi57.node',
      'function-location.abi64.node',
      'function-location.abi72.node',
      'function-location.abi83.node',
      'function-location.abi93.node',
      'function-location.abi108.node',
      'function-location.abi115.node',
      'function-location.abi127.node',
      'function-location.abi137.node',
    ]);
  });
});
