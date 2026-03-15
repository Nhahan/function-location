# Contributing

This project uses a strict branch and release strategy to keep npm releases deterministic.

## Branches

- `dev` is the release branch.
- `main` is the integration/validation branch.
- `ci-verify/<topic>` is the temporary validation branch.
- Releases are never published from `main`.

Use `ci-verify/<topic>` for workflow-heavy validation:

```bash
git checkout -b ci-verify/<topic>
git push -u origin ci-verify/<topic>
```

- For release behavior verification, run `gh workflow run Release -f dry_run=true`.
- Iterate and fix on `ci-verify/<topic>` until all runs pass.
- Merge only the validated changes back to `main`/`dev`.

## Workflow Scope

- `CI` is optimized for feedback speed:
  - maintainer test matrix across `macos-15`, `ubuntu-latest`, `windows-latest` and Node `16.x`, `20.x`, `22.x`, `24.x`
  - package/tarball verification once per OS on Node `16.x`
  - full multi-platform prebuild generation and release-coverage validation
- `Release` keeps the full publish gate on `dev`.
- `ci-verify/*` is allowed only when `dry_run=true`.
- npm publish is blocked if `${name}@${version}` already exists.
- Release compatibility matrix:
- `linux-x64`: `8.17.0`, `10.24.1`, `12.22.12`, `14.21.3`, `16.20.2`, `18.20.8`, `20.20.1`, `22.22.1`, `24.14.0`
- `win32-x64`: `8.17.0`, `10.24.1`, `12.22.12`, `14.21.3`, `16.20.2`, `18.20.8`, `20.20.1`, `22.22.1`, `24.14.0`
- `darwin-x64`: `8.17.0`, `10.24.1`, `12.22.12`, `14.21.3`, `16.20.2`, `18.20.8`, `20.20.1`, `22.22.1`, `24.14.0`
- `darwin-x64` on Apple Silicon via Rosetta: `8.17.0`, `10.24.1`, `12.22.12`, `14.21.3`, `16.20.2`, `18.20.8`, `20.20.1`, `22.22.1`, `24.14.0`
- `darwin-arm64`: `16.20.2`, `18.20.8`, `20.20.1`, `22.22.1`, `24.14.0`

## Packaging Policy

- Prebuild artifacts are generated only in CI and release jobs.
- Generated `.node` binaries are not committed to git history.
- Release uses the merged CI prebuild artifact for packaging and publish. It does not regenerate single-platform prebuilds at the final npm publish step.
- Custom tooling must avoid reserved npm lifecycle script names. The project uses `build:prebuilds`, not `prebuild`, so merged release artifacts cannot be clobbered silently.

## Technical Notes

- `locate` uses a synchronous native binding that reads function metadata from runtime internals (`GetScriptOrigin`), not inspector protocol.
- The addon entrypoint uses Node-API, but the implementation still depends on V8 internals. Release artifacts are therefore shipped as ABI-tagged prebuilds, not as one cross-major N-API binary.
- Current ABI set: `abi57`, `abi64`, `abi72`, `abi83`, `abi93`, `abi108`, `abi115`, `abi127`, `abi137`.

## Release Readiness Checklist

Before running release:

- `npm test -- --runInBand`
- `FUNCTION_LOCATION_PREBUILDS_READY=1 npm pack --silent` after merged prebuilds are present
- CI + prebuild coverage jobs pass for all configured Node versions
- version in `package.json` is incremented
- branch is `dev`
- only verified `ci-verify/*` branches are used for dry-run validation
