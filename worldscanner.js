var async = require('async');
var request = require('request');
var events = require('events');
var extend = require('util')._extend;

var default_config = {
  ne: {
    lat: 90,
    lng: 180
  },
  sw: {
    lat: -90,
    lng: -180
  },
  area_size: 1
};

var WorldScanner = function (config) {
  var _this = this;
  _this.config = extend(default_config, config);
  if (typeof _this.config.client_id == 'undefined' || typeof _this.config.client_secret == 'undefined') {
    throw new Error('Foursquare client_id and client_secret are required.');
  }

  _this.scanner = async.queue(function (task, callback) {
    request('https://api.foursquare.com/v2/venues/search?client_id=' + _this.config.client_id + '&client_secret=' + _this.config.client_secret + '&v=20130815&intent=browse&sw=' + task.sw.lat + ',' + task.sw.lng + '&ne=' + task.ne.lat + ',' + task.ne.lng + '&limit=50', function (error, response, body) {
      if (error) {
        callback(error);
      } else {
        var remaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
        if (remaining == 0) {
          _this.scanner.pause();
          var resume = parseInt(response.headers['X-RateLimit-Reset'], 10) - new Date().getTime();
          _this.emit('scannerPaused', resume);
          setTimeout(function () {
            _this.scanner.resume();
            _this.emit('scannerResumed');
          }, resume);
        }
        if (response.statusCode == 200) {
          var data = JSON.parse(body);
          var venues = data.response.venues || [];
          if (venues.length >= 50) {
            var new_size = (task.ne.lat - task.sw.lat) / 2;
            _this.emit('areaSplit', new_size);
            _this._scan(task.ne, task.sw, new_size, true);
            callback(null, []);
          } else {
            _this.emit('areaScanned', { ne: task.ne, sw: task.sw });
            callback(null, venues);
          }
        } else {
          var current_size = task.ne.lat - task.sw.lat;
          _this._scan(task.ne, task.sw, current_size);
          callback('Api returned status: ' + response.statusCode);
        }
      }
    });
  });

  _this._scan = function (ne, sw, size, unshift) {
    var area_size = size || _this.config.area_size;
    var NE = ne || _this.config.ne;
    var SW = sw || _this.config.sw;

    var rows = (NE.lat - SW.lat) / area_size - 1;
    var cols = (NE.lng - SW.lng) / area_size - 1;

    var current_ne = {
      lat: NE.lat,
      lng: SW.lng + area_size
    };

    var current_sw = {
      lat: NE.lat - area_size,
      lng: SW.lng
    };

    var scannerCallback = function (err, venues) {
      if (err) {
        _this.emit('error', err);
      } else {
        for (var n = 0; n < venues.length; n++) {
          _this.emit('venueDiscovered', venues[n]);
        }
      }
    };

    for (var i = 0; i < rows; i++) {
      current_ne.lng = SW.lng + area_size;
      current_sw.lng = SW.lng;
      for (var j = 0; j < cols; j++) {
        if (unshift) {
          _this.scanner.unshift({ ne: extend({}, current_ne), sw: extend({}, current_sw) }, scannerCallback);
        } else {
          _this.scanner.push({ ne: extend({}, current_ne), sw: extend({}, current_sw) }, scannerCallback);
        }
        current_ne.lng += area_size;
        current_sw.lng += area_size;
      }
      current_ne.lat -= area_size;
      current_sw.lat -= area_size;
    }
  }
};

WorldScanner.prototype = new events.EventEmitter;

WorldScanner.prototype.scan = function (ne, sw, size) {
  this._scan(ne, sw, size);
};

WorldScanner.prototype.itemsLeft = function () {
  return this.scanner.length();
};

module.exports = WorldScanner;