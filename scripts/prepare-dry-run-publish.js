#!/usr/bin/env node

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const layout = require('../config/package-layout.json');

const PLATFORM_PACKAGE_NAMES = new Set(layout.platformPackages.map((entry) => entry.name));

function parseArgValue(argv, name) {
  const prefix = `--${name}=`;
  const arg = argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : '';
}

function createDryRunVersion(version, suffix) {
  if (!suffix) {
    throw new Error('Dry-run version suffix is required.');
  }

  return version.includes('-') ? `${version}.${suffix}` : `${version}-${suffix}`;
}

function applyDryRunVersion(manifest, version) {
  const updated = {
    ...manifest,
    version,
  };

  if (updated.optionalDependencies && typeof updated.optionalDependencies === 'object') {
    updated.optionalDependencies = { ...updated.optionalDependencies };

    for (const dependencyName of Object.keys(updated.optionalDependencies)) {
      if (PLATFORM_PACKAGE_NAMES.has(dependencyName)) {
        updated.optionalDependencies[dependencyName] = version;
      }
    }
  }

  return updated;
}

function extractTarball(sourceTarball, outputDir, executor = execFileSync) {
  executor('tar', ['-xzf', sourceTarball, '-C', outputDir]);
}

function stageDryRunPublishDirectory(sourceTarball, outputDir, versionSuffix, executor = execFileSync) {
  const resolvedTarball = path.resolve(sourceTarball);
  const resolvedOutputDir = path.resolve(outputDir);

  if (!fs.existsSync(resolvedTarball)) {
    throw new Error(`Tarball does not exist: ${resolvedTarball}`);
  }

  fs.mkdirSync(resolvedOutputDir, { recursive: true });
  extractTarball(resolvedTarball, resolvedOutputDir, executor);

  const packageDir = path.join(resolvedOutputDir, 'package');
  const packageJsonPath = path.join(packageDir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Extracted tarball is missing package.json: ${resolvedTarball}`);
  }

  const manifest = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dryRunVersion = createDryRunVersion(manifest.version, versionSuffix);
  const stagedManifest = applyDryRunVersion(manifest, dryRunVersion);

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(stagedManifest, null, 2)}\n`);

  return {
    name: stagedManifest.name,
    packageDir,
    version: dryRunVersion,
  };
}

function main(argv = process.argv.slice(2)) {
  const tarball = parseArgValue(argv, 'tarball');
  const outputDir = parseArgValue(argv, 'out-dir');
  const versionSuffix = parseArgValue(argv, 'version-suffix');

  if (!tarball || !outputDir || !versionSuffix) {
    throw new Error(
      'Usage: node ./scripts/prepare-dry-run-publish.js --tarball=<path> --out-dir=<path> --version-suffix=<suffix>',
    );
  }

  const staged = stageDryRunPublishDirectory(tarball, outputDir, versionSuffix);
  process.stdout.write(`${staged.packageDir}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  applyDryRunVersion,
  createDryRunVersion,
  extractTarball,
  parseArgValue,
  stageDryRunPublishDirectory,
};
