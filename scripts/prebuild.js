'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  buildPrebuildArgs,
  getCurrentPlatformPackage,
  getPlatformPackageByName,
  getPlatformPackageDir,
  getReleasePrebuildTargets,
  getRootPackageName,
  parsePrebuildArgs,
} = require('./prebuild-utils');

function parsePlatformPackageName(argv = process.argv.slice(2), env = process.env) {
  const directArg = argv.find((item) => item.startsWith('--package='));
  const raw = directArg ? directArg.slice('--package='.length) : env.FUNCTION_LOCATION_PLATFORM_PACKAGE;
  return raw ? raw.trim() : '';
}

function hasExplicitTargets(argv = process.argv.slice(2), env = process.env) {
  return argv.some((item) => item.startsWith('--target=') || item.startsWith('--targets=')) || !!env.PREBUILD_TARGETS;
}

function resolvePrebuildifyBin(rootDir) {
  const binPath = path.join(rootDir, 'node_modules', 'prebuildify', 'bin.js');

  if (!fs.existsSync(binPath)) {
    throw new Error(
      `prebuildify binary not found at ${binPath}. Run npm install before building prebuilds.`,
    );
  }

  return binPath;
}

function resolvePlatformPackage(argv = process.argv.slice(2), env = process.env) {
  const explicitName = parsePlatformPackageName(argv, env);
  if (!explicitName) {
    return getCurrentPlatformPackage();
  }

  const resolved = getPlatformPackageByName(explicitName);
  if (!resolved) {
    throw new Error(`Unknown platform package: ${explicitName}`);
  }

  return resolved;
}

function createPrebuildInvocation(options, platformPackage, rootDir, env = process.env) {
  const packageDir = getPlatformPackageDir(platformPackage, rootDir);
  const args = [
    resolvePrebuildifyBin(rootDir),
    rootDir,
    '--out',
    packageDir,
    '--name',
    getRootPackageName(),
  ].concat(buildPrebuildArgs(options));

  return {
    command: process.execPath,
    args,
    cwd: rootDir,
    env: {
      ...env,
      PREBUILD_PLATFORM: platformPackage.platform,
      PREBUILD_ARCH: platformPackage.arch,
      ...(platformPackage.libc ? { PREBUILD_LIBC: platformPackage.libc[0] } : {}),
    },
    packageDir,
  };
}

function runPrebuild(rootDir = process.cwd(), spawn = spawnSync, argv = process.argv.slice(2), env = process.env) {
  const platformPackage = resolvePlatformPackage(argv, env);
  const packageDir = getPlatformPackageDir(platformPackage, rootDir);
  const prebuildDir = path.join(packageDir, 'prebuilds');
  fs.rmSync(prebuildDir, { recursive: true, force: true });

  const options = parsePrebuildArgs(argv, env);
  if (!hasExplicitTargets(argv, env)) {
    options.targets = getReleasePrebuildTargets();
  }

  const invocation = createPrebuildInvocation(options, platformPackage, rootDir, env);
  const result = spawn(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    env: invocation.env,
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

  return {
    packageDir,
    platformPackage,
  };
}

if (require.main === module) {
  runPrebuild();
}

module.exports = {
  createPrebuildInvocation,
  parsePlatformPackageName,
  hasExplicitTargets,
  resolvePlatformPackage,
  resolvePrebuildifyBin,
  runPrebuild,
};
