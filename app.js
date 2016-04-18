var async = require('async');
var request = require('request');
var config = require('./config');
var extend = require('util')._extend;

var scanner = async.queue(function (task, callback) {
  request('https://api.foursquare.com/v2/venues/search?client_id='+config.APP_ID+'&client_secret='+config.APP_SECRET+'&v=20130815&intent=browse&sw='+task.sw.lat+','+task.sw.lng+'&ne='+task.ne.lat+','+task.ne.lng+'&size=50', function (error, response, body) {
    var remaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
    console.log(remaining)
    if(remaining == 0){
      scanner.pause();
      console.log(response.headers);
      console.log('Ratelimit exhausted');
      var resume = parseInt(response.headers['X-RateLimit-Reset'], 10) - new Date().getTime();
      console.log('Resuming scanning after: '+resume+'ms');
      setTimeout(function(){
        scanner.resume();
      }, resume);
    } 
    if (!error && response.statusCode == 200) {
      var data = JSON.parse(body);
      console.log(data.response.venues);
      callback();
    }else{
      console.log(error);
      callback(error);
    }
  });
});

var area_size = 1;

var NE = {
  lat: 90,
  lng: 180
};

var SW = {
  lat: -90,
  lng: -180
};

var rows = (NE.lat - SW.lat) / area_size - 1;
var cols = (NE.lng - SW.lng) / area_size - 1;
var total_areas = rows * cols;

console.log('Scanning '+rows+' rows and '+cols+' cols');

var current_ne = {
  lat: NE.lat,
  lng: SW.lng + area_size
};

var current_sw = {
  lat: NE.lat - area_size,
  lng: SW.lng
};

for(var i = 0; i < rows; i++){
  current_ne.lng = SW.lng + area_size;
	current_sw.lng = SW.lng;
  for(var j = 0; j < cols; j++){
    scanner.push({ne: extend({}, current_ne), sw: extend({}, current_sw)}, function (err) {
      console.log('finished processing area');
    });
    current_ne.lng += area_size;
		current_sw.lng += area_size;
  }
  current_ne.lat -= area_size;
	current_sw.lat -= area_size;
}