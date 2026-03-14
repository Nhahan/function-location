'use strict';

const { performance } = require('perf_hooks');

const { locateV8 } = require('../dist');

const {
  FUNCTION_LOCATION_NATIVE_ITERS: nativeIterationsRaw = '5000',
  FUNCTION_LOCATION_BASELINE_ITERS: baselineIterationsRaw = process.env.FUNCTION_LOCATION_GFL_ITERS || '300',
} = process.env;

const baselineModuleName = process.env.FUNCTION_LOCATION_BASELINE_MODULE;
const baselineModuleLabel = process.env.FUNCTION_LOCATION_BASELINE_LABEL || baselineModuleName || '';

let baselineLocator;

if (baselineModuleName) {
  try {
    baselineLocator = require(baselineModuleName);
  } catch (error) {
    console.error(`Missing or invalid baseline module: ${baselineModuleName}`);
    process.exit(1);
  }
}

const nativeIterations = Number.parseInt(nativeIterationsRaw, 10);
const baselineIterations = Number.parseInt(baselineIterationsRaw, 10);

if (!Number.isFinite(nativeIterations) || nativeIterations < 1) {
  throw new Error(`Invalid FUNCTION_LOCATION_NATIVE_ITERS value: ${nativeIterationsRaw}`);
}

if (!Number.isFinite(baselineIterations) || baselineIterations < 1) {
  throw new Error(`Invalid FUNCTION_LOCATION_BASELINE_ITERS value: ${baselineIterationsRaw}`);
}

function sampleFunction() {}

class SampleClass {
  render() {
    return '';
  }
}

function benchmarkNative(iterations) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    locateV8(sampleFunction);
    locateV8(SampleClass);
  }
  return performance.now() - start;
}

async function benchmarkBaseline(iterations) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await baselineLocator(sampleFunction);
    await baselineLocator(SampleClass);
  }
  return performance.now() - start;
}

async function run() {
  const environment = process.version;

  // Warmup
  benchmarkNative(200);

  const nativeTotalMs = benchmarkNative(nativeIterations);
  const nativePerCallUs = (nativeTotalMs / (nativeIterations * 2)) * 1000;

  console.log('function-location benchmark\n');
  console.log(`Node.js: ${environment}`);
  console.log(`- Native calls: ${nativeIterations * 2} total in ${nativeTotalMs.toFixed(2)}ms`);
  console.log(`  - ${nativePerCallUs.toFixed(4)} µs/call`);

  if (!baselineLocator) {
    console.log('\nNo baseline locator configured.');
    console.log('Set FUNCTION_LOCATION_BASELINE_MODULE=<module> to compare against another implementation.');
    if (process.env.FUNCTION_LOCATION_BENCHMARK_JSON === '1') {
      console.log(
        JSON.stringify(
          {
            node: environment,
            nativePerCallUs,
            nativeIterations,
          },
          null,
          2,
        ),
      );
    }
    return;
  }

  // Warmup
  await benchmarkBaseline(20);

  const baselineTotalMs = await benchmarkBaseline(baselineIterations);
  const baselinePerCallUs = (baselineTotalMs / (baselineIterations * 2)) * 1000;
  const baselineLabel = baselineModuleLabel || 'baseline';
  const ratio = baselinePerCallUs / nativePerCallUs;

  console.log(`- ${baselineLabel} calls: ${baselineIterations * 2} total in ${baselineTotalMs.toFixed(2)}ms`);
  console.log(`  - ${baselinePerCallUs.toFixed(4)} µs/call`);
  console.log(`- Measured speedup: ${ratio.toFixed(1)}x native faster`);

  if (process.env.FUNCTION_LOCATION_BENCHMARK_JSON === '1') {
    console.log(
      JSON.stringify(
        {
          node: environment,
          nativePerCallUs,
          baselinePerCallUs,
          speedup: ratio,
          nativeIterations,
          baselineIterations,
          baselineLocatorLabel: baselineLabel,
        },
        null,
        2,
      ),
    );
  }
}

run().catch((error) => {
  console.error('Benchmark failed:', error.message || error);
  process.exit(1);
});
