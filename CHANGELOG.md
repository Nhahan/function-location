# Changelog

## 2.0.0

### Breaking changes

- Requires Node.js 20 or later. Node.js 16 and 18 are no longer supported; `engines` is `>=20 <27`.

### Added

- Prebuilt binaries for Linux x64 (glibc), macOS x64 and arm64, and Windows x64 for every Node.js major from 20 to 26. 1.0.0 shipped no Linux binary.
- Bound functions resolve to the location of their target function.

### Changed

- Native binaries ship as platform packages (`function-location-<platform>-<arch>`) installed through `optionalDependencies`, so installs download only the matching binary.
- `locateV8` is typed as returning `string | undefined` instead of `any`.
- Packages are published with npm provenance.

### Performance

- `locateV8` is about 4.8x faster (0.1227 µs to 0.0254 µs per call on Apple M4 Max, Node.js 22): it returns the existing script-name string and no longer resolves V8-internal symbols.

### Fixed

- A crash when passing builtin functions such as `Math.max` from another `vm` context.
- The returned path could reference a handle released before the call returned.
