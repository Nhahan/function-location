# Description

Retrieve the path of a class or function using this library, and it supports not only `node` command but also 
`ts-node`.

# Installation

```bash
npm install function-location
```

# Usage

```ts
import { locateV8 } from 'function-location';

class TestClass {
}

function testFunction() {
}

locateV8(TestClass);
locateV8(testFunction);
```

# Return Value

The `locateV8()` function returns the source file path of the currently executing function as a string.

# License

This library is licensed under the [MIT license](https://github.com/Nhahan/function-location).

# Native Distribution

`function-location` ships prebuilt binaries under `prebuilds/` for every supported OS/architecture in the GitHub
CI matrix (`macOS`, `Linux`, `Windows`) and supported Node majors (`20`, `22`) from the `release` workflow.
On install, `node-gyp-build` loads the matching prebuild automatically.

This project is intentionally not committed with binary artifacts.

Known ABI risk:
- The addon currently depends on Node/V8 native APIs (`native/locate.cc`), so binary compatibility is ABI-sensitive.
- Prebuilds are generated with `--no-napi` in CI to keep Node ABI dimensions explicit in filenames, allowing multiple ABI targets per platform to coexist.
- Any release tarball is validated for required platform and minimum ABI coverage before `npm publish` can run.

Fallback behavior:
- If no matching prebuild is found, installation falls back to local rebuild via `node-gyp`, which requires local compiler tooling.
- Fallback is also validated in CI, but prebuilt paths are still preferred for end-user install reliability and speed.

Roadmap hardening:
- Immediate: keep ABI-aware prebuild coverage and branch-gated release checks in CI.
- Long-term: migrate native code to `N-API` and simplify release matrix to runtime-targeted artifacts once migration is complete.

## Release and Branch Policy

- Source branches:
  - `dev` is the release branch (manual `workflow_dispatch` release must run from `refs/heads/dev`).
  - `main` is the integration/validation branch; it does not publish to npm directly.
- Workflow validation on non-trivial changes should be done on temporary branches (`ci-verify/*`) to prevent noise in long-lived branches.
- Recommended validation flow for GitHub Actions changes:
  - `git checkout -b ci-verify/<topic>`
  - push and run desired workflow on that branch
  - for release flow dry-run, execute from `ci-verify/*` with `dry_run=true`
  - only merge back to `main`/`dev` after successful workflow runs
- Release workflow:
  - `npm` publish is allowed only from `dev`.
  - workflow requires matrix test and prebuild coverage jobs to pass before publish.
  - prebuild binaries are generated in CI and merged into release artifacts only during release.
  - CI-generated binaries are never committed to git history.

### Example: release validation without publish

```bash
git checkout -b ci-verify/release-pipeline
git push -u origin ci-verify/release-pipeline

# run the workflow from ci-verify/<topic> with dry-run=true
gh workflow run Release -f dry_run=true
```

Dry-run also validates all matrix tests/prebuild coverage and package metadata.
