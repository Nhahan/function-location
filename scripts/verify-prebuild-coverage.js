'use strict';

const fs = require('node:fs');
const path = require('node:path');

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

function main() {
  const requiredGroups = parseRequired();
  const baseDir = parseBaseDir();
  const requiredMinBinaries = parseRequiredMinBinaries();
  const prebuildDirs = findPrebuildDirs(baseDir);

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
