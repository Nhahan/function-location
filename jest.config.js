module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // Platform packages share names with the optional dependencies the loader
    // requires; keep Jest's module map from resolving them to local prebuilds.
    modulePathIgnorePatterns: ['<rootDir>/packages/'],
};
