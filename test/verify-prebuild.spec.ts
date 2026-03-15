const { shouldRunSmokeTest } = require('../scripts/verify-prebuild');

describe('verify-prebuild', () => {
  test('runs smoke tests by default', () => {
    expect(shouldRunSmokeTest([], {})).toBe(true);
  });

  test('allows workflow jobs to disable smoke tests explicitly', () => {
    expect(shouldRunSmokeTest(['--no-smoke'], {})).toBe(false);
    expect(shouldRunSmokeTest([], { PREBUILD_VERIFY_SMOKE: '0' })).toBe(false);
  });
});
