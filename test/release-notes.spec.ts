import { readFileSync } from 'node:fs';
import path from 'node:path';

const { getChangelogSection, getReleaseNotes } = require('../scripts/release-notes');
const rootPackageJson = require('../package.json');

const CHANGELOG = ['# Changelog', '', '## 2.1.0', '', '### Added', '', '- New thing.', '', '## 2.0.0', '', '- Old thing.', ''].join('\n');

describe('release-notes', () => {
  test('extracts only the requested version section', () => {
    expect(getChangelogSection(CHANGELOG, '2.1.0')).toBe('### Added\n\n- New thing.');
    expect(getChangelogSection(CHANGELOG, '2.0.0')).toBe('- Old thing.');
    expect(getChangelogSection(CHANGELOG, '9.9.9')).toBe('');
  });

  test('adds install instructions and the npm link', () => {
    const notes = getReleaseNotes(CHANGELOG, 'function-location', '2.1.0');

    expect(notes).toContain('- New thing.');
    expect(notes).not.toContain('Old thing');
    expect(notes).toContain('npm install function-location@2.1.0');
    expect(notes).toContain('https://www.npmjs.com/package/function-location/v/2.1.0');
  });

  test('refuses to release a version without a CHANGELOG entry', () => {
    expect(() => getReleaseNotes(CHANGELOG, 'function-location', '9.9.9')).toThrow('no "## 9.9.9" section');
  });

  test('CHANGELOG documents the current package version', () => {
    const changelog = readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');

    expect(getChangelogSection(changelog, rootPackageJson.version)).not.toBe('');
  });
});
