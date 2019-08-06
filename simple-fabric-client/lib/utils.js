'use strict';

class Utils {
    static _mergeOptions(defaultOptions, suppliedOptions) {
        for (const prop in suppliedOptions) {
            if (typeof suppliedOptions[prop] === 'object' && suppliedOptions[prop] !== null) {
                if (defaultOptions[prop] === undefined) {
                    defaultOptions[prop] = suppliedOptions[prop];
                } else {
                    Utils._mergeOptions(defaultOptions[prop], suppliedOptions[prop]);
                }
            } else {
                defaultOptions[prop] = suppliedOptions[prop];
            }
        }
    }
}

module.exports = Utils;
