'use strict';

const NODE_VERSION_PATTERN = /^(?<major>\d+)(?:\.(?<minor>\d+)(?:\.(?<patch>\d+))?)?(?:\.x)?$/;
const SUPPORTED_NODE_TARGETS = Object.freeze([
  { major: 8, version: '8.17.0', abi: '57' },
  { major: 10, version: '10.24.1', abi: '64' },
  { major: 12, version: '12.22.12', abi: '72' },
  { major: 14, version: '14.21.3', abi: '83' },
  { major: 16, version: '16.20.2', abi: '93' },
  { major: 18, version: '18.20.8', abi: '108' },
  { major: 20, version: '20.20.1', abi: '115' },
  { major: 22, version: '22.22.1', abi: '127' },
  { major: 24, version: '24.14.0', abi: '137' },
]);

const RELEASE_PREBUILD_MINIMUM_MAJOR = Object.freeze({
  'darwin-arm64': 16,
  'darwin-x64': 8,
  'linux-x64': 8,
  'win32-x64': 8,
});

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

function getSupportedNodeTargets() {
  return SUPPORTED_NODE_TARGETS.map((target) => ({ ...target }));
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

function getReleasePrebuildPlan(
  platform = process.platform,
  arch = process.arch,
  currentVersion = process.versions.node,
) {
  const currentDir = getCurrentPrebuildDir(platform, arch);
  const minimumMajor = RELEASE_PREBUILD_MINIMUM_MAJOR[currentDir];

  if (minimumMajor === undefined) {
    const abi = getNodeAbiForVersion(currentVersion);
    if (!abi) {
      return [];
    }

    return [{ major: parseNodeVersion(currentVersion).major, version: currentVersion, abi }];
  }

  return SUPPORTED_NODE_TARGETS
    .filter((target) => target.major >= minimumMajor)
    .map((target) => ({ ...target }));
}

function getReleasePrebuildTargets(
  platform = process.platform,
  arch = process.arch,
  currentVersion = process.versions.node,
) {
  return getReleasePrebuildPlan(platform, arch, currentVersion).map((target) => target.version);
}

function getExpectedPrebuildFiles(
  platform = process.platform,
  arch = process.arch,
  currentVersion = process.versions.node,
) {
  return getExpectedPrebuildFilesForTargets(
    getReleasePrebuildPlan(platform, arch, currentVersion).map((target) => target.version),
  );
}

function getExpectedPrebuildFilesForTargets(targets) {
  return getPrebuildPlanForTargets(targets).map(
    (target) => `function-location.abi${target.abi}.node`,
  );
}

module.exports = {
  getExpectedPrebuildFiles,
  getExpectedPrebuildFilesForTargets,
  parseNodeVersion,
  normalizeTarget,
  parseTargetList,
  parsePrebuildArgs,
  buildPrebuildArgs,
  getCurrentPrebuildDir,
  getNodeAbiForMajor,
  getNodeAbiForVersion,
  getPrebuildPlanForTargets,
  getReleasePrebuildPlan,
  getReleasePrebuildTargets,
  getSupportedNodeTargets,
};
