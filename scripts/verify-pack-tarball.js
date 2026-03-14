const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const rootDir = process.cwd();
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const requiredFiles = packageJson.files;
let tarballPath = null;

function cleanupTarball() {
  if (!tarballPath) return;
  if (!fs.existsSync(tarballPath)) return;
  try {
    fs.unlinkSync(tarballPath);
  } catch (error) {
    console.error(`Unable to remove temporary tarball ${tarballPath}:`, error.message);
  }
}

process.once('exit', cleanupTarball);

if (!Array.isArray(requiredFiles) || requiredFiles.length === 0) {
  console.error('No package files configured; set `files` in package.json.');
  process.exit(1);
}

let packMetadataRaw;
try {
  packMetadataRaw = execSync('npm pack --json --silent', { encoding: 'utf8' });
} catch (error) {
  console.error('npm pack failed:', error.message);
  process.exit(1);
}

let manifest;
try {
  const packMetadata = JSON.parse(packMetadataRaw);
  manifest = Array.isArray(packMetadata) ? packMetadata[0] : packMetadata;
} catch {
  console.error('Failed to parse npm pack --json output.');
  process.exit(1);
}

if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files)) {
  console.error('Unexpected npm pack output shape.');
  process.exit(1);
}

const includedPaths = new Set(manifest.files.map((entry) => entry.path));
const missingFiles = requiredFiles.filter((file) => !matchesRequiredFile(file, includedPaths));

if (missingFiles.length > 0) {
  console.error('Missing files in package tarball:', missingFiles.join(', '));
  process.exit(1);
}

console.log('Package tarball includes required files.');

tarballPath = manifest.filename ? path.join(rootDir, manifest.filename) : null;

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
