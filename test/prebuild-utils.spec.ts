const {
  parseTargetList,
  parsePrebuildArgs,
  buildPrebuildArgs,
} = require('../scripts/prebuild-utils');

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
    expect(buildPrebuildArgs(options)).toEqual(['-t', '22.18.0', '--no-napi', '--strip']);
  });

  test('build args include explicit CLI toggles', () => {
    const options = parsePrebuildArgs(
      ['--target=22.x', '--napi', '--no-strip'],
      { PREBUILD_TARGETS: 'ignored' },
      '22.18.0',
    );
    expect(buildPrebuildArgs(options)).toEqual(['-t', '22.18.0', '--napi']);
  });

  test('can force legacy ABI mode', () => {
    const options = parsePrebuildArgs(['--target=22.x', '--no-napi'], { PREBUILD_TARGETS: 'ignored' }, '22.18.0');
    expect(buildPrebuildArgs(options)).toEqual(['-t', '22.18.0', '--no-napi', '--strip']);
  });

  test('build args switch to --all when requested', () => {
    const options = parsePrebuildArgs(['--all'], { PREBUILD_TARGETS: '22.18.0' }, '22.18.0');
    expect(buildPrebuildArgs(options).includes('--all')).toBe(true);
  });
});
