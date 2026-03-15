#!/usr/bin/env node

'use strict';

var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

function parseArgs(argv) {
  var options = {
    tarball: '',
    expectedNodeArch: '',
    expectedHostArm64: '',
    expectedTranslated: '',
  };

  argv.forEach(function (arg) {
    if (arg.indexOf('--tarball=') === 0) {
      options.tarball = arg.slice('--tarball='.length);
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
  var result = childProcess.spawnSync(command, args, {
    cwd: cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    var stdout = result.stdout ? '\nstdout:\n' + result.stdout : '';
    var stderr = result.stderr ? '\nstderr:\n' + result.stderr : '';
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

function removeTree(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  if (fs.lstatSync(targetPath).isDirectory()) {
    fs.readdirSync(targetPath).forEach(function (entry) {
      removeTree(path.join(targetPath, entry));
    });
    fs.rmdirSync(targetPath);
    return;
  }

  fs.unlinkSync(targetPath);
}

function resolveNpmCliPath() {
  var nodeDir = path.dirname(process.execPath);
  var candidates = [
    path.resolve(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(nodeDir, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];

  for (var index = 0; index < candidates.length; index += 1) {
    if (fs.existsSync(candidates[index])) {
      return candidates[index];
    }
  }

  throw new Error('Unable to resolve npm-cli.js for ' + process.execPath + '.');
}

function getNpmCommandSpec() {
  return {
    command: process.execPath,
    args: [resolveNpmCliPath()],
  };
}

function writeSmokeScript(targetPath) {
  var source = [
    "var path = require('path');",
    "var lib = require('function-location');",
    'function smoke() {}',
    'var expected = path.resolve(__filename);',
    'var located = lib.locateV8(smoke);',
    'if (located !== expected) {',
    "  console.error(JSON.stringify({ expected: expected, located: located, arch: process.arch, version: process.version }));",
    '  process.exit(1);',
    '}',
    "console.log(JSON.stringify({ expected: expected, located: located, arch: process.arch, version: process.version }));",
    '',
  ].join('\n');

  fs.writeFileSync(targetPath, source, 'utf8');
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

  var context = readDarwinExecutionContext();

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
  if (!options.tarball) {
    throw new Error('Missing required --tarball argument.');
  }

  assertRuntimeContext(options);

  var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'function-location-compat-'));
  var tarballPath = path.resolve(options.tarball);
  var packageTarball = path.join(tempDir, 'package.tgz');
  var smokeScript = path.join(tempDir, 'smoke.js');
  var npmCommand = getNpmCommandSpec();

  try {
    fs.copyFileSync(tarballPath, packageTarball);
    runCommand(npmCommand.command, npmCommand.args.concat(['init', '-y']), tempDir);
    runCommand(npmCommand.command, npmCommand.args.concat(['install', packageTarball]), tempDir);
    writeSmokeScript(smokeScript);
    process.stdout.write(runCommand(process.execPath, [smokeScript], tempDir));
  } finally {
    try {
      removeTree(tempDir);
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
  getNpmCommandSpec: getNpmCommandSpec,
  parseArgs: parseArgs,
  readDarwinExecutionContext: readDarwinExecutionContext,
  resolveNpmCliPath: resolveNpmCliPath,
  runCompatibilitySmoke: runCompatibilitySmoke,
};
