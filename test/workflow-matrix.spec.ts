const { getCompatibilityMatrix, getPrebuildMatrix } = require('../scripts/workflow-matrix');

describe('workflow-matrix', () => {
  test('defines the release prebuild runner matrix', () => {
    expect(getPrebuildMatrix()).toEqual([
      {
        runner: 'ubuntu-latest',
        platform: 'linux',
        arch: 'x64',
        nodeVersion: '24.14.0',
        platformDir: 'linux-x64',
        prebuildTargets: '8.17.0,10.24.1,12.22.12,14.21.3,16.20.2,18.20.8,20.20.1,22.22.1,24.14.0',
      },
      {
        runner: 'windows-latest',
        platform: 'win32',
        arch: 'x64',
        nodeVersion: '24.14.0',
        platformDir: 'win32-x64',
        prebuildTargets: '8.17.0,10.24.1,12.22.12,14.21.3,16.20.2,18.20.8,20.20.1,22.22.1,24.14.0',
      },
      {
        runner: 'macos-15-intel',
        platform: 'darwin',
        arch: 'x64',
        nodeVersion: '24.14.0',
        platformDir: 'darwin-x64',
        prebuildTargets: '8.17.0,10.24.1,12.22.12,14.21.3,16.20.2,18.20.8,20.20.1,22.22.1,24.14.0',
      },
      {
        runner: 'macos-15',
        platform: 'darwin',
        arch: 'arm64',
        nodeVersion: '24.14.0',
        platformDir: 'darwin-arm64',
        prebuildTargets: '16.20.2,18.20.8,20.20.1,22.22.1,24.14.0',
      },
    ]);
  });

  test('defines the compatibility runtime matrix from the prebuild plan', () => {
    const matrix = getCompatibilityMatrix();

    expect(matrix).toHaveLength(41);
    expect(matrix[0]).toEqual({
      runner: 'ubuntu-latest',
      platform: 'linux',
      arch: 'x64',
      nodeArchitecture: 'x64',
      compatibilityLabel: 'linux-x64',
      nodeVersion: '8.17.0',
      abi: '57',
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
      nodeVersion: '8.17.0',
      abi: '57',
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
      nodeVersion: '24.14.0',
      abi: '137',
      platformDir: 'darwin-arm64',
    });
  });
});
