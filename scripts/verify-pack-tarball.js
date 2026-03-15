'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function cleanupTarball(tarballPath) {
  if (!tarballPath) return;
  if (!fs.existsSync(tarballPath)) return;
  try {
    fs.unlinkSync(tarballPath);
  } catch (error) {
    console.error(`Unable to remove temporary tarball ${tarballPath}:`, error.message);
  }
}

function createPackInvocation(env = process.env) {
  const args = ['pack', '--json', '--silent', '--ignore-scripts'];

  if (env.npm_execpath) {
    return {
      command: process.execPath,
      args: [env.npm_execpath].concat(args),
    };
  }

  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
  };
}

function getRequiredEntryPath(requiredFile) {
  if (requiredFile.endsWith('/**')) {
    return requiredFile.slice(0, -3);
  }

  if (requiredFile.endsWith('/')) {
    return requiredFile.slice(0, -1);
  }

  return requiredFile;
}

function copyRequiredEntry(rootDir, stagingDir, requiredFile) {
  const entryPath = getRequiredEntryPath(requiredFile);

  if (!entryPath) {
    throw new Error(`Invalid package file entry: ${requiredFile}`);
  }

  const sourcePath = path.join(rootDir, entryPath);
  const destinationPath = path.join(stagingDir, entryPath);
  const stats = fs.statSync(sourcePath);

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

  if (stats.isDirectory()) {
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
    return;
  }

  fs.copyFileSync(sourcePath, destinationPath);
}

function stagePackDirectory(rootDir, packageJson, stagingDir) {
  const stagedPackageJson = {
    ...packageJson,
  };

  delete stagedPackageJson.scripts;

  fs.writeFileSync(
    path.join(stagingDir, 'package.json'),
    `${JSON.stringify(stagedPackageJson, null, 2)}\n`,
  );

  const requiredFiles = Array.isArray(packageJson.files) ? packageJson.files : [];

  for (const requiredFile of requiredFiles) {
    copyRequiredEntry(rootDir, stagingDir, requiredFile);
  }
}

function verifyPackTarball(rootDir = process.cwd(), executor = execFileSync, env = process.env) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredFiles = packageJson.files;

  if (!Array.isArray(requiredFiles) || requiredFiles.length === 0) {
    throw new Error('No package files configured; set `files` in package.json.');
  }

  let tarballPath = null;
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'function-location-pack-'));

  try {
    stagePackDirectory(rootDir, packageJson, stagingDir);

    let packMetadataRaw;
    const invocation = createPackInvocation(env);
    try {
      packMetadataRaw = executor(invocation.command, invocation.args, {
        cwd: stagingDir,
        encoding: 'utf8',
      });
    } catch (error) {
      throw new Error(`npm pack failed: ${error.message}`);
    }

    let manifest;
    try {
      const packMetadata = JSON.parse(packMetadataRaw);
      manifest = Array.isArray(packMetadata) ? packMetadata[0] : packMetadata;
    } catch (error) {
      throw new Error('Failed to parse npm pack --json output.');
    }

    if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files)) {
      throw new Error('Unexpected npm pack output shape.');
    }

    const includedPaths = new Set(manifest.files.map((entry) => entry.path));
    const missingFiles = requiredFiles.filter((file) => !matchesRequiredFile(file, includedPaths));

    if (missingFiles.length > 0) {
      throw new Error(`Missing files in package tarball: ${missingFiles.join(', ')}`);
    }

    tarballPath = manifest.filename ? path.join(stagingDir, manifest.filename) : null;
    return manifest;
  } finally {
    cleanupTarball(tarballPath);
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

function main() {
  try {
    verifyPackTarball();
    console.log('Package tarball includes required files.');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

function matchesRequiredFile(requiredFile, includedPaths) {
  if (requiredFile.endsWith('/**')) {
    const prefix = requiredFile.slice(0, -3);
    if (prefix === '') return false;

    return [...includedPaths].some((includedPath) => matchesDirectory(prefix, includedPath));
  }

  if (requiredFile.endsWith('/')) {
    const prefix = requiredFile.slice(0, -1);
    return [...includedPaths].some((includedPath) => matchesDirectory(prefix, includedPath));
  }

  return includedPaths.has(requiredFile);
}

function matchesDirectory(prefix, includedPath) {
  const normalizedPrefix = normalizePath(prefix);
  const normalizedPath = normalizePath(includedPath);
  return (
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
  );
}

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

if (require.main === module) {
  main();
}

module.exports = {
  copyRequiredEntry,
  createPackInvocation,
  getRequiredEntryPath,
  matchesDirectory,
  matchesRequiredFile,
  normalizePath,
  stagePackDirectory,
  verifyPackTarball,
};
