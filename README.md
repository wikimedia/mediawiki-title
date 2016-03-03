# mediawiki-title [![npm version](https://badge.fury.io/js/mediawiki-title.svg)](https://badge.fury.io/js/mediawiki-title) [![Build Status](https://travis-ci.org/wikimedia/mediawiki-title.svg?branch=master)](https://travis-ci.org/wikimedia/mediawiki-title) [![Coverage Status](https://coveralls.io/repos/github/wikimedia/mediawiki-title/badge.svg?branch=master)](https://coveralls.io/github/wikimedia/mediawiki-title?branch=master) [![Dependencies](https://david-dm.org/wikimedia/mediawiki-title.svg?branch=master)](https://david-dm.org/wikimedia/mediawiki-title?branch=master)

Mediawiki title normalizetion, that conforms to the normalization rules used in [MediaWiki Core](https://www.mediawiki.org/wiki/API:Query#Title_normalization).
In general, the page title is converted to the mediawiki DB key format by trimming spaces, replacing whitespace symbols to underscores
and applying wiki-specific capitalizetion rules. The namespace name is converted to a localized canonical name.

<a name="Normalizer"></a>
## Normalizer

* [Normalizer](#Normalizer)
    * [new Normalizer(options)](#new_Normalizer_new)
    * [.normalize(title, domain)](#Normalizer+normalize) ⇒ <code>P.&lt;string&gt;</code>

<a name="new_Normalizer_new"></a>
### new Normalizer(options)
Creates an instance of title normalizer.


| Param | Type | Description |
| --- | --- | --- |
| options | <code>Object</code> | the normalizer options |
| options.getSiteInfo | <code>function</code> | a function                 that takes a domain string and returns back                 the information about the site. The info is cached                 in-memory, so there's no need for external caching. |

<a name="Normalizer+normalize"></a>
### normalizer.normalize(title, domain) ⇒ <code>P.&lt;string&gt;</code>
Normalize a title according to the rules of <domain>

**Kind**: instance method of <code>[Normalizer](#Normalizer)</code>  
**Returns**: <code>P.&lt;string&gt;</code> - normalized version of a title.  
**Access:** public  

| Param | Type | Description |
| --- | --- | --- |
| title | <code>string</code> | the page title to normalize. |
| domain | <code>string</code> | the domain page belongs to. |

<a name="SiteInfo"></a>
## SiteInfo : <code>Object</code>
Information about a wikimedia site required to make correct
normalization.
  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| lang | <code>string</code> | Site language code. |
| legaltitlechars | <code>string</code> | A perl-like regex for characters allowed in the page title. |
| namespaces | <code>Object</code> | Site namespaces info in the same format as returned by PHP api. |
| namespacealiases | <code>Object</code> | Site namespace aliases in the same format as returned by PHP api. |

## Usage

The library returns a [Bluebird](bluebirdjs.com) promise of a normalized title. 
Wiki-specific rules are fetched from the [api](en.wikipedia.org/w/api.php), and
cached within the `Normalizer` instance, so reusing the instance is highly recommended.

```javascript
var normalizer = new Normalizer({
  getSiteInfo: function(domain) { 
    return {
      lang: 'en',
      legaltitlechars: " %!\"$&'()*,\\-.\\/0-9:;=?@A-Z\\\\^_`a-z~\\x80-\\xFF+",
      namespaces: {
      	"0": {
		  id: 0,
          case: "first-letter",
          content: "",
          "*": ""
        },
      }
    }; 
  }
});

normalizer.normalize(title, 'en.wikipedia.org')
.then(function(normalizedTitle) {
  console.log(normalizedTitle);
})
.catch(function(e) {
  console.log('The title is ivalid! ' + e.message);
});
```

## Bug reporting

For bug reporting please use [Phabricator](https://phabricator.wikimedia.org/tag/services/) ]
and mark the bugs with `Servises` label or contuct directly in IRC in the [#wikimedia-services](http://webchat.freenode.net/?channels=wikimedia-services) channel.

