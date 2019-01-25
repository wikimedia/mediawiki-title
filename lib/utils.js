'use strict';

module.exports = {};

/**
 * Utility method for converting a character sequence from bytes to Unicode.
 *
 * Primary usecase being converting $wgLegalTitleChars to a sequence usable in
 * javascript, as PHP uses UTF-8 bytes where javascript uses Unicode code units.
 *
 * Direct port of the mediawiki code
 * @param {string} byteClass
 * @return {string}
 */
module.exports.convertByteClassToUnicodeClass = (byteClass) => {
    const length = byteClass.length;
    // Input token queue
    let x0 = '';
    let x1 = '';
    let x2 = '';
    // Decoded queue
    let d0 = '';
    // Decoded integer codepoints
    let ord0 = 0;
    let ord1 = 0;
    let ord2 = 0;
    // Re-encoded queue
    let r0 = '';
    let r1 = '';
    let r2 = '';
    // Output
    let out = '';
    // Flags
    let allowUnicode = false;
    for (let pos = 0; pos < length; pos++) {
        // Shift the queues down
        x2 = x1;
        x1 = x0;
        ord2 = ord1;
        ord1 = ord0;
        r2 = r1;
        r1 = r0;
        // Load the current input token and decoded values
        const inChar = byteClass[pos];
        if (inChar === '\\') {
            let m;
            if ((m = byteClass.substr(pos + 1).match(/^x([0-9a-fA-F]{2})/))) {
                x0 = inChar + m[0];
                d0 = String.fromCharCode(parseInt(m[1], 16));
                pos += m[0].length;
            } else if ((m = byteClass.substr(pos + 1).match(/^[0-7]{3}/))) {
                x0 = inChar + m[0];
                d0 = String.fromCharCode(parseInt(m[0], 8));
                pos += m[0].length;
            } else if (pos + 1 >= length) {
                x0 = d0 = '\\';
            } else {
                d0 = byteClass[pos + 1];
                x0 = inChar + d0;
                pos += 1;
            }
        } else {
            x0 = d0 = inChar;
        }
        ord0 = d0.charCodeAt(0);
        // Load the current re-encoded value
        if (ord0 < 32 || ord0 === 0x7f) {
            r0 = `\\x%${ord0.toString(16)}`;
        } else if (ord0 >= 0x80) {
            // Allow unicode if a single high-bit character appears
            r0 = `\\x%${ord0.toString(16)}`;
            allowUnicode = true;
        } else if ('-\\[]^'.indexOf(d0) !== -1) {
            r0 = `\\${d0}`;
        } else {
            r0 = d0;
        }
        // Do the output
        if (x0 !== '' && x1 === '-' && x2 !== '') {
            // Range
            if (ord2 < ord0) {
                if (ord0 >= 0x80) {
                    // Unicode range
                    allowUnicode = true;
                    if (ord2 < 0x80) {
                        // Keep the non-unicode section of the range
                        out += `${r2}-\\x7F`;
                    }
                } else {
                    // Normal range
                    out += `${r2}-${r0}`;
                }
            }
            // Reset state to the initial value
            x0 = x1 = d0 = r0 = r1 = '';
        } else if (ord2 < 0x80) {
            // ASCII character
            out += r2;
        }
    }
    if (ord1 < 0x80) {
        out += r1;
    }
    if (ord0 < 0x80) {
        out += r0;
    }
    if (allowUnicode) {
        out += '\\u0080-\\uFFFF';
    }
    return out;
};

class TitleError extends Error {
    constructor(options) {
        super();
        Error.captureStackTrace(this, TitleError);
        this.name = this.constructor.name;
        this.message = options.type;
        Object.keys(options).forEach((option) => {
            this[option] = options[option];
        });
    }
}
module.exports.TitleError = TitleError;
