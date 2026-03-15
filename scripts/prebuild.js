'use strict';

const { spawnSync } = require('child_process');
const { buildPrebuildArgs, parsePrebuildArgs } = require('./prebuild-utils');
const fs = require('fs');
const path = require('path');

function resolvePrebuildifyBin(rootDir) {
  const binPath = path.join(rootDir, 'node_modules', 'prebuildify', 'bin.js');

  if (!fs.existsSync(binPath)) {
    throw new Error(
      `prebuildify binary not found at ${binPath}. Run npm install before building prebuilds.`,
    );
  }

  return binPath;
}

function createPrebuildInvocation(options, rootDir) {
  return {
    command: process.execPath,
    args: [resolvePrebuildifyBin(rootDir)].concat(buildPrebuildArgs(options)),
  };
}

function runPrebuild(rootDir = process.cwd(), spawn = spawnSync) {
  const prebuildDir = path.join(rootDir, 'prebuilds');
  fs.rmSync(prebuildDir, { recursive: true, force: true });

  const options = parsePrebuildArgs();
  const invocation = createPrebuildInvocation(options, rootDir);

  const result = spawn(invocation.command, invocation.args, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`prebuildify execution failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    const code = Number.isInteger(result.status) ? result.status : 1;
    const signal = result.signal ? ` (signal: ${result.signal})` : '';
    console.error(`prebuildify exited with code ${code}${signal}`);
    process.exit(code);
  }
}

if (require.main === module) {
  runPrebuild();
}

module.exports = {
  createPrebuildInvocation,
  resolvePrebuildifyBin,
  runPrebuild,
};
