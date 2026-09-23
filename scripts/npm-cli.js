'use strict';

const fs = require('fs');
const path = require('path');

const NPM_CLI_SEGMENTS = ['npm', 'bin', 'npm-cli.js'];

function getExecPathCandidates(execPath) {
  const nodeDir = path.dirname(execPath);

  return [
    path.resolve(nodeDir, 'node_modules', ...NPM_CLI_SEGMENTS),
    path.resolve(nodeDir, '..', 'lib', 'node_modules', ...NPM_CLI_SEGMENTS),
    path.resolve(nodeDir, '..', 'node_modules', ...NPM_CLI_SEGMENTS),
  ];
}

// Package managers such as Homebrew install npm outside the node prefix and
// expose it as a symlink on PATH, so follow that symlink to npm-cli.js.
function getPathCandidates(env) {
  const entries = (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);
  const candidates = [];

  for (const entry of entries) {
    const npmBin = path.join(entry, 'npm');

    try {
      const resolved = fs.realpathSync(npmBin);
      if (path.basename(resolved) === 'npm-cli.js') {
        candidates.push(resolved);
      }
    } catch (error) {
      // Not present in this PATH entry.
    }
  }

  return candidates;
}

function resolveNpmCliPath(execPath = process.execPath, env = process.env) {
  const candidates = getExecPathCandidates(execPath).concat(getPathCandidates(env));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getNpmCommandSpec(env = process.env, execPath = process.execPath) {
  const npmCliPath = resolveNpmCliPath(execPath, env);

  if (npmCliPath) {
    return {
      command: execPath,
      args: [npmCliPath],
    };
  }

  return {
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: [],
  };
}

module.exports = {
  getNpmCommandSpec,
  resolveNpmCliPath,
};
