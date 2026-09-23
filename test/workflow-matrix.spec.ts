const { getCompatibilityMatrix, getPackageMatrix, getPrebuildMatrix } = require('../scripts/workflow-matrix');

describe('workflow-matrix', () => {
  const RELEASE_TARGETS = [
    { version: '20.20.1', abi: '115' },
    { version: '21.7.3', abi: '120' },
    { version: '22.22.1', abi: '127' },
    { version: '23.11.1', abi: '131' },
    { version: '24.14.0', abi: '137' },
    { version: '25.9.0', abi: '141' },
    { version: '26.10.0', abi: '147' },
  ];

  const PREBUILD_RUNNERS = [
    { runner: 'ubuntu-latest', platform: 'linux', arch: 'x64' },
    { runner: 'windows-latest', platform: 'win32', arch: 'x64' },
    { runner: 'macos-15-intel', platform: 'darwin', arch: 'x64' },
    { runner: 'macos-15', platform: 'darwin', arch: 'arm64' },
  ];

  test('defines the release prebuild runner matrix', () => {
    const expected = PREBUILD_RUNNERS.flatMap((entry) => {
      const packageName = `function-location-${entry.platform}-${entry.arch}`;

      return RELEASE_TARGETS.map((target) => ({
        ...entry,
        packageName,
        packageDir: `packages/${packageName}`,
        hostNodeVersion: '24.14.0',
        targetNodeVersion: target.version,
        abi: target.abi,
        artifactName: `prebuild-${packageName}-abi${target.abi}`,
        platformDir: `${entry.platform}-${entry.arch}`,
      }));
    });

    expect(getPrebuildMatrix()).toEqual(expected);
  });

  test('defines the platform packaging matrix', () => {
    expect(getPackageMatrix()).toEqual([
      {
        packageName: 'function-location-linux-x64',
        packageDir: 'packages/function-location-linux-x64',
        nodeVersion: '20.x',
        platformDir: 'linux-x64',
        artifactPattern: 'prebuild-function-location-linux-x64-*',
      },
      {
        packageName: 'function-location-win32-x64',
        packageDir: 'packages/function-location-win32-x64',
        nodeVersion: '20.x',
        platformDir: 'win32-x64',
        artifactPattern: 'prebuild-function-location-win32-x64-*',
      },
      {
        packageName: 'function-location-darwin-x64',
        packageDir: 'packages/function-location-darwin-x64',
        nodeVersion: '20.x',
        platformDir: 'darwin-x64',
        artifactPattern: 'prebuild-function-location-darwin-x64-*',
      },
      {
        packageName: 'function-location-darwin-arm64',
        packageDir: 'packages/function-location-darwin-arm64',
        nodeVersion: '20.x',
        platformDir: 'darwin-arm64',
        artifactPattern: 'prebuild-function-location-darwin-arm64-*',
      },
    ]);
  });

  test('defines the compatibility runtime matrix from the platform package plan', () => {
    const matrix = getCompatibilityMatrix();

    expect(matrix).toHaveLength(35);
    expect(matrix[0]).toEqual({
      runner: 'ubuntu-latest',
      platform: 'linux',
      arch: 'x64',
      nodeArchitecture: 'x64',
      compatibilityLabel: 'linux-x64',
      packageName: 'function-location-linux-x64',
      packageDir: 'packages/function-location-linux-x64',
      nodeVersion: '20.20.1',
      abi: '115',
      platformDir: 'linux-x64',
    });
    expect(matrix).toContainEqual({
      runner: 'macos-15',
      platform: 'darwin',
      arch: 'x64',
      nodeArchitecture: 'x64',
      compatibilityLabel: 'darwin-x64-rosetta',
      expectedHostArm64: '1',
      expectedTranslated: '1',
      packageName: 'function-location-darwin-x64',
      packageDir: 'packages/function-location-darwin-x64',
      nodeVersion: '20.20.1',
      abi: '115',
      platformDir: 'darwin-x64',
    });
    expect(matrix[matrix.length - 1]).toEqual({
      runner: 'macos-15',
      platform: 'darwin',
      arch: 'arm64',
      nodeArchitecture: 'arm64',
      compatibilityLabel: 'darwin-arm64',
      expectedHostArm64: '1',
      expectedTranslated: '0',
      packageName: 'function-location-darwin-arm64',
      packageDir: 'packages/function-location-darwin-arm64',
      nodeVersion: '26.10.0',
      abi: '147',
      platformDir: 'darwin-arm64',
    });
  });
});
