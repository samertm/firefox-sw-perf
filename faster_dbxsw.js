/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var swToolboxOptions = __webpack_require__(1);
	var swToolboxRouter = __webpack_require__(2);
	var swToolboxListeners = __webpack_require__(8);

	var cacheHelpers = __webpack_require__(10);
	var utils = __webpack_require__(11);
	var routes = __webpack_require__(12);

	var clearCache = __webpack_require__(13);
	var cacheByHeader = __webpack_require__(14);


	function _enableDebugLogging() {
	  var search = self.location.search.toLowerCase();
	  if (search.includes("?debug=true") ||
	      search.includes("&debug=true")) {
	    return true;
	  }
	  return false;
	}

	/**
	 * @returns {?string} the experiment for the service worker, if it exists
	 */
	function _getExperimentVariant() {
	  var search = self.location.search.toLowerCase();
	  if (!search) {
	    return;
	  }

	  var m = /[&?]variant=([^&]*)/g.exec(search);
	  if (!m || !m[1]) {
	    return;
	  }
	  return m[1];
	}

	function main() {
	  if (_enableDebugLogging()) {
	    swToolboxOptions.debug = true;
	  }

	  // Only accept 200s as successful responses for caching.
	  swToolboxOptions.successResponses = /^200$/;

	  // Check if we are running any additional experiment via stormcrow
	  var expVariant = _getExperimentVariant();

	  for (var i = 0; i < routes.clearCacheRouteRegexes.length; i++) {
	    swToolboxRouter.get(routes.clearCacheRouteRegexes[i],
	                        clearCache,
	                        {variant: expVariant});
	    swToolboxRouter.post(routes.clearCacheRouteRegexes[i],
	                        clearCache,
	                        {variant: expVariant});
	  }

	  // Match everything in the whitelist to the cacheByHeader policy
	  // which allow the server to specify versioning.
	  for (var i = 0; i < routes.whitelistRouteRegexes.length; i++) {
	    // Routes in the whitelist should really be only GET operations
	    // Including the pagelet calls
	    swToolboxRouter.get(routes.whitelistRouteRegexes[i],
	                        cacheByHeader,
	                        {variant: expVariant});
	  }
	}

	self.addEventListener("install", function(event) {
	  event.waitUntil(cacheHelpers.deleteAllCaches('$$$toolbox-cache$$$'));
	  event.waitUntil(self.skipWaiting());
	  // Do not call sw-toolbox's install listener, which just sets up
	  // precached items.
	});

	self.addEventListener("activate", function(event) {
	  event.waitUntil(self.clients.claim());
	  // Do not call sw-toolbox's activate listener, which just sets up
	  // precached items.
	});

	self.addEventListener("fetch", function(event) {
          if (event.request.mode !== 'navigate') {
            return;
          }

	  // Don't process non-whitelisted urls, so they don't get fetched by
	  // the service worker.
	  if (!routes.isWhitelistedURL(event.request.url)) {
	    return;
	  }

	  swToolboxListeners.fetchListener(event);
	});

	main();


/***/ },
/* 1 */
/***/ function(module, exports) {

	/*
		Copyright 2015 Google Inc. All Rights Reserved.

		Licensed under the Apache License, Version 2.0 (the "License");
		you may not use this file except in compliance with the License.
		You may obtain a copy of the License at

	      http://www.apache.org/licenses/LICENSE-2.0

		Unless required by applicable law or agreed to in writing, software
		distributed under the License is distributed on an "AS IS" BASIS,
		WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
		See the License for the specific language governing permissions and
		limitations under the License.
	*/
	'use strict';

	// TODO: This is necessary to handle different implementations in the wild
	// The spec defines self.registration, but it was not implemented in Chrome 40.
	var scope;
	if (self.registration) {
	  scope = self.registration.scope;
	} else {
	  scope = self.scope || new URL('./', self.location).href;
	}

	module.exports = {
	  cache: {
	    name: '$$$toolbox-cache$$$' + scope + '$$$',
	    maxAgeSeconds: null,
	    maxEntries: null
	  },
	  debug: false,
	  networkTimeoutSeconds: null,
	  preCacheItems: [],
	  // A regular expression to apply to HTTP response codes. Codes that match
	  // will be considered successes, while others will not, and will not be
	  // cached.
	  successResponses: /^0|([123]\d\d)|(40[14567])|410$/
	};


/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/*
	  Copyright 2014 Google Inc. All Rights Reserved.

	  Licensed under the Apache License, Version 2.0 (the "License");
	  you may not use this file except in compliance with the License.
	  You may obtain a copy of the License at

	      http://www.apache.org/licenses/LICENSE-2.0

	  Unless required by applicable law or agreed to in writing, software
	  distributed under the License is distributed on an "AS IS" BASIS,
	  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	  See the License for the specific language governing permissions and
	  limitations under the License.
	*/
	'use strict';

	var Route = __webpack_require__(3);
	var helpers = __webpack_require__(6);

	function regexEscape(s) {
	  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
	}

	var keyMatch = function(map, string) {
	  // This would be better written as a for..of loop, but that would break the
	  // minifyify process in the build.
	  var entriesIterator = map.entries();
	  var item = entriesIterator.next();
	  var matches = [];
	  while (!item.done) {
	    var pattern = new RegExp(item.value[0]);
	    if (pattern.test(string)) {
	      matches.push(item.value[1]);
	    }
	    item = entriesIterator.next();
	  }
	  return matches;
	};

	var Router = function() {
	  this.routes = new Map();
	  // Create the dummy origin for RegExp-based routes
	  this.routes.set(RegExp, new Map());
	  this.default = null;
	};

	['get', 'post', 'put', 'delete', 'head', 'any'].forEach(function(method) {
	  Router.prototype[method] = function(path, handler, options) {
	    return this.add(method, path, handler, options);
	  };
	});

	Router.prototype.add = function(method, path, handler, options) {
	  options = options || {};
	  var origin;

	  if (path instanceof RegExp) {
	    // We need a unique key to use in the Map to distinguish RegExp paths
	    // from Express-style paths + origins. Since we can use any object as the
	    // key in a Map, let's use the RegExp constructor!
	    origin = RegExp;
	  } else {
	    origin = options.origin || self.location.origin;
	    if (origin instanceof RegExp) {
	      origin = origin.source;
	    } else {
	      origin = regexEscape(origin);
	    }
	  }

	  method = method.toLowerCase();

	  var route = new Route(method, path, handler, options);

	  if (!this.routes.has(origin)) {
	    this.routes.set(origin, new Map());
	  }

	  var methodMap = this.routes.get(origin);
	  if (!methodMap.has(method)) {
	    methodMap.set(method, new Map());
	  }

	  var routeMap = methodMap.get(method);
	  var regExp = route.regexp || route.fullUrlRegExp;

	  if (routeMap.has(regExp.source)) {
	    helpers.debug('"' + path + '" resolves to same regex as existing route.');
	  }

	  routeMap.set(regExp.source, route);
	};

	Router.prototype.matchMethod = function(method, url) {
	  var urlObject = new URL(url);
	  var origin = urlObject.origin;
	  var path = urlObject.pathname;

	  // We want to first check to see if there's a match against any
	  // "Express-style" routes (string for the path, RegExp for the origin).
	  // Checking for Express-style matches first maintains the legacy behavior.
	  // If there's no match, we next check for a match against any RegExp routes,
	  // where the RegExp in question matches the full URL (both origin and path).
	  return this._match(method, keyMatch(this.routes, origin), path) ||
	    this._match(method, [this.routes.get(RegExp)], url);
	};

	Router.prototype._match = function(method, methodMaps, pathOrUrl) {
	  if (methodMaps.length === 0) {
	    return null;
	  }

	  for (var i = 0; i < methodMaps.length; i++) {
	    var methodMap = methodMaps[i];
	    var routeMap = methodMap && methodMap.get(method.toLowerCase());
	    if (routeMap) {
	      var routes = keyMatch(routeMap, pathOrUrl);
	      if (routes.length > 0) {
	        return routes[0].makeHandler(pathOrUrl);
	      }
	    }
	  }

	  return null;
	};

	Router.prototype.match = function(request) {
	  return this.matchMethod(request.method, request.url) ||
	      this.matchMethod('any', request.url);
	};

	module.exports = new Router();


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	/*
	  Copyright 2014 Google Inc. All Rights Reserved.

	  Licensed under the Apache License, Version 2.0 (the "License");
	  you may not use this file except in compliance with the License.
	  You may obtain a copy of the License at

	      http://www.apache.org/licenses/LICENSE-2.0

	  Unless required by applicable law or agreed to in writing, software
	  distributed under the License is distributed on an "AS IS" BASIS,
	  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	  See the License for the specific language governing permissions and
	  limitations under the License.
	*/
	'use strict';

	// TODO: Use self.registration.scope instead of self.location
	var url = new URL('./', self.location);
	var basePath = url.pathname;
	var pathRegexp = __webpack_require__(4);

	var Route = function(method, path, handler, options) {
	  if (path instanceof RegExp) {
	    this.fullUrlRegExp = path;
	  } else {
	    // The URL() constructor can't parse express-style routes as they are not
	    // valid urls. This means we have to manually manipulate relative urls into
	    // absolute ones. This check is extremely naive but implementing a tweaked
	    // version of the full algorithm seems like overkill
	    // (https://url.spec.whatwg.org/#concept-basic-url-parser)
	    if (path.indexOf('/') !== 0) {
	      path = basePath + path;
	    }

	    this.keys = [];
	    this.regexp = pathRegexp(path, this.keys);
	  }

	  this.method = method;
	  this.options = options;
	  this.handler = handler;
	};

	Route.prototype.makeHandler = function(url, waitUntilCallback) {
	  var values;
	  if (this.regexp) {
	    var match = this.regexp.exec(url);
	    values = {};
	    this.keys.forEach(function(key, index) {
	      values[key.name] = match[index + 1];
	    });
	  }

	  return function(request) {
	    return this.handler(request, values, this.options, waitUntilCallback);
	  }.bind(this);
	};

	module.exports = Route;


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var isarray = __webpack_require__(5)

	/**
	 * Expose `pathToRegexp`.
	 */
	module.exports = pathToRegexp
	module.exports.parse = parse
	module.exports.compile = compile
	module.exports.tokensToFunction = tokensToFunction
	module.exports.tokensToRegExp = tokensToRegExp

	/**
	 * The main path matching regexp utility.
	 *
	 * @type {RegExp}
	 */
	var PATH_REGEXP = new RegExp([
	  // Match escaped characters that would otherwise appear in future matches.
	  // This allows the user to escape special characters that won't transform.
	  '(\\\\.)',
	  // Match Express-style parameters and un-named parameters with a prefix
	  // and optional suffixes. Matches appear as:
	  //
	  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
	  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
	  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
	  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?|(\\*))'
	].join('|'), 'g')

	/**
	 * Parse a string for the raw tokens.
	 *
	 * @param  {string} str
	 * @return {!Array}
	 */
	function parse (str) {
	  var tokens = []
	  var key = 0
	  var index = 0
	  var path = ''
	  var res

	  while ((res = PATH_REGEXP.exec(str)) != null) {
	    var m = res[0]
	    var escaped = res[1]
	    var offset = res.index
	    path += str.slice(index, offset)
	    index = offset + m.length

	    // Ignore already escaped sequences.
	    if (escaped) {
	      path += escaped[1]
	      continue
	    }

	    var next = str[index]
	    var prefix = res[2]
	    var name = res[3]
	    var capture = res[4]
	    var group = res[5]
	    var modifier = res[6]
	    var asterisk = res[7]

	    // Push the current path onto the tokens.
	    if (path) {
	      tokens.push(path)
	      path = ''
	    }

	    var partial = prefix != null && next != null && next !== prefix
	    var repeat = modifier === '+' || modifier === '*'
	    var optional = modifier === '?' || modifier === '*'
	    var delimiter = res[2] || '/'
	    var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?')

	    tokens.push({
	      name: name || key++,
	      prefix: prefix || '',
	      delimiter: delimiter,
	      optional: optional,
	      repeat: repeat,
	      partial: partial,
	      asterisk: !!asterisk,
	      pattern: escapeGroup(pattern)
	    })
	  }

	  // Match any characters still remaining.
	  if (index < str.length) {
	    path += str.substr(index)
	  }

	  // If the path exists, push it onto the end.
	  if (path) {
	    tokens.push(path)
	  }

	  return tokens
	}

	/**
	 * Compile a string to a template function for the path.
	 *
	 * @param  {string}             str
	 * @return {!function(Object=, Object=)}
	 */
	function compile (str) {
	  return tokensToFunction(parse(str))
	}

	/**
	 * Prettier encoding of URI path segments.
	 *
	 * @param  {string}
	 * @return {string}
	 */
	function encodeURIComponentPretty (str) {
	  return encodeURI(str).replace(/[\/?#]/g, function (c) {
	    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
	  })
	}

	/**
	 * Encode the asterisk parameter. Similar to `pretty`, but allows slashes.
	 *
	 * @param  {string}
	 * @return {string}
	 */
	function encodeAsterisk (str) {
	  return encodeURI(str).replace(/[?#]/g, function (c) {
	    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
	  })
	}

	/**
	 * Expose a method for transforming tokens into the path function.
	 */
	function tokensToFunction (tokens) {
	  // Compile all the tokens into regexps.
	  var matches = new Array(tokens.length)

	  // Compile all the patterns before compilation.
	  for (var i = 0; i < tokens.length; i++) {
	    if (typeof tokens[i] === 'object') {
	      matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$')
	    }
	  }

	  return function (obj, opts) {
	    var path = ''
	    var data = obj || {}
	    var options = opts || {}
	    var encode = options.pretty ? encodeURIComponentPretty : encodeURIComponent

	    for (var i = 0; i < tokens.length; i++) {
	      var token = tokens[i]

	      if (typeof token === 'string') {
	        path += token

	        continue
	      }

	      var value = data[token.name]
	      var segment

	      if (value == null) {
	        if (token.optional) {
	          // Prepend partial segment prefixes.
	          if (token.partial) {
	            path += token.prefix
	          }

	          continue
	        } else {
	          throw new TypeError('Expected "' + token.name + '" to be defined')
	        }
	      }

	      if (isarray(value)) {
	        if (!token.repeat) {
	          throw new TypeError('Expected "' + token.name + '" to not repeat, but received `' + JSON.stringify(value) + '`')
	        }

	        if (value.length === 0) {
	          if (token.optional) {
	            continue
	          } else {
	            throw new TypeError('Expected "' + token.name + '" to not be empty')
	          }
	        }

	        for (var j = 0; j < value.length; j++) {
	          segment = encode(value[j])

	          if (!matches[i].test(segment)) {
	            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received `' + JSON.stringify(segment) + '`')
	          }

	          path += (j === 0 ? token.prefix : token.delimiter) + segment
	        }

	        continue
	      }

	      segment = token.asterisk ? encodeAsterisk(value) : encode(value)

	      if (!matches[i].test(segment)) {
	        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
	      }

	      path += token.prefix + segment
	    }

	    return path
	  }
	}

	/**
	 * Escape a regular expression string.
	 *
	 * @param  {string} str
	 * @return {string}
	 */
	function escapeString (str) {
	  return str.replace(/([.+*?=^!:${}()[\]|\/\\])/g, '\\$1')
	}

	/**
	 * Escape the capturing group by escaping special characters and meaning.
	 *
	 * @param  {string} group
	 * @return {string}
	 */
	function escapeGroup (group) {
	  return group.replace(/([=!:$\/()])/g, '\\$1')
	}

	/**
	 * Attach the keys as a property of the regexp.
	 *
	 * @param  {!RegExp} re
	 * @param  {Array}   keys
	 * @return {!RegExp}
	 */
	function attachKeys (re, keys) {
	  re.keys = keys
	  return re
	}

	/**
	 * Get the flags for a regexp from the options.
	 *
	 * @param  {Object} options
	 * @return {string}
	 */
	function flags (options) {
	  return options.sensitive ? '' : 'i'
	}

	/**
	 * Pull out keys from a regexp.
	 *
	 * @param  {!RegExp} path
	 * @param  {!Array}  keys
	 * @return {!RegExp}
	 */
	function regexpToRegexp (path, keys) {
	  // Use a negative lookahead to match only capturing groups.
	  var groups = path.source.match(/\((?!\?)/g)

	  if (groups) {
	    for (var i = 0; i < groups.length; i++) {
	      keys.push({
	        name: i,
	        prefix: null,
	        delimiter: null,
	        optional: false,
	        repeat: false,
	        partial: false,
	        asterisk: false,
	        pattern: null
	      })
	    }
	  }

	  return attachKeys(path, keys)
	}

	/**
	 * Transform an array into a regexp.
	 *
	 * @param  {!Array}  path
	 * @param  {Array}   keys
	 * @param  {!Object} options
	 * @return {!RegExp}
	 */
	function arrayToRegexp (path, keys, options) {
	  var parts = []

	  for (var i = 0; i < path.length; i++) {
	    parts.push(pathToRegexp(path[i], keys, options).source)
	  }

	  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options))

	  return attachKeys(regexp, keys)
	}

	/**
	 * Create a path regexp from string input.
	 *
	 * @param  {string}  path
	 * @param  {!Array}  keys
	 * @param  {!Object} options
	 * @return {!RegExp}
	 */
	function stringToRegexp (path, keys, options) {
	  var tokens = parse(path)
	  var re = tokensToRegExp(tokens, options)

	  // Attach keys back to the regexp.
	  for (var i = 0; i < tokens.length; i++) {
	    if (typeof tokens[i] !== 'string') {
	      keys.push(tokens[i])
	    }
	  }

	  return attachKeys(re, keys)
	}

	/**
	 * Expose a function for taking tokens and returning a RegExp.
	 *
	 * @param  {!Array}  tokens
	 * @param  {Object=} options
	 * @return {!RegExp}
	 */
	function tokensToRegExp (tokens, options) {
	  options = options || {}

	  var strict = options.strict
	  var end = options.end !== false
	  var route = ''
	  var lastToken = tokens[tokens.length - 1]
	  var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken)

	  // Iterate over the tokens and create our regexp string.
	  for (var i = 0; i < tokens.length; i++) {
	    var token = tokens[i]

	    if (typeof token === 'string') {
	      route += escapeString(token)
	    } else {
	      var prefix = escapeString(token.prefix)
	      var capture = '(?:' + token.pattern + ')'

	      if (token.repeat) {
	        capture += '(?:' + prefix + capture + ')*'
	      }

	      if (token.optional) {
	        if (!token.partial) {
	          capture = '(?:' + prefix + '(' + capture + '))?'
	        } else {
	          capture = prefix + '(' + capture + ')?'
	        }
	      } else {
	        capture = prefix + '(' + capture + ')'
	      }

	      route += capture
	    }
	  }

	  // In non-strict mode we allow a slash at the end of match. If the path to
	  // match already ends with a slash, we remove it for consistency. The slash
	  // is valid at the end of a path match, not in the middle. This is important
	  // in non-ending mode, where "/test/" shouldn't match "/test//route".
	  if (!strict) {
	    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
	  }

	  if (end) {
	    route += '$'
	  } else {
	    // In non-ending mode, we need the capturing groups to match as much as
	    // possible by using a positive lookahead to the end or next path segment.
	    route += strict && endsWithSlash ? '' : '(?=\\/|$)'
	  }

	  return new RegExp('^' + route, flags(options))
	}

	/**
	 * Normalize the given path string, returning a regular expression.
	 *
	 * An empty array can be passed in for the keys, which will hold the
	 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
	 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
	 *
	 * @param  {(string|RegExp|Array)} path
	 * @param  {(Array|Object)=}       keys
	 * @param  {Object=}               options
	 * @return {!RegExp}
	 */
	function pathToRegexp (path, keys, options) {
	  keys = keys || []

	  if (!isarray(keys)) {
	    options = /** @type {!Object} */ (keys)
	    keys = []
	  } else if (!options) {
	    options = {}
	  }

	  if (path instanceof RegExp) {
	    return regexpToRegexp(path, /** @type {!Array} */ (keys))
	  }

	  if (isarray(path)) {
	    return arrayToRegexp(/** @type {!Array} */ (path), /** @type {!Array} */ (keys), options)
	  }

	  return stringToRegexp(/** @type {string} */ (path), /** @type {!Array} */ (keys), options)
	}


/***/ },
/* 5 */
/***/ function(module, exports) {

	module.exports = Array.isArray || function (arr) {
	  return Object.prototype.toString.call(arr) == '[object Array]';
	};


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	/*
	  Copyright 2014 Google Inc. All Rights Reserved.

	  Licensed under the Apache License, Version 2.0 (the "License");
	  you may not use this file except in compliance with the License.
	  You may obtain a copy of the License at

	      http://www.apache.org/licenses/LICENSE-2.0

	  Unless required by applicable law or agreed to in writing, software
	  distributed under the License is distributed on an "AS IS" BASIS,
	  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	  See the License for the specific language governing permissions and
	  limitations under the License.
	*/
	'use strict';

	var globalOptions = __webpack_require__(1);
	var idbCacheExpiration = __webpack_require__(7);

	function debug(message, options) {
	  options = options || {};
	  var flag = options.debug || globalOptions.debug;
	  if (flag) {
	    console.log('[sw-toolbox] ' + message);
	  }
	}

	function openCache(options) {
	  var cacheName;
	  if (options && options.cache) {
	    cacheName = options.cache.name;
	  }
	  cacheName = cacheName || globalOptions.cache.name;

	  return caches.open(cacheName);
	}

	function fetchAndCache(request, options) {
	  options = options || {};
	  var successResponses = options.successResponses ||
	      globalOptions.successResponses;

	  return fetch(request.clone()).then(function(response) {
	    // Only cache GET requests with successful responses.
	    // Since this is not part of the promise chain, it will be done
	    // asynchronously and will not block the response from being returned to the
	    // page.
	    if (request.method === 'GET' && successResponses.test(response.status)) {
	      openCache(options).then(function(cache) {
	        cache.put(request, response).then(function() {
	          // If any of the options are provided in options.cache then use them.
	          // Do not fallback to the global options for any that are missing
	          // unless they are all missing.
	          var cacheOptions = options.cache || globalOptions.cache;

	          // Only run the cache expiration logic if at least one of the maximums
	          // is set, and if we have a name for the cache that the options are
	          // being applied to.
	          if ((cacheOptions.maxEntries || cacheOptions.maxAgeSeconds) &&
	              cacheOptions.name) {
	            queueCacheExpiration(request, cache, cacheOptions);
	          }
	        });
	      });
	    }

	    return response.clone();
	  });
	}

	var cleanupQueue;
	function queueCacheExpiration(request, cache, cacheOptions) {
	  var cleanup = cleanupCache.bind(null, request, cache, cacheOptions);

	  if (cleanupQueue) {
	    cleanupQueue = cleanupQueue.then(cleanup);
	  } else {
	    cleanupQueue = cleanup();
	  }
	}

	function cleanupCache(request, cache, cacheOptions) {
	  var requestUrl = request.url;
	  var maxAgeSeconds = cacheOptions.maxAgeSeconds;
	  var maxEntries = cacheOptions.maxEntries;
	  var cacheName = cacheOptions.name;

	  var now = Date.now();
	  debug('Updating LRU order for ' + requestUrl + '. Max entries is ' +
	    maxEntries + ', max age is ' + maxAgeSeconds);

	  return idbCacheExpiration.getDb(cacheName).then(function(db) {
	    return idbCacheExpiration.setTimestampForUrl(db, requestUrl, now);
	  }).then(function(db) {
	    return idbCacheExpiration.expireEntries(db, maxEntries, maxAgeSeconds, now);
	  }).then(function(urlsToDelete) {
	    debug('Successfully updated IDB.');

	    var deletionPromises = urlsToDelete.map(function(urlToDelete) {
	      return cache.delete(urlToDelete);
	    });

	    return Promise.all(deletionPromises).then(function() {
	      debug('Done with cache cleanup.');
	    });
	  }).catch(function(error) {
	    debug(error);
	  });
	}

	function renameCache(source, destination, options) {
	  debug('Renaming cache: [' + source + '] to [' + destination + ']', options);
	  return caches.delete(destination).then(function() {
	    return Promise.all([
	      caches.open(source),
	      caches.open(destination)
	    ]).then(function(results) {
	      var sourceCache = results[0];
	      var destCache = results[1];

	      return sourceCache.keys().then(function(requests) {
	        return Promise.all(requests.map(function(request) {
	          return sourceCache.match(request).then(function(response) {
	            return destCache.put(request, response);
	          });
	        }));
	      }).then(function() {
	        return caches.delete(source);
	      });
	    });
	  });
	}

	function cache(url, options) {
	  return openCache(options).then(function(cache) {
	    return cache.add(url);
	  });
	}

	function uncache(url, options) {
	  return openCache(options).then(function(cache) {
	    return cache.delete(url);
	  });
	}

	function precache(items) {
	  if (!(items instanceof Promise)) {
	    validatePrecacheInput(items);
	  }

	  globalOptions.preCacheItems = globalOptions.preCacheItems.concat(items);
	}

	function validatePrecacheInput(items) {
	  var isValid = Array.isArray(items);
	  if (isValid) {
	    items.forEach(function(item) {
	      if (!(typeof item === 'string' || (item instanceof Request))) {
	        isValid = false;
	      }
	    });
	  }

	  if (!isValid) {
	    throw new TypeError('The precache method expects either an array of ' +
	    'strings and/or Requests or a Promise that resolves to an array of ' +
	    'strings and/or Requests.');
	  }

	  return items;
	}

	module.exports = {
	  debug: debug,
	  fetchAndCache: fetchAndCache,
	  openCache: openCache,
	  renameCache: renameCache,
	  cache: cache,
	  uncache: uncache,
	  precache: precache,
	  validatePrecacheInput: validatePrecacheInput
	};


/***/ },
/* 7 */
/***/ function(module, exports) {

	/*
	 Copyright 2015 Google Inc. All Rights Reserved.

	 Licensed under the Apache License, Version 2.0 (the "License");
	 you may not use this file except in compliance with the License.
	 You may obtain a copy of the License at

	     http://www.apache.org/licenses/LICENSE-2.0

	 Unless required by applicable law or agreed to in writing, software
	 distributed under the License is distributed on an "AS IS" BASIS,
	 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 See the License for the specific language governing permissions and
	 limitations under the License.
	*/
	'use strict';

	var DB_PREFIX = 'sw-toolbox-';
	var DB_VERSION = 1;
	var STORE_NAME = 'store';
	var URL_PROPERTY = 'url';
	var TIMESTAMP_PROPERTY = 'timestamp';
	var cacheNameToDbPromise = {};

	function openDb(cacheName) {
	  return new Promise(function(resolve, reject) {
	    var request = indexedDB.open(DB_PREFIX + cacheName, DB_VERSION);

	    request.onupgradeneeded = function() {
	      var objectStore = request.result.createObjectStore(STORE_NAME,
	          {keyPath: URL_PROPERTY});
	      objectStore.createIndex(TIMESTAMP_PROPERTY, TIMESTAMP_PROPERTY,
	          {unique: false});
	    };

	    request.onsuccess = function() {
	      resolve(request.result);
	    };

	    request.onerror = function() {
	      reject(request.error);
	    };
	  });
	}

	function getDb(cacheName) {
	  if (!(cacheName in cacheNameToDbPromise)) {
	    cacheNameToDbPromise[cacheName] = openDb(cacheName);
	  }

	  return cacheNameToDbPromise[cacheName];
	}

	function setTimestampForUrl(db, url, now) {
	  return new Promise(function(resolve, reject) {
	    var transaction = db.transaction(STORE_NAME, 'readwrite');
	    var objectStore = transaction.objectStore(STORE_NAME);
	    objectStore.put({url: url, timestamp: now});

	    transaction.oncomplete = function() {
	      resolve(db);
	    };

	    transaction.onabort = function() {
	      reject(transaction.error);
	    };
	  });
	}

	function expireOldEntries(db, maxAgeSeconds, now) {
	  // Bail out early by resolving with an empty array if we're not using
	  // maxAgeSeconds.
	  if (!maxAgeSeconds) {
	    return Promise.resolve([]);
	  }

	  return new Promise(function(resolve, reject) {
	    var maxAgeMillis = maxAgeSeconds * 1000;
	    var urls = [];

	    var transaction = db.transaction(STORE_NAME, 'readwrite');
	    var objectStore = transaction.objectStore(STORE_NAME);
	    var index = objectStore.index(TIMESTAMP_PROPERTY);

	    index.openCursor().onsuccess = function(cursorEvent) {
	      var cursor = cursorEvent.target.result;
	      if (cursor) {
	        if (now - maxAgeMillis > cursor.value[TIMESTAMP_PROPERTY]) {
	          var url = cursor.value[URL_PROPERTY];
	          urls.push(url);
	          objectStore.delete(url);
	          cursor.continue();
	        }
	      }
	    };

	    transaction.oncomplete = function() {
	      resolve(urls);
	    };

	    transaction.onabort = reject;
	  });
	}

	function expireExtraEntries(db, maxEntries) {
	  // Bail out early by resolving with an empty array if we're not using
	  // maxEntries.
	  if (!maxEntries) {
	    return Promise.resolve([]);
	  }

	  return new Promise(function(resolve, reject) {
	    var urls = [];

	    var transaction = db.transaction(STORE_NAME, 'readwrite');
	    var objectStore = transaction.objectStore(STORE_NAME);
	    var index = objectStore.index(TIMESTAMP_PROPERTY);

	    var countRequest = index.count();
	    index.count().onsuccess = function() {
	      var initialCount = countRequest.result;

	      if (initialCount > maxEntries) {
	        index.openCursor().onsuccess = function(cursorEvent) {
	          var cursor = cursorEvent.target.result;
	          if (cursor) {
	            var url = cursor.value[URL_PROPERTY];
	            urls.push(url);
	            objectStore.delete(url);
	            if (initialCount - urls.length > maxEntries) {
	              cursor.continue();
	            }
	          }
	        };
	      }
	    };

	    transaction.oncomplete = function() {
	      resolve(urls);
	    };

	    transaction.onabort = reject;
	  });
	}

	function expireEntries(db, maxEntries, maxAgeSeconds, now) {
	  return expireOldEntries(db, maxAgeSeconds, now).then(function(oldUrls) {
	    return expireExtraEntries(db, maxEntries).then(function(extraUrls) {
	      return oldUrls.concat(extraUrls);
	    });
	  });
	}

	module.exports = {
	  getDb: getDb,
	  setTimestampForUrl: setTimestampForUrl,
	  expireEntries: expireEntries
	};


/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	/*
	  Copyright 2014 Google Inc. All Rights Reserved.

	  Licensed under the Apache License, Version 2.0 (the "License");
	  you may not use this file except in compliance with the License.
	  You may obtain a copy of the License at

	      http://www.apache.org/licenses/LICENSE-2.0

	  Unless required by applicable law or agreed to in writing, software
	  distributed under the License is distributed on an "AS IS" BASIS,
	  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	  See the License for the specific language governing permissions and
	  limitations under the License.
	*/
	'use strict';

	// For cache.addAll.
	__webpack_require__(9);

	var helpers = __webpack_require__(6);
	var router = __webpack_require__(2);
	var options = __webpack_require__(1);

	// Event listeners

	function fetchListener(event) {
	  var handler = router.match(event.request);
	  // event.waitUntil needs to be called synchronously, so we create a
	  // promise that isn't fulfilled until the handler calls it.
	  var waitUntilCallback;
	  event.waitUntil(new Promise((resolve) => {
	    waitUntilCallback = function() {
	      resolve();
	    }
	  }));
	  // At this point, waitUntilCallback is defined because the Promise
	  // callback is run synchronously.

	  if (handler) {
	    event.respondWith(handler(event.request, waitUntilCallback));
	  } else if (router.default &&
	    event.request.method === 'GET' &&
	    // Ensure that chrome-extension:// requests don't trigger the default route.
	    event.request.url.indexOf('http') === 0) {
	    event.respondWith(router.default(event.request));
	  }
	}

	function activateListener(event) {
	  helpers.debug('activate event fired');
	  var inactiveCache = options.cache.name + '$$$inactive$$$';
	  event.waitUntil(helpers.renameCache(inactiveCache, options.cache.name));
	}

	function flatten(items) {
	  return items.reduce(function(a, b) {
	    return a.concat(b);
	  }, []);
	}

	function installListener(event) {
	  var inactiveCache = options.cache.name + '$$$inactive$$$';
	  helpers.debug('install event fired');
	  helpers.debug('creating cache [' + inactiveCache + ']');
	  event.waitUntil(
	    helpers.openCache({cache: {name: inactiveCache}})
	    .then(function(cache) {
	      return Promise.all(options.preCacheItems)
	      .then(flatten)
	      .then(helpers.validatePrecacheInput)
	      .then(function(preCacheItems) {
	        helpers.debug('preCache list: ' +
	              (preCacheItems.join(', ') || '(none)'));
	        return cache.addAll(preCacheItems);
	      });
	    })
	  );
	}

	module.exports = {
	  fetchListener: fetchListener,
	  activateListener: activateListener,
	  installListener: installListener
	};


/***/ },
/* 9 */
/***/ function(module, exports) {

	/**
	 * Copyright 2015 Google Inc. All rights reserved.
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 *
	 */

	(function() {
	  var nativeAddAll = Cache.prototype.addAll;
	  var userAgent = navigator.userAgent.match(/(Firefox|Chrome)\/(\d+\.)/);

	  // Has nice behavior of `var` which everyone hates
	  if (userAgent) {
	    var agent = userAgent[1];
	    var version = parseInt(userAgent[2]);
	  }

	  if (
	    nativeAddAll && (!userAgent ||
	      (agent === 'Firefox' && version >= 46) ||
	      (agent === 'Chrome'  && version >= 50)
	    )
	  ) {
	    return;
	  }

	  Cache.prototype.addAll = function addAll(requests) {
	    var cache = this;

	    // Since DOMExceptions are not constructable:
	    function NetworkError(message) {
	      this.name = 'NetworkError';
	      this.code = 19;
	      this.message = message;
	    }

	    NetworkError.prototype = Object.create(Error.prototype);

	    return Promise.resolve().then(function() {
	      if (arguments.length < 1) throw new TypeError();

	      // Simulate sequence<(Request or USVString)> binding:
	      var sequence = [];

	      requests = requests.map(function(request) {
	        if (request instanceof Request) {
	          return request;
	        }
	        else {
	          return String(request); // may throw TypeError
	        }
	      });

	      return Promise.all(
	        requests.map(function(request) {
	          if (typeof request === 'string') {
	            request = new Request(request);
	          }

	          var scheme = new URL(request.url).protocol;

	          if (scheme !== 'http:' && scheme !== 'https:') {
	            throw new NetworkError("Invalid scheme");
	          }

	          return fetch(request.clone());
	        })
	      );
	    }).then(function(responses) {
	      // If some of the responses has not OK-eish status,
	      // then whole operation should reject
	      if (responses.some(function(response) {
	        return !response.ok;
	      })) {
	        throw new NetworkError('Incorrect response status');
	      }

	      // TODO: check that requests don't overwrite one another
	      // (don't think this is possible to polyfill due to opaque responses)
	      return Promise.all(
	        responses.map(function(response, i) {
	          return cache.put(requests[i], response);
	        })
	      );
	    }).then(function() {
	      return undefined;
	    });
	  };

	  Cache.prototype.add = function add(request) {
	    return this.addAll([request]);
	  };
	}());

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	/**
	 * Contains helper functions for interfacing with the cache. Augments
	 * sw-toolbox/helpers, which also contains some cache helper
	 * functions.
	 */
	var globalOptions = __webpack_require__(1);
	var helpers = __webpack_require__(6);

	/**
	 * Delete all caches.
	 *
	 * @param {?string} cachePrefix - deletes all caches with this prefix.
	 * @returns {Promise} - A promise that deletes all caches.
	 */
	function deleteAllCaches(cachePrefix) {
	  return caches.keys().then(function(keys) {
	    return Promise.all(keys.map(function(key) {
	      if (!cachePrefix || key.startsWith(cachePrefix)) {
	        return caches.delete(key);
	      }
	    }));
	  });
	}

	/**
	 * Delete one cache.
	 *
	 * @param {string} options.cache.name - The cache to delete, otherwise
	 * deletes the sw-toolbox cache.
	 * @returns {Promise} - a promise that deletes one cache.
	 */
	function deleteCache(options) {
	  var cacheName;
	  if (options && options.cache) {
	    cacheName = options.cache.name;
	  }
	  cacheName = cacheName || globalOptions.cache.name;

	  return caches.delete(cacheName);
	}

	// Map from headers to field names. See "strategy/cacheByHeader"
	// docstring for more details on what each field means. All fields are
	// required for a response to be considered cacheable.
	var _cacheHeaderToField = [
	  { headerName: 'X-Service-Worker-Cache-Name', fieldName: 'name' },
	  { headerName: 'X-Service-Worker-Cache-Version', fieldName: 'version' },
	  { headerName: 'X-Service-Worker-Cache-Min-Version', fieldName: 'minVersion' },
	];

	var _numericCacheField = {
	  'version': true,
	  'minVersion': true,
	};

	/**
	 * Gets the cache info related to a response. Returns null if the
	 * response is not cacheable.
	 */
	function getCacheHeaderInfo(response) {
	  var info = {};
	  var headers = response.headers;

	  for (var i = 0; i < _cacheHeaderToField.length; i++) {
	    var h = _cacheHeaderToField[i].headerName;
	    var field = _cacheHeaderToField[i].fieldName;
	    var v = headers.get(h);
	    if (v === null) {
	      // If we've already seen 'name', that means this header is
	      // malformed.
	      if (info.name) {
	        helpers.debug("Header malformed, missing header: " + h);
	      }
	      return null;
	    }

	    // Convert numeric fields to numbers.
	    if (_numericCacheField[field]) {
	      var newV = parseInt(v, 10);
	      if (isNaN(newV)) {
	        helpers.debug("Header malformed, could not convert header '" + h + "' to number: " + v)
	        return null;
	      }
	      v = newV;
	    }

	    info[field] = v;
	  }
	  return info;
	}



	module.exports = {
	  deleteAllCaches: deleteAllCaches,
	  deleteCache: deleteCache,
	  getCacheHeaderInfo: getCacheHeaderInfo,
	};


/***/ },
/* 11 */
/***/ function(module, exports) {

	'use strict';

	var _cacheKeys = [
	  'role',
	  'stormcrow_override',
	];

	var _routesToStrip = [
	  '/home',
	  '/personal',
	  '/work',
	];

	function _stripBrowseRoute(path) {
	  for (var i = 0; i < _routesToStrip.length; i++) {
	    var r = _routesToStrip[i];
	    if (path.startsWith(r + '/')) {
	      return r;
	    }
	  }
	  return path;
	}

	/**
	 * Creates a new request to be used as a cache key for navigate
	 * requests (e.g. the appshell). The request's query params stripped
	 * out are, except for the params in _cacheKeys.

	 * Must be created from the original request, not one that's had the
	 * service worker header added to it, because the request's mode is
	 * overwritten if it's "navigate".
	 */
	function getCacheKey(request) {
	  if (request.headers.get('X-Service-Worker-Fetch')) {
	    throw new Error("Cannot create cache key for modified requests. Url: " + request.url);
	  }

	  var u = new URL(request.url);

	  var isAppshellRequest = request.mode === 'navigate';
	  if (!isAppshellRequest) {
	    // We don't need to strip any data from non-appshell request.
	    return request;
	  }

	  u.pathname = _stripBrowseRoute(u.pathname);

	  // Create the search parameters from _cacheKeys.
	  var search = "";
	  if (u.search) {
	    for (var i = 0; i < _cacheKeys.length; i++) {
	      var key = _cacheKeys[i];
	      var value = u.searchParams.get(key);
	      if (value) {
	        if (search === "") {
	          search = key + '=' + value;
	        } else {
	          search = '?' + key + '=' + value;
	        }
	      }
	    }
	  }
	  u.search = search;

	  return new Request(u.toString(), {
	    method: request.method,
	    headers: request.headers,
	    mode: request.mode === 'navigate' ? 'same-origin' : request.mode,
	  });
	}

	/**
	 * Returns a new request with the header "'X-Service-Worker-Fetch': 1"
	 * added. All requests from the service worker should include this
	 * header, to work around a Chrome bug where samesite cookies aren't
	 * added to service worker requests (fixed in Chrome 54).
	 */
	function addServiceWorkerHeader(request) {
	  // TODO: Currently, this function does not clone the request body,
	  // so we can only use it with requests that don't use a body. Clone
	  // the body correctly and then remove this check. T125378
	  if (request.method !== 'GET' &&
	      request.method !== 'HEAD') {
	    return request;
	  }

	  var headers = new Headers();
	  for (var pair of request.headers.entries()) {
	    headers.append(pair[0], pair[1]);
	  }

	  headers.append('X-Service-Worker-Fetch', '1');

	  // Cloning a request is a bit non-trivial. See
	  // https://github.com/whatwg/fetch/issues/245 for more details.
	  //
	  // If the mode is 'navigate', then we need to change the mode to
	  // "same-origin", which has the same semantics, because you can't
	  // construct a "navigate" request (only the browser can). We also
	  // can't add non-origin referrers to same-origin requests, so we
	  // just leave it off entirely.
	  var mode;
	  var referrer;
	  if (request.mode === 'navigate') {
	    mode = 'same-origin';
	  } else {
	    mode = request.mode;
	    referrer = request.referrer;
	  }

	  return new Request(request.url, {
	    method: request.method,
	    headers: headers,
	    mode: mode,
	    credentials: request.credentials,
	    cache: request.cache,
	    integrity: request.integrity,
	    redirect: request.redirect,
	    referrer: referrer,
	  });
	}

	module.exports = {
	  getCacheKey: getCacheKey,
	  addServiceWorkerHeader: addServiceWorkerHeader,
	};


/***/ },
/* 12 */
/***/ function(module, exports) {

	'use strict';

	// Turn rawRoutes into regexes.
	// @param {Object} rawRouteMap - a map from route type to array of route string.
	function _createRoutes(rawRouteMap) {
	  // Matches either the end of the path or '/'.
	  //
	  // Example: "/s($|/)" will match match the strings "/s" and
	  // "/s/something", but not "/so_cool".
	  var _endPath = '($|/)';

	  var routes = [];
	  for (var i = 0; i < rawRouteMap.length; i++) {
	    var r = rawRouteMap[i];
	    routes.push(new RegExp(r + _endPath));
	  }
	  return routes;
	};

	var _whitelistRoutes = [
	  // Routes in this whitelist are allowed to go through the service worker.
	  // NOTE: these routes are cached only cached if the server sets the
	  // correct caching headers on the response.

	  // ##### Appshell routes ####
	  '/',
	  '/personal',
	  '/work',
	  '/home',
	  '/recents',
	  '/requests',
	  '/events',
	  '/h',
	  '/deleted_files',
	  '/links',
	  // Notice that we explicitly exclude routes that can be placed in iframes
	  // We leave off the origin for navigate requests when cloning them, and
	  // that breaks these routes when they're placed in iframes.
	  // '/s/',
	  // '/sh/',
	  // '/scl/',

	  // #### Application routes ####
	  '/nav_menu',  // ajax endpoint that returns the nav data for a given user

	  // #### Test routes ####
	  '/test-iframe',
	  '/test-route',
	];
	var whitelistRouteRegexes = _createRoutes(_whitelistRoutes);

	var _clearCacheRoutes = [
	  // When any of these routes is hit, the cache is cleared first. None
	  // of these routes are cached.
	  '/set_locale',
	  '/team/admin/set_locale',
	  '/logout',
	  '/switch_login',
	];
	var clearCacheRouteRegexes = _createRoutes(_clearCacheRoutes);

	var _whitelistHosts = [
	  'localhost',
	  'meta-dbdev.dev.corp.dropbox.com',
	  'www.dropbox.com',
	];

	// Returns true if the url is on the whitelist, and should be
	// processed by the service worker.
	function isWhitelistedURL(url) {
	  var u = new URL(url)

	  // First, check that the host matches the whitelisted hosts.
	  var hostExists = false;
	  for (var i = 0; i < _whitelistHosts.length; i++) {
	    var h = _whitelistHosts[i];
	    if (u.hostname === h) {
	      hostExists = true;
	      break;
	    }
	  }
	  if (!hostExists) {
	    return false;
	  }

	  // Accept the URL path if it's on the whitelist.
	  for (var i = 0; i < whitelistRouteRegexes.length; i++) {
	    var w = whitelistRouteRegexes[i];
	    if (w.test(u.pathname)) {
	      return true;
	    }
	  }

	  // Accept the URL path if it's on the whitelist.
	  for (var i = 0; i < clearCacheRouteRegexes.length; i++) {
	    var w = clearCacheRouteRegexes[i];
	    if (w.test(u.pathname)) {
	      return true;
	    }
	  }

	  // If the route wasn't on the whitelist, return false.
	  return false;
	}

	module.exports = {
	  isWhitelistedURL: isWhitelistedURL,
	  whitelistRouteRegexes: whitelistRouteRegexes,
	  clearCacheRouteRegexes: clearCacheRouteRegexes,
	}


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var helpers = __webpack_require__(6);
	var cacheHelpers = __webpack_require__(10);
	var utils = __webpack_require__(11);

	/**
	 * Clears the cache, and then makes the request. Used when the user
	 * has hit a state transition that invalidates the cache (e.g.
	 * changing the locale).
	 */
	function clearCache(request, values, options, waitUntilCallback) {
	  helpers.debug('Strategy: clearCache [' + request.url + ']', options);

	  // Trigger the waitUntil callback immediately, b/c all the work
	  // happens before the response.
	  if (waitUntilCallback) {
	    waitUntilCallback();
	  }

	  // Delete the cache as part of the promise chain, because we want to
	  // make sure the cache has been deleted before any additional
	  // requests are made to prevent races.
	  return cacheHelpers.deleteAllCaches().then(function() {
	    return fetch(utils.addServiceWorkerHeader(request));
	  })
	}

	module.exports = clearCache;


/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	var globalOptions = __webpack_require__(1);
	var helpers = __webpack_require__(6);

	var cacheHelpers = __webpack_require__(10);
	var utils = __webpack_require__(11);

	/**
	 * Caches the route based on the headers set on the response. If the
	 * appropriate headers are set, the response is cached.
	 *
	 * In order to be cacheable, the response must set ALL the following
	 * headers:
	 *
	 * - X-Service-Worker-Cache-Name: The name of the cache that the
	 *    response is stored in. This groups caches of the same thing
	 *    (e.g. "appshell") together so the entire cache can be purged at
	 *    once.
	 *
	 * - X-Service-Worker-Cache-Version: The version that the response
	 *    represents. Each version should represent a major bump in
	 *    functionality.
	 *
	 * - X-Service-Worker-Cache-Min-Version: The minimum version of
	 *    anything served from the cache that is still compatible with the
	 *    server. If the browser was served a cached response with a
	 *    version less than the min version from the network, the service
	 *    worker sends a message to the browser (which should know how to
	 *    handle version inconsistencies).
	 */
	function cacheByHeader(request, values, options, waitUntilCallback) {
	  helpers.debug('Strategy: cacheByHeader [' + request.url + ']', options);

	  var cacheKey = utils.getCacheKey(request);
	  request = utils.addServiceWorkerHeader(request);

	  return new Promise(function(resolve, reject) {
	    // Basic flow:
	    //  - If the request exists in the cache, serve it immediately.
	    //
	    //  - Make the network request, and serve it if the cached version
	    //  hasn't already been served.
	    //
	    //  - If the network response is not cacheable, return the
	    //  response and do not cache it. If the request matched something
	    //  that was in the cache, delete that entire cache. This is the
	    //  branch that handles cases where a route used to be cached but
	    //  isn't any more.
	    //
	    //  - At this point, the network response is cacheable. Delete any
	    //  items in its cache that have a version less than the network
	    //  response's minimum version. Then, put the network response in
	    //  the cache. Send a message to the browser if it was served a
	    //  cached response with a version less than the network
	    //  response's minimum version.
	    caches.match(cacheKey).then(function(cachedResponse) {
	      var p = Promise.resolve();

	      // cachedResponseInfo is null if cachedResponse was served to
	      // the user, and non-null otherwise.
	      var cachedResponseInfo;
	      if (cachedResponse) {
	        cachedResponseInfo = cacheHelpers.getCacheHeaderInfo(cachedResponse);

	        if (!cachedResponseInfo) {
	          // If we served a cached response without valid caching
	          // headers, that means we're in an invalid state. Do not
	          // serve the cached response, and delete all the caches to
	          // try and return the service worker to a valid state.
	          p = p.then(cacheHelpers.deleteAllCaches);
	        } else {
	          // Immediately resolve the cachedResponse. We don't need to
	          // clone it b/c we never use the body of the response later.
	          resolve(cachedResponse);
	        }
	      }

	      // Fetching and caching potentially happens outside of the
	      // promise chain if cachedResponse is null.
	      p = p.then(function() {
	        return fetch(request);
	      }).then(function(networkResponse) {
	        var networkResponseInfo = cacheHelpers.getCacheHeaderInfo(networkResponse);
	        // Immediately resolve the networkResponse. If networkResponse
	        // isn't cacheable, we don't need to clone it.
	        if (networkResponseInfo) {
	          resolve(networkResponse.clone());
	        } else {
	          resolve(networkResponse);
	        }

	        var cachedResponseInfo;
	        if (cachedResponse) {
	          cachedResponseInfo = cacheHelpers.getCacheHeaderInfo(cachedResponse);

	          // If we served a cached response without valid caching
	          // headers, that means we're in an invalid state.
	          // Short-circuit and delete all the caches to try and return
	          // the service worker to a valid state.
	          if (!cachedResponseInfo) {
	            helpers.debug("cacheByHeader: Invalid state: served cached response without caching headers");
	            // TODO: Report an exception here when exception reporting
	            // is implemented.
	            return deleteAllCaches();
	          }
	        }

	        // Short-circuit if there's no cached response and the network
	        // response is not cacheable
	        if (!networkResponseInfo && !cachedResponseInfo) {
	          return;
	        }

	        // If the request has been cached, but the network request has
	        // caching disabled, wipe the cache.
	        if (!networkResponseInfo && cachedResponseInfo) {
	          return cacheHelpers.deleteCache({'cache': {'name': cachedResponseInfo.name}});
	        }

	        // If the response does not have a successful status code but
	        // it still set caching headers correctly, delete it from the
	        // cache.
	        if (!globalOptions.successResponses.test(networkResponse.status)) {
	          return caches.open(networkResponseInfo.name).then(function(cache) {
	            return cache.delete(cacheKey);
	          });
	        }

	        // At this point, networkResponse is cacheable and has a successful status code
	        return Promise.resolve().then(function() {
	          var cache;
	          return caches.open(networkResponseInfo.name).then(function(_cache) {
	            cache = _cache;
	            return cache.keys();
	          }).then(function(keys) {
	            // Clean out incompatible versions from the cache
	            return Promise.all(keys.map(function(key) {
	              return cache.match(key).then(function(resp) {
	                var respInfo = cacheHelpers.getCacheHeaderInfo(resp);
	                // Delete key from the cache if its version is not
	                // supported.
	                if (!respInfo || respInfo.version < networkResponseInfo.minVersion) {
	                  return cache.delete(key);
	                }
	                return;
	              });
	            }));
	          }).then(function() {
	            // If the cache name is different, delete the old cache name.
	            if (cachedResponseInfo && cachedResponseInfo.name !== networkResponseInfo.name) {
	              return cacheHelpers.deleteCache({'cache': {'name': cachedResponseInfo.name}});
	            }
	          }).then(function() {
	            // Add the response to the cache.
	            return cache.put(cacheKey, networkResponse);
	          }).then(function() {
	            // Send a message to the user if the served request is
	            // unsupported.
	            if (cachedResponseInfo &&
	                cachedResponseInfo.name === networkResponseInfo.name &&
	                cachedResponseInfo.version < networkResponseInfo.minVersion) {
	              // TODO: use broadcastUnsupportedVersion here when
	              // "event" is passed into the strategy.
	              // See https://github.com/GoogleChrome/sw-toolbox/issues/196.
	              return;
	            }
	          });
	        });
	      }, function() {
	        // Errback for when the fetch fails.

	        // If the request was cached, delete it request from the cache.
	        if (cachedResponseInfo) {
	          return caches.open(cachedResponseInfo.name).then(function(cache) {
	            return cache.delete(cacheKey);
	          });
	        }
	      }).then(() => {
	        if (waitUntilCallback) {
	          waitUntilCallback();
	        }
	      });
	    });
	  });
	}

	// NOTE: Currently not used because "event" is not passed into
	// strategies. Use this function when that change is made to
	// sw-toolbox (see https://github.com/GoogleChrome/sw-toolbox/issues/196).
	function broadcastUnsupportedVersion(cacheInfo, clientId) {
	  return self.clients.get(clientId).then(function(client) {
	    return client.postMessage({message: "CACHE_UPDATED", cacheName: cacheInfo.name});
	  });
	}

	module.exports = cacheByHeader;


/***/ }
/******/ ]);
