const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const builtBinary = path.join(rootDir, 'native', 'build', 'Release', 'locate.node');
const sourceBinaries = [
  { source: path.join(rootDir, 'lib', 'locate.node'), target: 'locate.node' },
  { source: path.join(rootDir, 'lib', 'locate-win.node'), target: 'locate-win.node' },
];

if (!fs.existsSync(builtBinary)) {
  throw new Error(`Native binary not found: ${builtBinary}. Run npm run build:native first.`);
}

const missingSourceBinaries = sourceBinaries
  .filter((addon) => !fs.existsSync(addon.source))
  .map((addon) => addon.source);

if (missingSourceBinaries.length > 0) {
  throw new Error(
    `Missing bundled native binaries: ${missingSourceBinaries.join(', ')}. ` +
      'Prebuilt binaries for both platforms must exist in lib/.',
  );
}

for (const addon of sourceBinaries) {
  const targetPath = path.join(distDir, addon.target);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
}

const currentPlatformBinary =
  process.platform === 'win32' ? 'locate-win.node' : 'locate.node';
fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(
  builtBinary,
  path.join(distDir, currentPlatformBinary),
);

for (const addon of sourceBinaries) {
  if (addon.target === currentPlatformBinary) {
    continue;
  }
  fs.copyFileSync(addon.source, path.join(distDir, addon.target));
}
