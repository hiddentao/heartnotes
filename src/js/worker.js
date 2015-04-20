var _ = require('underscore');
_.mixin(require('./underscore_mixins'));

var D = require('D');
var usaLatLngData = require('us_latlng_json');




(function() {
  var self = this;

  self.addEventListener('message', function(e) {
    self.initialized
      .then(function() {
        var request = e.data,
          id = request.id,
          type = request.type,
          params = request.params;

        var result = null;

        switch (type) {
          case 'fieldInfo':
            result = {
              races: self.fieldInfo.races
            };
            break;
          case 'search':
            result = self.search(params);
            break;
        }

        self.postMessage({
          type: type,
          id: id,
          results: result
        });
      })
      .error(function(err) {
        console.error(err.stack);

        self.postMessage({
          error: error.toString()
        });
      });
  });



  self.search = function(filterParams) {
    return self.data.filter(function(item) {
      // victim age unknown
      if ('unknown' === item.victim_age) {
        if (!_.deepGet(filterParams, 'victim.age.includeUnknown')) {
          return false;
        }
      }
      // victim age known
      else if (item.victim_age < _.deepGet(filterParams, 'victim.age.lower', 0)  || 
            item.victim_age > _.deepGet(filterParams, 'victim.age.upper', 100)
          ) {
        return false;
      }

      // victim gender
      if (!_.contains(_.deepGet(filterParams, 'victim.gender', []), item.victim_gender)) {
        return false;
      }

      // victim armed
      if (!_.contains(_.deepGet(filterParams, 'victim.armed', []), item.victim_armed)) {
        return false;
      }

      // victim outcome
      if (!_.contains(_.deepGet(filterParams, 'victim.outcome', []), item.outcome)) {
        return false;
      }

      return true;
    });
  };


  // INITIALISATION


  var requiredProps = [
    'victim_gender',
    'state',
    'outcome',
  ];




  self._loadLatLngData = function() {
    if (self.latLngData) {
      return;
    }

    self.latLngData = {};

    for (var state in usaLatLngData) {
      var counties = usaLatLngData[state].counties,
        cities = usaLatLngData[state].cities;

      self.latLngData[state] = {
        counties: {},
        cities: {}
      };

      for (county in counties) {
        counties[county].name = county;
        self.latLngData[state].counties[county.toLowerCase()] = counties[county];
      }

      for (city in cities) {
        cities[city].name = city;
        self.latLngData[state].cities[city.toLowerCase()] = cities[city];
      }
    }
  };


  self.initialized = (function() {
    self._loadLatLngData();

    self.data = [];
    self.fieldInfo = {
      races: {}
    };

    var deferred = D();

    _.Ajax.get('http://localhost:8080/content?limit=30000', function(data) {
      deferred.resolve(data);
    })

    return deferred.promise
      .then(function(data) {
        var results = data.results;

        var notEnoughInfoCount = 0;

        results.forEach(function(item) {
          // need required props
          for (var i=0; i<requiredProps.length; ++i) {
            if (!item[requiredProps[i]]) {
              notEnoughInfoCount++;

              return;
            }
          }

          // age
          if (!item.victim_age) {
            item.victim_age = 'unknown';
          }

          // get state
          var state = item.state.toUpperCase();

          // get city, county
          var city = item.city,
            county = item.county;

          city = (city || '').toLowerCase();
          county = (county || '').toLowerCase();

          // if state valid
          if (self.latLngData[state]) {
            // if city known
            if (city.length && self.latLngData[state].cities[city]) {
              item.latlng = self.latLngData[state].cities[city];                
            }
            // if county known
            else if (county.length && self.latLngData[state].counties[county]) {
              item.latlng = self.latLngData[state].counties[county];                                
            }
            // else use state
            else {
              item.latlng = self.latLngData[state].center;
            }
          } else {
            notEnoughInfoCount++;

            return;
          }

          // normalize fields
          item.victim_gender = item.victim_gender.trim().toLowerCase();
          item.victim_race = (item.victim_race || 'unknown').trim().toLowerCase().replace(' or ', '/');
          self.fieldInfo.races[item.victim_race] = item.victim_race;

          item.victim_armed = (item.victim_armed || '').trim().toLowerCase();
          switch (item.victim_armed) {
            case 'armed':
            case 'unarmed':
              break;
            default:
              item.outcome = 'unknown';
          }

          item.outcome = (item.outcome || '').trim().toLowerCase();
          switch (item.outcome) {
            case 'hit':
            case 'killed':
              break;
            default:
              item.outcome = 'unknown';
          }

          self.data.push(item);
        });

        console.log('Not enough info for: ' + notEnoughInfoCount + ' items');
      })
      .then(function() {
        self.initialized = true;
      });
  })();

})(self);