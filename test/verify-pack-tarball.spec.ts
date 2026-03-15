import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  createPackInvocation,
  getRequiredEntryPath,
  verifyPackTarball,
} = require('../scripts/verify-pack-tarball');

describe('verify-pack-tarball', () => {
  test('uses npm_execpath when available to avoid PATH-dependent npm lookups', () => {
    const invocation = createPackInvocation({ npm_execpath: '/tmp/npm-cli.js' });

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args).toEqual([
      '/tmp/npm-cli.js',
      'pack',
      '--json',
      '--silent',
      '--ignore-scripts',
    ]);
  });

  test('falls back to the platform npm command outside npm-run environments', () => {
    const invocation = createPackInvocation({});

    expect(invocation.command).toBe(process.platform === 'win32' ? 'npm.cmd' : 'npm');
    expect(invocation.args).toEqual(['pack', '--json', '--silent', '--ignore-scripts']);
  });

  test('normalizes package file entries before staging', () => {
    expect(getRequiredEntryPath('dist/index.js')).toBe('dist/index.js');
    expect(getRequiredEntryPath('prebuilds/**')).toBe('prebuilds');
    expect(getRequiredEntryPath('dist/')).toBe('dist');
  });

  test('validates the tarball manifest against package files', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-'));
    const executed: Array<{
      command: string;
      args: string[];
      options: { cwd: string; encoding: string };
    }> = [];

    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        files: ['dist/index.js', 'prebuilds/**'],
        scripts: {
          prepack: 'node ./scripts/verify-pack-tarball.js',
        },
      }),
    );
    mkdirSync(path.join(root, 'dist'), { recursive: true });
    mkdirSync(path.join(root, 'prebuilds', 'darwin-arm64'), { recursive: true });
    writeFileSync(path.join(root, 'dist', 'index.js'), 'module.exports = {};');
    writeFileSync(path.join(root, 'prebuilds', 'darwin-arm64', 'locate.node'), 'fake-binary');

    expect(() =>
      verifyPackTarball(
        root,
        (command: string, args: string[], options: { cwd: string; encoding: string }) => {
          const stagedPackageJson = JSON.parse(
            readFileSync(path.join(options.cwd, 'package.json'), 'utf8'),
          );

          expect(stagedPackageJson.scripts).toBeUndefined();
          executed.push({ command, args, options });
          return JSON.stringify([
            {
              filename: 'function-location-1.0.0.tgz',
              files: [
                { path: 'dist/index.js' },
                { path: 'prebuilds/darwin-arm64/locate.node' },
              ],
            },
          ]);
        },
        { npm_execpath: '/tmp/npm-cli.js' },
      ),
    ).not.toThrow();

    expect(executed).toHaveLength(1);
    expect(executed[0].command).toBe(process.execPath);
    expect(executed[0].args).toEqual([
      '/tmp/npm-cli.js',
      'pack',
      '--json',
      '--silent',
      '--ignore-scripts',
    ]);
    expect(executed[0].options.cwd).not.toBe(root);

    rmSync(root, { recursive: true, force: true });
  });

  test('fails when required package files are missing from the tarball manifest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-'));

    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        files: ['dist/index.js', 'prebuilds/**'],
      }),
    );
    mkdirSync(path.join(root, 'dist'), { recursive: true });
    mkdirSync(path.join(root, 'prebuilds', 'darwin-arm64'), { recursive: true });
    writeFileSync(path.join(root, 'dist', 'index.js'), 'module.exports = {};');
    writeFileSync(path.join(root, 'prebuilds', 'darwin-arm64', 'locate.node'), 'fake-binary');

    expect(() =>
      verifyPackTarball(root, () =>
        JSON.stringify([
          {
            filename: 'function-location-1.0.0.tgz',
            files: [{ path: 'dist/index.js' }],
          },
        ]),
      ),
    ).toThrow(/Missing files in package tarball: prebuilds\/\*\*/);

    rmSync(root, { recursive: true, force: true });
  });
});
