# mediawiki-title [![npm version](https://badge.fury.io/js/mediawiki-title.svg)](https://badge.fury.io/js/mediawiki-title) [![Build Status](https://travis-ci.org/wikimedia/mediawiki-title.svg?branch=master)](https://travis-ci.org/wikimedia/mediawiki-title) [![Coverage Status](https://coveralls.io/repos/github/wikimedia/mediawiki-title/badge.svg?branch=master)](https://coveralls.io/github/wikimedia/mediawiki-title?branch=master) [![Dependencies](https://david-dm.org/wikimedia/mediawiki-title.svg?branch=master)](https://david-dm.org/wikimedia/mediawiki-title?branch=master)

Mediawiki title normalization, that conforms to the normalization rules used in [MediaWiki Core](https://www.mediawiki.org/wiki/API:Query#Title_normalization).
In general, the page title is converted to the mediawiki DB key format by trimming spaces, replacing whitespace symbols to underscores
and applying wiki-specific capitalization rules. The namespace name is converted to a localized canonical name.

## Classes

<dl>
<dt><a href="#Namespace">Namespace</a></dt>
<dd></dd>
<dt><a href="#Title">Title</a></dt>
<dd></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#SiteInfo">SiteInfo</a> : <code>Object</code></dt>
<dd><p>Information about a wikimedia site required to make correct
normalization. This information matches the format used by the
<a href="https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=general%7Cnamespaces%7Cnamespacealiases%7Cspecialpagealiases">PHP API response</a>,
however not all of the fields are required for library operation.</p>
<p>The list of required properties is documented here, others can be removed.</p>
</dd>
</dl>

<a name="Namespace"></a>

## Namespace
**Kind**: global class  

* [Namespace](#Namespace)
    * [new Namespace(id, siteInfo)](#new_Namespace_new)
    * _instance_
        * [.isMedia()](#Namespace++isMedia) ⇒ <code>boolean</code>
        * [.isSpecial()](#Namespace++isSpecial) ⇒ <code>boolean</code>
        * [.isMain()](#Namespace++isMain) ⇒ <code>boolean</code>
        * [.isTalk()](#Namespace++isTalk) ⇒ <code>boolean</code>
        * [.isUserTalk()](#Namespace++isUserTalk) ⇒ <code>boolean</code>
        * [.getNormalizedText()](#Namespace+getNormalizedText) ⇒ <code>string</code>
    * _static_
        * [.fromText(text, siteInfo)](#Namespace.fromText) ⇒ <code>[Namespace](#Namespace)</code> &#124; <code>undefined</code>
        * [.main(siteInfo)](#Namespace.main) ⇒ <code>[Namespace](#Namespace)</code>

<a name="new_Namespace_new"></a>

### new Namespace(id, siteInfo)
Represents a wiki namespace


| Param | Type | Description |
| --- | --- | --- |
| id | <code>number</code> | The namespace identifier |
| siteInfo | <code>[SiteInfo](#SiteInfo)</code> | The site metadata information. |

<a name="Namespace++isMedia"></a>

### namespace.isMedia() ⇒ <code>boolean</code>
Checks whether namespace is `Media`

**Kind**: instance method of <code>[Namespace](#Namespace)</code>  
<a name="Namespace++isSpecial"></a>

### namespace.isSpecial() ⇒ <code>boolean</code>
Checks whether namespace is `Special`

**Kind**: instance method of <code>[Namespace](#Namespace)</code>  
<a name="Namespace++isMain"></a>

### namespace.isMain() ⇒ <code>boolean</code>
Checks whether namespace is `Main`

**Kind**: instance method of <code>[Namespace](#Namespace)</code>  
<a name="Namespace++isTalk"></a>

### namespace.isTalk() ⇒ <code>boolean</code>
Checks whether namespace is `Talk`

**Kind**: instance method of <code>[Namespace](#Namespace)</code>  
<a name="Namespace++isUserTalk"></a>

### namespace.isUserTalk() ⇒ <code>boolean</code>
Checks whether namespace is `UserTalk`

**Kind**: instance method of <code>[Namespace](#Namespace)</code>  
<a name="Namespace+getNormalizedText"></a>

### namespace.getNormalizedText() ⇒ <code>string</code>
Get the canonical name string for this namespace.

**Kind**: instance method of <code>[Namespace](#Namespace)</code>  
<a name="Namespace.fromText"></a>

### Namespace.fromText(text, siteInfo) ⇒ <code>[Namespace](#Namespace)</code> &#124; <code>undefined</code>
Creates a namespace instance from namespace text or a namespace alias

**Kind**: static method of <code>[Namespace](#Namespace)</code>  
**Returns**: <code>[Namespace](#Namespace)</code> &#124; <code>undefined</code> - a namespace or undefined if it wasn't found.  

| Param | Type | Description |
| --- | --- | --- |
| text | <code>string</code> | Namespace name text. |
| siteInfo | <code>[SiteInfo](#SiteInfo)</code> | the site information. |

<a name="Namespace.main"></a>

### Namespace.main(siteInfo) ⇒ <code>[Namespace](#Namespace)</code>
Creates a namespace object for a `Main` namespace.

**Kind**: static method of <code>[Namespace](#Namespace)</code>  

| Param | Type | Description |
| --- | --- | --- |
| siteInfo | <code>[SiteInfo](#SiteInfo)</code> | the site information. |

<a name="Title"></a>

## Title
**Kind**: global class  

* [Title](#Title)
    * [new Title(key, namespace, siteInfo, [fragment])](#new_Title_new)
    * _instance_
        * [.getPrefixedDBKey()](#Title+getPrefixedDBKey) ⇒ <code>string</code>
        * [.getFragment()](#Title+getFragment) ⇒ <code>string</code> &#124; <code>undefined</code>
        * [.getNamespace()](#Title+getNamespace) ⇒ <code>[Namespace](#Namespace)</code>
    * _static_
        * [.newFromText(title, siteInfo, defaultNs)](#Title.newFromText) ⇒ <code>[Title](#Title)</code>

<a name="new_Title_new"></a>

### new Title(key, namespace, siteInfo, [fragment])
Creates a new title object with article the dbKey and namespace


| Param | Type | Description |
| --- | --- | --- |
| key | <code>string</code> | The article title in a form of the dbKey. |
| namespace | <code>[Namespace](#Namespace)</code> &#124; <code>number</code> | The article namespace. |
| siteInfo | <code>[SiteInfo](#SiteInfo)</code> | The site metadata. |
| [fragment] | <code>string</code> | The fragment of the title. |

<a name="Title+getPrefixedDBKey"></a>

### title.getPrefixedDBKey() ⇒ <code>string</code>
Returns the normalized article title and namespace.

**Kind**: instance method of <code>[Title](#Title)</code>  
<a name="Title+getFragment"></a>

### title.getFragment() ⇒ <code>string</code> &#124; <code>undefined</code>
Returns the normalized fragment part of the original title

**Kind**: instance method of <code>[Title](#Title)</code>  
<a name="Title+getNamespace"></a>

### title.getNamespace() ⇒ <code>[Namespace](#Namespace)</code>
Returns the namespace of an article.

**Kind**: instance method of <code>[Title](#Title)</code>  
<a name="Title.newFromText"></a>

### Title.newFromText(title, siteInfo, defaultNs) ⇒ <code>[Title](#Title)</code>
Normalize a title according to the rules of <code>siteInfo</code>

**Kind**: static method of <code>[Title](#Title)</code>  
**Returns**: <code>[Title](#Title)</code> - The resulting title object.  

| Param | Type | Description |
| --- | --- | --- |
| title | <code>string</code> | The page title to normalize. |
| siteInfo | <code>[SiteInfo](#SiteInfo)</code> | The site information. |

<a name="SiteInfo"></a>

## SiteInfo : <code>Object</code>
Information about a wikimedia site required to make correct
normalization. This information matches the format used by the
<a href="https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=general%7Cnamespaces%7Cnamespacealiases%7Cspecialpagealiases">PHP API response</a>,
however not all of the fields are required for library operation.

The list of required properties is documented here, others can be removed.

**Kind**: global typedef  
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| general | <code>Object</code> | General information about the site |
| general.lang | <code>string</code> | Site language code. |
| general.legaltitlechars | <code>string</code> | A perl-like regex for characters allowed in the page title. |
| general.case | <code>string</code> | Whether to capitalize the first letter of the title. Could be obtained from the `general` section of the `siteInfo` php API response. |
| namespaces | <code>Object</code> | Site namespaces info in the same format as returned by PHP api. |
| namespacealiases | <code>Object</code> | Site namespace aliases in the same format as returned by PHP api. |
| specialpagealiases | <code>Object</code> | Site special page aliases in the same format as returned by PHP api. |


## Usage

The library synchronously returns a normalized title. Wiki-specific rules should be fetched from the 
[MediaWiki API](https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=general|namespaces|namespacealiases|specialpagealiases),
and cached outside of the library. The description of the required properties is available in the [SiteInfo](#SiteInfo)
object docs.

```javascript
var result = Title.newFromText('some_title', {
    		general: {
        	lang: 'en',
        	legaltitlechars: " %!\"$&'()*,\\-.\\/0-9:;=?@A-Z\\\\^_`a-z~\\x80-\\xFF+",
        	case: 'first-letter'
    	},
	namespaces: {
		"0": {
			id: 0,
			case: "first-letter",
			content: "",
			"*": ""
			},
		}
});
console.log(result.getPrefixedDBKey());
```

## Bug reporting

For bug reporting please use [Phabricator](https://phabricator.wikimedia.org/tag/services/)
and mark the bugs with `Services` label or contact directly in IRC in the [#wikimedia-services](http://webchat.freenode.net/?channels=wikimedia-services) channel.
