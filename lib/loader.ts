import path from 'node:path';

type RequireFunction = {
  (path: string): unknown;
};

type NodeGypBuildLoader = (directory: string) => unknown;
type NativeAddon = {
  locate?: unknown;
};

const DEFAULT_PACKAGE_DIR = path.resolve(__dirname, '..');

export function createLocateLoader(
  requireFn: RequireFunction,
  packageDir = DEFAULT_PACKAGE_DIR,
): (input: Function) => string | undefined {
  const imported = loadNativeAddon(requireFn, packageDir);

  if (!imported || typeof imported !== 'object' || !('locate' in imported)) {
    throw new Error(`Native addon loaded from ${packageDir} does not export locate().`);
  }

  const { locate } = imported as NativeAddon;

  if (typeof locate !== 'function') {
    throw new Error(
      `Native addon loaded from ${packageDir} exports locate with invalid type (${typeof locate}).`,
    );
  }

  return locate as (input: Function) => string | undefined;
}

function loadNativeAddon(requireFn: RequireFunction, packageDir: string): NativeAddon {
  const nodeGypBuild = resolveNodeGypBuild(requireFn);
  const imported = nodeGypBuild(packageDir);

  if (!imported || typeof imported !== 'object') {
    throw new Error('Loaded native addon does not export an object.');
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
