import fs from 'fs';
import path from 'path';

import packageLayout from '../config/package-layout.json';

type RequireFunction = {
  (path: string): unknown;
};

type NodeGypBuildLoader = (directory: string) => unknown;
type NativeAddon = {
  locate?: unknown;
};

type PlatformPackage = {
  name: string;
  platform: string;
  arch: string;
  libc?: string[];
};

type RuntimeTarget = {
  platform: string;
  arch: string;
  libc: string | null;
};

type PlatformPackageResolution = {
  packageName: string | null;
  unsupportedReason: string | null;
};

const DEFAULT_PACKAGE_DIR = resolveDefaultPackageDir();
const PLATFORM_PACKAGES = packageLayout.platformPackages as PlatformPackage[];

export function createLocateLoader(
  requireFn: RequireFunction,
  packageDir = DEFAULT_PACKAGE_DIR,
  runtimeTarget = resolveRuntimeTarget(),
): (input: Function) => string | undefined {
  const imported = loadNativeAddon(requireFn, packageDir, runtimeTarget);

  if (!imported || typeof imported !== 'object' || !('locate' in imported)) {
    throw new Error('Loaded native addon does not export locate().');
  }

  const { locate } = imported as NativeAddon;

  if (typeof locate !== 'function') {
    throw new Error(`Loaded native addon exports locate with invalid type (${typeof locate}).`);
  }

  return locate as (input: Function) => string | undefined;
}

export function resolvePlatformPackageName(
  platform = process.platform,
  arch = process.arch,
  libc = platform === 'linux' ? detectLinuxLibc() : null,
): string | null {
  return resolvePlatformPackage(platform, arch, libc).packageName;
}

function loadNativeAddon(
  requireFn: RequireFunction,
  packageDir: string,
  runtimeTarget: RuntimeTarget,
): NativeAddon {
  const resolution = resolvePlatformPackage(
    runtimeTarget.platform,
    runtimeTarget.arch,
    runtimeTarget.libc,
  );
  const platformPackageName = resolution.packageName;
  let platformError: Error | null = resolution.unsupportedReason
    ? new Error(resolution.unsupportedReason)
    : null;

  if (platformPackageName) {
    try {
      return loadInstalledPlatformAddon(requireFn, platformPackageName);
    } catch (error) {
      platformError = asError(error);
    }
  }

  try {
    return loadLocalAddon(requireFn, packageDir);
  } catch (localError) {
    const resolvedLocalError = asError(localError);

    if (!platformError) {
      throw resolvedLocalError;
    }

    const platformMessage = platformPackageName
      ? `Unable to load native addon from installed platform package ${platformPackageName} (${platformError.message}).`
      : `Published native addon is unavailable for the current runtime (${platformError.message}).`;

    throw new Error(
      [
        platformMessage,
        `Local fallback from ${packageDir} also failed (${resolvedLocalError.message}).`,
      ].join(' '),
    );
  }
}

function resolveRuntimeTarget(): RuntimeTarget {
  return {
    platform: process.platform,
    arch: process.arch,
    libc: process.platform === 'linux' ? detectLinuxLibc() : null,
  };
}

function detectLinuxLibc(): string | null {
  const report = process.report?.getReport?.() as { header?: { glibcVersionRuntime?: unknown } } | undefined;
  const glibcVersionRuntime = report?.header?.glibcVersionRuntime;

  return typeof glibcVersionRuntime === 'string' && glibcVersionRuntime.length > 0
    ? 'glibc'
    : null;
}

function resolvePlatformPackage(
  platform: string,
  arch: string,
  libc: string | null,
): PlatformPackageResolution {
  const matches = PLATFORM_PACKAGES.filter((entry) => entry.platform === platform && entry.arch === arch);
  if (matches.length === 0) {
    return {
      packageName: null,
      unsupportedReason: null,
    };
  }

  const match = matches.find((entry) => !entry.libc || (libc !== null && entry.libc.includes(libc)));
  if (match) {
    return {
      packageName: match.name,
      unsupportedReason: null,
    };
  }

  const supportedLibcs = Array.from(
    new Set(matches.flatMap((entry) => entry.libc || [])),
  );
  const runtimeLabel = libc ? `${platform}-${arch} (${libc})` : `${platform}-${arch}`;

  return {
    packageName: null,
    unsupportedReason: `No published native addon is available for ${runtimeLabel}. Supported libc for this target: ${supportedLibcs.join(', ')}.`,
  };
}

function resolveDefaultPackageDir(): string {
  const candidate = path.resolve(__dirname, '..');

  if (fs.existsSync(path.join(candidate, 'package.json'))) {
    return candidate;
  }

  return path.resolve(candidate, '..');
}

function loadInstalledPlatformAddon(requireFn: RequireFunction, platformPackageName: string): NativeAddon {
  try {
    const imported = requireFn(platformPackageName);

    if (!imported || typeof imported !== 'object') {
      throw new Error(`Platform package ${platformPackageName} did not export an object.`);
    }

    return imported as NativeAddon;
  } catch (error) {
    const resolved = asError(error);

    if (isModuleNotFoundError(resolved, platformPackageName)) {
      throw new Error(`Optional platform package ${platformPackageName} is not installed.`);
    }

    throw resolved;
  }
}

function loadLocalAddon(requireFn: RequireFunction, packageDir: string): NativeAddon {
  const nodeGypBuild = resolveNodeGypBuild(requireFn);
  const imported = nodeGypBuild(packageDir);

  if (!imported || typeof imported !== 'object') {
    throw new Error(`Loaded native addon from ${packageDir} does not export an object.`);
  }

  return imported as NativeAddon;
}

function resolveNodeGypBuild(requireFn: RequireFunction): NodeGypBuildLoader {
  const nodeGypBuild = requireFn('node-gyp-build');

  if (typeof nodeGypBuild !== 'function') {
    throw new Error(`node-gyp-build must export a function. Loaded: ${String(typeof nodeGypBuild)}.`);
  }

  return nodeGypBuild as NodeGypBuildLoader;
}

function isModuleNotFoundError(error: Error, moduleName: string): boolean {
  const errorWithCode = error as NodeJS.ErrnoException;
  if (errorWithCode.code !== 'MODULE_NOT_FOUND') {
    return false;
  }

  return error.message.includes(`'${moduleName}'`) || error.message.includes(`"${moduleName}"`);
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
