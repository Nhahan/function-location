#!/usr/bin/env node

'use strict';

const {
  getCurrentPrebuildDir,
  getPlatformPackageByRuntime,
  getReleasePrebuildPlan,
  getReleasePrebuildTargets,
} = require('./prebuild-utils');

const PREBUILD_PLATFORMS = Object.freeze([
  { runner: 'ubuntu-latest', platform: 'linux', arch: 'x64' },
  { runner: 'windows-latest', platform: 'win32', arch: 'x64' },
  { runner: 'macos-15-intel', platform: 'darwin', arch: 'x64' },
  { runner: 'macos-15', platform: 'darwin', arch: 'arm64' },
]);

const PREBUILD_HOST_NODE_VERSION = '24.14.0';
const PACKAGE_NODE_VERSION = '20.x';

const COMPATIBILITY_PLATFORMS = Object.freeze([
  {
    runner: 'ubuntu-latest',
    platform: 'linux',
    arch: 'x64',
    nodeArchitecture: 'x64',
    compatibilityLabel: 'linux-x64',
  },
  {
    runner: 'windows-latest',
    platform: 'win32',
    arch: 'x64',
    nodeArchitecture: 'x64',
    compatibilityLabel: 'win32-x64',
  },
  {
    runner: 'macos-15-intel',
    platform: 'darwin',
    arch: 'x64',
    nodeArchitecture: 'x64',
    compatibilityLabel: 'darwin-x64',
  },
  {
    runner: 'macos-15',
    platform: 'darwin',
    arch: 'x64',
    nodeArchitecture: 'x64',
    compatibilityLabel: 'darwin-x64-rosetta',
    expectedHostArm64: '1',
    expectedTranslated: '1',
  },
  {
    runner: 'macos-15',
    platform: 'darwin',
    arch: 'arm64',
    nodeArchitecture: 'arm64',
    compatibilityLabel: 'darwin-arm64',
    expectedHostArm64: '1',
    expectedTranslated: '0',
  },
]);

function getPrebuildMatrix() {
  const matrix = [];

  for (const entry of PREBUILD_PLATFORMS) {
    const platformPackage = getPlatformPackageByRuntime(entry.platform, entry.arch);

    if (!platformPackage) {
      throw new Error(`Missing platform package mapping for ${entry.platform}-${entry.arch}`);
    }

    for (const target of getReleasePrebuildPlan()) {
      matrix.push({
        ...entry,
        packageName: platformPackage.name,
        packageDir: platformPackage.dir,
        hostNodeVersion: PREBUILD_HOST_NODE_VERSION,
        targetNodeVersion: target.version,
        abi: target.abi,
        artifactName: `prebuild-${platformPackage.name}-abi${target.abi}`,
        platformDir: getCurrentPrebuildDir(entry.platform, entry.arch),
      });
    }
  }

  return matrix;
}

function getPackageMatrix() {
  return PREBUILD_PLATFORMS.map((entry) => {
    const platformPackage = getPlatformPackageByRuntime(entry.platform, entry.arch);

    if (!platformPackage) {
      throw new Error(`Missing platform package mapping for ${entry.platform}-${entry.arch}`);
    }

    return {
      packageName: platformPackage.name,
      packageDir: platformPackage.dir,
      nodeVersion: PACKAGE_NODE_VERSION,
      platformDir: getCurrentPrebuildDir(entry.platform, entry.arch),
      artifactPattern: `prebuild-${platformPackage.name}-*`,
    };
  });
}

function getCompatibilityMatrix() {
  const matrix = [];

  for (const entry of COMPATIBILITY_PLATFORMS) {
    const platformPackage = getPlatformPackageByRuntime(entry.platform, entry.arch);

    if (!platformPackage) {
      throw new Error(`Missing platform package mapping for ${entry.platform}-${entry.arch}`);
    }

    for (const target of getReleasePrebuildPlan()) {
      matrix.push({
        ...entry,
        packageName: platformPackage.name,
        packageDir: platformPackage.dir,
        nodeVersion: target.version,
        abi: target.abi,
        platformDir: getCurrentPrebuildDir(entry.platform, entry.arch),
      });
    }
  }

  return matrix;
}

function main(argv = process.argv.slice(2)) {
  const mode = argv[0];

  if (mode === 'prebuild') {
    process.stdout.write(JSON.stringify(getPrebuildMatrix()));
    return;
  }

  if (mode === 'package') {
    process.stdout.write(JSON.stringify(getPackageMatrix()));
    return;
  }

  if (mode === 'compat') {
    process.stdout.write(JSON.stringify(getCompatibilityMatrix()));
    return;
  }

  throw new Error('Usage: node ./scripts/workflow-matrix.js <prebuild|package|compat>');
}

if (require.main === module) {
  main();
}

module.exports = {
  getCompatibilityMatrix,
  getPackageMatrix,
  getPrebuildMatrix,
};
