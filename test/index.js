'use strict';

var assert = require('assert');
var Title = require('../lib/index').Title;
var utils = require('../lib/utils');
var preq = require('preq');

// Run jshint as part of normal testing
require('mocha-jshint')();
// Run jscs as part of normal testing
require('mocha-jscs')();

function doTest(formatversion) {
    var siteInfoCache = {};
    var getSiteInfo = function(domain) {
        if (siteInfoCache[domain]) {
            return siteInfoCache[domain];
        }

        siteInfoCache[domain] = preq.post({
            uri: 'https://' + domain + '/w/api.php',
            body: {
                action: 'query',
                meta: 'siteinfo',
                siprop: 'general|namespaces|namespacealiases|specialpagealiases',
                format: 'json',
                formatversion: formatversion
            }
        })
        .then(function(res) {
            return res.body.query;
        });
        return siteInfoCache[domain];
    };

    describe('Validation', function () {
        var invalidTitles = [
            ['foo�', 'title-invalid-utf8'],
            ['', 'title-invalid-empty'],
            [':', 'title-invalid-empty'],
            ['__  __', 'title-invalid-empty'],
            ['  __  ', 'title-invalid-empty'],
            // Bad characters forbidden regardless of wgLegalTitleChars
            ['A [ B', 'title-invalid-characters'],
            ['A ] B', 'title-invalid-characters'],
            ['A { B', 'title-invalid-characters'],
            ['A } B', 'title-invalid-characters'],
            ['A < B', 'title-invalid-characters'],
            ['A > B', 'title-invalid-characters'],
            ['A | B', 'title-invalid-characters'],
            // URL encoding
            ['A%20B', 'title-invalid-characters'],
            ['A%23B', 'title-invalid-characters'],
            ['A%2523B', 'title-invalid-characters'],
            // XML/HTML character entity references
            // Note: Commented out because they are not marked invalid by the PHP test as
            // Title::newFromText runs Sanitizer::decodeCharReferencesAndNormalize first.
            // 'A &eacute; B',
            // 'A &#233; B',
            // 'A &#x00E9; B',
            // Subject of NS_TALK does not roundtrip to NS_MAIN
            ['Talk:File:Example.svg', 'title-invalid-talk-namespace'],
            // Directory navigation
            ['.', 'title-invalid-relative'],
            ['..', 'title-invalid-relative'],
            ['./Sandbox', 'title-invalid-relative'],
            ['../Sandbox', 'title-invalid-relative'],
            ['Foo/./Sandbox', 'title-invalid-relative'],
            ['Foo/../Sandbox', 'title-invalid-relative'],
            ['Sandbox/.', 'title-invalid-relative'],
            ['Sandbox/..', 'title-invalid-relative'],
            // Tilde
            ['A ~~~ Name', 'title-invalid-magic-tilde'],
            ['A ~~~~ Signature', 'title-invalid-magic-tilde'],
            ['A ~~~~~ Timestamp', 'title-invalid-magic-tilde'],
            // Length
            [ new Array(258).join('x'), 'title-invalid-too-long' ],
            [ 'Special:' + new Array(514).join('x'), 'title-invalid-too-long' ],
            // Namespace prefix without actual title
            ['Talk:', 'title-invalid-empty'],
            ['Talk:#', 'title-invalid-empty'],
            ['Category: ', 'title-invalid-empty'],
            ['Category: #bar', 'title-invalid-empty']];

        invalidTitles.forEach(function(testCase) {
            var name = testCase[0];
            if (name.length > 20) {
                name = testCase[0].substr(0, 20) + '...'
            }

            it('should throw ' + testCase[1] + ' error for ' + name, function() {
                return getSiteInfo('en.wikipedia.org')
                .then(function(siteInfo) {
                    return Title.newFromText(testCase[0], siteInfo);
                })
                .then(function () {
                    throw new Error('Error should be thrown');
                }, function (e) {
                    assert.deepEqual(e.message, testCase[1]);
                });
            });
        });

        var validTitles = [
            [ 'Sandbox' ],
            [ 'A "B"' ],
            [ 'A \'B\'' ],
            [ '.com' ],
            [ '~' ],
            [ '#' ],
            [ 'Test#Abc' ],
            [ '"' ],
            [ '\'' ],
            [ 'Talk:Sandbox' ],
            [ 'Talk:Foo:Sandbox' ],
            [ 'File:Example.svg' ],
            [ 'File_talk:Example.svg' ],
            [ 'Foo/.../Sandbox' ],
            [ 'Sandbox/...' ],
            [ 'A~~' ],
            [ ':A' ],
            // Length is 256 total, but only title part matters
            [ 'Category:' + new Array(248).join('x') ],
            // Special pages can have longer titles
            [ 'Special:' + new Array(500).join('x') ],
            [ new Array(252).join('x') ],
            [ new Array(257).join('x') ],
            [ '-' ],
            [ 'aũ' ],
            [ '"Believing_Women"_in_Islam._Unreading_Patriarchal_Interpretations_of_the_Qur\\\'ān']
        ];

        validTitles.forEach(function(title) {
            var name = title[0];
            if (name.length > 20) {
                name = title[0].substr(0, 20) + '...'
            }

            it(name + ' should be valid', function() {
                return getSiteInfo('en.wikipedia.org')
                .then(function(siteInfo) {
                    return Title.newFromText(title[0], siteInfo);
                })
            });
        });
    });

    describe('Normalization', function() {
        var testCases = [
            [ 'en.wikipedia.org', 'Test', 'Test'],
            [ 'en.wikipedia.org', ':Test', 'Test'],
            [ 'en.wikipedia.org', ': Test', 'Test'],
            [ 'en.wikipedia.org', ':_Test_', 'Test'],
            [ 'en.wikipedia.org', 'Test 123  456   789', 'Test_123_456_789' ],
            [ 'en.wikipedia.org', '💩', '💩'],
            [ 'en.wikipedia.org', 'Foo:bar', 'Foo:bar'],
            [ 'en.wikipedia.org', 'Talk: foo', 'Talk:Foo'],
            [ 'en.wikipedia.org', 'int:eger', 'Int:eger'],
            [ 'en.wikipedia.org', 'WP:eger', 'Wikipedia:Eger'],
            [ 'en.wikipedia.org', 'X-Men (film series) #Gambit', 'X-Men_(film_series)' ],
            [ 'en.wikipedia.org', 'Foo _ bar', 'Foo_bar' ],
            [ 'en.wikipedia.org', 'Foo \u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000 bar', 'Foo_bar' ],
            [ 'en.wikipedia.org', 'Foo\u200E\u200F\u202A\u202B\u202C\u202D\u202Ebar', 'Foobar' ],
            // Special handling for `i` first character
            [ 'tr.wikipedia.org', 'iTestTest', 'İTestTest'],
            [ 'az.wikipedia.org', 'iTestTest', 'İTestTest'],
            [ 'kk.wikipedia.org', 'iTestTest', 'İTestTest'],
            [ 'kaa.wikipedia.org', 'iTestTest', 'İTestTest'],
            // User IP sanitizations
            [ 'en.wikipedia.org', 'User:::1', 'User:0:0:0:0:0:0:0:1'],
            [ 'en.wikipedia.org', 'User:0:0:0:0:0:0:0:1', 'User:0:0:0:0:0:0:0:1'],
            [ 'en.wikipedia.org', 'User:127.000.000.001', 'User:127.0.0.1'],
            [ 'en.wikipedia.org', 'User:0.0.0.0', 'User:0.0.0.0' ],
            [ 'en.wikipedia.org', 'User:00.00.00.00', 'User:0.0.0.0' ],
            [ 'en.wikipedia.org', 'User:000.000.000.000', 'User:0.0.0.0'],
            [ 'en.wikipedia.org', 'User:141.000.011.253', 'User:141.0.11.253' ],
            [ 'en.wikipedia.org', 'User: 1.2.4.5', 'User:1.2.4.5' ],
            [ 'en.wikipedia.org', 'User:01.02.04.05', 'User:1.2.4.5' ],
            [ 'en.wikipedia.org', 'User:001.002.004.005', 'User:1.2.4.5' ],
            [ 'en.wikipedia.org', 'User:010.0.000.1', 'User:10.0.0.1' ],
            [ 'en.wikipedia.org', 'User:080.072.250.04', 'User:80.72.250.4' ],
            [ 'en.wikipedia.org', 'User:Foo.1000.00', 'User:Foo.1000.00' ],
            [ 'en.wikipedia.org', 'User:Bar.01', 'User:Bar.01' ],
            [ 'en.wikipedia.org', 'User:Bar.010', 'User:Bar.010' ],
            [ 'en.wikipedia.org', 'User:cebc:2004:f::', 'User:CEBC:2004:F:0:0:0:0:0' ],
            [ 'en.wikipedia.org', 'User:::', 'User:0:0:0:0:0:0:0:0' ],
            [ 'en.wikipedia.org', 'User:0:0:0:1::', 'User:0:0:0:1:0:0:0:0' ],
            [ 'en.wikipedia.org', 'User:3f:535::e:fbb', 'User:3F:535:0:0:0:0:E:FBB' ],
            [ 'en.wikipedia.org', 'User Talk:::1', 'User_talk:0:0:0:0:0:0:0:1'],
            [ 'en.wikipedia.org', 'User_Talk:::1', 'User_talk:0:0:0:0:0:0:0:1'],
            [ 'en.wikipedia.org', 'User_talk:::1', 'User_talk:0:0:0:0:0:0:0:1'],
            [ 'en.wikipedia.org', 'User_talk:::1/24', 'User_talk:0:0:0:0:0:0:0:1/24'],
            // Case-sensitive namespace
            [ 'en.wikipedia.org', 'user:pchelolo', 'User:Pchelolo'],
            [ 'en.wiktionary.org', 'user:pchelolo', 'User:Pchelolo' ],
            [ 'en.wikipedia.org',
                'list of Neighbours characters (2016)#Tom Quill',
                'List_of_Neighbours_characters_(2016)'],
            [ 'en.wikipedia.org', 'ß', 'ß' ],
            [ 'en.wikipedia.org', 'ŉ', 'ŉ' ],
            [ 'en.wikipedia.org', 'ǰ', 'ǰ' ],
            [ 'en.wikipedia.org', 'ΐ', 'ΐ' ],
            [ 'en.wikipedia.org', 'ΰ', 'ΰ' ],
            [ 'en.wikipedia.org', 'և', 'և' ],
            [ 'en.wikipedia.org', 'ẖ', 'ẖ' ],
            [ 'en.wikipedia.org', 'ẗ', 'ẗ' ],
            [ 'en.wikipedia.org', 'ẘ', 'ẘ' ],
            [ 'en.wikipedia.org', 'ẙ', 'ẙ' ],
            [ 'en.wikipedia.org', 'ẚ', 'ẚ' ],
            [ 'en.wikipedia.org', 'ὐ', 'ὐ' ],
            [ 'en.wikipedia.org', 'ὒ', 'ὒ' ],
            [ 'en.wikipedia.org', 'ὔ', 'ὔ' ],
            [ 'en.wikipedia.org', 'ὖ', 'ὖ' ],
            [ 'en.wikipedia.org', 'ᾀ', 'ᾈ' ],
            [ 'en.wikipedia.org', 'ᾁ', 'ᾉ' ],
            [ 'en.wikipedia.org', 'ᾂ', 'ᾊ' ],
            [ 'en.wikipedia.org', 'ᾃ', 'ᾋ' ],
            [ 'en.wikipedia.org', 'ᾄ', 'ᾌ' ],
            [ 'en.wikipedia.org', 'ᾅ', 'ᾍ' ],
            [ 'en.wikipedia.org', 'ᾆ', 'ᾎ' ],
            [ 'en.wikipedia.org', 'ᾇ', 'ᾏ' ],
            [ 'en.wikipedia.org', 'ᾐ', 'ᾘ' ],
            [ 'en.wikipedia.org', 'ᾑ', 'ᾙ' ],
            [ 'en.wikipedia.org', 'ᾒ', 'ᾚ' ],
            [ 'en.wikipedia.org', 'ᾓ', 'ᾛ' ],
            [ 'en.wikipedia.org', 'ᾔ', 'ᾜ' ],
            [ 'en.wikipedia.org', 'ᾕ', 'ᾝ' ],
            [ 'en.wikipedia.org', 'ᾖ', 'ᾞ' ],
            [ 'en.wikipedia.org', 'ᾗ', 'ᾟ' ],
            [ 'en.wikipedia.org', 'ᾠ', 'ᾨ' ],
            [ 'en.wikipedia.org', 'ᾡ', 'ᾩ' ],
            [ 'en.wikipedia.org', 'ᾢ', 'ᾪ' ],
            [ 'en.wikipedia.org', 'ᾣ', 'ᾫ' ],
            [ 'en.wikipedia.org', 'ᾤ', 'ᾬ' ],
            [ 'en.wikipedia.org', 'ᾥ', 'ᾭ' ],
            [ 'en.wikipedia.org', 'ᾦ', 'ᾮ' ],
            [ 'en.wikipedia.org', 'ᾧ', 'ᾯ' ],
            [ 'en.wikipedia.org', 'ﬀ', 'ﬀ' ],
            [ 'en.wikipedia.org', 'ﬁ', 'ﬁ' ],
            [ 'en.wikipedia.org', 'ﬂ', 'ﬂ' ],
            [ 'en.wikipedia.org', 'ﬃ', 'ﬃ' ],
            [ 'en.wikipedia.org', 'ﬄ', 'ﬄ' ],
            [ 'en.wikipedia.org', 'ﬅ', 'ﬅ' ],
            [ 'en.wikipedia.org', 'ﬆ', 'ﬆ' ],
            [ 'en.wikipedia.org', 'ﬓ', 'ﬓ' ],
            [ 'en.wikipedia.org', 'ﬔ', 'ﬔ' ],
            [ 'en.wikipedia.org', 'ﬕ', 'ﬕ' ],
            [ 'en.wikipedia.org', 'ﬖ', 'ﬖ' ],
            [ 'en.wikipedia.org', 'ﬗ', 'ﬗ' ],
            [ 'en.wikipedia.org', 'ⓝ', 'ⓝ' ],
            // Special page aliases
            [ 'en.wikipedia.org', 'Special:NotSpecial', 'Special:NotSpecial' ],
            [ 'en.wikipedia.org', 'Special:Lonelypages', 'Special:LonelyPages' ],
            [ 'en.wikipedia.org', 'Special:lonelypages', 'Special:LonelyPages' ],
            [ 'en.wikipedia.org', 'Special:OrphanedPages', 'Special:LonelyPages' ],
            [ 'en.wikipedia.org', 'Special:Contribs/124.106.240.49', 'Special:Contributions/124.106.240.49' ],
            [ 'es.wikipedia.org', 'Especial:SpecialPages', 'Especial:PáginasEspeciales' ],
            [ 'es.wikipedia.org', 'Especial:Expandir plantillas', 'Especial:Sustituir_plantillas' ],
            [ 'es.wikipedia.org', 'Especial:BookSources/9784041047910', 'Especial:FuentesDeLibros/9784041047910' ],
        ];

        testCases.forEach(function (test) {
            it('For ' + test[0] + ' should normalize ' + test[1] + ' to ' + test[2], function() {
                return getSiteInfo(test[0])
                .then(function(siteInfo) {
                    return Title.newFromText(test[1], siteInfo).getPrefixedDBKey();
                })
                .then(function(res) {
                    assert.deepEqual(res, test[2]);
                });
            });
        });

        it('Should normalize fragment', function() {
            return getSiteInfo('en.wikipedia.org')
            .then(function(siteInfo) {
                return Title.newFromText('Test#some fragment', siteInfo);
            })
            .then(function(res) {
                assert.deepEqual(res.getFragment(), 'some_fragment');
            });
        });

        it('Should normalize and give readable title', function() {
            return getSiteInfo('en.wikipedia.org')
            .then(function(siteInfo) {
                return Title.newFromText('X-Men_(film_series)', siteInfo);
            })
            .then(function(res) {
                assert.deepEqual(res.getPrefixedText(), 'X-Men (film series)');
            });
        });
    });

    describe('Defaults', function() {
        var testCases = [
            [ undefined, 'Example.svg', 0, 'Example.svg' ],
            [ 0, 'Example.svg', 0, 'Example.svg' ],
            [ 6, 'Example.svg', 6, 'File:Example.svg' ],
            [ undefined, 'File:Example.svg', 6, 'File:Example.svg' ],
            [ 6, 'File:Example.svg', 6, 'File:Example.svg' ],
            [ 2, 'File:Example.svg', 6, 'File:Example.svg' ],
            [ 2, 'Test', 2, 'User:Test' ],
            [ 2, ':Test', 0, 'Test' ],
            [ 0, ':User:Test', 2, 'User:Test' ],
        ];
        testCases.forEach(function (test) {
            it('For ns:' + test[0] + ' should default ' + test[1] + ' to ' + test[2], function() {
                return getSiteInfo('en.wikipedia.org')
                .then(function(siteInfo) {
                    var t = Title.newFromText(test[1], siteInfo, test[0]);
                    return [t.getNamespace()._id, t.getPrefixedDBKey()];
                })
                .then(function(res) {
                    assert.deepEqual(res[0], test[2])
                    assert.deepEqual(res[1], test[3]);
                });
            });
        });
    });

    describe('Utilities', function () {
        var data = [
            [
                ' %!"$&\'()*,\\-.\\/0-9:;=?@A-Z\\\\^_`a-z~\\x80-\\xFF+',
                ' %!"$&\'()*,\\-./0-9:;=?@A-Z\\\\\\^_`a-z~+\\u0080-\\uFFFF',
            ],
            [
                'QWERTYf-\\xFF+',
                'QWERTYf-\\x7F+\\u0080-\\uFFFF',
            ],
            [
                'QWERTY\\x66-\\xFD+',
                'QWERTYf-\\x7F+\\u0080-\\uFFFF',
            ],
            [
                'QWERTYf-y+',
                'QWERTYf-y+',
            ],
            [
                'QWERTYf-\\x80+',
                'QWERTYf-\\x7F+\\u0080-\\uFFFF',
            ],
            [
                'QWERTY\\x66-\\x80+\\x23',
                'QWERTYf-\\x7F+#\\u0080-\\uFFFF',
            ],
            [
                'QWERTY\\x66-\\x80+\\xD3',
                'QWERTYf-\\x7F+\\u0080-\\uFFFF',
            ],
            [
                '\\\\\\x99',
                '\\\\\\u0080-\\uFFFF',
            ],
            [
                '-\\x99',
                '\\-\\u0080-\\uFFFF',
            ],
            [
                'QWERTY\\-\\x99',
                'QWERTY\\-\\u0080-\\uFFFF',
            ],
            [
                '\\\\x99',
                '\\\\x99',
            ],
            [
                'A-\\x9F',
                'A-\\x7F\\u0080-\\uFFFF',
            ],
            [
                '\\x66-\\x77QWERTY\\x88-\\x91FXZ',
                'f-wQWERTYFXZ\\u0080-\\uFFFF',
            ],
            [
                '\\x66-\\x99QWERTY\\xAA-\\xEEFXZ',
                'f-\\x7FQWERTYFXZ\\u0080-\\uFFFF',
            ]
        ];

        var idx = 0;
        data.forEach(function(test) {
            idx++;
            it('Should covert byte range. Test ' + idx, function () {
                assert.deepEqual(utils.convertByteClassToUnicodeClass(test[0]), test[1]);
            });
        });

        it('Should fetch domains', function() {
            return preq.get({
                uri: 'https://en.wikipedia.org/w/api.php?action=sitematrix&format=json'
            })
            .then(function(res) {
                return Object.keys(res.body.sitematrix)
                .filter(function(idx) {
                    return idx !== 'count' && idx !== 'specials';
                })
                .map(function (idx) {
                    return res.body.sitematrix[idx].site[0].url.replace(/^https?:\/\//, '');
                });
            })
            .then(function (domains) {
                describe('Various domains', function() {
                    domains.forEach(function (domain) {
                        it('Should work for ' + domain, function() {
                            return getSiteInfo(domain)
                            .then(function(siteInfo) {
                                return Title.newFromText('1', siteInfo);
                            })
                            .then(function (res) {
                                assert.deepEqual(res.getPrefixedDBKey(), '1');
                            });
                        });
                    });
                });
            });
        });
    });
}

doTest(1);
doTest(2);
