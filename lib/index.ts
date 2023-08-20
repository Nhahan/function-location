import { resolve } from 'path';

function getFunctionLocation(): string {
    const stackTrace = new Error().stack;
    const filePathRegex = /at __decorate * \((.*\.js)/;
    const matches = stackTrace?.match(filePathRegex);
    if (matches && matches.length > 1) {
        const matchedPath = resolve(matches[1], '..');
        return `${matchedPath}/**/*.js`;
    }
    throw new Error('Could not extract file path from stack trace');
}

getFunctionLocation();