"use strict";

var sanitizeIP = require('./ip');
var utils      = require('./utils');

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
 * normalization. This information matches the format used by the
 * <a href="https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=general%7Cnamespaces%7Cnamespacealiases">PHP API response</a>,
 * however not all of the fields are required for library operation.
 *
 * The list of required properties is documented here, others can be removed.
 *
 * @typedef SiteInfo
 * @type Object
 * @property {Object} general General information about the site
 * @property {string} general.lang Site language code.
 * @property {string} general.legaltitlechars A perl-like regex for characters
 * allowed in the page title.
 * @property {string} general.case Whether to capitalize the first letter of the title.
 * Could be obtained from the `general` section of the `siteInfo` php API response.
 * @property {Object} namespaces Site namespaces info in the same format as
 * returned by PHP api.
 * @property {Object} namespacealiases Site namespace aliases in the same format
 * as returned by PHP api.
 */

/**
 * Represents a wiki namespace
 *
 * @param {number} id The namespace identifier
 * @param {SiteInfo} siteInfo The site metadata information.
 * @constructor
 */
function Namespace(id, siteInfo) {
    this._siteInfo = siteInfo;
    this._id = Number(id);
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

/**
 * Creates a namespace instance from namespace text or a namespace alias
 *
 * @param {string} text Namespace name text.
 * @param {SiteInfo} siteInfo the site information.
 * @returns {Namespace|undefined} a namespace or undefined if it wasn't found.
 */
Namespace.fromText = function(text, siteInfo) {
    var index = _getNSIndex(text, siteInfo);
    if (index !== undefined) {
        return new Namespace(index, siteInfo);
    }
    return undefined;
};

/**
 * Creates a namespace object for a `Main` namespace.
 *
 * @param {SiteInfo} siteInfo the site information.
 * @returns {Namespace}
 */
Namespace.main = function(siteInfo) {
    return new Namespace(0, siteInfo);
};

/* Namespace id definitions from Defines.php in mediawiki-core */
var nameSpaceIds = {
    Media: -2,
    Special: -1,
    Main: 0,
    Talk: 1,
    User: 2,
    UserTalk: 3,
    Project: 4,
    ProjectTalk: 5,
    File: 6,
    FileTalk: 7,
    Mediawiki: 8,
    MediawikiTalk: 9,
    Template: 10,
    TemplateTalk: 11,
    Help: 12,
    HelpTalk: 13,
    Category: 14,
    CategoryTalk: 15,
};
nameSpaceIds.Image = nameSpaceIds.File;


/**
 * Checks whether namespace is `Media`
 *
 * @method
 * @name Namespace.prototype#isMedia
 * @return {boolean}
 */

/**
 * Checks whether namespace is `Special`
 *
 * @method
 * @name Namespace.prototype#isSpecial
 * @return {boolean}
 */

/**
 * Checks whether namespace is `Main`
 *
 * @method
 * @name Namespace.prototype#isMain
 * @return {boolean}
 */

/**
 * Checks whether namespace is `Talk`
 *
 * @method
 * @name Namespace.prototype#isTalk
 * @return {boolean}
 */

/**
 * Checks whether namespace is `UserTalk`
 *
 * @method
 * @name Namespace.prototype#isUserTalk
 * @return {boolean}
 */

nameSpaceIds.ImageTalk = nameSpaceIds.FileTalk;

/* Define a boolean is<ns> function for every namespace */
for (var ns in nameSpaceIds) {
    (function(id) {
        Namespace.prototype['is' + ns] = function() {
            return this._id === id;
        };
    })(nameSpaceIds[ns]);
}

/**
 * Get the canonical name string for this namespace.
 *
 * @returns {string}
 */
Namespace.prototype.getNormalizedText = function() {
    return this._siteInfo.namespaces[this._id + '']['*'].replace(/ /g, '_');
};

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

function _capitalizeTitle(result, siteInfo) {
    if (siteInfo.general.case === 'first-letter') {
        if (result.title[0] === 'i' && (siteInfo.general.lang === 'az'
                || siteInfo.general.lang === 'tr'
                || siteInfo.general.lang === 'kaa'
                || siteInfo.general.lang === 'kk')) {
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
        var ns = Namespace.fromText(namespaceText, siteInfo);
        if (ns !== undefined) {
            return {
                title: match[2],
                namespace: ns
            };
        }
    }
    return {
        title: title,
        namespace: Namespace.main(siteInfo)
    };
}

function _checkLegalTitleCharacters(title, siteInfo) {
    var match = title.match(_createInvalidTitleRegex(siteInfo.general.legaltitlechars));
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
    if (split.namespace && !split.namespace.isMain()) {
        throw new utils.TitleError({
            type: 'title-invalid-talk-namespace',
            title: title
        });
    }
}

function _checkMaxLength(title, namespace) {
    var maxLength = !namespace.isSpecial() ? 255 : 512;
    if (title.length > maxLength) {
        throw new utils.TitleError({
            type: 'title-invalid-too-long',
            title: title,
            maxLength: maxLength
        });
    }
}

/**
 * Creates a new title object with article the dbKey and namespace
 *
 * @param {string} key The article title in a form of the dbKey.
 * @param {Namespace|number} namespace The article namespace.
 * @param {SiteInfo} siteInfo The site metadata.
 * @param {string} [fragment] The fragment of the title.
 * @constructor
 */
function Title(key, namespace, siteInfo, fragment) {
    this._key = key;
    this._namespace = namespace.constructor.name === 'Namespace' ?
            namespace : new Namespace(namespace, siteInfo);
    this._siteInfo = siteInfo;
    this._fragment = fragment;
}

/**
 * Normalize a title according to the rules of <domain>
 *
 * @param {string} title The page title to normalize.
 * @param {SiteInfo} siteInfo The site information.
 *
 * @returns {Title} The resulting title object.
 */
Title.newFromText = function(title, siteInfo) {
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
    if (result.namespace.isTalk()) {
        _checkTalkNamespace(result.title, siteInfo);
    }
    var fragmentIndex = result.title.indexOf('#');
    if (fragmentIndex >= 0) {
        var fragment = result.title.substr(fragmentIndex);
        result.fragment = fragment.substr(1).replace(/ /g, '_');
        result.title = result.title
            .substring(0, result.title.length - fragment.length)
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

    if (!result.namespace.isMain()) {
        _checkEmptyTitle(result.title);
    }

    if (result.namespace.isUser() || result.namespace.isUserTalk()) {
        result.title = sanitizeIP(result.title);
    }

    return new Title(result.title, result.namespace, siteInfo, result.fragment);
};

/**
 * Returns the normalized article title and namespace.
 *
 * @returns {string}
 */
Title.prototype.getPrefixedDBKey = function() {
    var normalized = this._key;
    if (!this._namespace.isMain()) {
        normalized = this._namespace.getNormalizedText() + ':' + normalized;
    }
    return normalized;
};

/**
 * Returns the normalized fragment part of the original title
 *
 * @returns {string|undefined}
 */
Title.prototype.getFragment = function() {
    return this._fragment;
};

/**
 * Returns the namespace of an article.
 *
 * @returns {Namespace}
 */
Title.prototype.getNamespace = function() {
    return this._namespace;
};

module.exports = {};
module.exports.Namespace = Namespace;
module.exports.Title = Title;
