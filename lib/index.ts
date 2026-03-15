import { createLocateLoader } from './loader';

const nativeLocate = createLocateLoader(require);

export function locate(input: Function): string | undefined {
    return nativeLocate(input);
}
