#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function getPrepackScripts(env = process.env) {
  if (env.FUNCTION_LOCATION_PREBUILDS_READY === '1') {
    return ['build', 'verify:pack'];
  }

  return ['build:all', 'build:prebuilds', 'verify:pack'];
}

function runNpmScript(scriptName, env = process.env) {
  if (!env.npm_execpath) {
    throw new Error('npm_execpath is required to run the prepack pipeline.');
  }

  const result = spawnSync(process.execPath, [env.npm_execpath, 'run', scriptName], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

function main(env = process.env) {
  const scripts = getPrepackScripts(env);

  for (const scriptName of scripts) {
    runNpmScript(scriptName, env);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getPrepackScripts,
  main,
};
