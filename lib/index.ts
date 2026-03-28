import { createLocateV8Loader } from './loader';

const nativeLocateV8 = createLocateV8Loader(require);

export function locateV8(input: Function): string | undefined {
    return nativeLocateV8(input);
}
