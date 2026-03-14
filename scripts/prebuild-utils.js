'use strict';

const NODE_VERSION_PATTERN = /^(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+))?)?(?:\.x)?$/;

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

function normalizeTarget(target, currentVersion) {
  const current = parseNodeVersion(currentVersion);
  const match = NODE_VERSION_PATTERN.exec(target);

  if (!match || !match.groups) {
    throw new Error(`Invalid prebuild target "${target}". Use major, major.minor, major.minor.patch, or major.x.`);
  }

  const major = Number.parseInt(match.groups.major, 10);

  if (Number.isNaN(major)) {
    throw new Error(`Invalid prebuild target "${target}".`);
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

function getCurrentPrebuildDir(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

module.exports = {
  parseNodeVersion,
  normalizeTarget,
  parseTargetList,
  parsePrebuildArgs,
  buildPrebuildArgs,
  getCurrentPrebuildDir,
};
