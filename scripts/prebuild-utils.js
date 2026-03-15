'use strict';

const path = require('path');
const layout = require('../config/package-layout.json');

const NODE_VERSION_PATTERN = /^(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+))?)?(?:\.x)?$/;

const SUPPORTED_NODE_TARGETS = Object.freeze(layout.supportedNodeTargets.map((target) => ({ ...target })));
const PLATFORM_PACKAGES = Object.freeze(layout.platformPackages.map((entry) => ({ ...entry })));
const ROOT_PACKAGE_NAME = layout.rootPackageName;

function parseNodeVersion(version) {
  const parsed = version.split('.');
  const major = Number.parseInt(parsed[0], 10);
  const minor = Number.parseInt(parsed[1] ?? '0', 10);
  const patch = Number.parseInt(parsed[2] ?? '0', 10);

  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) {
    throw new Error(`Invalid Node version: ${version}`);
  }

  return { major, minor, patch };
}

function getRootPackageName() {
  return ROOT_PACKAGE_NAME;
}

function getSupportedNodeTargets() {
  return SUPPORTED_NODE_TARGETS.map((target) => ({ ...target }));
}

function getPlatformPackages() {
  return PLATFORM_PACKAGES.map((entry) => ({ ...entry }));
}

function getPlatformPackageByName(name) {
  const found = PLATFORM_PACKAGES.find((entry) => entry.name === name);
  return found ? { ...found } : null;
}

function getPlatformPackageByRuntime(platform = process.platform, arch = process.arch) {
  const found = PLATFORM_PACKAGES.find((entry) => entry.platform === platform && entry.arch === arch);
  return found ? { ...found } : null;
}

function getCurrentPlatformPackage(platform = process.platform, arch = process.arch) {
  const found = getPlatformPackageByRuntime(platform, arch);

  if (!found) {
    throw new Error(`Unsupported platform package target: ${platform}-${arch}`);
  }

  return found;
}

function getCurrentPrebuildDir(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

function getPlatformPackageDir(entry, rootDir = process.cwd()) {
  const platformPackage = typeof entry === 'string' ? getPlatformPackageByName(entry) : entry;

  if (!platformPackage) {
    throw new Error(`Unknown platform package: ${String(entry)}`);
  }

  return path.join(rootDir, platformPackage.dir);
}

function normalizeTarget(target, currentVersion) {
  const current = parseNodeVersion(currentVersion);
  const match = NODE_VERSION_PATTERN.exec(target);

  if (!match || !match.groups) {
    throw new Error(`Invalid prebuild target "${target}". Use major, major.minor, major.minor.patch, or major.x.`);
  }

  const major = Number.parseInt(match.groups.major, 10);
  const supportedMajor = SUPPORTED_NODE_TARGETS.find((entry) => entry.major === major);

  if (!supportedMajor) {
    throw new Error(`Unsupported prebuild target "${target}". Supported majors: ${SUPPORTED_NODE_TARGETS.map((entry) => entry.major).join(', ')}.`);
  }

  if (target.endsWith('.x')) {
    if (major !== current.major) {
      throw new Error(
        `Prebuild target "${target}" must match running Node major (${current.major}) when major-only wildcard is used.`,
      );
    }

    return `${current.major}.${current.minor}.${current.patch}`;
  }

  if (match.groups.patch === undefined) {
    return `${major}.${match.groups.minor || current.minor}.${current.patch}`;
  }

  if (match.groups.minor === undefined) {
    return `${major}.${current.minor}.${current.patch}`;
  }

  return target;
}

function parseTargetList(rawTargets, currentVersion) {
  const raw = Array.isArray(rawTargets) ? rawTargets.join(',') : String(rawTargets);
  const list = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizeTarget(item, currentVersion));
  const unique = new Set(list);

  return Array.from(unique);
}

function parsePrebuildArgs(argv = process.argv.slice(2), env = process.env, currentVersion = process.versions.node) {
  const options = {
    all: false,
    targets: [],
    useNapi: env.PREBUILD_NAPI === '1',
    strip: process.platform !== 'win32' && env.PREBUILD_STRIP !== '0',
  };

  for (const arg of argv) {
    if (arg === '--all') {
      options.all = true;
      continue;
    }

    if (arg === '--napi') {
      options.useNapi = true;
      continue;
    }

    if (arg === '--no-napi') {
      options.useNapi = false;
      continue;
    }

    if (arg === '--no-strip') {
      options.strip = false;
      continue;
    }

    if (arg.startsWith('--targets=')) {
      options.targets.push(
        ...parseTargetList(arg.slice('--targets='.length), currentVersion),
      );
      continue;
    }

    if (arg.startsWith('--target=')) {
      options.targets.push(
        ...parseTargetList(arg.slice('--target='.length), currentVersion),
      );
      continue;
    }
  }

  if (env.PREBUILD_TARGETS && !options.targets.length) {
    options.targets = parseTargetList(env.PREBUILD_TARGETS, currentVersion);
  }

  if (!options.targets.length) {
    options.targets = [currentVersion];
  }

  return options;
}

function buildPrebuildArgs(options) {
  const args = [];

  if (options.all) {
    args.push('--all');
  } else {
    for (const target of options.targets) {
      args.push('-t', target);
    }
  }

  if (options.useNapi) {
    args.push('--napi');
  } else {
    args.push('--no-napi');
  }

  if (options.strip) {
    args.push('--strip');
  }

  return args;
}

function getNodeAbiForMajor(major) {
  const supported = SUPPORTED_NODE_TARGETS.find((target) => target.major === major);
  return supported ? supported.abi : null;
}

function getNodeAbiForVersion(version) {
  return getNodeAbiForMajor(parseNodeVersion(version).major);
}

function getPrebuildPlanForTargets(targets) {
  return targets.map((version) => {
    const major = parseNodeVersion(version).major;
    const abi = getNodeAbiForMajor(major);

    if (!abi) {
      throw new Error(`Unsupported Node target for prebuild ABI mapping: ${version}`);
    }

    return { major, version, abi };
  });
}

function getReleasePrebuildPlan() {
  return SUPPORTED_NODE_TARGETS.map((target) => ({ ...target }));
}

function getReleasePrebuildTargets() {
  return getReleasePrebuildPlan().map((target) => target.version);
}

function getExpectedPrebuildFilesForTargets(targets, packageName = ROOT_PACKAGE_NAME) {
  return getPrebuildPlanForTargets(targets).map(
    (target) => `${packageName}.abi${target.abi}.node`,
  );
}

function getExpectedPrebuildFiles(platform = process.platform, arch = process.arch, packageName = ROOT_PACKAGE_NAME) {
  getCurrentPlatformPackage(platform, arch);
  return getExpectedPrebuildFilesForTargets(getReleasePrebuildTargets(), packageName);
}

module.exports = {
  buildPrebuildArgs,
  getCurrentPlatformPackage,
  getCurrentPrebuildDir,
  getExpectedPrebuildFiles,
  getExpectedPrebuildFilesForTargets,
  getNodeAbiForMajor,
  getNodeAbiForVersion,
  getPlatformPackageByName,
  getPlatformPackageByRuntime,
  getPlatformPackageDir,
  getPlatformPackages,
  getPrebuildPlanForTargets,
  getReleasePrebuildPlan,
  getReleasePrebuildTargets,
  getRootPackageName,
  getSupportedNodeTargets,
  normalizeTarget,
  parseNodeVersion,
  parsePrebuildArgs,
  parseTargetList,
};
