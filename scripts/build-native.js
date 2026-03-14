#!/usr/bin/env node

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootPackageDir = path.resolve(__dirname, '..');
const nodeGyp = path.join(rootPackageDir, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');

if (!fs.existsSync(nodeGyp)) {
  throw new Error(
    `node-gyp binary not found at ${nodeGyp}. Run npm install before building native addons.`,
  );
}

execFileSync(process.execPath, [nodeGyp, 'configure'], {
  cwd: rootPackageDir,
  stdio: 'inherit',
});

execFileSync(process.execPath, [nodeGyp, 'build'], {
  cwd: rootPackageDir,
  stdio: 'inherit',
});
