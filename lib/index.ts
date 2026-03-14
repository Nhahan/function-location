import { createLocateLoader } from './loader';

const locate = createLocateLoader(require);

export function locateV8(input: Function): string | undefined {
    return locate(input);
}
