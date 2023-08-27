import {TestClass} from "../test/test-class";

const {locateV8} = require('../native/build/Release/locate.node');

function main() {
    try {
        const func = () => {};
        const location = locateV8(TestClass);

        if (location) {
            console.log('Function location:', location);
        } else {
            console.log('Function location not available.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main();