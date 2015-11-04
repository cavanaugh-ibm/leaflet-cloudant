(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
var _ = global._ || require('lodash');
var URL = require('url-parse');

var FooUtil = function () {};

FooUtil.prototype.paramOrError = function (param, error) {
  if (_.isEmpty(_.trim(param))) {
    throw new Error(error);
  } else {
    return param;
  }
};

FooUtil.prototype.paramOrDefault = function (param, def) {
  return _.isEmpty(_.trim(param)) ? def : param;
};

FooUtil.prototype.urlFromAngular = function (urlString) {
  urlString = this.paramOrDefault(urlString, '');
  var url = new URL(urlString);

  // If the hash part of the URL ended up containing the query parameters, pull them out into the query field
  var urlHashParts = url.hash.split('?');
  if (urlHashParts.length === 2) {
    url.hash = urlHashParts[0];
    url.query = '?' + urlHashParts[1];
  }

  return url;
};

FooUtil.prototype.urlQueryValue = function (url) {
  return url ? this.removeLeading('?', url.query) : '';
};

FooUtil.prototype.urlHashValue = function (url) {
  return url ? this.removeLeading('#', url.hash) : '';
};

FooUtil.prototype.urlQueryParams = function (url) {
  return this.parseParams(this.urlQueryValue(url));
};

FooUtil.prototype.urlHashParams = function (url) {
  return this.parseParams(this.urlHashValue(url));
};

FooUtil.prototype.parseParams = function (str) {
  str = this.paramOrDefault(str, '');
  var p = {};

  //
  // Figure out what our separator is
  var sep = '&';
  if (str.query('&amp;') !== -1) {
    sep = '&amp;';
  }

  //
  // Loop through the query string and 
  var params = str.split(sep);
  for (var i = 0; i < params.length; i++) {
    var tmp = params[i].split('=');
    if (tmp.length !== 2) continue;
    p[tmp[0]] = decodeURI(tmp[1]);
  }

  return p;
};

FooUtil.prototype.removeLeading = function (removeMe, str) {
  removeMe = this.paramOrDefault(removeMe, '');
  str = this.paramOrDefault(str, '');

  return _.startsWith(str, removeMe) ? str.slice(removeMe.length) : str;
};

module.exports = new FooUtil();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"lodash":"lodash","url-parse":4}],2:[function(require,module,exports){
'use strict';
var immediate = require('immediate');

/* istanbul ignore next */
function INTERNAL() {}

var handlers = {};

var REJECTED = ['REJECTED'];
var FULFILLED = ['FULFILLED'];
var PENDING = ['PENDING'];

module.exports = exports = Promise;

function Promise(resolver) {
  if (typeof resolver !== 'function') {
    throw new TypeError('resolver must be a function');
  }
  this.state = PENDING;
  this.queue = [];
  this.outcome = void 0;
  if (resolver !== INTERNAL) {
    safelyResolveThenable(this, resolver);
  }
}

Promise.prototype["catch"] = function (onRejected) {
  return this.then(null, onRejected);
};
Promise.prototype.then = function (onFulfilled, onRejected) {
  if (typeof onFulfilled !== 'function' && this.state === FULFILLED ||
    typeof onRejected !== 'function' && this.state === REJECTED) {
    return this;
  }
  var promise = new this.constructor(INTERNAL);
  if (this.state !== PENDING) {
    var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
    unwrap(promise, resolver, this.outcome);
  } else {
    this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
  }

  return promise;
};
function QueueItem(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (typeof onFulfilled === 'function') {
    this.onFulfilled = onFulfilled;
    this.callFulfilled = this.otherCallFulfilled;
  }
  if (typeof onRejected === 'function') {
    this.onRejected = onRejected;
    this.callRejected = this.otherCallRejected;
  }
}
QueueItem.prototype.callFulfilled = function (value) {
  handlers.resolve(this.promise, value);
};
QueueItem.prototype.otherCallFulfilled = function (value) {
  unwrap(this.promise, this.onFulfilled, value);
};
QueueItem.prototype.callRejected = function (value) {
  handlers.reject(this.promise, value);
};
QueueItem.prototype.otherCallRejected = function (value) {
  unwrap(this.promise, this.onRejected, value);
};

function unwrap(promise, func, value) {
  immediate(function () {
    var returnValue;
    try {
      returnValue = func(value);
    } catch (e) {
      return handlers.reject(promise, e);
    }
    if (returnValue === promise) {
      handlers.reject(promise, new TypeError('Cannot resolve promise with itself'));
    } else {
      handlers.resolve(promise, returnValue);
    }
  });
}

handlers.resolve = function (self, value) {
  var result = tryCatch(getThen, value);
  if (result.status === 'error') {
    return handlers.reject(self, result.value);
  }
  var thenable = result.value;

  if (thenable) {
    safelyResolveThenable(self, thenable);
  } else {
    self.state = FULFILLED;
    self.outcome = value;
    var i = -1;
    var len = self.queue.length;
    while (++i < len) {
      self.queue[i].callFulfilled(value);
    }
  }
  return self;
};
handlers.reject = function (self, error) {
  self.state = REJECTED;
  self.outcome = error;
  var i = -1;
  var len = self.queue.length;
  while (++i < len) {
    self.queue[i].callRejected(error);
  }
  return self;
};

function getThen(obj) {
  // Make sure we only access the accessor once as required by the spec
  var then = obj && obj.then;
  if (obj && typeof obj === 'object' && typeof then === 'function') {
    return function appyThen() {
      then.apply(obj, arguments);
    };
  }
}

function safelyResolveThenable(self, thenable) {
  // Either fulfill, reject or reject with error
  var called = false;
  function onError(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.reject(self, value);
  }

  function onSuccess(value) {
    if (called) {
      return;
    }
    called = true;
    handlers.resolve(self, value);
  }

  function tryToUnwrap() {
    thenable(onSuccess, onError);
  }

  var result = tryCatch(tryToUnwrap);
  if (result.status === 'error') {
    onError(result.value);
  }
}

function tryCatch(func, value) {
  var out = {};
  try {
    out.value = func(value);
    out.status = 'success';
  } catch (e) {
    out.status = 'error';
    out.value = e;
  }
  return out;
}

exports.resolve = resolve;
function resolve(value) {
  if (value instanceof this) {
    return value;
  }
  return handlers.resolve(new this(INTERNAL), value);
}

exports.reject = reject;
function reject(reason) {
  var promise = new this(INTERNAL);
  return handlers.reject(promise, reason);
}

exports.all = all;
function all(iterable) {
  var self = this;
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return this.reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return this.resolve([]);
  }

  var values = new Array(len);
  var resolved = 0;
  var i = -1;
  var promise = new this(INTERNAL);

  while (++i < len) {
    allResolver(iterable[i], i);
  }
  return promise;
  function allResolver(value, i) {
    self.resolve(value).then(resolveFromAll, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
    function resolveFromAll(outValue) {
      values[i] = outValue;
      if (++resolved === len && !called) {
        called = true;
        handlers.resolve(promise, values);
      }
    }
  }
}

exports.race = race;
function race(iterable) {
  var self = this;
  if (Object.prototype.toString.call(iterable) !== '[object Array]') {
    return this.reject(new TypeError('must be an array'));
  }

  var len = iterable.length;
  var called = false;
  if (!len) {
    return this.resolve([]);
  }

  var i = -1;
  var promise = new this(INTERNAL);

  while (++i < len) {
    resolver(iterable[i]);
  }
  return promise;
  function resolver(value) {
    self.resolve(value).then(function (response) {
      if (!called) {
        called = true;
        handlers.resolve(promise, response);
      }
    }, function (error) {
      if (!called) {
        called = true;
        handlers.reject(promise, error);
      }
    });
  }
}

},{"immediate":3}],3:[function(require,module,exports){
(function (global){
'use strict';
var Mutation = global.MutationObserver || global.WebKitMutationObserver;

var scheduleDrain;

{
  if (Mutation) {
    var called = 0;
    var observer = new Mutation(nextTick);
    var element = global.document.createTextNode('');
    observer.observe(element, {
      characterData: true
    });
    scheduleDrain = function () {
      element.data = (called = ++called % 2);
    };
  } else if (!global.setImmediate && typeof global.MessageChannel !== 'undefined') {
    var channel = new global.MessageChannel();
    channel.port1.onmessage = nextTick;
    scheduleDrain = function () {
      channel.port2.postMessage(0);
    };
  } else if ('document' in global && 'onreadystatechange' in global.document.createElement('script')) {
    scheduleDrain = function () {

      // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
      // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
      var scriptEl = global.document.createElement('script');
      scriptEl.onreadystatechange = function () {
        nextTick();

        scriptEl.onreadystatechange = null;
        scriptEl.parentNode.removeChild(scriptEl);
        scriptEl = null;
      };
      global.document.documentElement.appendChild(scriptEl);
    };
  } else {
    scheduleDrain = function () {
      setTimeout(nextTick, 0);
    };
  }
}

var draining;
var queue = [];
//named nextTick for less confusing stack traces
function nextTick() {
  draining = true;
  var i, oldQueue;
  var len = queue.length;
  while (len) {
    oldQueue = queue;
    queue = [];
    i = -1;
    while (++i < len) {
      oldQueue[i]();
    }
    len = queue.length;
  }
  draining = false;
}

module.exports = immediate;
function immediate(task) {
  if (queue.push(task) === 1 && !draining) {
    scheduleDrain();
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],4:[function(require,module,exports){
'use strict';

var required = require('requires-port')
  , lolcation = require('./lolcation')
  , qs = require('querystringify')
  , relativere = /^\/(?!\/)/;

/**
 * These are the parse instructions for the URL parsers, it informs the parser
 * about:
 *
 * 0. The char it Needs to parse, if it's a string it should be done using
 *    indexOf, RegExp using exec and NaN means set as current value.
 * 1. The property we should set when parsing this value.
 * 2. Indication if it's backwards or forward parsing, when set as number it's
 *    the value of extra chars that should be split off.
 * 3. Inherit from location if non existing in the parser.
 * 4. `toLowerCase` the resulting value.
 */
var instructions = [
  ['#', 'hash'],                        // Extract from the back.
  ['?', 'query'],                       // Extract from the back.
  ['//', 'protocol', 2, 1, 1],          // Extract from the front.
  ['/', 'pathname'],                    // Extract from the back.
  ['@', 'auth', 1],                     // Extract from the front.
  [NaN, 'host', undefined, 1, 1],       // Set left over value.
  [/\:(\d+)$/, 'port'],                 // RegExp the back.
  [NaN, 'hostname', undefined, 1, 1]    // Set left over.
];

/**
 * The actual URL instance. Instead of returning an object we've opted-in to
 * create an actual constructor as it's much more memory efficient and
 * faster and it pleases my CDO.
 *
 * @constructor
 * @param {String} address URL we want to parse.
 * @param {Boolean|function} parser Parser for the query string.
 * @param {Object} location Location defaults for relative paths.
 * @api public
 */
function URL(address, location, parser) {
  if (!(this instanceof URL)) {
    return new URL(address, location, parser);
  }

  var relative = relativere.test(address)
    , parse, instruction, index, key
    , type = typeof location
    , url = this
    , i = 0;

  //
  // The following if statements allows this module two have compatibility with
  // 2 different API:
  //
  // 1. Node.js's `url.parse` api which accepts a URL, boolean as arguments
  //    where the boolean indicates that the query string should also be parsed.
  //
  // 2. The `URL` interface of the browser which accepts a URL, object as
  //    arguments. The supplied object will be used as default values / fall-back
  //    for relative paths.
  //
  if ('object' !== type && 'string' !== type) {
    parser = location;
    location = null;
  }

  if (parser && 'function' !== typeof parser) {
    parser = qs.parse;
  }

  location = lolcation(location);

  for (; i < instructions.length; i++) {
    instruction = instructions[i];
    parse = instruction[0];
    key = instruction[1];

    if (parse !== parse) {
      url[key] = address;
    } else if ('string' === typeof parse) {
      if (~(index = address.indexOf(parse))) {
        if ('number' === typeof instruction[2]) {
          url[key] = address.slice(0, index);
          address = address.slice(index + instruction[2]);
        } else {
          url[key] = address.slice(index);
          address = address.slice(0, index);
        }
      }
    } else if (index = parse.exec(address)) {
      url[key] = index[1];
      address = address.slice(0, address.length - index[0].length);
    }

    url[key] = url[key] || (instruction[3] || ('port' === key && relative) ? location[key] || '' : '');

    //
    // Hostname, host and protocol should be lowercased so they can be used to
    // create a proper `origin`.
    //
    if (instruction[4]) {
      url[key] = url[key].toLowerCase();
    }
  }

  //
  // Also parse the supplied query string in to an object. If we're supplied
  // with a custom parser as function use that instead of the default build-in
  // parser.
  //
  if (parser) url.query = parser(url.query);

  //
  // We should not add port numbers if they are already the default port number
  // for a given protocol. As the host also contains the port number we're going
  // override it with the hostname which contains no port number.
  //
  if (!required(url.port, url.protocol)) {
    url.host = url.hostname;
    url.port = '';
  }

  //
  // Parse down the `auth` for the username and password.
  //
  url.username = url.password = '';
  if (url.auth) {
    instruction = url.auth.split(':');
    url.username = instruction[0] || '';
    url.password = instruction[1] || '';
  }

  //
  // The href is just the compiled result.
  //
  url.href = url.toString();
}

/**
 * This is convenience method for changing properties in the URL instance to
 * insure that they all propagate correctly.
 *
 * @param {String} prop Property we need to adjust.
 * @param {Mixed} value The newly assigned value.
 * @returns {URL}
 * @api public
 */
URL.prototype.set = function set(part, value, fn) {
  var url = this;

  if ('query' === part) {
    if ('string' === typeof value && value.length) {
      value = (fn || qs.parse)(value);
    }

    url[part] = value;
  } else if ('port' === part) {
    url[part] = value;

    if (!required(value, url.protocol)) {
      url.host = url.hostname;
      url[part] = '';
    } else if (value) {
      url.host = url.hostname +':'+ value;
    }
  } else if ('hostname' === part) {
    url[part] = value;

    if (url.port) value += ':'+ url.port;
    url.host = value;
  } else if ('host' === part) {
    url[part] = value;

    if (/\:\d+/.test(value)) {
      value = value.split(':');
      url.hostname = value[0];
      url.port = value[1];
    }
  } else {
    url[part] = value;
  }

  url.href = url.toString();
  return url;
};

/**
 * Transform the properties back in to a valid and full URL string.
 *
 * @param {Function} stringify Optional query stringify function.
 * @returns {String}
 * @api public
 */
URL.prototype.toString = function toString(stringify) {
  if (!stringify || 'function' !== typeof stringify) stringify = qs.stringify;

  var query
    , url = this
    , result = url.protocol +'//';

  if (url.username) {
    result += url.username;
    if (url.password) result += ':'+ url.password;
    result += '@';
  }

  result += url.hostname;
  if (url.port) result += ':'+ url.port;

  result += url.pathname;

  query = 'object' === typeof url.query ? stringify(url.query) : url.query;
  if (query) result += '?' !== query.charAt(0) ? '?'+ query : query;

  if (url.hash) result += url.hash;

  return result;
};

//
// Expose the URL parser and some additional properties that might be useful for
// others.
//
URL.qs = qs;
URL.location = lolcation;
module.exports = URL;

},{"./lolcation":5,"querystringify":6,"requires-port":7}],5:[function(require,module,exports){
(function (global){
'use strict';

/**
 * These properties should not be copied or inherited from. This is only needed
 * for all non blob URL's as the a blob URL does not include a hash, only the
 * origin.
 *
 * @type {Object}
 * @private
 */
var ignore = { hash: 1, query: 1 }
  , URL;

/**
 * The location object differs when your code is loaded through a normal page,
 * Worker or through a worker using a blob. And with the blobble begins the
 * trouble as the location object will contain the URL of the blob, not the
 * location of the page where our code is loaded in. The actual origin is
 * encoded in the `pathname` so we can thankfully generate a good "default"
 * location from it so we can generate proper relative URL's again.
 *
 * @param {Object} loc Optional default location object.
 * @returns {Object} lolcation object.
 * @api public
 */
module.exports = function lolcation(loc) {
  loc = loc || global.location || {};
  URL = URL || require('./');

  var finaldestination = {}
    , type = typeof loc
    , key;

  if ('blob:' === loc.protocol) {
    finaldestination = new URL(unescape(loc.pathname), {});
  } else if ('string' === type) {
    finaldestination = new URL(loc, {});
    for (key in ignore) delete finaldestination[key];
  } else if ('object' === type) for (key in loc) {
    if (key in ignore) continue;
    finaldestination[key] = loc[key];
  }

  return finaldestination;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./":4}],6:[function(require,module,exports){
'use strict';

var has = Object.prototype.hasOwnProperty;

/**
 * Simple query string parser.
 *
 * @param {String} query The query string that needs to be parsed.
 * @returns {Object}
 * @api public
 */
function querystring(query) {
  var parser = /([^=?&]+)=([^&]*)/g
    , result = {}
    , part;

  //
  // Little nifty parsing hack, leverage the fact that RegExp.exec increments
  // the lastIndex property so we can continue executing this loop until we've
  // parsed all results.
  //
  for (;
    part = parser.exec(query);
    result[decodeURIComponent(part[1])] = decodeURIComponent(part[2])
  );

  return result;
}

/**
 * Transform a query string to an object.
 *
 * @param {Object} obj Object that should be transformed.
 * @param {String} prefix Optional prefix.
 * @returns {String}
 * @api public
 */
function querystringify(obj, prefix) {
  prefix = prefix || '';

  var pairs = [];

  //
  // Optionally prefix with a '?' if needed
  //
  if ('string' !== typeof prefix) prefix = '?';

  for (var key in obj) {
    if (has.call(obj, key)) {
      pairs.push(encodeURIComponent(key) +'='+ encodeURIComponent(obj[key]));
    }
  }

  return pairs.length ? prefix + pairs.join('&') : '';
}

//
// Expose the module.
//
exports.stringify = querystringify;
exports.parse = querystring;

},{}],7:[function(require,module,exports){
'use strict';

/**
 * Check if we're required to add a port number.
 *
 * @see https://url.spec.whatwg.org/#default-port
 * @param {Number|String} port Port number we need to check
 * @param {String} protocol Protocol we need to check against.
 * @returns {Boolean} Is it a default port for the given protocol
 * @api private
 */
module.exports = function required(port, protocol) {
  protocol = protocol.split(':')[0];
  port = +port;

  if (!port) return false;

  switch (protocol) {
    case 'http':
    case 'ws':
    return port !== 80;

    case 'https':
    case 'wss':
    return port !== 443;

    case 'ftp':
    return port !== 21;

    case 'gopher':
    return port !== 70;

    case 'file':
    return false;
  }

  return port !== 0;
};

},{}],8:[function(require,module,exports){
(function (global){
'use strict';
var jsonp = require('./jsonp');
var Promise = require('lie');

module.exports = function (url, options) {
  options = options || {};
  if (options.jsonp) {
    return jsonp(url, options);
  }
  var request;
  var cancel;
  var out = new Promise(function (resolve, reject) {
    cancel = reject;
    if (global.XMLHttpRequest === undefined) {
      reject('XMLHttpRequest is not supported');
    }
    var response;
    request = new global.XMLHttpRequest();
    request.open('GET', url);
    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        if ((request.status < 400 && options.local) || request.status === 200) {
          if (global.JSON) {
            response = JSON.parse(request.responseText);
          } else {
            reject(new Error('JSON is not supported'));
          }
          resolve(response);
        } else {
          if (!request.status) {
            reject('Attempted cross origin request without CORS enabled');
          } else {
            reject(request.statusText);
          }
        }
      }
    };
    request.send();
  });
  out.catch(function (reason) {
    request.abort();
    return reason;
  });
  out.abort = cancel;
  return out;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./jsonp":10,"lie":2}],9:[function(require,module,exports){
(function (global){
'use strict';
var L = global.L || require('leaflet');
var Promise = require('lie');
var ajax = require('./ajax');
// var Set = require('Set');
var _ = global._ || require('lodash');
var foo = require('footils');

/*
  DESIGN

  - Support multiple sources
  - Automatic refresh from sources based upon:
      - Method
      - Time
  - When refreshing, CRUD of features

  - Methods
      - sourceAdd - takes in an identifier and a url - a
      - sourceUpdate - takes in an identifier and a replacement url
      - sourceRemove - takes in an identifier
      - sourceRefresh - takes in an identifier

      - clearAll - no parameters - clears all 
*/

L.GeoJSON.Cloudant = L.FeatureGroup.extend({
  defaultAjaxParams: {
    dataType: 'jsonp',
    callbackParam: 'callback',
    local: false,
    middleware: function (f) {
      return f;
    }
  },

  defaultSourceParams: {
    refreshSeconds: 0
  },

  defaultGeoJsonParams: {
    pointToLayer: false,
    onEachFeature: false,
    filter: false,
    coordsToLatLng: false
  },

  options: {
  },

  initialize: function (options) {
    L.Util.setOptions(this, options);

    this._layers = {};
    this._sources = {};

    this.on('cloudant:data:loaded', function () {
      if (this.filter) {
        this.refilter(this.filter);
      }
    }, this);
  },

  sourceAdd: function (identifier, url, options) {
    foo.paramOrError(identifier, 'IDENTIFIER is required when updating a source'); // IDENTIFIER is required
    foo.paramOrError(url, 'URL is required when adding a source'); // URL is required

    if (identifier in this._sources) {
      // We had a previous source here, we need to remove it
      this.sourceRemove(identifier);
    }

    //
    // Setup our new source    
    this._sources[identifier] = {}; // Save our source
    this._sources[identifier]['url'] = url;

    //
    // Setup our AJAX parameters
    var ajaxParams = L.Util.extend({}, this.defaultAjaxParams);
    for (var i in options) {
      if (this.defaultAjaxParams.hasOwnProperty(i)) {
        ajaxParams[i] = options[i];
      }
    }
    this._sources[identifier]['ajaxParams'] = ajaxParams;
    this._sources[identifier]['ajaxParams'].dataType = new RegExp('^(?:[a-z]+:)?//', 'i').test(url) ? 'jsonp' : 'json';

    //
    // Setup our Other parameters
    var otherParams = L.Util.extend({}, this.defaultSourceParams);
    for (var i in options) {
      if (this.defaultSourceParams.hasOwnProperty(i)) {
        otherParams[i] = options[i];
      }
    }
    this._sources[identifier]['params'] = otherParams;

    //
    // Setup our GeoJSON parameters
    var geoJsonParams = L.Util.extend({}, this.defaultGeoJsonParams);
    for (var i in options) {
      if (this.defaultGeoJsonParams.hasOwnProperty(i)) {
        geoJsonParams[i] = options[i];
      }
    }

    // 
    // Create the GeoJSON layer for this source
    // TODO - need to pass the options to geoJson
    this._sources[identifier]['layer'] = L.geoJson(null, geoJsonParams).addTo(this);

    //
    // Fire off that we added this source
    this.fire('cloudant:sourceAdd', {identifier: identifier, source: this._sources[identifier]});

    //
    // Trigger an immediate refresh
    this._refresh(this._sources[identifier]);

    //
    // Schedule refreshes
    this._refreshSchedule(this._sources[identifier]);
  },

  sourceRemove: function (identifier) {
    foo.paramOrError(identifier, 'IDENTIFIER is required when updating a source'); // IDENTIFIER is required

    if (identifier in this._sources) {
      var source = this._sources[identifier];

      //
      // Cancel our refresh
      this._refreshCancel(source);

      //
      // Remove the GeoJson layer
      this.removeLayer(source.layer);
      delete this._sources[identifier];
    }
  },

  sourceUpdate: function (identifier, url) {
    foo.paramOrError(identifier, 'IDENTIFIER is required when updating a source'); // IDENTIFIER is required
    foo.paramOrError(url, 'URL is required when updating a source'); // URL is required

    if (identifier in this._sources) {
      var source = this._sources[identifier];

      //
      // Cancel our refresh
      this._refreshCancel(source);

      //
      // Store the new URL
      source['url'] = url;

      //
      // Trigger an immediate refresh
      this._refresh(source);

      //
      // Schedule refreshes
      this._refreshSchedule(source);
    }
  },

  refilter: function (func) {
    if (typeof func !== 'function') {
      this.filter = false;
      this.eachLayer(function (a) {
        a.setStyle({
          stroke: true,
          clickable: true
        });
      });
    } else {
      this.filter = func;
      this.eachLayer(function (a) {
        if (func(a.feature)) {
          a.setStyle({
            stroke: true,
            clickable: true
          });
        } else {
          a.setStyle({
            stroke: false,
            clickable: false
          });
        }
      });
    }
  },

  _refresh: function (source) {
    var self = this;

    if (source.ajaxParams.dataType.toLowerCase() === 'jsonp') {
      L.Util.jsonp(source.url, source.ajaxParams).then(function (d) {
        var data = source.ajaxParams.middleware(d);
        source.layer.clearLayers();
        source.layer.addData(data);
        self.fire('cloudant:data:loaded', data);
      }, function (err) {
        self.fire('cloudant:data:loaded', { error: err });
      });
    } else {
      ajax(source.url, source.ajaxParams).then(function (d) {
        var data = source.ajaxParams.middleware(d);
        source.layer.clearLayers();
        source.layer.addData(data);
        self.fire('cloudant:data:loaded', data);
      }, function (err) {
        self.fire('cloudant:data:loaded', { error: err });
      });
    }
  },

  _refreshCancel: function (source) {
    // console.log('_refreshCancel called');
    clearInterval(source.refreshTimer); // Cancel the refresh (CYA)
  },

  _refreshSchedule: function (source) {
    // console.log('_refreshSchedule called');
    var self = this;
    self._refreshCancel(source); // Call cancel to make sure that we don't end up with multiple timers

    if (source.params.refreshSeconds > 0) {
      source.refreshTimer = setInterval(function () {
        self._refresh(source);
      }, source.params.refreshSeconds * 1000);
    }
  },
});

L.Util.Promise = Promise;
L.Util.ajax = ajax;
L.Util.jsonp = require('./jsonp');
L.geoJson.cloudant = function (options) {
  return new L.GeoJSON.Cloudant(options);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ajax":8,"./jsonp":10,"footils":1,"leaflet":"leaflet","lie":2,"lodash":"lodash"}],10:[function(require,module,exports){
(function (global){
'use strict';
var L = global.L || require('leaflet');
var Promise = require('lie');

module.exports = function (url, options) {
  options = options || {};
  var head = document.getElementsByTagName('head')[0];
  var scriptNode = L.DomUtil.create('script', '', head);
  var cbName, ourl, cbSuffix, cancel;
  var out = new Promise(function (resolve, reject) {
    cancel = reject;
    var cbParam = options.cbParam || 'callback';
    if (options.callbackName) {
      cbName = options.callbackName;
    } else {
      cbSuffix = '_' + ('' + Math.random()).slice(2);
      cbName = '_leafletJSONPcallbacks.' + cbSuffix;
    }
    scriptNode.type = 'text/javascript';
    if (cbSuffix) {
      if (!global._leafletJSONPcallbacks) {
        global._leafletJSONPcallbacks = {
          length: 0
        };
      }
      global._leafletJSONPcallbacks.length++;
      global._leafletJSONPcallbacks[cbSuffix] = function (data) {
        head.removeChild(scriptNode);
        delete global._leafletJSONPcallbacks[cbSuffix];
        global._leafletJSONPcallbacks.length--;
        if (!global._leafletJSONPcallbacks.length) {
          delete global._leafletJSONPcallbacks;
        }
        resolve(data);
      };
    }
    if (url.indexOf('?') === -1) {
      ourl = url + '?' + cbParam + '=' + cbName;
    } else {
      ourl = url + '&' + cbParam + '=' + cbName;
    }
    scriptNode.src = ourl;
  }).then(null, function (reason) {
    head.removeChild(scriptNode);
    delete L.Util.ajax.cb[cbSuffix];
    return reason;
  });
  out.abort = cancel;
  return out;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"leaflet":"leaflet","lie":2}]},{},[9]);
