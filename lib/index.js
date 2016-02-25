"use strict";

var P          = require('bluebird');
var preq       = require('preq');
var TitleError = require('./title_error');
var sanitizeIP = require('./ip');

var NS_SPECIAL = '-1';
var NS_MAIN = '0';
var NS_TALK = '1';
var NS_USER = '2';
var NS_USER_TALK = '3';

/**
 * Creates an instance of title normalizer.
 *
 * @param {Object} options the normalizer options
 * @param {Function(string):string} options.apiURI a function
 *                 that takes a domain string and returns back
 *                 an API URI that needs to be contacted to get
 *                 the site information used for normalization.
 * @constructor
 * @public
 */
function Normalizer(options) {
    if (!options || typeof options.apiURI !== 'function') {
        throw new TypeError('Invalid options for Normalizer constructor');
    }

    this._options = options;
    this._siteInfo = {};
}

Normalizer.prototype._createInvalidTitleRegex = function(legalTitleChars) {
    // Any character not allowed is forbidden
    return new RegExp('[^' + legalTitleChars + ']' +
            // URL percent encoding sequences interfere with the ability
            // to round-trip titles -- you can't link to them consistently.
            '|%[0-9A-Fa-f]{2}' +
            // XML/HTML character references produce similar issues.
            '|&[A-Za-z0-9\x80-\xff]+;' +
            '|&#[0-9]+;' +
            '|&#x[0-9A-Fa-f]+;');
};

/**
 * Returns site info for a given domain.
 *
 * @param {string} domain the site
 * @private
 */
Normalizer.prototype._getSiteInfo = function(domain) {
    var self = this;
    if (self._siteInfo[domain]) {
        return P.resolve(self._siteInfo[domain]);
    } else {
        return preq.post({
            uri: self._options.apiURI(domain),
            body: {
                action: 'query',
                meta: 'siteinfo',
                siprop: 'general|namespaces|namespacealiases',
                format: 'json'
            }
        })
        .then(function(res) {
            res = res.body.query;
            self._siteInfo[domain] = {
                invalidTitleRegex: self._createInvalidTitleRegex(res.general.legaltitlechars),
                namespaces: res.namespaces,
                namespacealiases: res.namespacealiases
            };
            return self._siteInfo[domain];
        });
    }
};

Normalizer.prototype._getNSIndex = function(nsName, siteInfo) {
    function canonicalName(name) {
        return name.toUpperCase().replace(/_/g, ' ');
    }
    var name = canonicalName(nsName);
    var index = Object.keys(siteInfo.namespaces).find(function(nsId) {
        var ns = siteInfo.namespaces[nsId];
        return ns.canonical && canonicalName(ns.canonical) === name
                || ns['*'] && canonicalName(ns['*']) === name;
    });
    if (!index) {
        // Not found within canonical names, try aliases
        index = siteInfo.namespacealiases.find(function(alias) {
            return name === canonicalName(alias['*']);
        });
        if (index !== undefined) {
            index = '' + index.id;
        }
    }
    return index;
};

Normalizer.prototype._capitalizeTitle = function(result, siteInfo) {
    if (siteInfo.namespaces[result.namespace].case === 'first-letter') {
        result.title = result.title.substr(0, 1).toUpperCase() + result.title.substr(1);
    }
    return result;
};


Normalizer.prototype._splitNamespace = function(title, siteInfo) {
    var self = this;
    var prefixRegex = /^(.+?)_*:_*(.*)$/;
    var match = title.match(prefixRegex);
    if (match) {
        var namespaceText = match[1];
        var ns = self._getNSIndex(namespaceText, siteInfo);
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
};

Normalizer.prototype._checkLegalTitleCharacters = function(title, siteInfo) {
    var match = title.match(siteInfo.invalidTitleRegex);
    if (match) {
        throw new TitleError({
            type: 'title-invalid-characters',
            title: title,
            errors: match[0]
        });
    }
    return title;
};

Normalizer.prototype._checkEmptyTitle = function(title) {
    if (!title.length) {
        throw new TitleError({
            type: 'title-invalid-empty',
            title: title
        });
    }
};

// Pages with "/./" or "/../" appearing in the URLs will often be
// unreachable due to the way web browsers deal with 'relative' URLs.
// Also, they conflict with subpage syntax. Forbid them explicitly.
Normalizer.prototype._checkRelativeTitle = function(title) {
    if (title.indexOf('.') !== -1 && (
            title === '.' || title === '..' ||
            title.indexOf('./') === 0 ||
            title.indexOf('../') === 0 ||
            title.indexOf('/./') !== -1 ||
            title.indexOf('/../') !== -1 ||
            title.slice(-2) === '/.' ||
            title.slice(-3) === '/..')) {
        throw new TitleError({
            type: 'title-invalid-relative',
            title: title
        });
    }
};

// Disallow Talk:File:x type titles.
Normalizer.prototype._checkTalkNamespace = function(title, siteInfo) {
    var split = this._splitNamespace(title, siteInfo);
    if (split.namespace && split.namespace !== NS_MAIN) {
        throw new TitleError({
            type: 'title-invalid-talk-namespace',
            title: title
        });
    }
};

Normalizer.prototype._checkMaxLength = function(title, namespace) {
    var maxLength = namespace !== NS_SPECIAL ? 255 : 512;
    if (title.length > maxLength) {
        throw new TitleError({
            type: 'title-invalid-too-long',
            title: title,
            maxLength: maxLength
        });
    }
};

/**
 * Normalize a title according to the rules of <domain>
 *
 * @param {string} title the page title to normalize.
 * @param {string} domain the domain page belongs to.
 *
 * @returns {P.<string>} normalized version of a title.
 *
 * @public
 */
Normalizer.prototype.normalize = function(title, domain) {
    if (typeof title !== 'string') {
        throw new TypeError('Invalid type of title parameter. Must be a string');
    }
    if (typeof domain !== 'string') {
        throw new TypeError('Invalid type of domain parameter. Must be a string');
    }

    var self = this;
    return P.try(function() {
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

        self._checkEmptyTitle(title);
        return self._getSiteInfo(domain)
        .then(function(siteInfo) {
            var result = self._splitNamespace(title, siteInfo);
            if (result.namespace === NS_TALK) {
                self._checkTalkNamespace(result.title, siteInfo);
            }
            var fragmentIndex = result.title.indexOf('#');
            if (fragmentIndex >= 0) {
                var fragment = result.title.substr(fragmentIndex);
                result.fragment = fragment.substr(1).replace(/_/g, ' ');
                result.title = result.title
                .substring(result.title, result.title.length - fragment.length)
                .replace('/_*$/', '');
            }

            self._checkLegalTitleCharacters(result.title, siteInfo);
            self._checkRelativeTitle(result.title);
            // Magic tilde sequences? Nu-uh!
            if (result.title.indexOf('~~~') !== -1) {
                throw new TitleError({
                    type: 'title-invalid-magic-tilde',
                    title: title
                });
            }
            self._checkMaxLength(result.title, result.namespace);

            result = self._capitalizeTitle(result, siteInfo);

            if (result.namespace !== NS_MAIN) {
                self._checkEmptyTitle(result.title);
            }

            if (result.namespace === NS_USER || result.namespace === NS_USER_TALK) {
                result.title = sanitizeIP(result.title);
            }

            var normalized = result.title;

            if (result.namespace !== NS_MAIN) {
                normalized = siteInfo.namespaces[result.namespace]['*'] + ':' + normalized;
            }

            if (result.fragment) {
                normalized = normalized + '#' + result.fragment;
            }

            return normalized;
        });
    });
};

module.exports = Normalizer;