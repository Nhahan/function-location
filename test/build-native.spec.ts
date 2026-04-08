import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const {
  BUILD_DIRECTORY,
  buildNative,
  removeBuildDirectory,
  resolveNodeGyp,
} = require('../scripts/build-native');

describe('build-native', () => {
  test('resolves the package-local node-gyp entrypoint', () => {
    const resolved = resolveNodeGyp(process.cwd());

    expect(resolved).toContain(path.join('node-gyp', 'bin', 'node-gyp.js'));
  });

  test('removes the generated build directory before rebuilding', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-build-native-'));
    const buildDir = path.join(root, BUILD_DIRECTORY);
    const staleBinary = path.join(buildDir, 'Release', 'locate.node');

    mkdirSync(path.dirname(staleBinary), { recursive: true });
    writeFileSync(staleBinary, 'stale');

    removeBuildDirectory(root);

    expect(() => require('node:fs').statSync(buildDir)).toThrow();

    rmSync(root, { recursive: true, force: true });
  });

  test('cleans stale build outputs and invokes node-gyp configure/build', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'function-location-build-native-'));
    const nodeGyp = path.join(root, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');
    const staleBinary = path.join(root, BUILD_DIRECTORY, 'Release', 'locate.node');
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];

    mkdirSync(path.dirname(nodeGyp), { recursive: true });
    writeFileSync(nodeGyp, '');
    mkdirSync(path.dirname(staleBinary), { recursive: true });
    writeFileSync(staleBinary, 'stale');

    buildNative(
      root,
      (command: string, args: string[], options: { cwd: string; stdio: string }) => {
        expect(options.stdio).toBe('inherit');
        calls.push({ command, args, cwd: options.cwd });
        return Buffer.alloc(0);
      },
    );

    expect(() => require('node:fs').statSync(staleBinary)).toThrow();
    expect(calls).toEqual([
      {
        command: process.execPath,
        args: [nodeGyp, 'configure'],
        cwd: root,
      },
      {
        command: process.execPath,
        args: [nodeGyp, 'build'],
        cwd: root,
      },
    ]);

    rmSync(root, { recursive: true, force: true });
  });
});
