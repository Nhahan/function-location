'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getCurrentPrebuildDir } = require('./prebuild-utils');

function hasNodeBinary(directory) {
  if (!fs.existsSync(directory)) {
    return false;
  }

  const files = fs.readdirSync(directory);
  return files.some((file) => file.endsWith('.node'));
}

function runVerifyPrebuild() {
  const platformDir = path.join(process.cwd(), 'prebuilds', getCurrentPrebuildDir());

  if (!hasNodeBinary(platformDir)) {
    console.error(`Missing prebuild binary under ${platformDir}`);
    process.exit(1);
  }

  console.log(`Verified prebuild binary exists for ${getCurrentPrebuildDir()}.`);
}

runVerifyPrebuild();
