import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'verify-prebuild-coverage.js');

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
});
