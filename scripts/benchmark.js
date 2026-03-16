#!/usr/bin/env node

'use strict';

const fs = require('fs');
const inspector = require('node:inspector');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');

const rootDir = path.resolve(__dirname, '..');
const distEntry = path.join(rootDir, 'dist', 'lib', 'index.js');

function parsePositiveInteger(argv, name, fallback) {
  const prefix = `--${name}=`;
  const matched = argv.find((arg) => arg.startsWith(prefix));
  if (!matched) {
    return fallback;
  }

  const value = Number.parseInt(matched.slice(prefix.length), 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }

  return value;
}

function toMicroseconds(durationNs) {
  return Number(durationNs) / 1000;
}

function formatFixed(value, decimals) {
  return value.toFixed(decimals);
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function ensureBuiltArtifacts() {
  if (!fs.existsSync(distEntry)) {
    throw new Error('Missing dist/lib/index.js. Run `npm run build:all` before benchmarking.');
  }
}

function normalizeInspectorUrl(url) {
  if (!url) {
    return url;
  }

  if (url.startsWith('file://')) {
    return fileURLToPath(url);
  }

  return url;
}

function createInspectorLocator() {
  const session = new inspector.Session();
  const scripts = new Map();

  session.connect();
  session.on('Debugger.scriptParsed', ({ params }) => {
    scripts.set(params.scriptId, params.url);
  });

  function post(method, params = {}) {
    return new Promise((resolve, reject) => {
      session.post(method, params, (error, result) => (error ? reject(error) : resolve(result)));
    });
  }

  async function initialize() {
    await post('Debugger.enable');
    await post('Runtime.enable');
  }

  async function locateWithInspector(globalName, invoke) {
    const paused = new Promise((resolve, reject) => {
      session.once('Debugger.paused', async ({ params }) => {
        try {
          await post('Debugger.resume');
          resolve(params);
        } catch (error) {
          reject(error);
        }
      });
    });

    const evaluated = await post('Runtime.evaluate', {
      expression: `globalThis.${globalName}`,
      objectGroup: 'function-location-benchmark',
    });
    const { breakpointId } = await post('Debugger.setBreakpointOnFunctionCall', {
      objectId: evaluated.result.objectId,
    });

    invoke();
    const pauseDetails = await paused;

    await post('Debugger.removeBreakpoint', { breakpointId });
    await post('Runtime.releaseObjectGroup', { objectGroup: 'function-location-benchmark' });

    const frame = pauseDetails.callFrames[0];
    return normalizeInspectorUrl(scripts.get(frame.location.scriptId) || frame.url || '');
  }

  async function close() {
    session.disconnect();
  }

  return {
    close,
    initialize,
    locateWithInspector,
  };
}

async function main(argv = process.argv.slice(2)) {
  ensureBuiltArtifacts();

  const rounds = parsePositiveInteger(argv, 'rounds', 10);
  const nativeIterations = parsePositiveInteger(argv, 'native-iterations', 200000);
  const inspectorIterations = parsePositiveInteger(argv, 'inspector-iterations', 100);
  const { locate } = require(distEntry);

  class ExampleClass {}
  function exampleFunction() {}

  globalThis.__functionLocationBenchmarkFunction = exampleFunction;
  globalThis.__functionLocationBenchmarkClass = ExampleClass;

  const expectedPath = path.resolve(__filename);
  const nativeFunctionPath = locate(exampleFunction);
  const nativeClassPath = locate(ExampleClass);

  if (nativeFunctionPath !== expectedPath || nativeClassPath !== expectedPath) {
    throw new Error(
      `Native locate() validation failed. expected=${expectedPath} function=${String(nativeFunctionPath)} class=${String(nativeClassPath)}`,
    );
  }

  const inspectorLocator = createInspectorLocator();
  await inspectorLocator.initialize();

  try {
    const inspectorFunctionPath = await inspectorLocator.locateWithInspector(
      '__functionLocationBenchmarkFunction',
      () => exampleFunction(),
    );
    const inspectorClassPath = await inspectorLocator.locateWithInspector(
      '__functionLocationBenchmarkClass',
      () => new ExampleClass(),
    );

    if (inspectorFunctionPath !== expectedPath || inspectorClassPath !== expectedPath) {
      throw new Error(
        `Inspector validation failed. expected=${expectedPath} function=${String(inspectorFunctionPath)} class=${String(inspectorClassPath)}`,
      );
    }

    const nativeSamples = [];
    for (let round = 0; round < rounds; round += 1) {
      const startedAt = process.hrtime.bigint();
      for (let iteration = 0; iteration < nativeIterations; iteration += 1) {
        locate(exampleFunction);
        locate(ExampleClass);
      }
      const elapsed = process.hrtime.bigint() - startedAt;
      nativeSamples.push(toMicroseconds(elapsed) / (nativeIterations * 2));
    }

    const inspectorSamples = [];
    for (let round = 0; round < rounds; round += 1) {
      const startedAt = process.hrtime.bigint();
      for (let iteration = 0; iteration < inspectorIterations; iteration += 1) {
        await inspectorLocator.locateWithInspector(
          '__functionLocationBenchmarkFunction',
          () => exampleFunction(),
        );
        await inspectorLocator.locateWithInspector(
          '__functionLocationBenchmarkClass',
          () => new ExampleClass(),
        );
      }
      const elapsed = process.hrtime.bigint() - startedAt;
      inspectorSamples.push(toMicroseconds(elapsed) / (inspectorIterations * 2));
    }

    const nativeMedian = median(nativeSamples);
    const inspectorMedian = median(inspectorSamples);
    const relativeSpeed = inspectorMedian / nativeMedian;

    process.stdout.write(`# function-location benchmark\n\n`);
    process.stdout.write(`- file: ${expectedPath}\n`);
    process.stdout.write(`- platform: ${process.platform}\n`);
    process.stdout.write(`- arch: ${process.arch}\n`);
    process.stdout.write(`- node: ${process.version}\n`);
    process.stdout.write(`- cpu: ${os.cpus()[0]?.model || 'unknown'}\n`);
    process.stdout.write(`- rounds: ${rounds}\n`);
    process.stdout.write(`- native iterations/round: ${nativeIterations}\n`);
    process.stdout.write(`- inspector iterations/round: ${inspectorIterations}\n\n`);
    process.stdout.write(`| Approach | Median time / call | Relative speed |\n`);
    process.stdout.write(`| --- | ---: | ---: |\n`);
    process.stdout.write(`| locate | ${formatFixed(nativeMedian, 4)} µs | ${formatFixed(relativeSpeed, 2)}x faster |\n`);
    process.stdout.write(`| inspector protocol | ${formatFixed(inspectorMedian, 4)} µs | baseline |\n\n`);
    process.stdout.write(`Native samples (µs/call): ${nativeSamples.map((value) => formatFixed(value, 4)).join(', ')}\n`);
    process.stdout.write(`Inspector samples (µs/call): ${inspectorSamples.map((value) => formatFixed(value, 4)).join(', ')}\n`);
  } finally {
    delete globalThis.__functionLocationBenchmarkFunction;
    delete globalThis.__functionLocationBenchmarkClass;
    await inspectorLocator.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
