WorldScanner
==============

WorldScanner is tool to scan selected area using foursquare api. If venue count from area is the same as the foursquare venue limit (50) the area will be split into smaller ones, so all the venues can be scanned.

Install:
--------
    npm install worldscanner
    
Note that if you are using version 0.1.0 or higher you will need a redis version higher or equal than 2.8.11 for WorldScanner to work properly.

Usage
-----------
```javascript
var WorldScanner = require('worldscanner');
var worldScanner = new WorldScanner({
  ne: { //Optional, default value: ne.lat = 90, ne.lng = 180
    lat: 90,
    lng: 180
  },
  sw: { //Optinal, default value: sw.lat = -90, sw.lng = -180
    lat: -90,
    lng: -180
  },
  area_size: 0.5, //Optional, default value: 0.5
  redisPort: 6379, //Optional, default value: 6379
  redistHost: '127.0.0.1', //Optional, default value: 127.0.0.1
  client_id: 'YOUR FOURSQUARE CLIENT_ID', //required
  client_secret: 'YOUR FOURSQUARE CLIENT_SECRET' //required
});

worldScanner.on('venueDiscovered', function(venue){
  //Do something with discoreved venue
});

worldScanner.scan();
```

Events
-----------
```javascript
.on('scannerReady', function(){
  //Connections to redis etc have been created
});

.on('venueDiscovered', function(venue){
  //Venue was discovered
});

.on('areaScanned', function(area){
  //Area was scanned without hitting venue limit, area contains ne and sw for the scanned area
});

.on('areaSplit', function(newSize){
  //Area was split into smaller ones because venue limit was hit, newSize is number of temporary scan size after split
});

.on('scannerPaused', function(){
  //Scanner was paused either because requests ran out or pause method was called
});

.on('scannerResumed', function(){
  //Scanner was resumed because requests were reset or resume method was called
});

.on('error', function(err){
  //Error occurred
});
```

Methods
-----------

###WorldScanner##scan([ne, sw, size])
Starts scan for the specified area, with specified initial size. If parameters omitted, default values specified during initialization will be used

###WorldScanner##pause()
Pauses scanner until resume() is called.

###WorldScanner##resume()
Resumes paused scanner

###WorldScanner##cancel()
Stops current scan
