#!/usr/bin/env node

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getPublishedPackages, getPublishedPackageSpecs } = require('./package-metadata');
const { getNpmCommandSpec } = require('./npm-cli');
const { getNextPatchVersion, stagePublishDirectory } = require('./stage-publish');

const rootPackageDir = path.resolve(__dirname, '..');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    artifactsDir: 'artifacts',
    tag: '',
    versionSuffix: '',
    dryRun: false,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--artifacts-dir=')) {
      options.artifactsDir = arg.slice('--artifacts-dir='.length);
    } else if (arg.startsWith('--tag=')) {
      options.tag = arg.slice('--tag='.length);
    } else if (arg.startsWith('--version-suffix=')) {
      options.versionSuffix = arg.slice('--version-suffix='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.tag) {
    throw new Error(
      'Usage: node ./scripts/publish-packages.js --tag=<dist-tag> [--artifacts-dir=<path>] [--version-suffix=<suffix>] [--dry-run]',
    );
  }

  return options;
}

// Platform packages go first so the root package never references missing versions.
function getPublishOrder(versionSuffix = '', rootDir = rootPackageDir, baseVersion = '') {
  const [rootPackage, ...platformPackages] = getPublishedPackageSpecs(versionSuffix, rootDir, baseVersion);

  return platformPackages
    .map((entry) => ({ ...entry, isRoot: false }))
    .concat({ ...rootPackage, isRoot: true });
}

function findPackageTarball(artifactsDir, packageName) {
  const directory = path.join(artifactsDir, `package-${packageName}`);
  const tarballs = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((file) => file.endsWith('.tgz'))
    : [];

  if (tarballs.length !== 1) {
    throw new Error(`Expected exactly one tarball in ${directory}, found ${tarballs.length}.`);
  }

  return path.join(directory, tarballs[0]);
}

function createNpmRunner(executor = execFileSync, npmCommand = getNpmCommandSpec()) {
  return (args, options = {}) => executor(npmCommand.command, npmCommand.args.concat(args), {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
}

function isPublished(runNpm, spec) {
  try {
    return String(runNpm(['view', spec, 'version']) || '').trim() !== '';
  } catch (error) {
    const output = [error.stdout, error.stderr, error.message].filter(Boolean).join('\n');

    if (output.includes('E404')) {
      return false;
    }

    throw new Error(`Unable to check whether ${spec} is published:\n${output}`);
  }
}

function createPublishArgs(target, options, env = process.env) {
  const args = ['publish', target, '--access', 'public', '--tag', options.tag, '--ignore-scripts'];

  if (options.dryRun) {
    args.push('--dry-run');
  } else if (env.GITHUB_ACTIONS === 'true') {
    args.push('--provenance');
  }

  return args;
}

// Prereleases of an already released version would sort below it, so they
// build on the next patch version instead.
function resolvePrereleaseBaseVersion(runNpm, rootDir = rootPackageDir) {
  const [rootPackage] = getPublishedPackages(rootDir);

  if (rootPackage.version.includes('-') || !isPublished(runNpm, `${rootPackage.name}@${rootPackage.version}`)) {
    return '';
  }

  return getNextPatchVersion(rootPackage.version);
}

function publishPackages(options, runNpm = createNpmRunner(), log = console.log, env = process.env) {
  const baseVersion = options.versionSuffix && !options.dryRun ? resolvePrereleaseBaseVersion(runNpm) : '';
  if (baseVersion) {
    log(`The current version is already released; publishing prereleases of ${baseVersion}.`);
  }

  const packages = getPublishOrder(options.versionSuffix, rootPackageDir, baseVersion);
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'function-location-publish-'));
  const published = [];

  try {
    const rootPackage = packages[packages.length - 1];
    const rootSpec = `${rootPackage.name}@${rootPackage.version}`;

    // The root package is published last, so its presence means the release already completed.
    if (!options.dryRun && isPublished(runNpm, rootSpec)) {
      throw new Error(`${rootSpec} is already published. Bump the package versions before releasing again.`);
    }

    for (const entry of packages) {
      const spec = `${entry.name}@${entry.version}`;

      // Platform packages may already exist when a previous attempt failed part-way.
      if (!options.dryRun && !entry.isRoot && isPublished(runNpm, spec)) {
        log(`Skipping ${spec}: already published.`);
        continue;
      }

      const tarball = findPackageTarball(options.artifactsDir, entry.name);
      const target = options.versionSuffix
        ? stagePublishDirectory(tarball, path.join(stagingRoot, entry.name), options.versionSuffix, { baseVersion }).packageDir
        : tarball;

      log(`Publishing ${spec} with dist-tag ${options.tag}${options.dryRun ? ' (dry run)' : ''}.`);
      runNpm(createPublishArgs(target, options, env), { inherit: true });
      published.push(spec);
    }
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }

  return published;
}

if (require.main === module) {
  try {
    publishPackages(parseArgs());
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  createPublishArgs,
  findPackageTarball,
  getPublishOrder,
  isPublished,
  parseArgs,
  publishPackages,
  resolvePrereleaseBaseVersion,
};
