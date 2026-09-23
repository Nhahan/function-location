#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const rootPackageDir = path.resolve(__dirname, '..');

function getChangelogSection(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);

  if (start === -1) {
    return '';
  }

  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
}

function getReleaseNotes(changelog, packageName, version) {
  const section = getChangelogSection(changelog, version);

  if (!section) {
    throw new Error(`CHANGELOG.md has no "## ${version}" section.`);
  }

  return [
    section,
    '',
    '### Install',
    '',
    '```bash',
    `npm install ${packageName}@${version}`,
    '```',
    '',
    `Published to npm with provenance: https://www.npmjs.com/package/${packageName}/v/${version}`,
    '',
  ].join('\n');
}

function main(argv = process.argv.slice(2)) {
  const manifest = JSON.parse(fs.readFileSync(path.join(rootPackageDir, 'package.json'), 'utf8'));
  const version = argv[0] || manifest.version;
  const changelog = fs.readFileSync(path.join(rootPackageDir, 'CHANGELOG.md'), 'utf8');

  process.stdout.write(getReleaseNotes(changelog, manifest.name, version));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  getChangelogSection,
  getReleaseNotes,
};
