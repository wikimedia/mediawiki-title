"use strict";

var sanitizeIP = require('./ip');
var utils      = require('./utils');

var NS_SPECIAL = '-1';
var NS_MAIN = '0';
var NS_TALK = '1';
var NS_USER = '2';
var NS_USER_TALK = '3';

// Polyfill for array.find for node 0.10 support.
function arrayFind(array, predicate) {
    for (var i = 0; i < array.length; i++) {
        if (predicate(array[i])) {
            return array[i];
        }
    }
    return undefined;
}

/**
 * Information about a wikimedia site required to make correct
 * normalization.
 *
 * @typedef SiteInfo
 * @type Object
 * @property {string} lang Site language code.
 * @property {string} legaltitlechars A perl-like regex for characters
 *                                    allowed in the page title.
 * @property {Object} namespaces Site namespaces info in the same format as
 *                               returned by PHP api.
 * @property {Object} namespacealiases Site namespace aliases in the same format
 *                                     as returned by PHP api.
 */


var regexCache = {};
function _createInvalidTitleRegex(legalTitleChars) {
    if (regexCache[legalTitleChars]) {
        return regexCache[legalTitleChars];
    }
    // Any character not allowed is forbidden
    regexCache[legalTitleChars] = new RegExp('[^' +
            utils.convertByteClassToUnicodeClass(legalTitleChars) + ']' +
            // URL percent encoding sequences interfere with the ability
            // to round-trip titles -- you can't link to them consistently.
            '|%[0-9A-Fa-f]{2}' +
            // XML/HTML character references produce similar issues.
            '|&[A-Za-z0-9\x80-\xff]+;' +
            '|&#[0-9]+;' +
            '|&#x[0-9A-Fa-f]+;');
    return regexCache[legalTitleChars];
}

function _getNSIndex(nsName, siteInfo) {
    function canonicalName(name) {
        return name.toUpperCase().replace(/_/g, ' ');
    }
    var name = canonicalName(nsName);
    var index = arrayFind(Object.keys(siteInfo.namespaces), function(nsId) {
        var ns = siteInfo.namespaces[nsId];
        return ns.canonical && canonicalName(ns.canonical) === name
                || ns['*'] && canonicalName(ns['*']) === name;
    });
    if (!index) {
        // Not found within canonical names, try aliases
        index = arrayFind(siteInfo.namespacealiases, function(alias) {
            return name === canonicalName(alias['*']);
        });
        if (index !== undefined) {
            index = '' + index.id;
        }
    }
    return index;
}

function _capitalizeTitle(result, siteInfo) {
    if (siteInfo.namespaces[result.namespace].case === 'first-letter') {
        if (result.title[0] === 'i' && (siteInfo.lang === 'az'
                || siteInfo.lang === 'tr'
                || siteInfo.lang === 'kaa'
                || siteInfo.lang === 'kk')) {
            result.title = 'İ' +  result.title.substr(1);
        } else if (!/^[A-Z]/.test(result.title)) {
            result.title = result.title.substr(0, 1).toUpperCase() + result.title.substr(1);
        }
    }
    return result;
}


function _splitNamespace(title, siteInfo) {
    var prefixRegex = /^(.+?)_*:_*(.*)$/;
    var match = title.match(prefixRegex);
    if (match) {
        var namespaceText = match[1];
        var ns = _getNSIndex(namespaceText, siteInfo);
        if (ns !== undefined) {
            return {
                title: match[2],
                namespace: ns
            };
        }
    }
    return {
        title: title,
        namespace: NS_MAIN
    };
}

function _checkLegalTitleCharacters(title, siteInfo) {
    var match = title.match(_createInvalidTitleRegex(siteInfo.legaltitlechars));
    if (match) {
        throw new utils.TitleError({
            type: 'title-invalid-characters',
            title: title,
            errors: match[0]
        });
    }
    return title;
}

function _checkEmptyTitle(title) {
    if (!title.length) {
        throw new utils.TitleError({
            type: 'title-invalid-empty',
            title: title
        });
    }
}

// Pages with "/./" or "/../" appearing in the URLs will often be
// unreachable due to the way web browsers deal with 'relative' URLs.
// Also, they conflict with subpage syntax. Forbid them explicitly.
function _checkRelativeTitle(title) {
    if (title.indexOf('.') !== -1 && (
            title === '.' || title === '..' ||
            title.indexOf('./') === 0 ||
            title.indexOf('../') === 0 ||
            title.indexOf('/./') !== -1 ||
            title.indexOf('/../') !== -1 ||
            title.slice(-2) === '/.' ||
            title.slice(-3) === '/..')) {
        throw new utils.TitleError({
            type: 'title-invalid-relative',
            title: title
        });
    }
}

// Disallow Talk:File:x type titles.
function _checkTalkNamespace(title, siteInfo) {
    var split = _splitNamespace(title, siteInfo);
    if (split.namespace && split.namespace !== NS_MAIN) {
        throw new utils.TitleError({
            type: 'title-invalid-talk-namespace',
            title: title
        });
    }
}

function _checkMaxLength(title, namespace) {
    var maxLength = namespace !== NS_SPECIAL ? 255 : 512;
    if (title.length > maxLength) {
        throw new utils.TitleError({
            type: 'title-invalid-too-long',
            title: title,
            maxLength: maxLength
        });
    }
}

/**
 * Normalize a title according to the rules of <domain>
 *
 * @param {string} title The page title to normalize.
 * @param {SiteInfo} siteInfo The site information.
 *
 * @returns {string} normalized version of a title.
 *
 * @public
 */
function normalize(title, siteInfo) {
    if (typeof title !== 'string') {
        throw new TypeError('Invalid type of title parameter. Must be a string');
    }
    if (typeof siteInfo !== 'object') {
        throw new TypeError('Invalid type of siteInfo parameter. Must be a string');
    }

    title = title.replace(/ /g, '_')
    // Strip Unicode bidi override characters.
    .replace(/\xE2\x80[\x8E\x8F\xAA-\xAE]/g, '')
    // Clean up whitespace
    .replace(/[ \xA0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, '_')
    // Trim _ from beginning and end
    .replace(/(?:^_+)|(?:_+$)/g, '');

    // Initial colon indicates main namespace rather than specified default
    // but should not create invalid {ns,title} pairs such as {0,Project:Foo}
    if (title !== '' && title[0] === ':') {
        title = title.substr(1).replace(/(?:^_+)|(?:_+$)/g, '');
    }

    _checkEmptyTitle(title);

    var result = _splitNamespace(title, siteInfo);
    if (result.namespace === NS_TALK) {
        _checkTalkNamespace(result.title, siteInfo);
    }
    var fragmentIndex = result.title.indexOf('#');
    if (fragmentIndex >= 0) {
        var fragment = result.title.substr(fragmentIndex);
        result.fragment = fragment.substr(1).replace(/_/g, ' ');
        result.title = result.title
        .substring(result.title, result.title.length - fragment.length)
        .replace('/_*$/', '');
    }

    _checkLegalTitleCharacters(result.title, siteInfo);
    _checkRelativeTitle(result.title);
    // Magic tilde sequences? Nu-uh!
    if (result.title.indexOf('~~~') !== -1) {
        throw new utils.TitleError({
            type: 'title-invalid-magic-tilde',
            title: title
        });
    }
    _checkMaxLength(result.title, result.namespace);

    result = _capitalizeTitle(result, siteInfo);

    if (result.namespace !== NS_MAIN) {
        _checkEmptyTitle(result.title);
    }

    if (result.namespace === NS_USER || result.namespace === NS_USER_TALK) {
        result.title = sanitizeIP(result.title);
    }

    var normalized = result.title;

    if (result.namespace !== NS_MAIN) {
        normalized = siteInfo.namespaces[result.namespace]['*'].replace(/ /g, '_')
            + ':' + normalized;
    }

    if (result.fragment) {
        normalized = normalized + '#' + result.fragment;
    }

    return normalized;
}

module.exports = {
    normalize: normalize
};