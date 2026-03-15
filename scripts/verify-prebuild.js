'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getCurrentPrebuildDir,
  getExpectedPrebuildFilesForTargets,
  getPlatformPackageDir,
  getReleasePrebuildTargets,
  getRootPackageName,
  parseTargetList,
} = require('./prebuild-utils');
const { resolvePlatformPackage } = require('./prebuild');

function getNodeBinaries(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory).filter((file) => file.endsWith('.node')).sort();
}

function hasNodeBinary(directory) {
  return getNodeBinaries(directory).length > 0;
}

function verifyExpectedPrebuildFiles(packageDir, platformDirName, packageName) {
  const platformDir = path.join(packageDir, 'prebuilds', platformDirName);
  const targets = process.env.PREBUILD_TARGETS
    ? parseTargetList(process.env.PREBUILD_TARGETS, process.versions.node)
    : [];
  const expectedTargets = targets.length > 0 ? targets : getReleasePrebuildTargets();
  const expected = getExpectedPrebuildFilesForTargets(expectedTargets, packageName).sort();
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

function runPrebuildSmokeTest(packageDir) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'function-location-prebuild-'));
  const tempFile = path.join(tempDir, 'smoke.js');

  fs.writeFileSync(
    tempFile,
    [
      "const path = require('path');",
      `const { locate } = require(${JSON.stringify(packageDir)});`,
      'function smokeFixture() {}',
      'const expected = path.resolve(__filename);',
      'const located = locate(smokeFixture);',
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
      cwd: packageDir,
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

function runVerifyPrebuild(rootDir = process.cwd(), argv = process.argv.slice(2)) {
  const platformPackage = resolvePlatformPackage(argv, process.env);
  const packageDir = getPlatformPackageDir(platformPackage, rootDir);
  const platformDirName = getCurrentPrebuildDir(platformPackage.platform, platformPackage.arch);
  const platformDir = path.join(packageDir, 'prebuilds', platformDirName);

  if (!hasNodeBinary(platformDir)) {
    console.error(`Missing prebuild binary under ${platformDir}`);
    process.exit(1);
  }

  try {
    verifyExpectedPrebuildFiles(packageDir, platformDirName, getRootPackageName());
    runPrebuildSmokeTest(packageDir);
  } catch (error) {
    console.error(`Prebuild verification failed for ${platformDirName}: ${error.message}`);
    process.exit(1);
  }

  console.log(`Verified prebuild binaries for ${platformPackage.name} can be loaded and used.`);
}

if (require.main === module) {
  runVerifyPrebuild();
}

module.exports = {
  getNodeBinaries,
  hasNodeBinary,
  runPrebuildSmokeTest,
  runVerifyPrebuild,
  verifyExpectedPrebuildFiles,
};
