var Queue = require('bull');
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
  area_size: 0.5,
  redisPort: 6379,
  redistHost: '127.0.0.1'
};

var WorldScanner = function (config) {
  var _this = this;
  _this.config = extend(default_config, config);
  if (typeof _this.config.client_id == 'undefined' || typeof _this.config.client_secret == 'undefined') {
    throw new Error('Foursquare client_id and client_secret are required.');
  }
  _this.scanner = Queue('worldscanner', _this.config.redisPort, _this.config.redisHost);
  _this.scanner.on('ready', function(){
    _this.emit('scannerReady');
  });
  _this.scanner.on('completed', function (task, venues) {
    if (venues && venues.length > 0) {
      for (var n = 0; n < venues.length; n++) {
        _this.emit('venueDiscovered', venues[n]);
      }
    }
  });
  
  _this.scanner.on('paused', function () {
    _this.emit('scannerPaused');
  });
  
  _this.scanner.on('resumed', function (task) {
    _this.emit('scannerResumed');
  });
  
  _this.scanner.on('error', function (err) {
    _this.emit('error', err);
  });
  
  _this.scanner.on('failed', function (scan, err) {
    _this.emit('scanFailed', {task: scan, err: err});
  });
  
  _this.scanner.process(function (task, done) {
    request('https://api.foursquare.com/v2/venues/search?client_id=' + _this.config.client_id + '&client_secret=' + _this.config.client_secret + '&v=20160427&intent=browse&sw=' + task.data.sw.lat + ',' + task.data.sw.lng + '&ne=' + task.data.ne.lat + ',' + task.data.ne.lng + '&limit=50', function (error, response, body) {
      if (error) {
        done(error);
      } else {
        var remaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
        if (remaining == 0) {
          _this.scanner.pause();
          var currentTimeStamp = Math.floor(Date.now() / 1000);
          var resume = (parseInt(response.headers['x-ratelimit-reset'], 10) - currentTimeStamp) * 1000;
          setTimeout(function () {
            _this.scanner.resume();
          }, resume);
        }
        if (response.statusCode == 200) {
          var data = JSON.parse(body);
          var venues = data.response.venues || [];
          if (venues.length >= 50) {
            var new_size = (task.data.ne.lat - task.data.sw.lat) / 2;
            _this.emit('areaSplit', new_size);
            _this._scan(task.data.ne, task.data.sw, new_size, true);
            done(null, []);
          } else {
            _this.emit('areaScanned', { ne: task.data.ne, sw: task.data.sw });
            done(null, venues);
          }
        } else {
          var current_size = task.data.ne.lat - task.data.sw.lat;
          _this._scan(task.data.ne, task.data.sw, current_size);
          done(Error('Api returned status: ' + response.statusCode));
        }
      }
    });
  });

  _this._scan = function (ne, sw, size, unshift) {
    var area_size = size || _this.config.area_size;
    var NE = ne || _this.config.ne;
    var SW = sw || _this.config.sw;

    var rows = (NE.lat - SW.lat) / area_size - area_size;
    var cols = (NE.lng - SW.lng) / area_size - area_size;

    var current_ne = {
      lat: NE.lat,
      lng: SW.lng + area_size
    };

    var current_sw = {
      lat: NE.lat - area_size,
      lng: SW.lng
    };

    for (var i = 0; i < rows; i++) {
      current_ne.lng = SW.lng + area_size;
      current_sw.lng = SW.lng;
      for (var j = 0; j < cols; j++) {
        if (unshift) {
          _this.scanner.add({ ne: extend({}, current_ne), sw: extend({}, current_sw) }, { attempts: 3, lifo: true });
        } else {
          _this.scanner.add({ ne: extend({}, current_ne), sw: extend({}, current_sw) }, { attempts: 3 });
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

WorldScanner.prototype.pause = function () {
  this.scanner.pause();
};

WorldScanner.prototype.resume = function () {
  this.scanner.resume();
};

WorldScanner.prototype.cancel = function () {
  this.scanner.empty();
};

WorldScanner.prototype.itemsLeft = function () {
  return this.scanner.count();
};

module.exports = WorldScanner;