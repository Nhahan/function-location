#!/usr/bin/env node

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  packStagedPackage,
  parsePackageDir,
  stagePackDirectory,
} = require('./verify-pack-tarball');

function parseOutputDir(argv = process.argv.slice(2), cwd = process.cwd()) {
  const arg = argv.find((item) => item.startsWith('--out-dir='));
  if (!arg) {
    return cwd;
  }

  return path.resolve(cwd, arg.slice('--out-dir='.length));
}

function packPackageTarball(
  packageDir = process.cwd(),
  outputDir = process.cwd(),
  executor = execFileSync,
  env = process.env,
) {
  const packageJsonPath = path.join(packageDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-artifact-'));
  let stagedTarballPath = null;

  try {
    stagePackDirectory(packageDir, packageJson, stagingDir);
    const packed = packStagedPackage(stagingDir, executor, env);
    stagedTarballPath = packed.tarballPath;

    if (!stagedTarballPath || !fs.existsSync(stagedTarballPath)) {
      throw new Error('Pack command did not produce a tarball.');
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const destination = path.join(outputDir, path.basename(stagedTarballPath));
    fs.copyFileSync(stagedTarballPath, destination);

    return {
      manifest: packed.manifest,
      tarballPath: destination,
    };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

function main(argv = process.argv.slice(2)) {
  try {
    const packageDir = parsePackageDir(argv);
    const outputDir = parseOutputDir(argv);
    const packed = packPackageTarball(packageDir, outputDir);
    console.log(packed.tarballPath);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  packPackageTarball,
  parseOutputDir,
};
