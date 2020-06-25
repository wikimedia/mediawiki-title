'use strict';

const sanitizeIP     = require('./ip');
const utils          = require('./utils');
const phpCharToUpper = require('./mediawiki.Title.phpCharToUpper.js');

/**
 * A UTF-8 replacement character that's explicitly prohibited in the title
 *
 * @type {string}
 * @const
 */
const UTF_8_REPLACEMENT = '�';

/**
 * Convert db-key to readable text.
 * @param {string} s
 * @return {string}
 */
function text(s) {
    if (s !== null && s !== undefined) {
        return s.replace(/_/g, ' ');
    } else {
        return '';
    }
}

/**
 * Information about a wikimedia site required to make correct
 * normalization. This information matches the format used by the
 * <a href="https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=general%7Cnamespaces%7Cnamespacealiases%7Cspecialpagealiases">PHP API response</a>,
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
 * as returned by PHP api
 * @property {Object} specialpagealiases Site special page aliases in the same
 * format as returned by PHP api.
 */

function _getNSIndex(nsName, siteInfo) {
    const canonicalName = (name) => name.toUpperCase().replace(/_/g, ' ');
    const name = canonicalName(nsName);
    let index = Object.keys(siteInfo.namespaces).find((nsId) => {
        const ns = siteInfo.namespaces[nsId];
        return ns.canonical && canonicalName(ns.canonical) === name ||
            ns['*'] && canonicalName(ns['*']) === name ||
            ns.name && canonicalName(ns.name) === name;
    });
    if (!index) {
        // Not found within canonical names, try aliases
        index = siteInfo.namespacealiases.find((alias) =>
            name === canonicalName(alias['*'] || alias.alias));
        if (index !== undefined) {
            index = `${index.id}`;
        }
    }
    return index;
}

class Namespace {
    /**
     * Represents a wiki namespace
     * @param {number} id The namespace identifier
     * @param {SiteInfo} siteInfo The site metadata information.
     * @class
     */
    constructor(id, siteInfo) {
        this._siteInfo = siteInfo;
        this._id = Number(id);
    }

    getId() {
        return this._id;
    }

    /**
	 * Compares two namespaces for equality.
	 * @param {Namespace} ns
	 * @return {boolean}
	 */
    equals(ns) {
        return this === ns || this._id === ns._id;
    }

    isATalkNamespace() {
        // See https://www.mediawiki.org/wiki/Manual:Namespace#Subject_and_talk_namespaces
        return this._id % 2 === 1;
    }

    /**
     * Get the normalized localized name string for this namespace.
     * @return {string}
     */
    getNormalizedText() {
        const nsInfo = this._siteInfo.namespaces[`${this._id}`];
        const nsName = nsInfo['*'] || nsInfo.name;
        return nsName.replace(/ /g, '_');
    }

    /**
     * Get the canonical non-localized name string for this namespace.
     * @return {string}
     */
    getCanonicalText() {
        return this._siteInfo.namespaces[`${this._id}`].canonical.replace(/ /g, '_');
    }

    /**
     * Are subpages allowed for this namespace?
     * @return {boolean}
     */
    subpagesAllowed() {
        const subpages = this._siteInfo.namespaces[`${this._id}`].subpages;
        return subpages !== undefined && subpages !== false;
    }

    /**
     * Creates a namespace instance from namespace text or a namespace alias
     * @param {string} text Namespace name text.
     * @param {SiteInfo} siteInfo the site information.
     * @return {Namespace|undefined} a namespace or undefined if it wasn't found.
     */
    static fromText(text, siteInfo) {
        const index = _getNSIndex(text, siteInfo);
        if (index !== undefined) {
            return new Namespace(index, siteInfo);
        }
        return undefined;
    }

    /**
     * Creates a namespace object for a `Main` namespace.
     * @param {SiteInfo} siteInfo the site information.
     * @return {Namespace}
     */
    static main(siteInfo) {
        return new Namespace(0, siteInfo);
    }
}

/* Namespace id definitions from Defines.php in mediawiki-core */
const nameSpaceIds = {
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
    CategoryTalk: 15
};
nameSpaceIds.Image = nameSpaceIds.File;
nameSpaceIds.ImageTalk = nameSpaceIds.FileTalk;

/* Define a boolean is<ns> function for every namespace */
for (const ns in nameSpaceIds) {
    if (Object.prototype.hasOwnProperty.call(nameSpaceIds, ns)) {
        (function (id) {
            Namespace.prototype[`is${ns}`] = function () {
                return this._id === id;
            };
        }(nameSpaceIds[ns]));
    }
}

const regexCache = {};
function _createInvalidTitleRegex(legalTitleChars) {
    if (regexCache[legalTitleChars]) {
        return regexCache[legalTitleChars];
    }
    // Any character not allowed is forbidden
    regexCache[legalTitleChars] = new RegExp(`[^${
        utils.convertByteClassToUnicodeClass(legalTitleChars)}]` +
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
    const nsCase = siteInfo.namespaces[`${result.namespace._id}`].case;
    if (nsCase === 'first-letter') {
        // This special casing is from core's `Language::ucfirst`
        // Grep for definitions in core/languages/classes/
        if (result.title[0] === 'i' && (siteInfo.general.lang === 'az' ||
                siteInfo.general.lang === 'tr' ||
                siteInfo.general.lang === 'kaa' ||
                siteInfo.general.lang === 'kk')) {
            result.title = `İ${result.title.substr(1)}`;
        } else if (!/^[A-Z]/.test(result.title)) {
            const firstCharacter = result.title.charAt(0);
            const upperCasedFirstLetter = phpCharToUpper(firstCharacter);
            result.title = upperCasedFirstLetter + result.title.substr(1);
        }
    }
    return result;
}

function _splitNamespace(title, siteInfo, defaultNs) {
    const prefixRegex = /^(.+?)_*:_*(.*)$/;
    const match = title.match(prefixRegex);
    if (match) {
        const namespaceText = match[1];
        const ns = Namespace.fromText(namespaceText, siteInfo);
        if (ns !== undefined) {
            return {
                title: match[2],
                namespace: ns
            };
        }
    }
    return {
        title,
        namespace: (defaultNs !== undefined) ? defaultNs : Namespace.main(siteInfo)
    };
}

function _checkLegalTitleCharacters(title, siteInfo) {
    const match = title.match(_createInvalidTitleRegex(siteInfo.general.legaltitlechars));
    if (match) {
        throw new utils.TitleError({
            type: 'title-invalid-characters',
            title,
            errors: match[0]
        });
    }
    return title;
}

function _checkEmptyTitle(title) {
    if (!title.length) {
        throw new utils.TitleError({
            type: 'title-invalid-empty',
            title
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
            title
        });
    }
}

// Disallow Talk:File:x type titles.
function _checkTalkNamespace(title, siteInfo) {
    const split = _splitNamespace(title, siteInfo);
    if (split.namespace && !split.namespace.isMain()) {
        throw new utils.TitleError({
            type: 'title-invalid-talk-namespace',
            title
        });
    }
}

function _checkMaxLength(title, namespace) {
    const maxLength = namespace.isSpecial() ? 512 : 255;
    if (Buffer.byteLength(title, 'utf8') > maxLength) {
        throw new utils.TitleError({
            type: 'title-invalid-too-long',
            title,
            maxLength
        });
    }
}

function _fixSpecialName(title, siteInfo) {
    const parts = title.split('/');
    const first = parts[0].toUpperCase();
    const alias = (siteInfo.specialpagealiases || []).find((o) => {
        return o.aliases.find((a) => a.toUpperCase() === first) !== undefined;
    });
    if (alias) {
        parts[0] = alias.aliases[0];
        title = parts.join('/');
    }
    return title;
}

class Title {
    /**
     * Creates a new title object with article the dbKey and namespace
     * @param {string} key The article title in a form of the dbKey.
     * @param {Namespace|number} namespace The article namespace.
     * @param {SiteInfo} siteInfo The site metadata.
     * @param {string} [fragment] The fragment of the title.
     * @class
     */
    constructor(key, namespace, siteInfo, fragment) {
        this._key = key;
        if (namespace.constructor.name === 'Namespace') {
            this._namespace = namespace;
        } else {
            this._namespace = new Namespace(namespace, siteInfo);
        }
        this._siteInfo = siteInfo;
        this._fragment = fragment;
    }

    /**
     * Returns the normalized article title
     * @return {string}
     */
    getKey() {
        return this._key;
    }

    /**
     * Returns the normalized article title and namespace.
     * @return {string}
     */
    getPrefixedDBKey() {
        let normalized = this._key;
        if (!this._namespace.isMain()) {
            normalized = `${this._namespace.getNormalizedText()}:${normalized}`;
        }
        return normalized;
    }

    /**
     * Get the full page name (transformed by #text)
     *
     * Example: "File:Example image.svg" for "File:Example_image.svg".
     * @return {string}
     */
    getPrefixedText() {
        return text(this.getPrefixedDBKey());
    }

    /**
     * Returns the normalized fragment part of the original title
     * @return {string|undefined}
     */
    getFragment() {
        return this._fragment;
    }

    /**
     * Returns the namespace of an article.
     * @return {Namespace}
     */
    getNamespace() {
        return this._namespace;
    }

    /**
	 * Compares two titles for equality.
	 * @param {Title} title
	 * @return {boolean}
	 */
    equals(title) {
        return this === title ||
			(this._key === title._key && this._namespace.equals(title._namespace));
    }

    /**
     * Normalize a title according to the rules of <domain>
     * @param {string} title The page title to normalize.
     * @param {SiteInfo} siteInfo The site information.
     * @param {Namespace|number} [defaultNs] A default namespace.
     *
     * @return {Title} The resulting title object.
     */
    static newFromText(title, siteInfo, defaultNs) {
        if (typeof title !== 'string') {
            throw new TypeError('Invalid type of title parameter. Must be a string');
        }
        if (typeof siteInfo !== 'object') {
            throw new TypeError('Invalid type of siteInfo parameter. Must be an object');
        }

        title = title
        // Strip soft hyphens (U+00AD) and Unicode directional formatting
        // characters (U+061C, U+200E, U+200F, U+202A. U+202B, U+202C, U+202D,
        // U+202E, U+2066, U+2067, U+2068, U+2069).
        .replace(/[\u00AD\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]+/g, '')
        // Clean up whitespace
        .replace(/[ _\u00A0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, '_')
        // Trim _ from beginning and end
        .replace(/(?:^_+)|(?:_+$)/g, '');

        if (title.indexOf(UTF_8_REPLACEMENT) !== -1) {
            throw new utils.TitleError({
                type: 'title-invalid-utf8',
                title
            });
        }

        // Initial colon indicates main namespace rather than specified default
        // but should not create invalid {ns,title} pairs such as {0,Project:Foo}
        if (title !== '' && title[0] === ':') {
            title = title.substr(1).replace(/^_+/, '');
            defaultNs = 0;
        }

        _checkEmptyTitle(title);

        if (defaultNs !== undefined && defaultNs.constructor.name !== 'Namespace') {
            defaultNs = new Namespace(defaultNs, siteInfo);
        }

        let result = _splitNamespace(title, siteInfo, defaultNs);
        if (result.namespace.isTalk()) {
            _checkTalkNamespace(result.title, siteInfo);
        }
        const fragmentIndex = result.title.indexOf('#');
        if (fragmentIndex >= 0) {
            const fragment = result.title.substr(fragmentIndex);
            result.fragment = fragment.substr(1);
            result.title = result.title
                .substring(0, result.title.length - fragment.length)
                .replace(/_+$/, '');
        }

        _checkLegalTitleCharacters(result.title, siteInfo);
        _checkRelativeTitle(result.title);
        // Magic tilde sequences? Nu-uh!
        if (result.title.indexOf('~~~') !== -1) {
            throw new utils.TitleError({
                type: 'title-invalid-magic-tilde',
                title
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

        if (result.namespace.isSpecial()) {
            result.title = _fixSpecialName(result.title, siteInfo);
        }

        return new Title(result.title, result.namespace, siteInfo, result.fragment);
    }
}

module.exports = {};
module.exports.Namespace = Namespace;
module.exports.Title = Title;
module.exports.TitleError = utils.TitleError;
