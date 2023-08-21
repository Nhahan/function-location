import { resolve } from 'path';

export function locate(): string | undefined {
    const stackTrace = new Error().stack;
    const filePathMatch = stackTrace && stackTrace.match(/at\s+.*\s+\((.*):\d+:\d+\)/);
    return filePathMatch ? filePathMatch[1] : undefined;
}