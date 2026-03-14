'use strict';

const fs = require('node:fs');
const path = require('node:path');

function findPrebuildSources(rootDir) {
  const direct = path.join(rootDir, 'prebuilds');
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) {
    return [direct];
  }

  const sources = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = path.join(rootDir, entry.name);
    const prebuildDir = path.join(candidate, 'prebuilds');
    if (fs.existsSync(prebuildDir) && fs.statSync(prebuildDir).isDirectory()) {
      sources.push(prebuildDir);
      continue;
    }

    const nested = fs.readdirSync(candidate, { withFileTypes: true });
    for (const child of nested) {
      const nestedPrebuild = path.join(candidate, child.name, 'prebuilds');
      if (child.isDirectory() && fs.existsSync(nestedPrebuild) && fs.statSync(nestedPrebuild).isDirectory()) {
        sources.push(nestedPrebuild);
      }
    }
  }

  return sources;
}

function mergeArtifacts(sourceDirs, targetDir) {
  for (const sourceDir of sourceDirs) {
    if (!fs.existsSync(sourceDir)) {
      continue;
    }

    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        fs.cpSync(sourcePath, targetPath, { recursive: true, force: false });
        continue;
      }

      fs.cpSync(sourcePath, targetPath, { force: false });
    }
  }
}

function run() {
  const sourceRoot = process.env.PREBUILD_ARTIFACT_ROOT || process.cwd();
  const targetRoot = process.env.PREBUILD_MERGED_DIR || path.join(process.cwd(), 'prebuilds');

  const sources = findPrebuildSources(sourceRoot);
  if (sources.length === 0) {
    console.error(`No prebuild sources found under ${sourceRoot}`);
    process.exit(1);
  }

  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });
  mergeArtifacts(sources, targetRoot);
  console.log(`Merged prebuild artifacts into ${targetRoot} from ${sources.length} source(s).`);
}

run();
