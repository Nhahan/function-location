#!/usr/bin/env node

'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const npmCli = require('./npm-cli');

function parseArgs(argv) {
  const options = {
    rootTarball: '',
    platformTarball: '',
    expectedNodeArch: '',
    expectedHostArm64: '',
    expectedTranslated: '',
  };

  argv.forEach(function (arg) {
    if (arg.indexOf('--root-tarball=') === 0) {
      options.rootTarball = arg.slice('--root-tarball='.length);
      return;
    }

    if (arg.indexOf('--platform-tarball=') === 0) {
      options.platformTarball = arg.slice('--platform-tarball='.length);
      return;
    }

    if (arg.indexOf('--expected-node-arch=') === 0) {
      options.expectedNodeArch = arg.slice('--expected-node-arch='.length);
      return;
    }

    if (arg.indexOf('--expected-host-arm64=') === 0) {
      options.expectedHostArm64 = arg.slice('--expected-host-arm64='.length);
      return;
    }

    if (arg.indexOf('--expected-translated=') === 0) {
      options.expectedTranslated = arg.slice('--expected-translated='.length);
    }
  });

  return options;
}

function runCommand(command, args, cwd) {
  const result = childProcess.spawnSync(command, args, {
    cwd: cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stdout = result.stdout ? '\nstdout:\n' + result.stdout : '';
    const stderr = result.stderr ? '\nstderr:\n' + result.stderr : '';
    throw new Error(command + ' ' + args.join(' ') + ' exited with code ' + result.status + '.' + stdout + stderr);
  }

  return result.stdout || '';
}

function readDarwinSysctl(key) {
  return runCommand('/usr/sbin/sysctl', ['-in', key]).trim();
}

function readDarwinExecutionContext() {
  return {
    hostArm64: readDarwinSysctl('hw.optional.arm64'),
    translated: readDarwinSysctl('sysctl.proc_translated'),
  };
}

function getSmokeScriptSource() {
  return [
    "const path = require('path');",
    "const lib = require('function-location');",
    'function smoke() {}',
    'const expected = path.resolve(__filename);',
    'const located = lib.locateV8(smoke);',
    'if (located !== expected) {',
    "  console.error(JSON.stringify({ expected: expected, located: located, arch: process.arch, version: process.version }));",
    '  process.exit(1);',
    '}',
    "console.log(JSON.stringify({ expected: expected, located: located, arch: process.arch, version: process.version }));",
    '',
  ].join('\n');
}

function writeSmokeScript(targetPath) {
  fs.writeFileSync(targetPath, getSmokeScriptSource(), 'utf8');
}

function assertRuntimeContext(options) {
  if (options.expectedNodeArch && process.arch !== options.expectedNodeArch) {
    throw new Error(
      'Unexpected Node architecture: expected ' + options.expectedNodeArch + ', received ' + process.arch + '.',
    );
  }

  if (process.platform !== 'darwin') {
    return;
  }

  if (!options.expectedHostArm64 && !options.expectedTranslated) {
    return;
  }

  const context = readDarwinExecutionContext();

  if (options.expectedHostArm64 && context.hostArm64 !== options.expectedHostArm64) {
    throw new Error(
      'Unexpected Darwin host arm64 flag: expected ' + options.expectedHostArm64 + ', received ' + context.hostArm64 + '.',
    );
  }

  if (options.expectedTranslated && context.translated !== options.expectedTranslated) {
    throw new Error(
      'Unexpected Darwin translation flag: expected ' + options.expectedTranslated + ', received ' + context.translated + '.',
    );
  }
}

function runCompatibilitySmoke(options) {
  if (!options.rootTarball) {
    throw new Error('Missing required --root-tarball argument.');
  }

  if (!options.platformTarball) {
    throw new Error('Missing required --platform-tarball argument.');
  }

  assertRuntimeContext(options);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'function-location-compat-'));
  const rootTarball = path.resolve(options.rootTarball);
  const platformTarball = path.resolve(options.platformTarball);
  const rootPackageTarball = path.join(tempDir, 'function-location-root.tgz');
  const platformPackageTarball = path.join(tempDir, 'function-location-platform.tgz');
  const smokeScript = path.join(tempDir, 'smoke.js');
  const npmCommand = npmCli.getNpmCommandSpec();

  try {
    fs.copyFileSync(rootTarball, rootPackageTarball);
    fs.copyFileSync(platformTarball, platformPackageTarball);
    runCommand(npmCommand.command, npmCommand.args.concat(['init', '-y']), tempDir);
    runCommand(
      npmCommand.command,
      npmCommand.args.concat(['install', platformPackageTarball, rootPackageTarball]),
      tempDir,
    );
    writeSmokeScript(smokeScript);
    process.stdout.write(runCommand(process.execPath, [smokeScript], tempDir));
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      process.stderr.write(
        'Compatibility smoke cleanup warning: ' + (error && error.message ? error.message : String(error)) + '\n',
      );
    }
  }
}

function main(argv) {
  runCompatibilitySmoke(parseArgs(argv || process.argv.slice(2)));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  getSmokeScriptSource: getSmokeScriptSource,
  parseArgs: parseArgs,
  readDarwinExecutionContext: readDarwinExecutionContext,
  runCompatibilitySmoke: runCompatibilitySmoke,
};
