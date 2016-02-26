"use strict";

var util = require('util');

module.exports = {};

/**
 * Utility method for converting a character sequence from bytes to Unicode.
 *
 * Primary usecase being converting $wgLegalTitleChars to a sequence usable in
 * javascript, as PHP uses UTF-8 bytes where javascript uses Unicode code units.
 *
 * Direct port of the mediawiki code
 *
 * @param {string} byteClass
 * @return {string}
 */
module.exports.convertByteClassToUnicodeClass = function(byteClass) {
    var length = byteClass.length;
    // Input token queue
    var x0 = '';
    var x1 = '';
    var x2 = '';
    // Decoded queue
    var d0 = '';
    var d1 = '';
    var d2 = '';
    // Decoded integer codepoints
    var ord0 = 0;
    var ord1 = 0;
    var ord2 = 0;
    // Re-encoded queue
    var r0 = '';
    var r1 = '';
    var r2 = '';
    // Output
    var out = '';
    // Flags
    var allowUnicode = false;
    for (var pos = 0; pos < length; pos++) {
        // Shift the queues down
        x2 = x1;
        x1 = x0;
        d2 = d1;
        d1 = d0;
        ord2 = ord1;
        ord1 = ord0;
        r2 = r1;
        r1 = r0;
        // Load the current input token and decoded values
        var inChar = byteClass[pos];
        if (inChar === '\\') {
            var m;
            if (!!(m = byteClass.substr(pos + 1).match(/^x([0-9a-fA-F]{2})/))) {
                x0 = inChar + m[0];
                d0 = String.fromCharCode(parseInt(m[1], 16));
                pos += m[0].length;
            } else if (!!(m = byteClass.substr(pos + 1).match(/^[0-7]{3}/))) {
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
            r0 = '\\x%' + ord0.toString(16);
        } else if (ord0 >= 0x80) {
            // Allow unicode if a single high-bit character appears
            r0 = '\\x%' + ord0.toString(16);
            allowUnicode = true;
        } else if ('-\\[]^'.indexOf(d0) !== -1) {
            r0 = '\\' + d0;
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
                        out += r2 + '-\\x7F';
                    }
                } else {
                    // Normal range
                    out += r2 + '-' + r0;
                }
            }
            // Reset state to the initial value
            x0 = x1 = d0 = d1 = r0 = r1 = '';
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

function TitleError(options) {
    var self = this;
    Error.call(self);
    Error.captureStackTrace(self, TitleError);
    self.name = self.constructor.name;
    self.message = options.type;
    Object.keys(options).forEach(function(option) {
        self[option] = options[option];
    });
}
util.inherits(TitleError, Error);
module.exports.TitleError = TitleError;
