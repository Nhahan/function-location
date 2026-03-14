'use strict';

const allowedReleaseBranch = process.env.RELEASE_BRANCH || 'dev';
const branchPrefixesForDryRun = (process.env.RELEASE_DRY_RUN_BRANCH_PREFIXES || 'refs/heads/ci-verify/')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const isDryRun = String(process.env.RELEASE_DRY_RUN || '').toLowerCase() === 'true';
const githubRef = process.env.GITHUB_REF || '';
const expectedReleaseRef = `refs/heads/${allowedReleaseBranch}`;

function isAllowedPrefix(ref) {
  return branchPrefixesForDryRun.some((prefix) => {
    if (prefix.endsWith('/*')) {
      return ref.startsWith(prefix.slice(0, -2));
    }

    return ref.startsWith(prefix);
  });
}

function isAllowedReleaseRef(ref) {
  if (ref === expectedReleaseRef) {
    return true;
  }

  if (!isDryRun) {
    return false;
  }

  return isAllowedPrefix(ref);
}

if (!isAllowedReleaseRef(githubRef)) {
  const allowedBranches = isDryRun
    ? `${expectedReleaseRef} or ${branchPrefixesForDryRun.join(', ')}*`
    : expectedReleaseRef;

  console.error(
    `Release is restricted to ${allowedBranches}. Current ref: ${githubRef || '<unknown>'}.`,
  );
  process.exit(1);
}

console.log(`Release branch check passed for ${githubRef}.`);
