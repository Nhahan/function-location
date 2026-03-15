import path from 'node:path';

const { createPrebuildInvocation, resolvePrebuildifyBin } = require('../scripts/prebuild');

describe('prebuild script', () => {
  test('resolves the package-local prebuildify entrypoint', () => {
    const resolved = resolvePrebuildifyBin(process.cwd());
    expect(resolved).toContain(path.join('prebuildify', 'bin.js'));
  });

  test('invokes prebuildify via the current Node executable', () => {
    const invocation = createPrebuildInvocation(
      {
        all: false,
        targets: ['22.18.0'],
        useNapi: true,
        strip: false,
      },
      process.cwd(),
    );

    expect(invocation.command).toBe(process.execPath);
    expect(invocation.args[0]).toContain(path.join('prebuildify', 'bin.js'));
    expect(invocation.args.slice(1)).toEqual(['-t', '22.18.0', '--napi']);
  });
});
