#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const layout = require('../config/package-layout.json');

function readPackageJson(packageDir) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
}

function getRootPackage(rootDir = process.cwd()) {
  const manifest = readPackageJson(rootDir);

  return {
    name: manifest.name,
    version: manifest.version,
    packageDir: rootDir,
    optionalDependencies: { ...(manifest.optionalDependencies || {}) },
  };
}

function getPlatformPackageManifests(rootDir = process.cwd()) {
  return layout.platformPackages.map((entry) => {
    const packageDir = path.join(rootDir, entry.dir);
    const manifest = readPackageJson(packageDir);

    return {
      ...entry,
      name: manifest.name,
      version: manifest.version,
      packageDir,
    };
  });
}

function assertVersionAlignment(rootDir = process.cwd()) {
  const rootPackage = getRootPackage(rootDir);
  const platformPackages = getPlatformPackageManifests(rootDir);

  for (const platformPackage of platformPackages) {
    if (platformPackage.version !== rootPackage.version) {
      throw new Error(
        `${platformPackage.name} version ${platformPackage.version} does not match root package version ${rootPackage.version}.`,
      );
    }

    const dependencyRange = rootPackage.optionalDependencies[platformPackage.name];
    if (dependencyRange !== platformPackage.version) {
      throw new Error(
        `${platformPackage.name} optionalDependency range ${String(dependencyRange)} does not match package version ${platformPackage.version}.`,
      );
    }
  }

  return {
    rootPackage,
    platformPackages,
  };
}

function getPublishedPackages(rootDir = process.cwd()) {
  const aligned = assertVersionAlignment(rootDir);

  return [aligned.rootPackage].concat(aligned.platformPackages).map((entry) => ({
    name: entry.name,
    version: entry.version,
    packageDir: entry.packageDir,
  }));
}

function main() {
  try {
    process.stdout.write(`${JSON.stringify(getPublishedPackages())}\n`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  assertVersionAlignment,
  getPlatformPackageManifests,
  getPublishedPackages,
  getRootPackage,
  readPackageJson,
};
