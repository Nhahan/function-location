# Contributing

## Branches

- `main` is the default branch.
- `main` is the release branch. npm publish is allowed only from `main`.
- `dev` is the integration branch for ongoing development.
- `ci-verify/<topic>` is the temporary branch for workflow validation.

If a workflow change needs GitHub Actions verification, validate it on `ci-verify/<topic>` first, squash that branch back down before moving it onto `dev`, and promote the final release state to `main`.

## Runtime support

- Public package: `function-location`
- Supported Node.js versions: `20.x` through `26.x`, every major including odd releases, so each version inside `engines` has a prebuilt binary
- Published platform packages:
  - `function-location-linux-x64` (`glibc`)
  - `function-location-win32-x64`
  - `function-location-darwin-x64`
  - `function-location-darwin-arm64`

The root npm package ships only the JS wrapper and metadata. Native binaries are published as platform-specific optional packages, so consumers download only the matching runtime package instead of the entire cross-platform binary set.

## CI and release

`build.yml` is the shared pipeline that both workflows call:

- maintainer test matrix on Linux, Windows, and macOS across Node `20/22/24/26`
- root package tarball verification on every OS
- platform prebuilds for Node `20` through `26`, verified and packed into platform package tarballs
- compatibility smoke tests that install the root tarball plus the matching platform tarball on every supported Node version

`CI` runs `build.yml` for pushes to `main`, `dev`, and `ci-verify/**`, and for pull requests.

`Release` runs `build.yml` and then `scripts/publish-packages.js`:

- platform packages are published first, then the root package
- a rerun skips platform packages that an earlier failed attempt already published, and stops if the root version already exists
- packages are published with npm provenance; authentication uses the `NPM_TOKEN` secret when set, otherwise npm trusted publishing (OIDC) for `release.yml`

Pushes to `main` publish unique `beta` prereleases under the npm `beta` dist-tag, so plain `npm install function-location` keeps resolving to the latest stable release. When the manifest version is already on npm, betas use the next patch version (`2.0.1-beta.N` after `2.0.0`) so they never sort below a release.

`Release` dry-runs are allowed from `ci-verify/*`. Stable publishes are restricted to manual releases from `main`.

To cut a stable release:

1. In one commit, set the new version in the root and platform manifests (including the root `optionalDependencies`) and add a matching `## <version>` section to `CHANGELOG.md`. Tests fail when the CHANGELOG section is missing.
2. Merge it to `main`, then run `Release` manually with `dry_run` unchecked.
3. The workflow publishes to npm and creates the `v<version>` GitHub release from the CHANGELOG section.

## Packaging notes

- Generated `.node` binaries are CI artifacts only and must not be committed.
- The root package depends on exact-version `optionalDependencies` for the platform packages. Keep those versions aligned.
- Supported Node.js targets live in `config/package-layout.json`. When adding a major, add its ABI there and widen `engines` in the root and platform manifests.
- Repository installs should use `npm install --omit=optional` because the platform packages are release artifacts, not local workspace dependencies.
- The public API is `locateV8()`. Internal runtime details such as V8 access should not leak into the exported API surface.
