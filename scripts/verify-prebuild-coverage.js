'use strict';

const fs = require('fs');
const path = require('path');
const { getCurrentPrebuildDir, getExpectedPrebuildFiles } = require('./prebuild-utils');

const RELEASE_PREBUILD_PLATFORMS = [
  ['darwin', 'arm64'],
  ['darwin', 'x64'],
  ['linux', 'x64'],
  ['win32', 'x64'],
];

function parseRequired(argv = process.argv.slice(2)) {
  const requiredArg = argv.find((item) => item.startsWith('--required='));
  const requiredRaw = requiredArg ? requiredArg.slice('--required='.length) : process.env.PREBUILD_REQUIRED_DIRECTORIES;

  if (!requiredRaw) {
    return [];
  }

  return requiredRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split('|').map((entry) => entry.trim()).filter(Boolean));
}

function parseBaseDir(argv = process.argv.slice(2)) {
  const baseArg = argv.find((item) => item.startsWith('--base-dir='));
  return baseArg ? baseArg.slice('--base-dir='.length) : process.env.PREBUILD_BASE_DIR || process.cwd();
}

function parseRequiredMinBinaries(argv = process.argv.slice(2)) {
  const minArg = argv.find((item) => item.startsWith('--required-min='));
  const rawMin = minArg ? minArg.slice('--required-min='.length) : process.env.PREBUILD_REQUIRED_MIN_BINARIES;
  const value = rawMin === undefined ? 1 : Number.parseInt(rawMin, 10);

  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid --required-min value: ${rawMin}`);
  }

  return value;
}

function parseReleasePlan(argv = process.argv.slice(2)) {
  return argv.includes('--release-plan') || process.env.PREBUILD_RELEASE_PLAN === '1';
}

function nodeBinaryCount(dir) {
  if (!fs.existsSync(dir)) {
    return 0;
  }
  const files = fs.readdirSync(dir);
  return files.filter((file) => file.endsWith('.node')).length;
}

function isPrebuildDirectory(candidateDir) {
  if (!fs.existsSync(candidateDir)) {
    return false;
  }

  const stat = fs.statSync(candidateDir);
  if (!stat.isDirectory()) {
    return false;
  }

  return fs.readdirSync(candidateDir).some((entry) => entry.endsWith('.node'));
}

function findPrebuildDirs(baseDir) {
  const roots = new Set();

  const maybePush = (candidateDir) => {
    if (isPrebuildDirectory(candidateDir)) {
      roots.add(candidateDir);
    }
  };

  if (fs.existsSync(path.join(baseDir, 'prebuilds'))) {
    return [path.join(baseDir, 'prebuilds')];
  }

  const topEntries = fs.readdirSync(baseDir, { withFileTypes: true });
  const hasPlatformRoot = topEntries.some(
    (entry) => entry.isDirectory() && isPrebuildDirectory(path.join(baseDir, entry.name)),
  );

  if (hasPlatformRoot) {
    return [baseDir];
  }

  for (const entry of topEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = path.join(baseDir, entry.name);
    maybePush(candidate);

    const candidateEntries = fs.readdirSync(candidate, { withFileTypes: true });
    for (const nested of candidateEntries) {
      if (nested.isDirectory()) {
        maybePush(path.join(candidate, nested.name));
      }
    }
  }

  return Array.from(roots);
}

function getCoverageRoot(baseDir) {
  const nested = path.join(baseDir, 'prebuilds');
  if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
    return nested;
  }

  return baseDir;
}

function verifyReleasePlan(baseDir) {
  const coverageRoot = getCoverageRoot(baseDir);
  const failures = [];

  for (const [platform, arch] of RELEASE_PREBUILD_PLATFORMS) {
    const platformDirName = getCurrentPrebuildDir(platform, arch);
    const platformDir = path.join(coverageRoot, platformDirName);
    const expected = getExpectedPrebuildFiles(platform, arch).sort();
    const actual = isPrebuildDirectory(platformDir)
      ? fs.readdirSync(platformDir).filter((entry) => entry.endsWith('.node')).sort()
      : [];

    const missing = expected.filter((file) => !actual.includes(file));
    const unexpected = actual.filter((file) => !expected.includes(file));

    if (missing.length > 0 || unexpected.length > 0) {
      const detail = [];

      if (missing.length > 0) {
        detail.push(`missing ${missing.join(', ')}`);
      }

      if (unexpected.length > 0) {
        detail.push(`unexpected ${unexpected.join(', ')}`);
      }

      failures.push(`${platformDirName}: ${detail.join('; ')}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Release prebuild coverage mismatch: ${failures.join(' | ')}`);
  }
}

function main() {
  const requiredGroups = parseRequired();
  const baseDir = parseBaseDir();
  const requiredMinBinaries = parseRequiredMinBinaries();
  const releasePlan = parseReleasePlan();
  const prebuildDirs = findPrebuildDirs(baseDir);

  if (releasePlan) {
    try {
      verifyReleasePlan(baseDir);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }

    console.log('Verified release prebuild coverage across the configured platform matrix.');
    return;
  }

  if (requiredGroups.length === 0) {
    if (prebuildDirs.length === 0) {
      console.error(`Missing prebuild directories under ${baseDir}.`);
      process.exit(1);
    }
    console.log(`Prebuild directory exists under ${baseDir}.`);
    return;
  }

  if (prebuildDirs.length === 0) {
    console.error(`Missing prebuild directories under ${baseDir}.`);
    process.exit(1);
  }

  const missing = [];

  for (const alternatives of requiredGroups) {
    const hasMatch = prebuildDirs.some((prebuildDir) =>
      alternatives.some(
        (entry) => nodeBinaryCount(path.join(prebuildDir, entry)) >= requiredMinBinaries,
      ),
    );
    if (!hasMatch) {
      missing.push(alternatives.join('|'));
    }
  }

  if (missing.length > 0) {
    console.error(`Missing prebuild coverage for: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log(`Verified prebuild coverage for ${requiredGroups.length} platform target(s).`);
}

main();
