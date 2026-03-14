import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'merge-prebuild-artifacts.js');
const BRANCH_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'verify-release-branch.js');

function makeArtifactsFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-release-'));
  const artifactA = path.join(root, 'artifact-a');
  const artifactB = path.join(root, 'artifact-b');

  const prebuildA = path.join(artifactA, 'prebuilds', 'darwin-arm64');
  const prebuildB = path.join(artifactB, 'prebuilds', 'linux-x64');

  mkdirSync(prebuildA, { recursive: true });
  mkdirSync(prebuildB, { recursive: true });

  writeFileSync(path.join(prebuildA, 'locate-arm.node'), 'arm binary');
  writeFileSync(path.join(prebuildB, 'locate-linux.node'), 'linux binary');

  return { root, artifactA, artifactB };
}

describe('release scripts', () => {
  test('merge-prebuild-artifacts merges multiple artifact roots', () => {
    const { root, artifactA, artifactB } = makeArtifactsFixture();

    const merged = path.join(root, 'merged');
    const result = spawnSync('node', [SCRIPT_PATH], {
      env: {
        ...process.env,
        PREBUILD_ARTIFACT_ROOT: root,
        PREBUILD_MERGED_DIR: path.join(merged, 'prebuilds'),
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const mergedDarwin = readdirSync(path.join(merged, 'prebuilds', 'darwin-arm64'));
    const mergedLinux = readdirSync(path.join(merged, 'prebuilds', 'linux-x64'));

    expect(result.status).toBe(0);
    expect(mergedDarwin).toContain('locate-arm.node');
    expect(mergedLinux).toContain('locate-linux.node');

    rmSync(path.join(root, 'merged'), { recursive: true, force: true });
    rmSync(path.join(root, 'artifact-a'), { recursive: true, force: true });
    rmSync(path.join(root, 'artifact-b'), { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  });

  test('verify-release-branch accepts only dev branch by default', () => {
    const result = spawnSync('node', [BRANCH_SCRIPT_PATH], {
      env: {
        ...process.env,
        GITHUB_REF: 'refs/heads/main',
        RELEASE_BRANCH: 'dev',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Release is restricted to dev.');

    const ok = spawnSync('node', [BRANCH_SCRIPT_PATH], {
      env: {
        ...process.env,
        GITHUB_REF: 'refs/heads/dev',
        RELEASE_BRANCH: 'dev',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('Release branch check passed');
  });
});
