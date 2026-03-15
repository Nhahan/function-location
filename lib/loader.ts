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
};

const DEFAULT_PACKAGE_DIR = path.resolve(__dirname, '..');
const PLATFORM_PACKAGES = packageLayout.platformPackages as PlatformPackage[];

export function createLocateLoader(
  requireFn: RequireFunction,
  packageDir = DEFAULT_PACKAGE_DIR,
): (input: Function) => string | undefined {
  const imported = loadNativeAddon(requireFn, packageDir);

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
): string | null {
  const match = PLATFORM_PACKAGES.find((entry) => entry.platform === platform && entry.arch === arch);
  return match ? match.name : null;
}

function loadNativeAddon(requireFn: RequireFunction, packageDir: string): NativeAddon {
  const platformPackageName = resolvePlatformPackageName();
  let platformError: Error | null = null;

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

    throw new Error(
      [
        `Unable to load native addon from installed platform package ${platformPackageName} (${platformError.message}).`,
        `Local fallback from ${packageDir} also failed (${resolvedLocalError.message}).`,
      ].join(' '),
    );
  }
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
