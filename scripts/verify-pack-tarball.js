'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function parsePackageDir(argv = process.argv.slice(2), cwd = process.cwd()) {
  const arg = argv.find((item) => item.startsWith('--package-dir='));
  if (!arg) {
    return cwd;
  }

  return path.resolve(cwd, arg.slice('--package-dir='.length));
}

function cleanupTarball(tarballPath) {
  if (!tarballPath) return;
  if (!fs.existsSync(tarballPath)) return;
  try {
    fs.unlinkSync(tarballPath);
  } catch (error) {
    console.error(`Unable to remove temporary tarball ${tarballPath}:`, error.message);
  }
}

function resolveNpmCliPath(execPath = process.execPath) {
  const nodeDir = path.dirname(execPath);
  const candidates = [
    path.resolve(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(nodeDir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function createPackInvocation(env = process.env, execPath = process.execPath) {
  const args = ['pack', '--json', '--silent', '--ignore-scripts'];

  const npmExecPath = env.npm_execpath || resolveNpmCliPath(execPath);

  if (npmExecPath) {
    return {
      command: execPath,
      args: [npmExecPath].concat(args),
    };
  }

  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
  };
}

function packStagedPackage(stagingDir, executor = execFileSync, env = process.env) {
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

  return {
    manifest,
    tarballPath: manifest.filename ? path.join(stagingDir, manifest.filename) : null,
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

function findStandardMetadataFile(rootDir, prefixes) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    return null;
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const lowerName = entry.name.toLowerCase();
    if (prefixes.some((prefix) => lowerName === prefix || lowerName.startsWith(`${prefix}.`))) {
      return entry.name;
    }
  }

  return null;
}

function getMetadataSourceDirectories(rootDir) {
  const sources = [rootDir];
  const parentDir = path.dirname(rootDir);
  const grandparentDir = path.dirname(parentDir);

  if (path.basename(parentDir) === 'packages' && grandparentDir !== rootDir) {
    sources.push(grandparentDir);
  }

  return sources;
}

function copyStandardMetadata(rootDir, stagingDir) {
  const metadataDefinitions = [
    ['readme'],
    ['license', 'licence'],
  ];

  for (const prefixes of metadataDefinitions) {
    let copied = false;

    for (const sourceDir of getMetadataSourceDirectories(rootDir)) {
      const matchedFile = findStandardMetadataFile(sourceDir, prefixes);
      if (!matchedFile) {
        continue;
      }

      const sourcePath = path.join(sourceDir, matchedFile);
      const destinationPath = path.join(stagingDir, matchedFile);
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.copyFileSync(sourcePath, destinationPath);
      copied = true;
      break;
    }

    if (copied) {
      continue;
    }
  }
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

  copyStandardMetadata(rootDir, stagingDir);
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
    const packed = packStagedPackage(stagingDir, executor, env);
    const manifest = packed.manifest;

    const includedPaths = new Set(manifest.files.map((entry) => entry.path));
    const missingFiles = requiredFiles.filter((file) => !matchesRequiredFile(file, includedPaths));

    if (missingFiles.length > 0) {
      throw new Error(`Missing files in package tarball: ${missingFiles.join(', ')}`);
    }

    tarballPath = packed.tarballPath;
    return manifest;
  } finally {
    cleanupTarball(tarballPath);
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

function main(argv = process.argv.slice(2)) {
  try {
    verifyPackTarball(parsePackageDir(argv));
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
  copyStandardMetadata,
  findStandardMetadataFile,
  getMetadataSourceDirectories,
  getRequiredEntryPath,
  matchesDirectory,
  matchesRequiredFile,
  normalizePath,
  packStagedPackage,
  parsePackageDir,
  resolveNpmCliPath,
  stagePackDirectory,
  verifyPackTarball,
};
