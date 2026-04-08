#!/usr/bin/env node

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootPackageDir = path.resolve(__dirname, '..');
const BUILD_DIRECTORY = 'build';

function resolveNodeGyp(rootDir = rootPackageDir) {
  const nodeGyp = path.join(rootDir, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');

  if (!fs.existsSync(nodeGyp)) {
    throw new Error(
      `node-gyp binary not found at ${nodeGyp}. Run npm install before building native addons.`,
    );
  }

  return nodeGyp;
}

function removeBuildDirectory(rootDir = rootPackageDir) {
  fs.rmSync(path.join(rootDir, BUILD_DIRECTORY), { recursive: true, force: true });
}

function buildNative(rootDir = rootPackageDir, executor = execFileSync) {
  const nodeGyp = resolveNodeGyp(rootDir);
  removeBuildDirectory(rootDir);

  executor(process.execPath, [nodeGyp, 'configure'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  executor(process.execPath, [nodeGyp, 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

if (require.main === module) {
  buildNative();
}

module.exports = {
  BUILD_DIRECTORY,
  buildNative,
  removeBuildDirectory,
  resolveNodeGyp,
};
