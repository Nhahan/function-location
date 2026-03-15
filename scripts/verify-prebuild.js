'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getCurrentPrebuildDir,
  getExpectedPrebuildFilesForTargets,
  parseTargetList,
} = require('./prebuild-utils');

function hasNodeBinary(directory) {
  if (!fs.existsSync(directory)) {
    return false;
  }

  const files = fs.readdirSync(directory);
  return files.some((file) => file.endsWith('.node'));
}

function getNodeBinaries(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory).filter((file) => file.endsWith('.node')).sort();
}

function verifyExpectedPrebuildFiles(rootDir, platformDirName) {
  const platformDir = path.join(rootDir, 'prebuilds', platformDirName);
  const targets = process.env.PREBUILD_TARGETS
    ? parseTargetList(process.env.PREBUILD_TARGETS, process.versions.node)
    : [process.versions.node];
  const expected = getExpectedPrebuildFilesForTargets(targets).sort();

  if (expected.length === 0) {
    return;
  }

  const actual = getNodeBinaries(platformDir);
  const missing = expected.filter((file) => !actual.includes(file));
  const unexpected = actual.filter((file) => !expected.includes(file));

  if (missing.length > 0 || unexpected.length > 0) {
    const details = [];

    if (missing.length > 0) {
      details.push(`missing: ${missing.join(', ')}`);
    }

    if (unexpected.length > 0) {
      details.push(`unexpected: ${unexpected.join(', ')}`);
    }

    throw new Error(`prebuild file set mismatch for ${platformDirName} (${details.join('; ')})`);
  }
}

function runPrebuildSmokeTest(rootDir) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'function-location-prebuild-'));
  const tempFile = path.join(tempDir, 'smoke.js');
  const packageEntry = path.join(rootDir, 'dist');

  fs.writeFileSync(
    tempFile,
    [
      "const path = require('path');",
      `const { locateV8 } = require(${JSON.stringify(packageEntry)});`,
      'function smokeFixture() {}',
      'const expected = path.resolve(__filename);',
      'const located = locateV8(smokeFixture);',
      'if (located !== expected) {',
      "  console.error(JSON.stringify({ expected, located }));",
      '  process.exit(1);',
      '}',
      "console.log(JSON.stringify({ expected, located }));",
      '',
    ].join('\n'),
    'utf8',
  );

  try {
    const result = spawnSync(process.execPath, [tempFile], {
      cwd: rootDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PREBUILDS_ONLY: '1',
      },
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      const stdout = result.stdout ? `\nstdout:\n${result.stdout}` : '';
      const stderr = result.stderr ? `\nstderr:\n${result.stderr}` : '';
      throw new Error(`prebuild smoke test exited with code ${result.status}.${stdout}${stderr}`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runVerifyPrebuild() {
  const rootDir = process.cwd();
  const platformDirName = getCurrentPrebuildDir();
  const platformDir = path.join(rootDir, 'prebuilds', platformDirName);

  if (!hasNodeBinary(platformDir)) {
    console.error(`Missing prebuild binary under ${platformDir}`);
    process.exit(1);
  }

  try {
    verifyExpectedPrebuildFiles(rootDir, platformDirName);
    runPrebuildSmokeTest(rootDir);
  } catch (error) {
    console.error(`Prebuild verification failed for ${platformDirName}: ${error.message}`);
    process.exit(1);
  }

  console.log(`Verified prebuild binaries for ${platformDirName} can be loaded and used.`);
}

runVerifyPrebuild();
