'use strict';

var assert = require('assert');
var Normalizer = require('../lib/index');

// Run jshint as part of normal testing
require('mocha-jshint')();
// Run jscs as part of normal testing
require('mocha-jscs')();

var normalizer = new Normalizer({
    apiURI: function (domain) {
        return 'https://' + domain + '/w/api.php';
    }
});

describe('General', function() {
    it('should throw error for non-string title', function() {
        try {
            normalizer.normalize(1, 'en.wikipedia.org');
            throw new Error('Should throw error!');
        } catch (e) {
            assert.deepEqual(e.constructor, TypeError);
            assert.deepEqual(e.message, 'Invalid type of title parameter. Must be a string');
        }
    });
    it('should throw error for non-string domain', function() {
        try {
            normalizer.normalize('a', 2);
            throw new Error('Should throw error!');
        } catch (e) {
            assert.deepEqual(e.constructor, TypeError);
            assert.deepEqual(e.message, 'Invalid type of domain parameter. Must be a string');
        }
    });
    it('should throw error for undefined options', function() {
        try {
            new Normalizer();
            throw new Error('Should throw error!');
        } catch (e) {
            assert.deepEqual(e.constructor, TypeError);
            assert.deepEqual(e.message, 'Invalid options for Normalizer constructor');
        }
    });
    it('should throw error for invalid apiURI', function() {
        try {
            new Normalizer({
                apiURI: 'test'
            });
            throw new Error('Should throw error!');
        } catch (e) {
            assert.deepEqual(e.constructor, TypeError);
            assert.deepEqual(e.message, 'Invalid options for Normalizer constructor');
        }
    });
});

describe('Validation', function () {
    var invalidTitles = [['', 'title-invalid-empty'],
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
        [ new Array(257).join('x'), 'title-invalid-too-long' ],
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
            return normalizer.normalize(testCase[0], 'en.wikipedia.org')
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
        [ new Array(252).join('x') ]
    ];

    validTitles.forEach(function(title) {
        var name = title[0];
        if (name.length > 20) {
            name = title[0].substr(0, 20) + '...'
        }

        it(name + ' should be valid', function() {
            return normalizer.normalize(title[0], 'en.wikipedia.org')
        });
    });
});

describe('Normalization', function() {
    var testCases = [
        [ 'en.wikipedia.org', 'Test', 'Test'],
        [ 'en.wikipedia.org', 'Foo:bar', 'Foo:bar'],
        [ 'en.wikipedia.org', 'Talk: foo', 'Talk:Foo'],
        [ 'en.wikipedia.org', 'int:eger', 'Int:eger'],
        // User IP sanitizations
        [ 'en.wikipedia.org', 'User:::1', 'User:0:0:0:0:0:0:0:1'],
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
        [ 'en.wikipedia.org', 'User:Bar.010', 'User:Bar.010' ]

    ];

    testCases.forEach(function (test) {
        it('For ' + test[0] + ' should normalize ' + test[1] + ' to ' + test[2], function() {
            return normalizer.normalize(test[1], test[0])
            .then(function(res) {
                assert.deepEqual(res, test[2]);
            });
        });
    });
});