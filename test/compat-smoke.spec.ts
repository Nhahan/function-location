const {
  parseArgs,
  getNpmCommandSpec,
  getSmokeScriptSource,
  resolveNpmCliPath,
} = require('../scripts/run-compat-smoke');

describe('run-compat-smoke', () => {
  test('uses locateV8 in the compatibility smoke script', () => {
    const source = getSmokeScriptSource();

    expect(source).toContain('var located = lib.locateV8(smoke);');
    expect(source).not.toContain('lib.locate(smoke)');
  });

  test('parses compatibility smoke arguments', () => {
    expect(
      parseArgs([
        '--root-tarball=/tmp/function-location.tgz',
        '--platform-tarball=/tmp/function-location-darwin-arm64.tgz',
        '--expected-node-arch=x64',
        '--expected-host-arm64=1',
        '--expected-translated=1',
      ]),
    ).toEqual({
      rootTarball: '/tmp/function-location.tgz',
      platformTarball: '/tmp/function-location-darwin-arm64.tgz',
      expectedNodeArch: 'x64',
      expectedHostArm64: '1',
      expectedTranslated: '1',
    });
  });

  test('resolves npm through the current node installation', () => {
    const command = getNpmCommandSpec();

    expect(command.command).toBe(process.execPath);
    expect(command.args).toEqual([resolveNpmCliPath()]);
  });
});
