const { getPrepackScripts } = require('../scripts/run-prepack');

describe('run-prepack', () => {
  test('uses the local build pipeline by default', () => {
    expect(getPrepackScripts({ npm_execpath: '/tmp/npm-cli.js' })).toEqual([
      'build:all',
      'build:prebuilds',
      'verify:pack',
    ]);
  });

  test('skips prebuild regeneration when merged release artifacts are already prepared', () => {
    expect(
      getPrepackScripts({
        npm_execpath: '/tmp/npm-cli.js',
        FUNCTION_LOCATION_PREBUILDS_READY: '1',
      }),
    ).toEqual(['build', 'verify:pack']);
  });

  test('package metadata does not define the reserved npm prebuild lifecycle', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../package.json');
    expect(packageJson.scripts).not.toHaveProperty('prebuild');
    expect(packageJson.scripts['build:prebuilds']).toBe('node ./scripts/prebuild.js');
  });
});
