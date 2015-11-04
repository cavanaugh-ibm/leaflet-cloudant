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
