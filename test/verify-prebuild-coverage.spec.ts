import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'verify-prebuild-coverage.js');
const { getCurrentPrebuildDir, getExpectedPrebuildFiles } = require('../scripts/prebuild-utils');

function makeFixture(hasMultiNodeAbi = true) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-prebuild-'));

  const prebuildBase = path.join(root, 'downloaded-prebuilds', 'prebuilds');
  mkdirSync(prebuildBase, { recursive: true });

  const darwinDir = path.join(prebuildBase, 'darwin-arm64');
  const win32Dir = path.join(prebuildBase, 'win32-x64');

  mkdirSync(darwinDir, { recursive: true });
  mkdirSync(win32Dir, { recursive: true });

  writeFileSync(path.join(darwinDir, 'function-location.abi127.node'), 'binary', { encoding: 'utf8' });
  if (hasMultiNodeAbi) {
    writeFileSync(path.join(darwinDir, 'function-location.abi128.node'), 'binary', { encoding: 'utf8' });
  }
  writeFileSync(path.join(win32Dir, 'function-location.abi127.node'), 'binary', { encoding: 'utf8' });

  return root;
}

function makeReleasePlanFixture(removeLastLinuxAbi = false) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-prebuild-release-'));
  const prebuildBase = path.join(root, 'merged-prebuilds');
  const platforms: Array<[string, string]> = [
    ['darwin', 'arm64'],
    ['darwin', 'x64'],
    ['linux', 'x64'],
    ['win32', 'x64'],
  ];

  for (const [platform, arch] of platforms) {
    const platformDir = path.join(prebuildBase, getCurrentPrebuildDir(platform, arch));
    mkdirSync(platformDir, { recursive: true });

    let expectedFiles = getExpectedPrebuildFiles(platform, arch);
    if (removeLastLinuxAbi && platform === 'linux' && arch === 'x64') {
      expectedFiles = expectedFiles.slice(0, -1);
    }

    for (const file of expectedFiles) {
      writeFileSync(path.join(platformDir, file), 'binary', { encoding: 'utf8' });
    }
  }

  return root;
}

function runCoverage(args: string[], cwd = process.cwd()) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('verify-prebuild-coverage', () => {
  test('passes when required platform targets exist', () => {
    const root = makeFixture(true);

    const result = runCoverage([
      `--base-dir=${root}/downloaded-prebuilds`,
      '--required=darwin-arm64|darwin-x64,win32-x64',
      '--required-min=1',
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Verified prebuild coverage');
  });

  test('fails when required minimum binary count is not met', () => {
    const root = makeFixture(false);

    const result = runCoverage([
      `--base-dir=${root}/downloaded-prebuilds`,
      '--required=darwin-arm64',
      '--required-min=2',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing prebuild coverage');
  });

  test('passes when the full release ABI matrix is present', () => {
    const root = makeReleasePlanFixture(false);

    const result = runCoverage([`--base-dir=${root}/merged-prebuilds`, '--release-plan']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Verified release prebuild coverage');
  });

  test('fails when a release ABI entry is missing', () => {
    const root = makeReleasePlanFixture(true);

    const result = runCoverage([`--base-dir=${root}/merged-prebuilds`, '--release-plan']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Release prebuild coverage mismatch');
    expect(result.stderr).toContain('linux-x64');
  });
});
