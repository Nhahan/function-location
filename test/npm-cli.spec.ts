import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { getNpmCommandSpec, resolveNpmCliPath } = require('../scripts/npm-cli');

describe('npm-cli', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'function-location-npm-cli-')));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createNpmCli(root: string): string {
    const npmCli = path.join(root, 'npm', 'bin', 'npm-cli.js');
    mkdirSync(path.dirname(npmCli), { recursive: true });
    writeFileSync(npmCli, '');
    return npmCli;
  }

  test('resolves npm bundled next to the node executable', () => {
    const npmCli = createNpmCli(path.join(tempDir, 'lib', 'node_modules'));
    const execPath = path.join(tempDir, 'bin', 'node');

    expect(resolveNpmCliPath(execPath, { PATH: '' })).toBe(npmCli);
    expect(getNpmCommandSpec({ PATH: '' }, execPath)).toEqual({
      command: execPath,
      args: [npmCli],
    });
  });

  const posixOnly = process.platform === 'win32' ? test.skip : test;

  posixOnly('follows the npm symlink on PATH when npm lives outside the node prefix', () => {
    const npmCli = createNpmCli(path.join(tempDir, 'shared', 'lib', 'node_modules'));
    const binDir = path.join(tempDir, 'shared', 'bin');
    mkdirSync(binDir, { recursive: true });
    symlinkSync(npmCli, path.join(binDir, 'npm'));
    const execPath = path.join(tempDir, 'cellar', 'node', 'bin', 'node');

    expect(resolveNpmCliPath(execPath, { PATH: binDir })).toBe(npmCli);
  });

  test('falls back to the npm command when npm-cli.js cannot be found', () => {
    const execPath = path.join(tempDir, 'bin', 'node');

    expect(resolveNpmCliPath(execPath, { PATH: '' })).toBeNull();
    expect(getNpmCommandSpec({ PATH: '' }, execPath)).toEqual({
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: [],
    });
  });

  test('resolves npm for the current runtime', () => {
    const npmCli = resolveNpmCliPath();

    expect(npmCli).not.toBeNull();
    expect(path.basename(npmCli)).toBe('npm-cli.js');
  });
});
