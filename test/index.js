'use strict';

var assert = require('assert');
var Normalizer = require('../lib/index');

// Run jshint as part of normal testing
//require('mocha-jshint')();
// Run jscs as part of normal testing
//require('mocha-jscs')();

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
            normalizer.normalize('Test_Page', 1);
            throw new Error('Should throw error!');
        } catch (e) {
            assert.deepEqual(e.constructor, TypeError);
            assert.deepEqual(e.message, 'Invalid type of domain parameter. Must be a string');
        }
    });
});

describe('Title validation', function () {
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
        // TODO [('x', 256), 'title-invalid-too-long'],
        // Namespace prefix without actual title
        ['Talk:', 'title-invalid-empty'],
        ['Talk:#', 'title-invalid-empty'],
        ['Category: ', 'title-invalid-empty'],
        ['Category: #bar', 'title-invalid-empty']];

    invalidTitles.forEach(function(testCase) {
        it('should throw ' + testCase[1] + ' error for ' + testCase[0], function() {
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
        [ ':A' ]
        // Length is 256 total, but only title part matters
        // TODO [ 'Category:' . str_repeat( 'x', 248 ) ],
        // TODO [ str_repeat( 'x', 252 ) ],
    ];

    validTitles.forEach(function(title) {
        it(title[0] + ' should be valid', function() {
            return normalizer.normalize(title[0], 'en.wikipedia.org')
        });
    });
});

