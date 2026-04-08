# Contributing

## Branches

- `main` is the default branch.
- `main` is the release branch. npm publish is allowed only from `main`.
- `dev` is the integration branch for ongoing development.
- `ci-verify/<topic>` is the temporary branch for workflow validation.

If a workflow change needs GitHub Actions verification, validate it on `ci-verify/<topic>` first, squash that branch back down before moving it onto `dev`, and promote the final release state to `main`.

## Runtime support

- Public package: `function-location`
- Supported Node.js versions: `16.x`, `18.x`, `20.x`, `22.x`, `24.x`
- Published platform packages:
  - `function-location-linux-x64` (`glibc`)
  - `function-location-win32-x64`
  - `function-location-darwin-x64`
  - `function-location-darwin-arm64`

The root npm package ships only the JS wrapper and metadata. Native binaries are published as platform-specific optional packages, so consumers download only the matching runtime package instead of the entire cross-platform binary set.

## CI and release

- `CI` is the fast feedback workflow:
  - maintainer test matrix on Linux, Windows, and macOS across Node `20/22/24`
  - root package tarball verification once per OS on Node `20`
  - platform prebuild generation and platform package tarball verification
  - compatibility smoke tests across Node `16/18/20/22/24`
- `Release` is the publish gate:
  - same maintainer test matrix
  - platform package tarballs are built first
  - the root package tarball is built separately
  - compatibility smoke tests install the root tarball plus the matching platform tarball across Node `16/18/20/22/24`
  - publish order is platform packages first, then the root package

Pushes to `main` publish unique `beta` prereleases under the npm `beta` dist-tag, so plain `npm install function-location` keeps resolving to the latest stable release.

`Release` dry-runs are allowed from `ci-verify/*`. Stable publishes are restricted to manual releases from `main`.

## Packaging notes

- Generated `.node` binaries are CI artifacts only and must not be committed.
- The root package depends on exact-version `optionalDependencies` for the platform packages. Keep those versions aligned.
- Repository installs should use `npm install --omit=optional` because the platform packages are release artifacts, not local workspace dependencies.
- The public API is `locateV8()`. Internal runtime details such as V8 access should not leak into the exported API surface.
