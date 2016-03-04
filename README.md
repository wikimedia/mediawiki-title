# mediawiki-title [![npm version](https://badge.fury.io/js/mediawiki-title.svg)](https://badge.fury.io/js/mediawiki-title) [![Build Status](https://travis-ci.org/wikimedia/mediawiki-title.svg?branch=master)](https://travis-ci.org/wikimedia/mediawiki-title) [![Coverage Status](https://coveralls.io/repos/github/wikimedia/mediawiki-title/badge.svg?branch=master)](https://coveralls.io/github/wikimedia/mediawiki-title?branch=master) [![Dependencies](https://david-dm.org/wikimedia/mediawiki-title.svg?branch=master)](https://david-dm.org/wikimedia/mediawiki-title?branch=master)

Mediawiki title normalizetion, that conforms to the normalization rules used in [MediaWiki Core](https://www.mediawiki.org/wiki/API:Query#Title_normalization).
In general, the page title is converted to the mediawiki DB key format by trimming spaces, replacing whitespace symbols to underscores
and applying wiki-specific capitalizetion rules. The namespace name is converted to a localized canonical name.

## Functions

<dl>
<dt><a href="#normalize">normalize(title, siteInfo)</a> ⇒ <code>string</code></dt>
<dd><p>Normalize a title according to the rules of <domain></p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#SiteInfo">SiteInfo</a> : <code>Object</code></dt>
<dd><p>Information about a wikimedia site required to make correct normalization.</p>
</dd>
</dl>

<a name="normalize"></a>
## normalize(title, siteInfo) ⇒ <code>string</code>
Normalize a title according to the rules of <domain>
  
**Returns**: <code>string</code> - normalized version of a title.  
**Access:** public  

| Param | Type | Description |
| --- | --- | --- |
| title | <code>string</code> | The page title to normalize. |
| siteInfo | <code>[SiteInfo](#SiteInfo)</code> | The site information. |

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
var result = normalizer.normalize('some_title', {
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
});
```

## Bug reporting

For bug reporting please use [Phabricator](https://phabricator.wikimedia.org/tag/services/) ]
and mark the bugs with `Servises` label or contuct directly in IRC in the [#wikimedia-services](http://webchat.freenode.net/?channels=wikimedia-services) channel.

