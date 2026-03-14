#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

if (!process.env.npm_execpath) {
  throw new Error('npm_execpath is required to run the test pipeline.');
}

run(process.execPath, [process.env.npm_execpath, 'run', 'build:all']);
run(process.execPath, [
  path.join(rootDir, 'node_modules', 'jest', 'bin', 'jest.js'),
  ...process.argv.slice(2),
]);
