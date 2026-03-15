import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  createPackInvocation,
  getRequiredEntryPath,
  parsePackageDir,
  stagePackDirectory,
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
    expect(getRequiredEntryPath('dist/lib/index.js')).toBe('dist/lib/index.js');
    expect(getRequiredEntryPath('prebuilds/**')).toBe('prebuilds');
    expect(getRequiredEntryPath('dist/config/package-layout.json')).toBe('dist/config/package-layout.json');
    expect(getRequiredEntryPath('dist/')).toBe('dist');
  });

  test('resolves a package directory override from argv', () => {
    expect(parsePackageDir(['--package-dir=packages/function-location-linux-x64'])).toBe(
      path.join(process.cwd(), 'packages/function-location-linux-x64'),
    );
  });

  test('validates the root package tarball manifest against package files', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-'));
    const executed: Array<{
      command: string;
      args: string[];
      options: { cwd: string; encoding: string };
    }> = [];

    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        files: ['dist/lib/index.js', 'dist/config/package-layout.json'],
        scripts: {
          prepack: 'node ./scripts/verify-pack-tarball.js',
        },
      }),
    );
    mkdirSync(path.join(root, 'dist', 'lib'), { recursive: true });
    mkdirSync(path.join(root, 'dist', 'config'), { recursive: true });
    writeFileSync(path.join(root, 'dist', 'lib', 'index.js'), 'module.exports = {};');
    writeFileSync(path.join(root, 'dist', 'config', 'package-layout.json'), '{}');

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
                { path: 'dist/lib/index.js' },
                { path: 'dist/config/package-layout.json' },
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

  test('stages LICENSE metadata for workspace-style platform packages', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-metadata-'));
    const packageDir = path.join(repoRoot, 'packages', 'function-location-linux-x64');
    const stagingDir = mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-staging-'));
    const packageJson = {
      files: ['index.js'],
    };

    mkdirSync(packageDir, { recursive: true });
    writeFileSync(path.join(repoRoot, 'LICENSE'), 'MIT');
    writeFileSync(path.join(packageDir, 'index.js'), 'module.exports = {};');

    stagePackDirectory(packageDir, packageJson, stagingDir);

    expect(readFileSync(path.join(stagingDir, 'LICENSE'), 'utf8')).toBe('MIT');

    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(stagingDir, { recursive: true, force: true });
  });

  test('validates the platform package tarball manifest against package files', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-platform-'));

    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        files: ['index.js', 'prebuilds/**'],
      }),
    );
    mkdirSync(path.join(root, 'prebuilds', 'linux-x64'), { recursive: true });
    writeFileSync(path.join(root, 'index.js'), 'module.exports = {};');
    writeFileSync(path.join(root, 'prebuilds', 'linux-x64', 'locate.node'), 'fake-binary');

    expect(() =>
      verifyPackTarball(root, () =>
        JSON.stringify([
          {
            filename: 'function-location-linux-x64-1.0.0.tgz',
            files: [
              { path: 'index.js' },
              { path: 'prebuilds/linux-x64/locate.node' },
            ],
          },
        ]),
      ),
    ).not.toThrow();

    rmSync(root, { recursive: true, force: true });
  });

  test('fails when required root package files are missing from the tarball manifest', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-'));

    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        files: ['dist/lib/index.js', 'dist/config/package-layout.json'],
      }),
    );
    mkdirSync(path.join(root, 'dist', 'lib'), { recursive: true });
    mkdirSync(path.join(root, 'dist', 'config'), { recursive: true });
    writeFileSync(path.join(root, 'dist', 'lib', 'index.js'), 'module.exports = {};');
    writeFileSync(path.join(root, 'dist', 'config', 'package-layout.json'), '{}');

    expect(() =>
      verifyPackTarball(root, () =>
        JSON.stringify([
          {
            filename: 'function-location-1.0.0.tgz',
            files: [{ path: 'dist/lib/index.js' }],
          },
        ]),
      ),
    ).toThrow(/Missing files in package tarball: dist\/config\/package-layout\.json/);

    rmSync(root, { recursive: true, force: true });
  });
});
