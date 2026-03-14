type RequireFunction = {
  (path: string): unknown;
  resolve(path: string): string;
};

type NodeErrnoException = NodeJS.ErrnoException & { code?: unknown };

const ADDON_NAME_BY_PLATFORM: Record<string, string[]> = {
  win32: ['locate-win.node', 'locate.node'],
  default: ['locate.node', 'locate-win.node'],
};

export function resolveNativeAddonFilename(platform = process.platform): string[] {
  return ADDON_NAME_BY_PLATFORM[platform] ?? ADDON_NAME_BY_PLATFORM.default;
}

export function createLocateLoader(
  requireFn: RequireFunction,
  platform = process.platform,
): (input: Function) => string | undefined {
  const candidates = resolveNativeAddonFilename(platform);

  for (const candidate of candidates) {
    const importPath = `./${candidate}`;

    try {
      requireFn.resolve(importPath);
    } catch (error: unknown) {
      if (isModuleNotFoundError(error)) {
        continue;
      }
      throw error;
    }

    const imported = requireFn(importPath);
    if (
      imported &&
      typeof imported === 'object' &&
      'locate' in imported &&
      typeof (imported as { locate?: unknown }).locate === 'function'
    ) {
      return (imported as { locate: (input: Function) => string | undefined }).locate;
    }

    throw new Error(`Native addon does not export locate() in ${candidate}.`);
  }

  const addonCandidates = candidates.map((candidate) => `./${candidate}`).join(', ');
  throw new Error(
    `Cannot load function-location native addon. Searched: ${addonCandidates}. ` +
    'If this is a source checkout, run `npm run build:native` and `npm run copy:native`.',
  );
}

function isModuleNotFoundError(error: unknown): error is NodeErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeErrnoException).code === 'MODULE_NOT_FOUND'
  );
}
