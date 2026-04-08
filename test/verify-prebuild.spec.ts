const { getPrebuildSmokeScriptSource, shouldRunSmokeTest } = require('../scripts/verify-prebuild');

describe('verify-prebuild', () => {
  test('uses locateV8 in the prebuild smoke script', () => {
    const source = getPrebuildSmokeScriptSource('/tmp/function-location');

    expect(source).toContain("const { locateV8 } = require(\"/tmp/function-location\");");
    expect(source).toContain('const located = locateV8(smokeFixture);');
    expect(source).not.toContain('const { locate }');
  });

  test('runs smoke tests by default', () => {
    expect(shouldRunSmokeTest([], {})).toBe(true);
  });

  test('allows workflow jobs to disable smoke tests explicitly', () => {
    expect(shouldRunSmokeTest(['--no-smoke'], {})).toBe(false);
    expect(shouldRunSmokeTest([], { PREBUILD_VERIFY_SMOKE: '0' })).toBe(false);
  });
});
