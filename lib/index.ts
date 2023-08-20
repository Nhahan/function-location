import { resolve } from 'path';

export function locate(): string | undefined {
    const stackTrace = new Error().stack;
    const filePathRegex = /at [^(]*\((.*\.js)/;
    const matchedPath = (stackTrace?.match(filePathRegex) || [])[1];
    return matchedPath && resolve(matchedPath);
}

// function getFunctionLocation(entity?: Function | { new (...args: any[]): any }): string | undefined {
//     const stackTrace = new Error().stack;
//     const filePathRegex = /at [^(]*\((.*\.js)/;
//     const matchedPath = (stackTrace?.match(filePathRegex) || [])[1];
//
//     if (entity) {
//         if (typeof entity === 'function' || typeof entity === 'object') {
//             return matchedPath && resolve(matchedPath);
//         } else {
//             throw new Error('Invalid parameter type. Expected a function or class.');
//         }
//     } else {
//         return matchedPath && resolve(matchedPath);
//     }
// }