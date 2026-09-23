import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const {
  createPublishArgs,
  getPublishOrder,
  isPublished,
  parseArgs,
  publishPackages,
  resolvePrereleaseBaseVersion,
} = require('../scripts/publish-packages');
const { getNextPatchVersion } = require('../scripts/stage-publish');
const rootPackageJson = require('../package.json');

const VERSION = rootPackageJson.version;
const PUBLISH_ORDER = [
  'function-location-linux-x64',
  'function-location-win32-x64',
  'function-location-darwin-x64',
  'function-location-darwin-arm64',
  'function-location',
];

type NpmCall = {
  args: string[];
  manifest?: { name: string; version: string; optionalDependencies?: Record<string, string> };
};

function createArtifacts(root: string): string {
  const artifactsDir = path.join(root, 'artifacts');

  for (const name of PUBLISH_ORDER) {
    const packageRoot = path.join(root, 'src', name);
    mkdirSync(path.join(packageRoot, 'package'), { recursive: true });
    writeFileSync(
      path.join(packageRoot, 'package', 'package.json'),
      JSON.stringify({
        name,
        version: VERSION,
        ...(name === 'function-location'
          ? { optionalDependencies: Object.fromEntries(PUBLISH_ORDER.slice(0, -1).map((dep) => [dep, VERSION])) }
          : {}),
      }),
    );

    // Relative paths keep GNU tar on Windows from reading drive letters as remote hosts.
    const tarballName = `${name}-${VERSION}.tgz`;
    const artifactDir = path.join(artifactsDir, `package-${name}`);
    mkdirSync(artifactDir, { recursive: true });
    execFileSync('tar', ['-czf', tarballName, 'package'], { cwd: packageRoot });
    renameSync(path.join(packageRoot, tarballName), path.join(artifactDir, tarballName));
  }

  return artifactsDir;
}

function createNpmMock(publishedSpecs: string[] = []) {
  const calls: NpmCall[] = [];
  const runNpm = (args: string[]) => {
    if (args[0] === 'view') {
      if (publishedSpecs.includes(args[1])) {
        return `${args[1].split('@').pop()}\n`;
      }

      const error = new Error('npm error code E404') as Error & { stderr: string };
      error.stderr = 'npm error code E404';
      throw error;
    }

    const target = args[1];
    const manifestPath = path.join(target, 'package.json');
    const manifest = target.endsWith('.tgz') ? undefined : JSON.parse(readFileSync(manifestPath, 'utf8'));
    calls.push({ args, manifest });
    return '';
  };

  return { calls, runNpm };
}

describe('publish-packages', () => {
  let root: string;
  let artifactsDir: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'function-location-publish-spec-'));
    artifactsDir = createArtifacts(root);
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('parses publish arguments and requires a dist-tag', () => {
    expect(parseArgs(['--tag=beta', '--artifacts-dir=out', '--version-suffix=beta.1.1', '--dry-run'])).toEqual({
      artifactsDir: 'out',
      tag: 'beta',
      versionSuffix: 'beta.1.1',
      dryRun: true,
    });
    expect(() => parseArgs([])).toThrow('Usage:');
    expect(() => parseArgs(['--tag=latest', '--unknown'])).toThrow('Unknown argument: --unknown');
  });

  test('publishes platform packages before the root package', () => {
    expect(getPublishOrder().map((entry: { name: string }) => entry.name)).toEqual(PUBLISH_ORDER);
  });

  test('dry runs publish every package without registry lookups or provenance', () => {
    const npm = createNpmMock();

    publishPackages({ artifactsDir, tag: 'dry-run', versionSuffix: '', dryRun: true }, npm.runNpm, () => {}, {
      GITHUB_ACTIONS: 'true',
    });

    expect(npm.calls.map((call) => path.basename(call.args[1]))).toEqual(
      PUBLISH_ORDER.map((name) => `${name}-${VERSION}.tgz`),
    );
    for (const call of npm.calls) {
      expect(call.args).toEqual(expect.arrayContaining(['--dry-run', '--ignore-scripts', '--tag', 'dry-run']));
      expect(call.args).not.toContain('--provenance');
    }
  });

  test('refuses to publish when the root version already exists', () => {
    const npm = createNpmMock([`function-location@${VERSION}`]);

    expect(() =>
      publishPackages({ artifactsDir, tag: 'latest', versionSuffix: '', dryRun: false }, npm.runNpm, () => {}, {}),
    ).toThrow(`function-location@${VERSION} is already published`);
    expect(npm.calls).toHaveLength(0);
  });

  test('skips platform packages published by an earlier partial release', () => {
    const npm = createNpmMock([`function-location-linux-x64@${VERSION}`]);
    const logs: string[] = [];

    const published = publishPackages(
      { artifactsDir, tag: 'latest', versionSuffix: '', dryRun: false },
      npm.runNpm,
      (message: string) => logs.push(message),
      { GITHUB_ACTIONS: 'true' },
    );

    expect(published).toEqual(PUBLISH_ORDER.slice(1).map((name) => `${name}@${VERSION}`));
    expect(logs).toContain(`Skipping function-location-linux-x64@${VERSION}: already published.`);
    for (const call of npm.calls) {
      expect(call.args).toContain('--provenance');
    }
  });

  // Staging extracts tarballs with absolute paths; releases only run on Linux.
  const posixOnly = process.platform === 'win32' ? test.skip : test;

  posixOnly('stages suffixed versions and aligns the root optional dependencies', () => {
    const npm = createNpmMock();

    publishPackages({ artifactsDir, tag: 'beta', versionSuffix: 'beta.7.1', dryRun: false }, npm.runNpm, () => {}, {});

    expect(npm.calls).toHaveLength(PUBLISH_ORDER.length);
    for (const call of npm.calls) {
      expect(call.manifest?.version).toBe(`${VERSION}-beta.7.1`);
    }
    expect(npm.calls[npm.calls.length - 1].manifest?.optionalDependencies).toEqual(
      Object.fromEntries(PUBLISH_ORDER.slice(0, -1).map((dep) => [dep, `${VERSION}-beta.7.1`])),
    );
  });

  posixOnly('publishes prereleases of the next patch once the current version is released', () => {
    const npm = createNpmMock([`function-location@${VERSION}`]);
    const logs: string[] = [];
    const next = getNextPatchVersion(VERSION);

    const published = publishPackages(
      { artifactsDir, tag: 'beta', versionSuffix: 'beta.8.1', dryRun: false },
      npm.runNpm,
      (message: string) => logs.push(message),
      {},
    );

    expect(published).toEqual(PUBLISH_ORDER.map((name) => `${name}@${next}-beta.8.1`));
    for (const call of npm.calls) {
      expect(call.manifest?.version).toBe(`${next}-beta.8.1`);
    }
    expect(logs).toContain(`The current version is already released; publishing prereleases of ${next}.`);
  });

  test('keeps the current version as the prerelease base until it is released', () => {
    expect(resolvePrereleaseBaseVersion(createNpmMock().runNpm)).toBe('');
    expect(resolvePrereleaseBaseVersion(createNpmMock([`function-location@${VERSION}`]).runNpm)).toBe(
      getNextPatchVersion(VERSION),
    );
  });

  test('computes the next patch version of a release', () => {
    expect(getNextPatchVersion('2.0.0')).toBe('2.0.1');
    expect(getNextPatchVersion('2.9.19')).toBe('2.9.20');
    expect(() => getNextPatchVersion('2.1.0-rc.1')).toThrow('Cannot compute the next patch version');
  });

  test('treats only E404 as an unpublished version', () => {
    const failing = () => {
      throw Object.assign(new Error('network down'), { stderr: 'npm error code ETIMEDOUT' });
    };

    expect(isPublished(createNpmMock().runNpm, 'function-location@0.0.0')).toBe(false);
    expect(() => isPublished(failing, 'function-location@0.0.0')).toThrow('Unable to check whether');
  });

  test('adds provenance only for real publishes from GitHub Actions', () => {
    const options = { tag: 'latest', dryRun: false };

    expect(createPublishArgs('pkg.tgz', options, { GITHUB_ACTIONS: 'true' })).toContain('--provenance');
    expect(createPublishArgs('pkg.tgz', options, {})).not.toContain('--provenance');
  });
});
