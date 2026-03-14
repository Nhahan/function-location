# Contributing

This project uses a strict branch and release strategy to keep npm releases deterministic.

## Branch Model

- `dev` is the release branch.
  - `workflow_dispatch` release must run from `refs/heads/dev` by default.
  - Releases are never published from `main`.
- `main` is the integration/validation branch.
- `ci-verify/<topic>` is the temporary validation branch.

## GitHub Actions Validation Rule

Run workflow-heavy changes on temporary branches to avoid noisy commits on long-lived branches.

Recommended flow for CI/Release workflow validation:

```bash
git checkout -b ci-verify/<topic>
git push -u origin ci-verify/<topic>
```

- For release behavior verification, run:
  - `gh workflow run Release -f dry_run=true`
- Iterate and fix on `ci-verify/<topic>` until all runs pass.
- Merge only the validated changes back to `main`/`dev`.

## Release Workflow Contracts

The `Release` workflow enforces:

- Branch gate:
  - `dev` always allowed.
  - `ci-verify/*` allowed only when `dry_run=true`.
- Matrix verification across `macos-latest`, `ubuntu-latest`, `windows-latest` and Node `20.x`/`22.x`.
- Prebuild generation and platform coverage checks before publish.
- npm version uniqueness check before publishing:
  - publish is blocked if `${name}@${version}` already exists on npm.

## Prebuild Artifact Policy

- Prebuild artifacts are generated only in CI and release jobs.
- Generated `.node` binaries are not committed to git history.
- Release jobs merge CI artifacts into a temporary `prebuilds` folder only for packaging and publish.

## Release Readiness Checklist

Before running release:

- `npm test -- --runInBand`
- `npm run prepack`
- CI + prebuild coverage jobs pass
- version in `package.json` is incremented
- branch is `dev`
- only verified `ci-verify/*` branches are used for dry-run validation

