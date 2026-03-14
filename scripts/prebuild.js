'use strict';

const { spawnSync } = require('node:child_process');
const { buildPrebuildArgs, parsePrebuildArgs } = require('./prebuild-utils');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function runPrebuild() {
  const prebuildDir = path.join(process.cwd(), 'prebuilds');
  fs.rmSync(prebuildDir, { recursive: true, force: true });

  const options = parsePrebuildArgs();
  const args = buildPrebuildArgs(options);
  const command = path.join(process.cwd(), 'node_modules', '.bin', `prebuildify${os.platform() === 'win32' ? '.cmd' : ''}`);

  const result = spawnSync(command, args, {
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

runPrebuild();
