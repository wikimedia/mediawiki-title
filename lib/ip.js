"use strict";

function substrCount(string, substr) {
    return string.split(substr).length - 1;
}

function strRepeat(string, number) {
    return new Array(number + 1).join(string);
}
// jscs:disable maximumLineLength
var IP_STRING_REGEX = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?(?:\/(12[0-8]|1[01][0-9]|[1-9]?\d))?$/;
var IP_V4_STRING_REGEX = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|0?[0-9]?[0-9])(?:\/(3[0-2]|[12]?\d))?$/;
// jscs:enable maximumLineLength

module.exports = function sanitizeIP(ip) {
    ip = ip.trim();

    // If not an IP, just return trimmed value, since sanitizeIP() is called
    // in a number of contexts where usernames are supplied as input.
    if (!IP_STRING_REGEX.test(ip)) {
        return ip;
    }

    if (IP_V4_STRING_REGEX.test(ip)) {
        return ip.split('.')
            .map(function(block) {
                var simplified = block.replace(/^0+/, '');
                if (!simplified.length) {
                    return '0';
                }
                return simplified;
            }).join('.');
    }

    ip = ip.toUpperCase();
    // Expand zero abbreviations
    var abbrevPos = ip.indexOf('::');
    if (abbrevPos !== -1) {
        // We know this is valid IPv6. Find the last index of the
        // address before any CIDR number (e.g. "a:b:c::/24").
        var CIDRStart = ip.indexOf('/');
        var addressEnd = CIDRStart !== -1 ? CIDRStart - 1 : ip.length - 1;
        var repeat;
        var extra;
        var pad;
        if (abbrevPos === 0) {
            // If the '::' is at the beginning...
            repeat = '0:';
            extra = ip === '::' ? '0' : ''; // for the address '::'
            pad = 9; // 7+2 (due to '::')
            // If the '::' is at the end...
        } else if (abbrevPos === addressEnd - 1) {
            repeat = ':0';
            extra = '';
            pad = 9; // 7+2 (due to '::')
            // If the '::' is in the middle...
        } else {
            repeat = ':0';
            extra = ':';
            pad = 8; // 6+2 (due to '::')
        }
        ip = ip.replace(/::/g, strRepeat(repeat, pad - substrCount(ip, ':')) + extra);
    }
    // Remove leading zeros from each bloc as needed
    return ip.replace(/(^|:)0+([0-9A-Fa-f]{1,4})/g, '$1$2');
};