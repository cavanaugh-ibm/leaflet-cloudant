leaflet-cloudant
===========

[![js-semistandard-style](https://img.shields.io/badge/code%20style-semistandard-brightgreen.svg?style=flat-square)](https://github.com/Flet/semistandard)


Allows you to manage several GeoJSON layers via a single control

```javascript
var layer = new L.GeoJSON.Cloudant("geojson.json");
```

To add sources of data (with automatic refreshing)
```javascript
layer.sourceAdd("colleges", "colleges.geojson", {onEachFeature: popUp, refreshSeconds: 30});
```

To change the source of data for a given layer
```javascript
layer.sourceUpdate("colleges", "new.url");
```

To remove a given layer
```javascript
layer.sourceRemove("colleges");
```
