import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BRANCH_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'verify-release-branch.js');
const TAR_SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'create-package-tarball.js');
const {
  applyDryRunVersion,
  createDryRunVersion,
} = require('../scripts/prepare-dry-run-publish');
const { assertVersionAlignment, getPublishedPackages } = require('../scripts/package-metadata');
const rootPackageJson = require('../package.json');

describe('release scripts', () => {
  test('release package versions stay aligned across the root and platform packages', () => {
    const aligned = assertVersionAlignment(process.cwd());

    expect(aligned.rootPackage.name).toBe('function-location');
    expect(getPublishedPackages(process.cwd())).toEqual([
      {
        name: 'function-location',
        version: rootPackageJson.version,
        packageDir: process.cwd(),
      },
      {
        name: 'function-location-linux-x64',
        version: rootPackageJson.version,
        packageDir: path.join(process.cwd(), 'packages/function-location-linux-x64'),
      },
      {
        name: 'function-location-win32-x64',
        version: rootPackageJson.version,
        packageDir: path.join(process.cwd(), 'packages/function-location-win32-x64'),
      },
      {
        name: 'function-location-darwin-x64',
        version: rootPackageJson.version,
        packageDir: path.join(process.cwd(), 'packages/function-location-darwin-x64'),
      },
      {
        name: 'function-location-darwin-arm64',
        version: rootPackageJson.version,
        packageDir: path.join(process.cwd(), 'packages/function-location-darwin-arm64'),
      },
    ]);
  });

  test('create-package-tarball produces a tarball for a staged package directory', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-release-pack-'));
    const artifactsDir = path.join(root, 'artifacts');

    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'function-location-test-package',
        version: '1.0.0',
        files: ['dist/lib/index.js', 'dist/config/package-layout.json'],
      }),
    );
    mkdirSync(path.join(root, 'dist', 'lib'), { recursive: true });
    mkdirSync(path.join(root, 'dist', 'config'), { recursive: true });
    writeFileSync(path.join(root, 'dist', 'lib', 'index.js'), 'module.exports = {};');
    writeFileSync(path.join(root, 'dist', 'config', 'package-layout.json'), '{}');

    const result = spawnSync(process.execPath, [TAR_SCRIPT_PATH, `--package-dir=${root}`, `--out-dir=${artifactsDir}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(result.status).toBe(0);
    expect(existsSync(path.join(artifactsDir, 'function-location-test-package-1.0.0.tgz'))).toBe(true);

    rmSync(root, { recursive: true, force: true });
  });

  test('dry-run publish versions are rewritten to unique prereleases', () => {
    expect(createDryRunVersion('1.0.0', 'dryrun.123')).toBe('1.0.0-dryrun.123');
    expect(createDryRunVersion('1.0.0-beta.1', 'dryrun.123')).toBe('1.0.0-beta.1.dryrun.123');
  });

  test('dry-run publish keeps platform package versions aligned in the root manifest', () => {
    const updated = applyDryRunVersion(
      {
        name: 'function-location',
        version: '1.0.0',
        optionalDependencies: {
          'function-location-linux-x64': '1.0.0',
          'function-location-win32-x64': '1.0.0',
          unrelated: '^1.2.3',
        },
      },
      '1.0.0-dryrun.123',
    );

    expect(updated.version).toBe('1.0.0-dryrun.123');
    expect(updated.optionalDependencies).toEqual({
      'function-location-linux-x64': '1.0.0-dryrun.123',
      'function-location-win32-x64': '1.0.0-dryrun.123',
      unrelated: '^1.2.3',
    });
  });

  test('verify-release-branch accepts only main branch by default', () => {
    const result = spawnSync(process.execPath, [BRANCH_SCRIPT_PATH], {
      env: {
        ...process.env,
        GITHUB_REF: 'refs/heads/dev',
        RELEASE_BRANCH: 'main',
        RELEASE_DRY_RUN: 'false',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Release is restricted to refs/heads/main.');

    const ok = spawnSync(process.execPath, [BRANCH_SCRIPT_PATH], {
      env: {
        ...process.env,
        GITHUB_REF: 'refs/heads/main',
        RELEASE_BRANCH: 'main',
        RELEASE_DRY_RUN: 'false',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('Release branch check passed');
  });

  test('verify-release-branch allows ci-verify branches only in dry-run mode', () => {
    const dryRunReject = spawnSync(process.execPath, [BRANCH_SCRIPT_PATH], {
      env: {
        ...process.env,
        GITHUB_REF: 'refs/heads/ci-verify/patch-1',
        RELEASE_BRANCH: 'main',
        RELEASE_DRY_RUN: 'false',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(dryRunReject.status).not.toBe(0);

    const dryRunPass = spawnSync(process.execPath, [BRANCH_SCRIPT_PATH], {
      env: {
        ...process.env,
        GITHUB_REF: 'refs/heads/ci-verify/patch-1',
        RELEASE_BRANCH: 'main',
        RELEASE_DRY_RUN: 'true',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(dryRunPass.status).toBe(0);
    expect(dryRunPass.stdout).toContain('Release branch check passed');
  });
});
