'use strict';

const allowedBranch = process.env.RELEASE_BRANCH || 'dev';
const githubRef = process.env.GITHUB_REF || '';
const expectedRef = `refs/heads/${allowedBranch}`;

if (githubRef !== expectedRef) {
  console.error(
    `Release is restricted to ${allowedBranch}. Current ref: ${githubRef || '<unknown>'}.`,
  );
  process.exit(1);
}

console.log(`Release branch check passed for ${githubRef}.`);
