const { getPrepackScripts } = require('../scripts/run-prepack');

describe('run-prepack', () => {
  test('prepacks only the public root package assets', () => {
    expect(getPrepackScripts()).toEqual(['build', 'verify:pack']);
  });

  test('package metadata does not define the reserved npm prebuild lifecycle', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../package.json');
    expect(packageJson.scripts).not.toHaveProperty('prebuild');
    expect(packageJson.scripts['build:prebuilds']).toBe('node ./scripts/prebuild.js');
  });
});
