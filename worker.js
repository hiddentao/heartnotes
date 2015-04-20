(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"./underscore_mixins":6,"D":2,"underscore":3,"us_latlng_json":4}],2:[function(require,module,exports){
(function (process){
/**
* attempt of a simple defer/promise library for mobile development
* @author Jonathan Gotti < jgotti at jgotti dot net>
* @since 2012-10
* @version 0.7.2
*/
(function(undef){
	"use strict";

	var nextTick
		, isFunc = function(f){ return ( typeof f === 'function' ); }
		, isArray = function(a){ return Array.isArray ? Array.isArray(a) : (a instanceof Array); }
		, isObjOrFunc = function(o){ return !!(o && (typeof o).match(/function|object/)); }
		, isNotVal = function(v){ return (v === false || v === undef || v === null); }
		, slice = function(a, offset){ return [].slice.call(a, offset); }
		, undefStr = 'undefined'
		, tErr = typeof TypeError === undefStr ? Error : TypeError
	;
	if ( (typeof process !== undefStr) && process.nextTick ) {
		nextTick = process.nextTick;
	} else if ( typeof MessageChannel !== undefStr ) {
		var ntickChannel = new MessageChannel(), queue = [];
		ntickChannel.port1.onmessage = function(){ queue.length && (queue.shift())(); };
		nextTick = function(cb){
			queue.push(cb);
			ntickChannel.port2.postMessage(0);
		};
	} else {
		nextTick = function(cb){ setTimeout(cb, 0); };
	}
	function rethrow(e){ nextTick(function(){ throw e;}); }

	/**
	 * @typedef deferred
	 * @property {promise} promise
	 * @method resolve
	 * @method fulfill
	 * @method reject
	 */

	/**
	 * @typedef {function} fulfilled
	 * @param {*} value promise resolved value
	 * @returns {*} next promise resolution value
	 */

	/**
	 * @typedef {function} failed
	 * @param {*} reason promise rejection reason
	 * @returns {*} next promise resolution value or rethrow the reason
	 */

	//-- defining unenclosed promise methods --//
	/**
	 * same as then without failed callback
	 * @param {fulfilled} fulfilled callback
	 * @returns {promise} a new promise
	 */
	function promise_success(fulfilled){ return this.then(fulfilled, undef); }

	/**
	 * same as then with only a failed callback
	 * @param {failed} failed callback
	 * @returns {promise} a new promise
	 */
	function promise_error(failed){ return this.then(undef, failed); }


	/**
	 * same as then but fulfilled callback will receive multiple parameters when promise is fulfilled with an Array
	 * @param {fulfilled} fulfilled callback
	 * @param {failed} failed callback
	 * @returns {promise} a new promise
	 */
	function promise_apply(fulfilled, failed){
		return this.then(
			function(a){
				return isFunc(fulfilled) ? fulfilled.apply(null, isArray(a) ? a : [a]) : (defer.onlyFuncs ? a : fulfilled);
			}
			, failed || undef
		);
	}

	/**
	 * cleanup method which will be always executed regardless fulfillment or rejection
	 * @param {function} cb a callback called regardless of the fulfillment or rejection of the promise which will be called
	 *                      when the promise is not pending anymore
	 * @returns {promise} the same promise untouched
	 */
	function promise_ensure(cb){
		function _cb(){ cb(); }
		this.then(_cb, _cb);
		return this;
	}

	/**
	 * take a single callback which wait for an error as first parameter. other resolution values are passed as with the apply/spread method
	 * @param {function} cb a callback called regardless of the fulfillment or rejection of the promise which will be called
	 *                      when the promise is not pending anymore with error as first parameter if any as in node style
	 *                      callback. Rest of parameters will be applied as with the apply method.
	 * @returns {promise} a new promise
	 */
	function promise_nodify(cb){
		return this.then(
			function(a){
				return isFunc(cb) ? cb.apply(null, isArray(a) ? a.splice(0,0,undefined) && a : [undefined,a]) : (defer.onlyFuncs ? a : cb);
			}
			, function(e){
				return cb(e);
			}
		);
	}

	/**
	 *
	 * @param {function} [failed] without parameter will only rethrow promise rejection reason outside of the promise library on next tick
	 *                            if passed a failed method then will call failed on rejection and throw the error again if failed didn't
	 * @returns {promise} a new promise
	 */
	function promise_rethrow(failed){
		return this.then(
			undef
			, failed ? function(e){ failed(e); throw e; } : rethrow
		);
	}

	/**
	* @param {boolean} [alwaysAsync] if set force the async resolution for this promise independantly of the D.alwaysAsync option
	* @returns {deferred} defered object with property 'promise' and methods reject,fulfill,resolve (fulfill being an alias for resolve)
	*/
	var defer = function (alwaysAsync){
		var alwaysAsyncFn = (undef !== alwaysAsync ? alwaysAsync : defer.alwaysAsync) ? nextTick : function(fn){fn();}
			, status = 0 // -1 failed | 1 fulfilled
			, pendings = []
			, value
			/**
			 * @typedef promise
			 */
			, _promise  = {
				/**
				 * @param {fulfilled|function} fulfilled callback
				 * @param {failed|function} failed callback
				 * @returns {promise} a new promise
				 */
				then: function(fulfilled, failed){
					var d = defer();
					pendings.push([
						function(value){
							try{
								if( isNotVal(fulfilled)){
									d.resolve(value);
								} else {
									d.resolve(isFunc(fulfilled) ? fulfilled(value) : (defer.onlyFuncs ? value : fulfilled));
								}
							}catch(e){
								d.reject(e);
							}
						}
						, function(err){
							if ( isNotVal(failed) || ((!isFunc(failed)) && defer.onlyFuncs) ) {
								d.reject(err);
							}
							if ( failed ) {
								try{ d.resolve(isFunc(failed) ? failed(err) : failed); }catch(e){ d.reject(e);}
							}
						}
					]);
					status !== 0 && alwaysAsyncFn(execCallbacks);
					return d.promise;
				}

				, success: promise_success

				, error: promise_error
				, otherwise: promise_error

				, apply: promise_apply
				, spread: promise_apply

				, ensure: promise_ensure

				, nodify: promise_nodify

				, rethrow: promise_rethrow

				, isPending: function(){ return status === 0; }

				, getStatus: function(){ return status; }
			}
		;
		_promise.toSource = _promise.toString = _promise.valueOf = function(){return value === undef ? this : value; };


		function execCallbacks(){
			/*jshint bitwise:false*/
			if ( status === 0 ) {
				return;
			}
			var cbs = pendings, i = 0, l = cbs.length, cbIndex = ~status ? 0 : 1, cb;
			pendings = [];
			for( ; i < l; i++ ){
				(cb = cbs[i][cbIndex]) && cb(value);
			}
		}

		/**
		 * fulfill deferred with given value
		 * @param {*} val
		 * @returns {deferred} this for method chaining
		 */
		function _resolve(val){
			var done = false;
			function once(f){
				return function(x){
					if (done) {
						return undefined;
					} else {
						done = true;
						return f(x);
					}
				};
			}
			if ( status ) {
				return this;
			}
			try {
				var then = isObjOrFunc(val) && val.then;
				if ( isFunc(then) ) { // managing a promise
					if( val === _promise ){
						throw new tErr("Promise can't resolve itself");
					}
					then.call(val, once(_resolve), once(_reject));
					return this;
				}
			} catch (e) {
				once(_reject)(e);
				return this;
			}
			alwaysAsyncFn(function(){
				value = val;
				status = 1;
				execCallbacks();
			});
			return this;
		}

		/**
		 * reject deferred with given reason
		 * @param {*} Err
		 * @returns {deferred} this for method chaining
		 */
		function _reject(Err){
			status || alwaysAsyncFn(function(){
				try{ throw(Err); }catch(e){ value = e; }
				status = -1;
				execCallbacks();
			});
			return this;
		}
		return /**@type deferred */ {
			promise:_promise
			,resolve:_resolve
			,fulfill:_resolve // alias
			,reject:_reject
		};
	};

	defer.deferred = defer.defer = defer;
	defer.nextTick = nextTick;
	defer.alwaysAsync = true; // setting this will change default behaviour. use it only if necessary as asynchronicity will force some delay between your promise resolutions and is not always what you want.
	/**
	* setting onlyFuncs to false will break promises/A+ conformity by allowing you to pass non undefined/null values instead of callbacks
	* instead of just ignoring any non function parameters to then,success,error... it will accept non null|undefined values.
	* this will allow you shortcuts like promise.then('val','handled error'')
	* to be equivalent of promise.then(function(){ return 'val';},function(){ return 'handled error'})
	*/
	defer.onlyFuncs = true;

	/**
	 * return a fulfilled promise of given value (always async resolution)
	 * @param {*} value
	 * @returns {promise}
	 */
	defer.resolved = defer.fulfilled = function(value){ return defer(true).resolve(value).promise; };

	/**
	 * return a rejected promise with given reason of rejection (always async rejection)
	 * @param {*} reason
	 * @returns {promise}
	 */
	defer.rejected = function(reason){ return defer(true).reject(reason).promise; };

	/**
	 * return a promise with no resolution value which will be resolved in time ms (using setTimeout)
	 * @param {int} [time] in ms default to 0
	 * @returns {promise}
	 */
	defer.wait = function(time){
		var d = defer();
		setTimeout(d.resolve, time || 0);
		return d.promise;
	};

	/**
	 * return a promise for the return value of function call which will be fulfilled in delay ms or rejected if given fn throw an error
	 * @param {*} fn to execute or value to return after given delay
	 * @param {int} [delay] in ms default to 0
	 * @returns {promise}
	 */
	defer.delay = function(fn, delay){
		var d = defer();
		setTimeout(function(){ try{ d.resolve(isFunc(fn) ? fn.apply(null) : fn); }catch(e){ d.reject(e); } }, delay || 0);
		return d.promise;
	};

	/**
	 * if given value is not a promise return a fulfilled promise resolved to given value
	 * @param {*} promise a value or a promise
	 * @returns {promise}
	 */
	defer.promisify = function(promise){
		if ( promise && isFunc(promise.then) ) { return promise;}
		return defer.resolved(promise);
	};

	function multiPromiseResolver(callerArguments, returnPromises){
		var promises = slice(callerArguments);
		if ( promises.length === 1 && isArray(promises[0]) ) {
			if(! promises[0].length ){
				return defer.fulfilled([]);
			}
			promises = promises[0];
		}
		var args = []
			, d = defer()
			, c = promises.length
		;
		if ( !c ) {
			d.resolve(args);
		} else {
			var resolver = function(i){
				promises[i] = defer.promisify(promises[i]);
				promises[i].then(
					function(v){
						args[i] = returnPromises ? promises[i] : v;
						(--c) || d.resolve(args);
					}
					, function(e){
						if( ! returnPromises ){
							d.reject(e);
						} else {
							args[i] = promises[i];
							(--c) || d.resolve(args);
						}
					}
				);
			};
			for( var i = 0, l = c; i < l; i++ ){
				resolver(i);
			}
		}
		return d.promise;
	}

	function sequenceZenifier(promise, zenValue){
		return promise.then(isFunc(zenValue) ? zenValue : function(){return zenValue;});
	}
	function sequencePromiseResolver(callerArguments){
		var funcs = slice(callerArguments);
		if ( funcs.length === 1 && isArray(funcs[0]) ) {
			funcs = funcs[0];
		}
		var d = defer(), i=0, l=funcs.length, promise = defer.resolved();
		for(; i<l; i++){
			promise = sequenceZenifier(promise, funcs[i]);
		}
		d.resolve(promise);
		return d.promise;
	}

	/**
	 * return a promise for all given promises / values.
	 * the returned promises will be fulfilled with a list of resolved value.
	 * if any given promise is rejected then on the first rejection the returned promised will be rejected with the same reason
	 * @param {array|...*} [promise] can be a single array of promise/values as first parameter or a list of direct parameters promise/value
	 * @returns {promise} of a list of given promise resolution value
	 */
	defer.all = function(){ return multiPromiseResolver(arguments,false); };

	/**
	 * return an always fulfilled promise of array<promise> list of promises/values regardless they resolve fulfilled or rejected
	 * @param {array|...*} [promise] can be a single array of promise/values as first parameter or a list of direct parameters promise/value
	 *                     (non promise values will be promisified)
	 * @returns {promise} of the list of given promises
	 */
	defer.resolveAll = function(){ return multiPromiseResolver(arguments,true); };

	/**
	* execute given function in sequence passing their returned values to the next one in sequence.
	* You can pass values or promise instead of functions they will be passed in the sequence as if a function returned them.
	* if any function throw an error or a rejected promise the final returned promise will be rejected with that reason.
	* @param {array|...*} [function] list of function to call in sequence receiving previous one as a parameter
	*                     (non function values will be treated as if returned by a function)
	* @returns {promise} of the list of given promises
	*/
	defer.sequence = function(){ return sequencePromiseResolver(arguments); };

	/**
	 * transform a typical nodejs async method awaiting a callback as last parameter, receiving error as first parameter to a function that
	 * will return a promise instead. the returned promise will resolve with normal callback value minus the first error parameter on
	 * fulfill and will be rejected with that error as reason in case of error.
	 * @param {object} [subject] optional subject of the method to encapsulate
	 * @param {function} fn the function to encapsulate if the normal callback should receive more than a single parameter (minus the error)
	 *                      the promise will resolve with the list or parameters as fulfillment value. If only one parameter is sent to the
	 *                      callback then it will be used as the resolution value.
	 * @returns {Function}
	 */
	defer.nodeCapsule = function(subject, fn){
		if ( !fn ) {
			fn = subject;
			subject = void(0);
		}
		return function(){
			var d = defer(), args = slice(arguments);
			args.push(function(err, res){
				err ? d.reject(err) : d.resolve(arguments.length > 2 ? slice(arguments, 1) : res);
			});
			try{
				fn.apply(subject, args);
			}catch(e){
				d.reject(e);
			}
			return d.promise;
		};
	};

	/*global define*/
	if ( typeof define === 'function' && define.amd ) {
		define('D.js', [], function(){ return defer; });
	} else if ( typeof window !== undefStr ) {
		var oldD = window.D;
		/**
		 * restore global D variable to its previous value and return D to the user
		 * @returns {Function}
		 */
		defer.noConflict = function(){
			window.D = oldD;
			return defer;
		};
		window.D = defer;
	} else if ( typeof module !== undefStr && module.exports ) {
		module.exports = defer;
	}
})();

}).call(this,require('_process'))

},{"_process":5}],3:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],4:[function(require,module,exports){
module.exports={
    "TX": {
        "counties": {
            "Anderson": {
                "lat": 31.841266,
                "lng": -95.661744
            },
            "Andrews": {
                "lat": 32.312258,
                "lng": -102.640206
            },
            "Angelina": {
                "lat": 31.251951,
                "lng": -94.611056
            },
            "Aransas": {
                "lat": 28.104225,
                "lng": -96.977983
            },
            "Archer": {
                "lat": 33.616305,
                "lng": -98.687267
            },
            "Armstrong": {
                "lat": 34.964179,
                "lng": -101.356636
            },
            "Atascosa": {
                "lat": 28.894296,
                "lng": -98.528187
            },
            "Austin": {
                "lat": 29.891901,
                "lng": -96.27017
            },
            "Bailey": {
                "lat": 34.067521,
                "lng": -102.830345
            },
            "Bandera": {
                "lat": 29.755748,
                "lng": -99.260682
            },
            "Bastrop": {
                "lat": 30.103128,
                "lng": -97.311859
            },
            "Baylor": {
                "lat": 33.618172,
                "lng": -99.197228
            },
            "Bee": {
                "lat": 28.416077,
                "lng": -97.742586
            },
            "Bell": {
                "lat": 31.04211,
                "lng": -97.481921
            },
            "Bexar": {
                "lat": 29.448671,
                "lng": -98.520147
            },
            "Blanco": {
                "lat": 30.265605,
                "lng": -98.399977
            },
            "Borden": {
                "lat": 32.744062,
                "lng": -101.433033
            },
            "Bosque": {
                "lat": 31.900764,
                "lng": -97.637632
            },
            "Bowie": {
                "lat": 33.446051,
                "lng": -94.422375
            },
            "Brazoria": {
                "lat": 29.167818,
                "lng": -95.434647
            },
            "Brazos": {
                "lat": 30.656725,
                "lng": -96.302389
            },
            "Brewster": {
                "lat": 29.808997,
                "lng": -103.252458
            },
            "Briscoe": {
                "lat": 34.525173,
                "lng": -101.205893
            },
            "Brooks": {
                "lat": 27.034994,
                "lng": -98.215276
            },
            "Brown": {
                "lat": 31.764103,
                "lng": -98.99847
            },
            "Burleson": {
                "lat": 30.493487,
                "lng": -96.622091
            },
            "Burnet": {
                "lat": 30.789616,
                "lng": -98.201195
            },
            "Caldwell": {
                "lat": 29.840422,
                "lng": -97.631097
            },
            "Calhoun": {
                "lat": 28.445366,
                "lng": -96.5833
            },
            "Callahan": {
                "lat": 32.29315,
                "lng": -99.372249
            },
            "Cameron": {
                "lat": 26.102923,
                "lng": -97.478958
            },
            "Camp": {
                "lat": 32.974581,
                "lng": -94.979085
            },
            "Carson": {
                "lat": 35.405496,
                "lng": -101.355356
            },
            "Cass": {
                "lat": 33.083698,
                "lng": -94.357579
            },
            "Castro": {
                "lat": 34.533621,
                "lng": -102.258786
            },
            "Chambers": {
                "lat": 29.703933,
                "lng": -94.668875
            },
            "Cherokee": {
                "lat": 31.843859,
                "lng": -95.156504
            },
            "Childress": {
                "lat": 34.529337,
                "lng": -100.208336
            },
            "Clay": {
                "lat": 33.785904,
                "lng": -98.212918
            },
            "Cochran": {
                "lat": 33.60844,
                "lng": -102.830449
            },
            "Coke": {
                "lat": 31.877105,
                "lng": -100.635236
            },
            "Coleman": {
                "lat": 31.914205,
                "lng": -99.346622
            },
            "Collin": {
                "lat": 33.193885,
                "lng": -96.578153
            },
            "Collingsworth": {
                "lat": 34.963358,
                "lng": -100.272135
            },
            "Colorado": {
                "lat": 29.595908,
                "lng": -96.508389
            },
            "Comal": {
                "lat": 29.803019,
                "lng": -98.255201
            },
            "Comanche": {
                "lat": 31.951645,
                "lng": -98.549617
            },
            "Concho": {
                "lat": 31.318865,
                "lng": -99.863648
            },
            "Cooke": {
                "lat": 33.639169,
                "lng": -97.210372
            },
            "Coryell": {
                "lat": 31.391177,
                "lng": -97.798022
            },
            "Cottle": {
                "lat": 34.091906,
                "lng": -100.276442
            },
            "Crane": {
                "lat": 31.422797,
                "lng": -102.487774
            },
            "Crockett": {
                "lat": 30.717532,
                "lng": -101.404211
            },
            "Crosby": {
                "lat": 33.609144,
                "lng": -101.29871
            },
            "Culberson": {
                "lat": 31.445909,
                "lng": -104.526945
            },
            "Dallam": {
                "lat": 36.28637,
                "lng": -102.59402
            },
            "Dallas": {
                "lat": 32.766987,
                "lng": -96.778424
            },
            "Dawson": {
                "lat": 32.741934,
                "lng": -101.947322
            },
            "Deaf Smith": {
                "lat": 34.940766,
                "lng": -102.607564
            },
            "Delta": {
                "lat": 33.385933,
                "lng": -95.67335
            },
            "Denton": {
                "lat": 33.205005,
                "lng": -97.119046
            },
            "DeWitt": {
                "lat": 29.082342,
                "lng": -97.361656
            },
            "Dickens": {
                "lat": 33.614666,
                "lng": -100.786095
            },
            "Dimmit": {
                "lat": 28.423587,
                "lng": -99.765871
            },
            "Donley": {
                "lat": 34.955036,
                "lng": -100.815846
            },
            "Duval": {
                "lat": 27.681123,
                "lng": -98.497393
            },
            "Eastland": {
                "lat": 32.324645,
                "lng": -98.83656
            },
            "Ector": {
                "lat": 31.865301,
                "lng": -102.542507
            },
            "Edwards": {
                "lat": 29.985877,
                "lng": -100.307373
            },
            "Ellis": {
                "lat": 32.347279,
                "lng": -96.798336
            },
            "El Paso": {
                "lat": 31.766403,
                "lng": -106.241391
            },
            "Erath": {
                "lat": 32.238136,
                "lng": -98.222377
            },
            "Falls": {
                "lat": 31.25193,
                "lng": -96.934128
            },
            "Fannin": {
                "lat": 33.591161,
                "lng": -96.104988
            },
            "Fayette": {
                "lat": 29.877886,
                "lng": -96.921231
            },
            "Fisher": {
                "lat": 32.740473,
                "lng": -100.40312
            },
            "Floyd": {
                "lat": 34.073731,
                "lng": -101.303274
            },
            "Foard": {
                "lat": 33.980404,
                "lng": -99.777427
            },
            "Fort Bend": {
                "lat": 29.526602,
                "lng": -95.771015
            },
            "Franklin": {
                "lat": 33.175846,
                "lng": -95.219066
            },
            "Freestone": {
                "lat": 31.701654,
                "lng": -96.144237
            },
            "Frio": {
                "lat": 28.869334,
                "lng": -99.108788
            },
            "Gaines": {
                "lat": 32.743942,
                "lng": -102.631562
            },
            "Galveston": {
                "lat": 29.228706,
                "lng": -94.894865
            },
            "Garza": {
                "lat": 33.183792,
                "lng": -101.301134
            },
            "Gillespie": {
                "lat": 30.32639,
                "lng": -98.942106
            },
            "Glasscock": {
                "lat": 31.868591,
                "lng": -101.528971
            },
            "Goliad": {
                "lat": 28.6607,
                "lng": -97.430415
            },
            "Gonzales": {
                "lat": 29.468704,
                "lng": -97.477738
            },
            "Gray": {
                "lat": 35.402542,
                "lng": -100.812374
            },
            "Grayson": {
                "lat": 33.624508,
                "lng": -96.675699
            },
            "Gregg": {
                "lat": 32.486397,
                "lng": -94.816276
            },
            "Grimes": {
                "lat": 30.543231,
                "lng": -95.988082
            },
            "Guadalupe": {
                "lat": 29.583208,
                "lng": -97.949027
            },
            "Hale": {
                "lat": 34.068436,
                "lng": -101.822888
            },
            "Hall": {
                "lat": 34.453189,
                "lng": -100.576343
            },
            "Hamilton": {
                "lat": 31.706982,
                "lng": -98.111794
            },
            "Hansford": {
                "lat": 36.272847,
                "lng": -101.35693
            },
            "Hardeman": {
                "lat": 34.289904,
                "lng": -99.745697
            },
            "Hardin": {
                "lat": 30.329612,
                "lng": -94.393149
            },
            "Harris": {
                "lat": 29.857273,
                "lng": -95.393037
            },
            "Harrison": {
                "lat": 32.547993,
                "lng": -94.374425
            },
            "Hartley": {
                "lat": 35.840244,
                "lng": -102.610047
            },
            "Haskell": {
                "lat": 33.175965,
                "lng": -99.730773
            },
            "Hays": {
                "lat": 30.061225,
                "lng": -98.029267
            },
            "Hemphill": {
                "lat": 35.816237,
                "lng": -100.284807
            },
            "Henderson": {
                "lat": 32.211633,
                "lng": -95.853418
            },
            "Hidalgo": {
                "lat": 26.396384,
                "lng": -98.18099
            },
            "Hill": {
                "lat": 31.98224,
                "lng": -97.129886
            },
            "Hockley": {
                "lat": 33.605932,
                "lng": -102.343398
            },
            "Hood": {
                "lat": 32.430149,
                "lng": -97.831677
            },
            "Hopkins": {
                "lat": 33.148959,
                "lng": -95.565194
            },
            "Houston": {
                "lat": 31.323036,
                "lng": -95.4216
            },
            "Howard": {
                "lat": 32.303583,
                "lng": -101.43853
            },
            "Hudspeth": {
                "lat": 31.450868,
                "lng": -105.377549
            },
            "Hunt": {
                "lat": 33.123438,
                "lng": -96.083807
            },
            "Hutchinson": {
                "lat": 35.837047,
                "lng": -101.362746
            },
            "Irion": {
                "lat": 31.303424,
                "lng": -100.981304
            },
            "Jack": {
                "lat": 33.232277,
                "lng": -98.171902
            },
            "Jackson": {
                "lat": 28.959802,
                "lng": -96.58908
            },
            "Jasper": {
                "lat": 30.752932,
                "lng": -94.022294
            },
            "Jeff Davis": {
                "lat": 30.617087,
                "lng": -104.18786
            },
            "Jefferson": {
                "lat": 29.854,
                "lng": -94.149331
            },
            "Jim Hogg": {
                "lat": 27.041212,
                "lng": -98.700127
            },
            "Jim Wells": {
                "lat": 27.733516,
                "lng": -98.090814
            },
            "Johnson": {
                "lat": 32.379511,
                "lng": -97.364823
            },
            "Jones": {
                "lat": 32.743709,
                "lng": -99.87443
            },
            "Karnes": {
                "lat": 28.907618,
                "lng": -97.860767
            },
            "Kaufman": {
                "lat": 32.598944,
                "lng": -96.288378
            },
            "Kendall": {
                "lat": 29.944524,
                "lng": -98.711094
            },
            "Kenedy": {
                "lat": 26.890232,
                "lng": -97.591233
            },
            "Kent": {
                "lat": 33.18478,
                "lng": -100.76972
            },
            "Kerr": {
                "lat": 30.053928,
                "lng": -99.351968
            },
            "Kimble": {
                "lat": 30.479472,
                "lng": -99.746396
            },
            "King": {
                "lat": 33.614159,
                "lng": -100.250548
            },
            "Kinney": {
                "lat": 29.347087,
                "lng": -100.4177
            },
            "Kleberg": {
                "lat": 27.438735,
                "lng": -97.66062
            },
            "Knox": {
                "lat": 33.616657,
                "lng": -99.747112
            },
            "Lamar": {
                "lat": 33.667263,
                "lng": -95.570348
            },
            "Lamb": {
                "lat": 34.068862,
                "lng": -102.348018
            },
            "Lampasas": {
                "lat": 31.196731,
                "lng": -98.240889
            },
            "La Salle": {
                "lat": 28.351098,
                "lng": -99.096774
            },
            "Lavaca": {
                "lat": 29.382578,
                "lng": -96.923633
            },
            "Lee": {
                "lat": 30.321105,
                "lng": -96.976365
            },
            "Leon": {
                "lat": 31.300493,
                "lng": -95.995622
            },
            "Liberty": {
                "lat": 30.162189,
                "lng": -94.822682
            },
            "Limestone": {
                "lat": 31.547543,
                "lng": -96.593623
            },
            "Lipscomb": {
                "lat": 36.2802,
                "lng": -100.272683
            },
            "Live Oak": {
                "lat": 28.351535,
                "lng": -98.126961
            },
            "Llano": {
                "lat": 30.707585,
                "lng": -98.68469
            },
            "Loving": {
                "lat": 31.844936,
                "lng": -103.561229
            },
            "Lubbock": {
                "lat": 33.611469,
                "lng": -101.819944
            },
            "Lynn": {
                "lat": 33.178412,
                "lng": -101.818493
            },
            "McCulloch": {
                "lat": 31.205477,
                "lng": -99.359856
            },
            "McLennan": {
                "lat": 31.549493,
                "lng": -97.201472
            },
            "McMullen": {
                "lat": 28.384922,
                "lng": -98.578853
            },
            "Madison": {
                "lat": 30.966878,
                "lng": -95.930372
            },
            "Marion": {
                "lat": 32.797757,
                "lng": -94.357673
            },
            "Martin": {
                "lat": 32.30983,
                "lng": -101.961836
            },
            "Mason": {
                "lat": 30.703232,
                "lng": -99.237608
            },
            "Matagorda": {
                "lat": 28.783341,
                "lng": -95.997755
            },
            "Maverick": {
                "lat": 28.745217,
                "lng": -100.311368
            },
            "Medina": {
                "lat": 29.353661,
                "lng": -99.111085
            },
            "Menard": {
                "lat": 30.883707,
                "lng": -99.854936
            },
            "Midland": {
                "lat": 31.870896,
                "lng": -102.024326
            },
            "Milam": {
                "lat": 30.791242,
                "lng": -96.984395
            },
            "Mills": {
                "lat": 31.494889,
                "lng": -98.594623
            },
            "Mitchell": {
                "lat": 32.303781,
                "lng": -100.92458
            },
            "Montague": {
                "lat": 33.676289,
                "lng": -97.724747
            },
            "Montgomery": {
                "lat": 30.302364,
                "lng": -95.503523
            },
            "Moore": {
                "lat": 35.835676,
                "lng": -101.890502
            },
            "Morris": {
                "lat": 33.116466,
                "lng": -94.731265
            },
            "Motley": {
                "lat": 34.058383,
                "lng": -100.793696
            },
            "Nacogdoches": {
                "lat": 31.62056,
                "lng": -94.62025
            },
            "Navarro": {
                "lat": 32.04845,
                "lng": -96.476908
            },
            "Newton": {
                "lat": 30.786718,
                "lng": -93.73925
            },
            "Nolan": {
                "lat": 32.312338,
                "lng": -100.418108
            },
            "Nueces": {
                "lat": 27.739406,
                "lng": -97.521643
            },
            "Ochiltree": {
                "lat": 36.278744,
                "lng": -100.815864
            },
            "Oldham": {
                "lat": 35.401921,
                "lng": -102.59762
            },
            "Orange": {
                "lat": 30.120918,
                "lng": -93.893358
            },
            "Palo Pinto": {
                "lat": 32.75221,
                "lng": -98.317974
            },
            "Panola": {
                "lat": 32.163978,
                "lng": -94.305156
            },
            "Parker": {
                "lat": 32.777096,
                "lng": -97.805905
            },
            "Parmer": {
                "lat": 34.532163,
                "lng": -102.784853
            },
            "Pecos": {
                "lat": 30.770894,
                "lng": -102.71986
            },
            "Polk": {
                "lat": 30.784553,
                "lng": -94.837338
            },
            "Potter": {
                "lat": 35.398675,
                "lng": -101.893804
            },
            "Presidio": {
                "lat": 30.005891,
                "lng": -104.261619
            },
            "Rains": {
                "lat": 32.87058,
                "lng": -95.79544
            },
            "Randall": {
                "lat": 34.962529,
                "lng": -101.895547
            },
            "Reagan": {
                "lat": 31.372895,
                "lng": -101.513901
            },
            "Real": {
                "lat": 29.82303,
                "lng": -99.805303
            },
            "Red River": {
                "lat": 33.619626,
                "lng": -95.048429
            },
            "Reeves": {
                "lat": 31.308366,
                "lng": -103.712706
            },
            "Refugio": {
                "lat": 28.312496,
                "lng": -97.160479
            },
            "Roberts": {
                "lat": 35.836216,
                "lng": -100.807555
            },
            "Robertson": {
                "lat": 31.025481,
                "lng": -96.514941
            },
            "Rockwall": {
                "lat": 32.889216,
                "lng": -96.407501
            },
            "Runnels": {
                "lat": 31.833311,
                "lng": -99.967856
            },
            "Rusk": {
                "lat": 32.109423,
                "lng": -94.756382
            },
            "Sabine": {
                "lat": 31.3433,
                "lng": -93.851913
            },
            "San Augustine": {
                "lat": 31.382449,
                "lng": -94.16318
            },
            "San Jacinto": {
                "lat": 30.574218,
                "lng": -95.162852
            },
            "San Patricio": {
                "lat": 28.011782,
                "lng": -97.517165
            },
            "San Saba": {
                "lat": 31.155138,
                "lng": -98.819292
            },
            "Schleicher": {
                "lat": 30.896233,
                "lng": -100.527216
            },
            "Scurry": {
                "lat": 32.744462,
                "lng": -100.913399
            },
            "Shackelford": {
                "lat": 32.743788,
                "lng": -99.347045
            },
            "Shelby": {
                "lat": 31.790137,
                "lng": -94.142565
            },
            "Sherman": {
                "lat": 36.277628,
                "lng": -101.894716
            },
            "Smith": {
                "lat": 32.377093,
                "lng": -95.26963
            },
            "Somervell": {
                "lat": 32.217942,
                "lng": -97.769211
            },
            "Starr": {
                "lat": 26.546335,
                "lng": -98.715803
            },
            "Stephens": {
                "lat": 32.731531,
                "lng": -98.840081
            },
            "Sterling": {
                "lat": 31.835774,
                "lng": -101.054911
            },
            "Stonewall": {
                "lat": 33.17958,
                "lng": -100.253807
            },
            "Sutton": {
                "lat": 30.517865,
                "lng": -100.505395
            },
            "Swisher": {
                "lat": 34.53046,
                "lng": -101.732852
            },
            "Tarrant": {
                "lat": 32.77204,
                "lng": -97.291291
            },
            "Taylor": {
                "lat": 32.295684,
                "lng": -99.89322
            },
            "Terrell": {
                "lat": 30.232332,
                "lng": -102.072539
            },
            "Terry": {
                "lat": 33.171229,
                "lng": -102.339284
            },
            "Throckmorton": {
                "lat": 33.170712,
                "lng": -99.206137
            },
            "Titus": {
                "lat": 33.214599,
                "lng": -94.966783
            },
            "Tom Green": {
                "lat": 31.401583,
                "lng": -100.461355
            },
            "Travis": {
                "lat": 30.239513,
                "lng": -97.69127
            },
            "Trinity": {
                "lat": 31.087483,
                "lng": -95.153291
            },
            "Tyler": {
                "lat": 30.769579,
                "lng": -94.379449
            },
            "Upshur": {
                "lat": 32.735878,
                "lng": -94.941649
            },
            "Upton": {
                "lat": 31.353849,
                "lng": -102.042013
            },
            "Uvalde": {
                "lat": 29.35034,
                "lng": -99.761074
            },
            "Val Verde": {
                "lat": 29.884961,
                "lng": -101.146646
            },
            "Van Zandt": {
                "lat": 32.558948,
                "lng": -95.836391
            },
            "Victoria": {
                "lat": 28.79637,
                "lng": -96.971198
            },
            "Walker": {
                "lat": 30.74309,
                "lng": -95.569888
            },
            "Waller": {
                "lat": 30.013578,
                "lng": -95.982102
            },
            "Ward": {
                "lat": 31.513069,
                "lng": -103.105113
            },
            "Washington": {
                "lat": 30.215075,
                "lng": -96.410272
            },
            "Webb": {
                "lat": 27.770584,
                "lng": -99.326641
            },
            "Wharton": {
                "lat": 29.278481,
                "lng": -96.229675
            },
            "Wheeler": {
                "lat": 35.392593,
                "lng": -100.253107
            },
            "Wichita": {
                "lat": 33.991103,
                "lng": -98.716851
            },
            "Wilbarger": {
                "lat": 34.08492,
                "lng": -99.24244
            },
            "Willacy": {
                "lat": 26.481092,
                "lng": -97.584224
            },
            "Williamson": {
                "lat": 30.64903,
                "lng": -97.605069
            },
            "Wilson": {
                "lat": 29.174303,
                "lng": -98.085899
            },
            "Winkler": {
                "lat": 31.831416,
                "lng": -103.055986
            },
            "Wise": {
                "lat": 33.219095,
                "lng": -97.653997
            },
            "Wood": {
                "lat": 32.783588,
                "lng": -95.382166
            },
            "Yoakum": {
                "lat": 33.172397,
                "lng": -102.823771
            },
            "Young": {
                "lat": 33.158787,
                "lng": -98.678267
            },
            "Zapata": {
                "lat": 26.996981,
                "lng": -99.182603
            },
            "Zavala": {
                "lat": 28.864652,
                "lng": -99.75983
            }
        },
        "cities": {
            "Abilene": {
                "lat": 32.4487364,
                "lng": -99.73314390000002
            },
            "Allen": {
                "lat": 33.1031744,
                "lng": -96.67055030000002
            },
            "Amarillo": {
                "lat": 35.2219971,
                "lng": -101.8312969
            },
            "Arlington": {
                "lat": 32.735687,
                "lng": -97.10806559999999
            },
            "Atascocita": {
                "lat": 29.99883059999999,
                "lng": -95.1765978
            },
            "Austin": {
                "lat": 30.267153,
                "lng": -97.7430608
            },
            "Baytown": {
                "lat": 29.7355047,
                "lng": -94.97742740000001
            },
            "Beaumont": {
                "lat": 30.080174,
                "lng": -94.1265562
            },
            "Bedford": {
                "lat": 32.844017,
                "lng": -97.1430671
            },
            "Brownsville": {
                "lat": 25.9017472,
                "lng": -97.4974838
            },
            "Bryan": {
                "lat": 30.6743643,
                "lng": -96.3699632
            },
            "Carrollton": {
                "lat": 32.9756415,
                "lng": -96.8899636
            },
            "Cedar Hill": {
                "lat": 32.5884689,
                "lng": -96.9561152
            },
            "Cedar Park": {
                "lat": 30.505198,
                "lng": -97.8202888
            },
            "College Station": {
                "lat": 30.627977,
                "lng": -96.3344068
            },
            "Conroe": {
                "lat": 30.3118769,
                "lng": -95.45605119999999
            },
            "Corpus Christi": {
                "lat": 27.8005828,
                "lng": -97.39638099999999
            },
            "Dallas": {
                "lat": 32.802955,
                "lng": -96.769923
            },
            "Denton": {
                "lat": 33.2148412,
                "lng": -97.13306829999999
            },
            "DeSoto": {
                "lat": 32.5898577,
                "lng": -96.85694509999999
            },
            "Edinburg": {
                "lat": 26.3017374,
                "lng": -98.1633432
            },
            "El Paso": {
                "lat": 31.7587198,
                "lng": -106.4869314
            },
            "Euless": {
                "lat": 32.8370727,
                "lng": -97.08195409999999
            },
            "Flower Mound": {
                "lat": 33.0145673,
                "lng": -97.0969552
            },
            "Fort Worth": {
                "lat": 32.725409,
                "lng": -97.3208496
            },
            "Frisco": {
                "lat": 33.1506744,
                "lng": -96.82361159999999
            },
            "Galveston": {
                "lat": 29.3013479,
                "lng": -94.7976958
            },
            "Garland": {
                "lat": 32.912624,
                "lng": -96.63888329999999
            },
            "Georgetown": {
                "lat": 30.6326942,
                "lng": -97.6772311
            },
            "Grand Prairie": {
                "lat": 32.7459645,
                "lng": -96.99778459999999
            },
            "Grapevine": {
                "lat": 32.9342919,
                "lng": -97.0780654
            },
            "Haltom City": {
                "lat": 32.7995738,
                "lng": -97.26918169999999
            },
            "Harlingen": {
                "lat": 26.1906306,
                "lng": -97.69610259999999
            },
            "Houston": {
                "lat": 29.7601927,
                "lng": -95.36938959999999
            },
            "Irving": {
                "lat": 32.8140177,
                "lng": -96.9488945
            },
            "Keller": {
                "lat": 32.9345701,
                "lng": -97.251682
            },
            "Killeen": {
                "lat": 31.1171194,
                "lng": -97.72779589999999
            },
            "Laredo": {
                "lat": 27.506407,
                "lng": -99.5075421
            },
            "League City": {
                "lat": 29.5074538,
                "lng": -95.0949303
            },
            "Lewisville": {
                "lat": 33.046233,
                "lng": -96.994174
            },
            "Longview": {
                "lat": 32.5007037,
                "lng": -94.74048909999999
            },
            "Lubbock": {
                "lat": 33.5778631,
                "lng": -101.8551665
            },
            "McAllen": {
                "lat": 26.2034071,
                "lng": -98.23001239999999
            },
            "McKinney": {
                "lat": 33.1972465,
                "lng": -96.6397822
            },
            "Mansfield": {
                "lat": 32.5631924,
                "lng": -97.1416768
            },
            "Mesquite": {
                "lat": 32.76679550000001,
                "lng": -96.5991593
            },
            "Midland": {
                "lat": 31.9973456,
                "lng": -102.0779146
            },
            "Mission": {
                "lat": 26.2159066,
                "lng": -98.32529319999999
            },
            "Missouri City": {
                "lat": 29.6185669,
                "lng": -95.5377215
            },
            "New Braunfels": {
                "lat": 29.7030024,
                "lng": -98.1244531
            },
            "North Richland Hills": {
                "lat": 32.8342952,
                "lng": -97.2289029
            },
            "Odessa": {
                "lat": 31.8456816,
                "lng": -102.3676431
            },
            "Pasadena": {
                "lat": 29.6910625,
                "lng": -95.2091006
            },
            "Pearland": {
                "lat": 29.5635666,
                "lng": -95.2860474
            },
            "Pflugerville": {
                "lat": 30.4393696,
                "lng": -97.62000429999999
            },
            "Pharr": {
                "lat": 26.1947962,
                "lng": -98.1836216
            },
            "Plano": {
                "lat": 33.0198431,
                "lng": -96.6988856
            },
            "Port Arthur": {
                "lat": 29.8849504,
                "lng": -93.93994699999999
            },
            "Richardson": {
                "lat": 32.9481789,
                "lng": -96.7297205
            },
            "Rockwall": {
                "lat": 32.93123360000001,
                "lng": -96.4597089
            },
            "Round Rock": {
                "lat": 30.5082551,
                "lng": -97.678896
            },
            "Rowlett": {
                "lat": 32.9029017,
                "lng": -96.56388
            },
            "San Angelo": {
                "lat": 31.4637723,
                "lng": -100.4370375
            },
            "San Antonio": {
                "lat": 29.4241219,
                "lng": -98.49362819999999
            },
            "San Marcos": {
                "lat": 29.8832749,
                "lng": -97.9413941
            },
            "Spring": {
                "lat": 30.0799405,
                "lng": -95.41716009999999
            },
            "Sugar Land": {
                "lat": 29.6196787,
                "lng": -95.6349463
            },
            "Temple": {
                "lat": 31.0982344,
                "lng": -97.342782
            },
            "Texas City": {
                "lat": 29.383845,
                "lng": -94.9027002
            },
            "The Woodlands": {
                "lat": 30.1658207,
                "lng": -95.46126249999999
            },
            "Tyler": {
                "lat": 32.3512601,
                "lng": -95.30106239999999
            },
            "Victoria": {
                "lat": 28.8052674,
                "lng": -97.0035982
            },
            "Waco": {
                "lat": 31.549333,
                "lng": -97.1466695
            },
            "Wichita Falls": {
                "lat": 33.9137085,
                "lng": -98.4933873
            },
            "Wylie": {
                "lat": 33.0151201,
                "lng": -96.5388789
            }
        },
        "center": {
            "lat": 31.106,
            "lng": -97.6475
        }
    },
    "OH": {
        "counties": {
            "Adams": {
                "lat": 38.841681,
                "lng": -83.474173
            },
            "Allen": {
                "lat": 40.771528,
                "lng": -84.106546
            },
            "Ashland": {
                "lat": 40.843274,
                "lng": -82.270121
            },
            "Ashtabula": {
                "lat": 41.906644,
                "lng": -80.745641
            },
            "Athens": {
                "lat": 39.333848,
                "lng": -82.046008
            },
            "Auglaize": {
                "lat": 40.561309,
                "lng": -84.224018
            },
            "Belmont": {
                "lat": 40.017682,
                "lng": -80.967727
            },
            "Brown": {
                "lat": 38.931377,
                "lng": -83.866772
            },
            "Butler": {
                "lat": 39.439915,
                "lng": -84.565397
            },
            "Carroll": {
                "lat": 40.579884,
                "lng": -81.090787
            },
            "Champaign": {
                "lat": 40.132759,
                "lng": -83.767543
            },
            "Clark": {
                "lat": 39.917032,
                "lng": -83.783676
            },
            "Clermont": {
                "lat": 39.052084,
                "lng": -84.149614
            },
            "Clinton": {
                "lat": 39.414041,
                "lng": -83.814542
            },
            "Columbiana": {
                "lat": 40.768462,
                "lng": -80.777231
            },
            "Coshocton": {
                "lat": 40.29672,
                "lng": -81.930112
            },
            "Crawford": {
                "lat": 40.848508,
                "lng": -82.924771
            },
            "Cuyahoga": {
                "lat": 41.760392,
                "lng": -81.724217
            },
            "Darke": {
                "lat": 40.132176,
                "lng": -84.620438
            },
            "Defiance": {
                "lat": 41.321679,
                "lng": -84.486433
            },
            "Delaware": {
                "lat": 40.278941,
                "lng": -83.007462
            },
            "Erie": {
                "lat": 41.554006,
                "lng": -82.525897
            },
            "Fairfield": {
                "lat": 39.752935,
                "lng": -82.628276
            },
            "Fayette": {
                "lat": 39.553845,
                "lng": -83.459327
            },
            "Franklin": {
                "lat": 39.969447,
                "lng": -83.008258
            },
            "Fulton": {
                "lat": 41.597264,
                "lng": -84.124267
            },
            "Gallia": {
                "lat": 38.817046,
                "lng": -82.301746
            },
            "Geauga": {
                "lat": 41.499322,
                "lng": -81.173505
            },
            "Greene": {
                "lat": 39.687479,
                "lng": -83.894894
            },
            "Guernsey": {
                "lat": 40.056665,
                "lng": -81.497875
            },
            "Hamilton": {
                "lat": 39.196927,
                "lng": -84.544187
            },
            "Hancock": {
                "lat": 41.000471,
                "lng": -83.666034
            },
            "Hardin": {
                "lat": 40.660415,
                "lng": -83.664077
            },
            "Harrison": {
                "lat": 40.292318,
                "lng": -81.091565
            },
            "Henry": {
                "lat": 41.335072,
                "lng": -84.065882
            },
            "Highland": {
                "lat": 39.184488,
                "lng": -83.603668
            },
            "Hocking": {
                "lat": 39.490343,
                "lng": -82.483445
            },
            "Holmes": {
                "lat": 40.565309,
                "lng": -81.929869
            },
            "Huron": {
                "lat": 41.14508,
                "lng": -82.594641
            },
            "Jackson": {
                "lat": 39.013477,
                "lng": -82.614142
            },
            "Jefferson": {
                "lat": 40.399188,
                "lng": -80.76141
            },
            "Knox": {
                "lat": 40.40362,
                "lng": -82.422393
            },
            "Lake": {
                "lat": 41.924116,
                "lng": -81.392643
            },
            "Lawrence": {
                "lat": 38.603866,
                "lng": -82.517186
            },
            "Licking": {
                "lat": 40.093609,
                "lng": -82.481251
            },
            "Logan": {
                "lat": 40.387553,
                "lng": -83.766343
            },
            "Lorain": {
                "lat": 41.438805,
                "lng": -82.179722
            },
            "Lucas": {
                "lat": 41.682321,
                "lng": -83.468867
            },
            "Madison": {
                "lat": 39.896607,
                "lng": -83.400885
            },
            "Mahoning": {
                "lat": 41.01088,
                "lng": -80.770396
            },
            "Marion": {
                "lat": 40.588208,
                "lng": -83.172927
            },
            "Medina": {
                "lat": 41.116051,
                "lng": -81.899566
            },
            "Meigs": {
                "lat": 39.089807,
                "lng": -82.028397
            },
            "Mercer": {
                "lat": 40.535333,
                "lng": -84.632059
            },
            "Miami": {
                "lat": 40.053326,
                "lng": -84.228414
            },
            "Monroe": {
                "lat": 39.725969,
                "lng": -81.090658
            },
            "Montgomery": {
                "lat": 39.755218,
                "lng": -84.290546
            },
            "Morgan": {
                "lat": 39.624946,
                "lng": -81.861699
            },
            "Morrow": {
                "lat": 40.525266,
                "lng": -82.797729
            },
            "Muskingum": {
                "lat": 39.966046,
                "lng": -81.943506
            },
            "Noble": {
                "lat": 39.767232,
                "lng": -81.452604
            },
            "Ottawa": {
                "lat": 41.544467,
                "lng": -83.009253
            },
            "Paulding": {
                "lat": 41.119141,
                "lng": -84.576967
            },
            "Perry": {
                "lat": 39.743187,
                "lng": -82.237953
            },
            "Pickaway": {
                "lat": 39.648947,
                "lng": -83.052827
            },
            "Pike": {
                "lat": 39.071365,
                "lng": -83.052921
            },
            "Portage": {
                "lat": 41.16864,
                "lng": -81.196932
            },
            "Preble": {
                "lat": 39.737906,
                "lng": -84.645358
            },
            "Putnam": {
                "lat": 41.024533,
                "lng": -84.129879
            },
            "Richland": {
                "lat": 40.774167,
                "lng": -82.542715
            },
            "Ross": {
                "lat": 39.323763,
                "lng": -83.059585
            },
            "Sandusky": {
                "lat": 41.355291,
                "lng": -83.142735
            },
            "Scioto": {
                "lat": 38.815019,
                "lng": -82.999028
            },
            "Seneca": {
                "lat": 41.120008,
                "lng": -83.127436
            },
            "Shelby": {
                "lat": 40.33668,
                "lng": -84.204143
            },
            "Stark": {
                "lat": 40.814131,
                "lng": -81.365667
            },
            "Summit": {
                "lat": 41.121851,
                "lng": -81.534936
            },
            "Trumbull": {
                "lat": 41.308936,
                "lng": -80.767656
            },
            "Tuscarawas": {
                "lat": 40.447441,
                "lng": -81.471157
            },
            "Union": {
                "lat": 40.295901,
                "lng": -83.367042
            },
            "Van Wert": {
                "lat": 40.85552,
                "lng": -84.585775
            },
            "Vinton": {
                "lat": 39.252014,
                "lng": -82.485961
            },
            "Warren": {
                "lat": 39.425652,
                "lng": -84.169906
            },
            "Washington": {
                "lat": 39.450684,
                "lng": -81.490653
            },
            "Wayne": {
                "lat": 40.829661,
                "lng": -81.887194
            },
            "Williams": {
                "lat": 41.564958,
                "lng": -84.584323
            },
            "Wood": {
                "lat": 41.360183,
                "lng": -83.622682
            },
            "Wyandot": {
                "lat": 40.840122,
                "lng": -83.313172
            }
        },
        "cities": {
            "Akron": {
                "lat": 41.0814447,
                "lng": -81.51900529999999
            },
            "Beavercreek": {
                "lat": 39.7092262,
                "lng": -84.06326849999999
            },
            "Canton": {
                "lat": 40.79894729999999,
                "lng": -81.378447
            },
            "Centerville": {
                "lat": 39.6283928,
                "lng": -84.15938179999999
            },
            "Cincinnati": {
                "lat": 39.1031182,
                "lng": -84.5120196
            },
            "Cleveland": {
                "lat": 41.4994954,
                "lng": -81.6954088
            },
            "Cleveland Heights": {
                "lat": 41.5200518,
                "lng": -81.556235
            },
            "Columbus": {
                "lat": 39.9611755,
                "lng": -82.99879419999999
            },
            "Cuyahoga Falls": {
                "lat": 41.1339449,
                "lng": -81.48455849999999
            },
            "Dayton": {
                "lat": 39.7589478,
                "lng": -84.1916069
            },
            "Dublin": {
                "lat": 40.0992294,
                "lng": -83.1140771
            },
            "Elyria": {
                "lat": 41.3683798,
                "lng": -82.10764859999999
            },
            "Euclid": {
                "lat": 41.5931049,
                "lng": -81.5267873
            },
            "Fairfield": {
                "lat": 39.3454673,
                "lng": -84.5603187
            },
            "Hamilton": {
                "lat": 39.3995008,
                "lng": -84.5613355
            },
            "Kettering": {
                "lat": 39.68950359999999,
                "lng": -84.1688274
            },
            "Lakewood": {
                "lat": 41.4819932,
                "lng": -81.7981908
            },
            "Lorain": {
                "lat": 41.452819,
                "lng": -82.1823746
            },
            "Mansfield": {
                "lat": 40.75839,
                "lng": -82.5154471
            },
            "Mentor": {
                "lat": 41.6661573,
                "lng": -81.339552
            },
            "Middletown": {
                "lat": 39.5150576,
                "lng": -84.39827629999999
            },
            "Newark": {
                "lat": 40.0581205,
                "lng": -82.4012642
            },
            "Parma": {
                "lat": 41.4047742,
                "lng": -81.7229086
            },
            "Springfield": {
                "lat": 39.9242266,
                "lng": -83.8088171
            },
            "Strongsville": {
                "lat": 41.3144966,
                "lng": -81.83569
            },
            "Toledo": {
                "lat": 41.6639383,
                "lng": -83.55521200000001
            },
            "Youngstown": {
                "lat": 41.0997803,
                "lng": -80.6495194
            }
        },
        "center": {
            "lat": 40.3736,
            "lng": -82.7755
        }
    },
    "FL": {
        "counties": {
            "Alachua": {
                "lat": 29.67574,
                "lng": -82.357221
            },
            "Baker": {
                "lat": 30.324442,
                "lng": -82.302284
            },
            "Bay": {
                "lat": 30.237563,
                "lng": -85.631348
            },
            "Bradford": {
                "lat": 29.946934,
                "lng": -82.166796
            },
            "Brevard": {
                "lat": 28.298276,
                "lng": -80.700384
            },
            "Broward": {
                "lat": 26.19352,
                "lng": -80.476658
            },
            "Calhoun": {
                "lat": 30.388801,
                "lng": -85.197916
            },
            "Charlotte": {
                "lat": 26.868826,
                "lng": -81.940858
            },
            "Citrus": {
                "lat": 28.843628,
                "lng": -82.524796
            },
            "Clay": {
                "lat": 29.987116,
                "lng": -81.858147
            },
            "Collier": {
                "lat": 26.118713,
                "lng": -81.400884
            },
            "Columbia": {
                "lat": 30.221305,
                "lng": -82.623127
            },
            "DeSoto": {
                "lat": 27.190581,
                "lng": -81.806253
            },
            "Dixie": {
                "lat": 29.580899,
                "lng": -83.195666
            },
            "Duval": {
                "lat": 30.335245,
                "lng": -81.648113
            },
            "Escambia": {
                "lat": 30.611664,
                "lng": -87.33904
            },
            "Flagler": {
                "lat": 29.474894,
                "lng": -81.286362
            },
            "Franklin": {
                "lat": 29.810176,
                "lng": -84.799174
            },
            "Gadsden": {
                "lat": 30.57917,
                "lng": -84.612783
            },
            "Gilchrist": {
                "lat": 29.723456,
                "lng": -82.795801
            },
            "Glades": {
                "lat": 26.95481,
                "lng": -81.19082
            },
            "Gulf": {
                "lat": 29.907257,
                "lng": -85.256537
            },
            "Hamilton": {
                "lat": 30.491102,
                "lng": -82.951049
            },
            "Hardee": {
                "lat": 27.492846,
                "lng": -81.82158
            },
            "Hendry": {
                "lat": 26.53934,
                "lng": -81.151584
            },
            "Hernando": {
                "lat": 28.567911,
                "lng": -82.464835
            },
            "Highlands": {
                "lat": 27.342627,
                "lng": -81.340921
            },
            "Hillsborough": {
                "lat": 27.90659,
                "lng": -82.349568
            },
            "Holmes": {
                "lat": 30.866222,
                "lng": -85.812959
            },
            "Indian River": {
                "lat": 27.700638,
                "lng": -80.574803
            },
            "Jackson": {
                "lat": 30.787812,
                "lng": -85.210374
            },
            "Jefferson": {
                "lat": 30.424558,
                "lng": -83.890859
            },
            "Lafayette": {
                "lat": 29.990066,
                "lng": -83.17851
            },
            "Lake": {
                "lat": 28.764113,
                "lng": -81.712282
            },
            "Lee": {
                "lat": 26.552134,
                "lng": -81.89225
            },
            "Leon": {
                "lat": 30.45931,
                "lng": -84.2778
            },
            "Levy": {
                "lat": 29.284409,
                "lng": -82.783483
            },
            "Liberty": {
                "lat": 30.259849,
                "lng": -84.868581
            },
            "Madison": {
                "lat": 30.447228,
                "lng": -83.470437
            },
            "Manatee": {
                "lat": 27.481386,
                "lng": -82.365784
            },
            "Marion": {
                "lat": 29.202805,
                "lng": -82.0431
            },
            "Martin": {
                "lat": 27.079954,
                "lng": -80.398211
            },
            "Miami-Dade": {
                "lat": 25.610494,
                "lng": -80.499045
            },
            "Monroe": {
                "lat": 25.601043,
                "lng": -81.206777
            },
            "Nassau": {
                "lat": 30.605926,
                "lng": -81.764929
            },
            "Okaloosa": {
                "lat": 30.665858,
                "lng": -86.594194
            },
            "Okeechobee": {
                "lat": 27.385592,
                "lng": -80.887388
            },
            "Orange": {
                "lat": 28.514435,
                "lng": -81.323295
            },
            "Osceola": {
                "lat": 28.059027,
                "lng": -81.139312
            },
            "Palm Beach": {
                "lat": 26.645763,
                "lng": -80.448673
            },
            "Pasco": {
                "lat": 28.302024,
                "lng": -82.455707
            },
            "Pinellas": {
                "lat": 27.903122,
                "lng": -82.739518
            },
            "Polk": {
                "lat": 27.953115,
                "lng": -81.692783
            },
            "Putnam": {
                "lat": 29.606006,
                "lng": -81.740894
            },
            "St. Johns": {
                "lat": 29.890593,
                "lng": -81.383914
            },
            "St. Lucie": {
                "lat": 27.380775,
                "lng": -80.443364
            },
            "Santa Rosa": {
                "lat": 30.703633,
                "lng": -87.014255
            },
            "Sarasota": {
                "lat": 27.184386,
                "lng": -82.365835
            },
            "Seminole": {
                "lat": 28.690079,
                "lng": -81.13198
            },
            "Sumter": {
                "lat": 28.714294,
                "lng": -82.074715
            },
            "Suwannee": {
                "lat": 30.189244,
                "lng": -82.992754
            },
            "Taylor": {
                "lat": 30.016943,
                "lng": -83.616417
            },
            "Union": {
                "lat": 30.05428,
                "lng": -82.366918
            },
            "Volusia": {
                "lat": 29.057617,
                "lng": -81.161813
            },
            "Wakulla": {
                "lat": 30.140378,
                "lng": -84.375136
            },
            "Walton": {
                "lat": 30.631211,
                "lng": -86.176614
            },
            "Washington": {
                "lat": 30.602217,
                "lng": -85.662797
            }
        },
        "cities": {
            "Alafaya": {
                "lat": 28.5641,
                "lng": -81.2114
            },
            "Altamonte Springs": {
                "lat": 28.6611089,
                "lng": -81.3656242
            },
            "Apopka": {
                "lat": 28.68675,
                "lng": -81.51327599999999
            },
            "Boca Raton": {
                "lat": 26.3586885,
                "lng": -80.0830984
            },
            "Bonita Springs": {
                "lat": 26.339806,
                "lng": -81.7786972
            },
            "Boynton Beach": {
                "lat": 26.5253491,
                "lng": -80.0664309
            },
            "Bradenton": {
                "lat": 27.4989278,
                "lng": -82.5748194
            },
            "Brandon": {
                "lat": 27.937801,
                "lng": -82.2859247
            },
            "Cape Coral": {
                "lat": 26.5628537,
                "lng": -81.9495331
            },
            "Clearwater": {
                "lat": 27.9658533,
                "lng": -82.8001026
            },
            "Coconut Creek": {
                "lat": 26.2517482,
                "lng": -80.17893509999999
            },
            "Coral Gables": {
                "lat": 25.72149,
                "lng": -80.2683838
            },
            "Coral Springs": {
                "lat": 26.271192,
                "lng": -80.2706044
            },
            "Country Club": {
                "lat": 25.9481487,
                "lng": -80.3169953
            },
            "Cutler Bay": {
                "lat": 25.5783,
                "lng": -80.3377
            },
            "Davie": {
                "lat": 26.0628664,
                "lng": -80.2331038
            },
            "Daytona Beach": {
                "lat": 29.2108147,
                "lng": -81.0228331
            },
            "Deerfield Beach": {
                "lat": 26.3184123,
                "lng": -80.09976569999999
            },
            "Delray Beach": {
                "lat": 26.4614625,
                "lng": -80.0728201
            },
            "Deltona": {
                "lat": 28.9005446,
                "lng": -81.26367379999999
            },
            "Doral": {
                "lat": 25.8195424,
                "lng": -80.3553302
            },
            "Fort Lauderdale": {
                "lat": 26.1223084,
                "lng": -80.14337859999999
            },
            "Fort Myers": {
                "lat": 26.640628,
                "lng": -81.8723084
            },
            "Fort Pierce": {
                "lat": 27.4467056,
                "lng": -80.3256056
            },
            "Fountainbleau": {
                "lat": 25.7728774,
                "lng": -80.3478301
            },
            "Gainesville": {
                "lat": 29.6516344,
                "lng": -82.32482619999999
            },
            "Hialeah": {
                "lat": 25.8575963,
                "lng": -80.2781057
            },
            "Hollywood": {
                "lat": 26.0112014,
                "lng": -80.1494901
            },
            "Homestead": {
                "lat": 25.4687224,
                "lng": -80.4775569
            },
            "Jacksonville": {
                "lat": 30.3321838,
                "lng": -81.65565099999999
            },
            "Jupiter": {
                "lat": 26.9342246,
                "lng": -80.0942087
            },
            "Kendale Lakes": {
                "lat": 25.7081577,
                "lng": -80.4069986
            },
            "Kendall": {
                "lat": 25.6660336,
                "lng": -80.357827
            },
            "Kissimmee": {
                "lat": 28.2919557,
                "lng": -81.40757099999999
            },
            "Lakeland": {
                "lat": 28.0394654,
                "lng": -81.9498042
            },
            "Largo": {
                "lat": 27.9094665,
                "lng": -82.7873244
            },
            "Lauderhill": {
                "lat": 26.1403635,
                "lng": -80.2133808
            },
            "Lehigh Acres": {
                "lat": 26.6253497,
                "lng": -81.6248026
            },
            "Margate": {
                "lat": 26.2445263,
                "lng": -80.206436
            },
            "Melbourne": {
                "lat": 28.0836269,
                "lng": -80.60810889999999
            },
            "Miami": {
                "lat": 25.7889689,
                "lng": -80.2264393
            },
            "Miami Gardens": {
                "lat": 25.9420377,
                "lng": -80.2456045
            },
            "Miramar": {
                "lat": 25.9756704,
                "lng": -80.28675009999999
            },
            "North Lauderdale": {
                "lat": 26.217305,
                "lng": -80.2258811
            },
            "North Miami": {
                "lat": 25.8900949,
                "lng": -80.1867138
            },
            "North Miami Beach": {
                "lat": 25.9331488,
                "lng": -80.1625463
            },
            "North Port": {
                "lat": 27.044224,
                "lng": -82.2359254
            },
            "Oakland Park": {
                "lat": 26.1723065,
                "lng": -80.1319893
            },
            "Ocala": {
                "lat": 29.1871986,
                "lng": -82.14009229999999
            },
            "Orlando": {
                "lat": 28.5383355,
                "lng": -81.3792365
            },
            "Palm Bay": {
                "lat": 28.0344621,
                "lng": -80.5886646
            },
            "Palm Beach Gardens": {
                "lat": 26.8233946,
                "lng": -80.13865469999999
            },
            "Palm Coast": {
                "lat": 29.5849736,
                "lng": -81.2078411
            },
            "Palm Harbor": {
                "lat": 28.0780718,
                "lng": -82.7637127
            },
            "Pembroke Pines": {
                "lat": 26.0122378,
                "lng": -80.3152233
            },
            "Pensacola": {
                "lat": 30.42130899999999,
                "lng": -87.2169149
            },
            "Pine Hills": {
                "lat": 28.5577794,
                "lng": -81.4534046
            },
            "Pinellas Park": {
                "lat": 27.8428025,
                "lng": -82.6995443
            },
            "Plantation": {
                "lat": 26.1275862,
                "lng": -80.23310359999999
            },
            "Poinciana": {
                "lat": 28.1402939,
                "lng": -81.4584058
            },
            "Pompano Beach": {
                "lat": 26.2378597,
                "lng": -80.1247667
            },
            "Port Charlotte": {
                "lat": 26.9761707,
                "lng": -82.09064479999999
            },
            "Port Orange": {
                "lat": 29.1383165,
                "lng": -80.9956105
            },
            "Port St Lucie": {
                "lat": 27.2758333,
                "lng": -80.35499999999999
            },
            "Riverview": {
                "lat": 27.8661364,
                "lng": -82.32648089999999
            },
            "St Petersburg": {
                "lat": 27.7730556,
                "lng": -82.64
            },
            "Sanford": {
                "lat": 28.7588218,
                "lng": -81.29417939999999
            },
            "Sarasota": {
                "lat": 27.3364347,
                "lng": -82.53065269999999
            },
            "Spring Hill": {
                "lat": 28.4831682,
                "lng": -82.5369872
            },
            "Sunrise": {
                "lat": 26.1571743,
                "lng": -80.28622560000001
            },
            "Tallahassee": {
                "lat": 30.4382559,
                "lng": -84.28073289999999
            },
            "Tamarac": {
                "lat": 26.2128609,
                "lng": -80.2497707
            },
            "Tamiami": {
                "lat": 25.7587114,
                "lng": -80.398387
            },
            "Tampa": {
                "lat": 27.950575,
                "lng": -82.4571776
            },
            "The Hammocks": {
                "lat": 25.6714925,
                "lng": -80.4444997
            },
            "The Villages": {
                "lat": 28.9377778,
                "lng": -81.9711111
            },
            "Titusville": {
                "lat": 28.6122187,
                "lng": -80.8075537
            },
            "Town 'n' Country": {
                "lat": 28.0105745,
                "lng": -82.57731930000001
            },
            "Valrico": {
                "lat": 27.9408333,
                "lng": -82.24249999999999
            },
            "Wellington": {
                "lat": 26.6552309,
                "lng": -80.25425129999999
            },
            "Wesley Chapel": {
                "lat": 28.1786111,
                "lng": -82.35055559999999
            },
            "Weston": {
                "lat": 26.1003654,
                "lng": -80.3997748
            },
            "West Palm Beach": {
                "lat": 26.7153424,
                "lng": -80.0533746
            }
        },
        "center": {
            "lat": 27.8333,
            "lng": -81.717
        }
    },
    "CA": {
        "counties": {
            "Alameda": {
                "lat": 37.648081,
                "lng": -121.913304
            },
            "Alpine": {
                "lat": 38.61761,
                "lng": -119.798999
            },
            "Amador": {
                "lat": 38.44355,
                "lng": -120.653856
            },
            "Butte": {
                "lat": 39.665959,
                "lng": -121.601919
            },
            "Calaveras": {
                "lat": 38.187844,
                "lng": -120.555115
            },
            "Colusa": {
                "lat": 39.177739,
                "lng": -122.237563
            },
            "Contra Costa": {
                "lat": 37.919479,
                "lng": -121.951543
            },
            "Del Norte": {
                "lat": 41.749903,
                "lng": -123.980998
            },
            "El Dorado": {
                "lat": 38.785532,
                "lng": -120.534398
            },
            "Fresno": {
                "lat": 36.761006,
                "lng": -119.655019
            },
            "Glenn": {
                "lat": 39.602546,
                "lng": -122.4017
            },
            "Humboldt": {
                "lat": 40.706673,
                "lng": -123.925818
            },
            "Imperial": {
                "lat": 33.040816,
                "lng": -115.355395
            },
            "Inyo": {
                "lat": 36.561977,
                "lng": -117.403927
            },
            "Kern": {
                "lat": 35.346629,
                "lng": -118.729506
            },
            "Kings": {
                "lat": 36.072478,
                "lng": -119.81553
            },
            "Lake": {
                "lat": 39.094802,
                "lng": -122.746757
            },
            "Lassen": {
                "lat": 40.721089,
                "lng": -120.629931
            },
            "Los Angeles": {
                "lat": 34.196398,
                "lng": -118.261862
            },
            "Madera": {
                "lat": 37.210039,
                "lng": -119.749852
            },
            "Marin": {
                "lat": 38.051817,
                "lng": -122.745974
            },
            "Mariposa": {
                "lat": 37.570034,
                "lng": -119.91286
            },
            "Mendocino": {
                "lat": 39.432388,
                "lng": -123.442881
            },
            "Merced": {
                "lat": 37.194806,
                "lng": -120.722802
            },
            "Modoc": {
                "lat": 41.592919,
                "lng": -120.71837
            },
            "Mono": {
                "lat": 37.915836,
                "lng": -118.875167
            },
            "Monterey": {
                "lat": 36.240107,
                "lng": -121.315573
            },
            "Napa": {
                "lat": 38.507351,
                "lng": -122.325995
            },
            "Nevada": {
                "lat": 39.295191,
                "lng": -120.773446
            },
            "Orange": {
                "lat": 33.675687,
                "lng": -117.777207
            },
            "Placer": {
                "lat": 39.062032,
                "lng": -120.722718
            },
            "Plumas": {
                "lat": 39.99517,
                "lng": -120.829516
            },
            "Riverside": {
                "lat": 33.729828,
                "lng": -116.002239
            },
            "Sacramento": {
                "lat": 38.450011,
                "lng": -121.340441
            },
            "San Benito": {
                "lat": 36.610702,
                "lng": -121.085296
            },
            "San Bernardino": {
                "lat": 34.85722,
                "lng": -116.181197
            },
            "San Diego": {
                "lat": 33.023604,
                "lng": -116.776117
            },
            "San Francisco": {
                "lat": 37.727239,
                "lng": -123.032229
            },
            "San Joaquin": {
                "lat": 37.935034,
                "lng": -121.272237
            },
            "San Luis Obispo": {
                "lat": 35.385227,
                "lng": -120.44754
            },
            "San Mateo": {
                "lat": 37.414664,
                "lng": -122.371542
            },
            "Santa Barbara": {
                "lat": 34.537378,
                "lng": -120.038485
            },
            "Santa Clara": {
                "lat": 37.220777,
                "lng": -121.690622
            },
            "Santa Cruz": {
                "lat": 37.012488,
                "lng": -122.007205
            },
            "Shasta": {
                "lat": 40.760522,
                "lng": -122.04355
            },
            "Sierra": {
                "lat": 39.576925,
                "lng": -120.521993
            },
            "Siskiyou": {
                "lat": 41.587986,
                "lng": -122.533287
            },
            "Solano": {
                "lat": 38.267226,
                "lng": -121.939594
            },
            "Sonoma": {
                "lat": 38.532574,
                "lng": -122.945194
            },
            "Stanislaus": {
                "lat": 37.562384,
                "lng": -121.002656
            },
            "Sutter": {
                "lat": 39.035257,
                "lng": -121.702758
            },
            "Tehama": {
                "lat": 40.126156,
                "lng": -122.232276
            },
            "Trinity": {
                "lat": 40.647724,
                "lng": -123.114404
            },
            "Tulare": {
                "lat": 36.230453,
                "lng": -118.780542
            },
            "Tuolumne": {
                "lat": 38.021451,
                "lng": -119.964708
            },
            "Ventura": {
                "lat": 34.358742,
                "lng": -119.133143
            },
            "Yolo": {
                "lat": 38.679268,
                "lng": -121.903178
            },
            "Yuba": {
                "lat": 39.270026,
                "lng": -121.34428
            }
        },
        "cities": {
            "Alameda": {
                "lat": 37.7652065,
                "lng": -122.2416355
            },
            "Alhambra": {
                "lat": 34.095287,
                "lng": -118.1270146
            },
            "Aliso Viejo": {
                "lat": 33.57509599999999,
                "lng": -117.725431
            },
            "Altadena": {
                "lat": 34.1897274,
                "lng": -118.1311819
            },
            "Anaheim": {
                "lat": 33.8352932,
                "lng": -117.9145036
            },
            "Antelope North Rd": {
                "lat": 38.7172491,
                "lng": -121.3274832
            },
            "Antioch": {
                "lat": 38.0049214,
                "lng": -121.805789
            },
            "Apple Valley": {
                "lat": 34.5008311,
                "lng": -117.1858759
            },
            "Arcadia": {
                "lat": 34.1397292,
                "lng": -118.0353449
            },
            "Arden-Arcade": {
                "lat": 38.6008071,
                "lng": -121.3770336
            },
            "Azusa": {
                "lat": 34.1336186,
                "lng": -117.9075627
            },
            "Bakersfield": {
                "lat": 35.3732921,
                "lng": -119.0187125
            },
            "Baldwin Park": {
                "lat": 34.0852868,
                "lng": -117.9608978
            },
            "Beaumont": {
                "lat": 33.9294606,
                "lng": -116.977248
            },
            "Bellflower": {
                "lat": 33.8816818,
                "lng": -118.1170117
            },
            "Bell Gardens": {
                "lat": 33.9652918,
                "lng": -118.1514588
            },
            "Berkeley": {
                "lat": 37.8715926,
                "lng": -122.272747
            },
            "Brentwood": {
                "lat": 37.931868,
                "lng": -121.6957863
            },
            "Buena Park": {
                "lat": 33.8675143,
                "lng": -117.9981181
            },
            "Burbank": {
                "lat": 37.3205556,
                "lng": -121.9316667
            },
            "Calexico": {
                "lat": 32.6789476,
                "lng": -115.4988834
            },
            "Camarillo": {
                "lat": 34.2163937,
                "lng": -119.0376023
            },
            "Carlsbad": {
                "lat": 33.1580933,
                "lng": -117.3505939
            },
            "Carmichael": {
                "lat": 38.617127,
                "lng": -121.3282843
            },
            "Carson": {
                "lat": 33.8314058,
                "lng": -118.2820165
            },
            "Castro Valley": {
                "lat": 37.6940973,
                "lng": -122.0863522
            },
            "Cathedral City": {
                "lat": 33.7797426,
                "lng": -116.4652911
            },
            "Ceres": {
                "lat": 37.5949316,
                "lng": -120.9577098
            },
            "Cerritos": {
                "lat": 33.8583483,
                "lng": -118.0647871
            },
            "Chico": {
                "lat": 39.7284944,
                "lng": -121.8374777
            },
            "Chino": {
                "lat": 34.0122346,
                "lng": -117.688944
            },
            "Chino Hills": {
                "lat": 33.9898188,
                "lng": -117.7325848
            },
            "Chula Vista": {
                "lat": 32.6400541,
                "lng": -117.0841955
            },
            "Citrus Heights": {
                "lat": 38.7071247,
                "lng": -121.2810611
            },
            "Clovis": {
                "lat": 36.8252277,
                "lng": -119.7029194
            },
            "Coachella": {
                "lat": 33.6803003,
                "lng": -116.173894
            },
            "Colton": {
                "lat": 34.0739016,
                "lng": -117.3136547
            },
            "Compton": {
                "lat": 33.8958492,
                "lng": -118.2200712
            },
            "Concord": {
                "lat": 37.9779776,
                "lng": -122.0310733
            },
            "Corona": {
                "lat": 33.8752935,
                "lng": -117.5664384
            },
            "Costa Mesa": {
                "lat": 33.6411316,
                "lng": -117.9186689
            },
            "Covina": {
                "lat": 34.0900091,
                "lng": -117.8903397
            },
            "Cupertino": {
                "lat": 37.3229978,
                "lng": -122.0321823
            },
            "Cypress": {
                "lat": 33.8169599,
                "lng": -118.0372852
            },
            "Daly City": {
                "lat": 37.6879241,
                "lng": -122.4702079
            },
            "Danville": {
                "lat": 37.8215929,
                "lng": -121.9999606
            },
            "Davis": {
                "lat": 38.5449065,
                "lng": -121.7405167
            },
            "Delano": {
                "lat": 35.7688425,
                "lng": -119.2470536
            },
            "Diamond Bar": {
                "lat": 34.0286226,
                "lng": -117.8103367
            },
            "Downey": {
                "lat": 33.94001430000001,
                "lng": -118.1325688
            },
            "Dublin": {
                "lat": 37.7021521,
                "lng": -121.9357918
            },
            "East Los Angeles": {
                "lat": 34.0239015,
                "lng": -118.1720157
            },
            "Los Angeles": {
                "lat": 34.0522342,
                "lng": -118.2436849
            },
            "El Cajon": {
                "lat": 32.7947731,
                "lng": -116.9625269
            },
            "El Centro": {
                "lat": 32.792,
                "lng": -115.5630514
            },
            "El Dorado Hills": {
                "lat": 38.6857367,
                "lng": -121.082167
            },
            "Elk Grove": {
                "lat": 38.4087993,
                "lng": -121.3716178
            },
            "El Monte": {
                "lat": 34.0686206,
                "lng": -118.0275667
            },
            "Encinitas": {
                "lat": 33.0369867,
                "lng": -117.2919818
            },
            "Escondido": {
                "lat": 33.1192068,
                "lng": -117.086421
            },
            "Fairfield": {
                "lat": 38.24935809999999,
                "lng": -122.0399663
            },
            "Florence-Graham": {
                "lat": 33.9694444,
                "lng": -118.2438889
            },
            "Florin": {
                "lat": 38.4960187,
                "lng": -121.4088416
            },
            "Folsom": {
                "lat": 38.6779591,
                "lng": -121.1760583
            },
            "Fontana": {
                "lat": 34.0922335,
                "lng": -117.435048
            },
            "Fountain Valley": {
                "lat": 33.7091847,
                "lng": -117.9536697
            },
            "Fremont": {
                "lat": 37.5482697,
                "lng": -121.9885719
            },
            "Fresno": {
                "lat": 36.7477272,
                "lng": -119.7723661
            },
            "Fullerton": {
                "lat": 33.8702923,
                "lng": -117.925338
            },
            "Gardena": {
                "lat": 33.8883487,
                "lng": -118.3089624
            },
            "Garden Grove": {
                "lat": 33.7739053,
                "lng": -117.9414477
            },
            "Glendale": {
                "lat": 34.1425078,
                "lng": -118.255075
            },
            "Glendora": {
                "lat": 34.1361187,
                "lng": -117.865339
            },
            "Hacienda Heights": {
                "lat": 33.9930677,
                "lng": -117.9686755
            },
            "Hawthorne": {
                "lat": 33.9164032,
                "lng": -118.3525748
            },
            "Hayward": {
                "lat": 37.6688205,
                "lng": -122.0807964
            },
            "Hemet": {
                "lat": 33.7475203,
                "lng": -116.9719684
            },
            "Hesperia": {
                "lat": 34.4263886,
                "lng": -117.3008784
            },
            "Highland": {
                "lat": 34.1283442,
                "lng": -117.2086513
            },
            "Huntington Beach": {
                "lat": 33.660297,
                "lng": -117.9992265
            },
            "Huntington Park": {
                "lat": 33.9816812,
                "lng": -118.2250725
            },
            "Indio": {
                "lat": 33.7205771,
                "lng": -116.2155619
            },
            "Inglewood": {
                "lat": 33.9616801,
                "lng": -118.3531311
            },
            "Irvine": {
                "lat": 33.6839473,
                "lng": -117.7946942
            },
            "Laguna Niguel": {
                "lat": 33.5225261,
                "lng": -117.7075526
            },
            "La Habra": {
                "lat": 33.9319578,
                "lng": -117.9461734
            },
            "Lake Elsinore": {
                "lat": 33.6680772,
                "lng": -117.3272615
            },
            "Lake Forest": {
                "lat": 33.6469661,
                "lng": -117.689218
            },
            "Lakewood": {
                "lat": 33.8536269,
                "lng": -118.1339563
            },
            "La Mesa": {
                "lat": 32.7678287,
                "lng": -117.0230839
            },
            "La Mirada": {
                "lat": 33.9172357,
                "lng": -118.0120086
            },
            "Lancaster": {
                "lat": 34.6867846,
                "lng": -118.1541632
            },
            "La Quinta": {
                "lat": 33.6633573,
                "lng": -116.3100095
            },
            "Lincoln": {
                "lat": 38.891565,
                "lng": -121.2930079
            },
            "Livermore": {
                "lat": 37.6818745,
                "lng": -121.7680088
            },
            "Lodi": {
                "lat": 38.1301968,
                "lng": -121.2724473
            },
            "Lompoc": {
                "lat": 34.6391501,
                "lng": -120.4579409
            },
            "Long Beach": {
                "lat": 33.8041667,
                "lng": -118.1580556
            },
            "Lynwood": {
                "lat": 33.930293,
                "lng": -118.2114603
            },
            "Madera": {
                "lat": 36.9613356,
                "lng": -120.0607176
            },
            "Manteca": {
                "lat": 37.7974273,
                "lng": -121.2160526
            },
            "Menifee": {
                "lat": 33.692372,
                "lng": -117.1884585
            },
            "Merced": {
                "lat": 37.3021632,
                "lng": -120.4829677
            },
            "Milpitas": {
                "lat": 37.4282724,
                "lng": -121.9066238
            },
            "Mission Viejo": {
                "lat": 33.6000232,
                "lng": -117.6719953
            },
            "Modesto": {
                "lat": 37.63909719999999,
                "lng": -120.9968782
            },
            "Montebello": {
                "lat": 34.0165053,
                "lng": -118.1137535
            },
            "Monterey Park": {
                "lat": 34.0625106,
                "lng": -118.1228476
            },
            "Moreno Valley": {
                "lat": 33.9424658,
                "lng": -117.2296717
            },
            "Mountain View": {
                "lat": 37.3860517,
                "lng": -122.0838511
            },
            "Murrieta": {
                "lat": 33.5539143,
                "lng": -117.2139232
            },
            "Napa": {
                "lat": 38.5024689,
                "lng": -122.2653887
            },
            "National City": {
                "lat": 32.6781085,
                "lng": -117.0991967
            },
            "Newark": {
                "lat": 37.5296593,
                "lng": -122.0402399
            },
            "Newport Beach": {
                "lat": 33.6189101,
                "lng": -117.9289469
            },
            "North Highlands": {
                "lat": 38.6857362,
                "lng": -121.3721745
            },
            "Norwalk": {
                "lat": 33.9022367,
                "lng": -118.081733
            },
            "Novato": {
                "lat": 38.1074198,
                "lng": -122.5697032
            },
            "Oakland": {
                "lat": 37.8043637,
                "lng": -122.2711137
            },
            "Oceanside": {
                "lat": 33.1958696,
                "lng": -117.3794834
            },
            "Ontario": {
                "lat": 34.0633443,
                "lng": -117.6508876
            },
            "Orange": {
                "lat": 33.7877944,
                "lng": -117.8531119
            },
            "Oxnard": {
                "lat": 34.1975048,
                "lng": -119.1770516
            },
            "Palmdale": {
                "lat": 34.5794343,
                "lng": -118.1164613
            },
            "Palm Desert": {
                "lat": 33.7222445,
                "lng": -116.3744556
            },
            "Palm Springs": {
                "lat": 33.8302961,
                "lng": -116.5452921
            },
            "Palo Alto": {
                "lat": 37.4418834,
                "lng": -122.1430195
            },
            "Paramount": {
                "lat": 33.8894598,
                "lng": -118.1597911
            },
            "Pasadena": {
                "lat": 34.1477849,
                "lng": -118.1445155
            },
            "Perris": {
                "lat": 33.7825194,
                "lng": -117.2286478
            },
            "Petaluma": {
                "lat": 38.232417,
                "lng": -122.6366524
            },
            "Pico Rivera": {
                "lat": 33.9830688,
                "lng": -118.096735
            },
            "Pittsburg": {
                "lat": 38.0279762,
                "lng": -121.8846806
            },
            "Placentia": {
                "lat": 33.8722371,
                "lng": -117.8703363
            },
            "Pleasanton": {
                "lat": 37.6624312,
                "lng": -121.8746789
            },
            "Pomona": {
                "lat": 34.0552267,
                "lng": -117.7523048
            },
            "Poway": {
                "lat": 32.9628232,
                "lng": -117.0358646
            },
            "Rancho Cordova": {
                "lat": 38.5890723,
                "lng": -121.302728
            },
            "Rancho Cucamonga": {
                "lat": 34.10639889999999,
                "lng": -117.5931084
            },
            "Rancho Palos Verdes": {
                "lat": 33.7444613,
                "lng": -118.3870173
            },
            "Rancho Santa Margarita": {
                "lat": 33.640855,
                "lng": -117.603104
            },
            "Redding": {
                "lat": 40.5865396,
                "lng": -122.3916754
            },
            "Redlands": {
                "lat": 34.0555693,
                "lng": -117.1825381
            },
            "Redondo Beach": {
                "lat": 33.8491816,
                "lng": -118.3884078
            },
            "Redwood City": {
                "lat": 37.48521520000001,
                "lng": -122.2363548
            },
            "Rialto": {
                "lat": 34.1064001,
                "lng": -117.3703235
            },
            "Richmond": {
                "lat": 37.9357576,
                "lng": -122.3477486
            },
            "Riverside": {
                "lat": 33.9533487,
                "lng": -117.3961564
            },
            "Rocklin": {
                "lat": 38.7907339,
                "lng": -121.2357828
            },
            "Rohnert Park": {
                "lat": 38.3396367,
                "lng": -122.7010984
            },
            "Rosemead": {
                "lat": 34.0805651,
                "lng": -118.072846
            },
            "Roseville": {
                "lat": 38.7521235,
                "lng": -121.2880059
            },
            "Rowland Heights": {
                "lat": 33.9761238,
                "lng": -117.9053395
            },
            "Sacramento": {
                "lat": 38.5815719,
                "lng": -121.4943996
            },
            "Salinas": {
                "lat": 36.6777372,
                "lng": -121.6555013
            },
            "San Bernardino": {
                "lat": 34.1083449,
                "lng": -117.2897652
            },
            "San Bruno": {
                "lat": 37.6304904,
                "lng": -122.4110835
            },
            "Ventura": {
                "lat": 34.2746405,
                "lng": -119.2290053
            },
            "San Clemente": {
                "lat": 33.4269728,
                "lng": -117.6119925
            },
            "San Diego": {
                "lat": 32.7153292,
                "lng": -117.1572551
            },
            "San Francisco": {
                "lat": 37.7749295,
                "lng": -122.4194155
            },
            "San Jacinto": {
                "lat": 33.7839084,
                "lng": -116.958635
            },
            "San Jose": {
                "lat": 37.3393857,
                "lng": -121.8949555
            },
            "San Leandro": {
                "lat": 37.7249296,
                "lng": -122.1560768
            },
            "San Luis Obispo": {
                "lat": 35.2827524,
                "lng": -120.6596156
            },
            "San Marcos": {
                "lat": 33.1433723,
                "lng": -117.1661449
            },
            "San Mateo": {
                "lat": 37.5629917,
                "lng": -122.3255254
            },
            "San Rafael": {
                "lat": 37.9735346,
                "lng": -122.5310874
            },
            "San Ramon": {
                "lat": 37.7799273,
                "lng": -121.9780153
            },
            "Santa Ana": {
                "lat": 33.7455731,
                "lng": -117.8678338
            },
            "Santa Barbara": {
                "lat": 34.4208305,
                "lng": -119.6981901
            },
            "Santa Clara": {
                "lat": 37.3541079,
                "lng": -121.9552356
            },
            "Santa Clarita": {
                "lat": 34.3916641,
                "lng": -118.542586
            },
            "Santa Cruz": {
                "lat": 36.9741171,
                "lng": -122.0307963
            },
            "Santa Maria": {
                "lat": 34.9530337,
                "lng": -120.4357191
            },
            "Santa Monica": {
                "lat": 34.0194543,
                "lng": -118.4911912
            },
            "Santa Rosa": {
                "lat": 38.4404674,
                "lng": -122.7144314
            },
            "Santee": {
                "lat": 32.8383828,
                "lng": -116.9739167
            },
            "Simi Valley": {
                "lat": 34.2694474,
                "lng": -118.781482
            },
            "South Gate": {
                "lat": 33.954737,
                "lng": -118.2120161
            },
            "South San Francisco": {
                "lat": 37.654656,
                "lng": -122.4077498
            },
            "South Whittier": {
                "lat": 33.9347222,
                "lng": -118.0308333
            },
            "Stockton": {
                "lat": 37.9577016,
                "lng": -121.2907796
            },
            "Sunnyvale": {
                "lat": 37.36883,
                "lng": -122.0363496
            },
            "Temecula": {
                "lat": 33.4936391,
                "lng": -117.1483648
            },
            "Thousand Oaks": {
                "lat": 34.1705609,
                "lng": -118.8375937
            },
            "Torrance": {
                "lat": 33.8358492,
                "lng": -118.3406288
            },
            "Tracy": {
                "lat": 37.7396513,
                "lng": -121.4252227
            },
            "Turlock": {
                "lat": 37.4946568,
                "lng": -120.8465941
            },
            "Tustin": {
                "lat": 33.7458511,
                "lng": -117.826166
            },
            "Union City": {
                "lat": 37.5919304,
                "lng": -122.0456199
            },
            "Upland": {
                "lat": 34.09751,
                "lng": -117.6483876
            },
            "Vacaville": {
                "lat": 38.3565773,
                "lng": -121.9877444
            },
            "Vallejo": {
                "lat": 38.1040864,
                "lng": -122.2566367
            },
            "Victorville": {
                "lat": 34.5361067,
                "lng": -117.2911565
            },
            "Visalia": {
                "lat": 36.3302284,
                "lng": -119.2920585
            },
            "Vista": {
                "lat": 33.2000368,
                "lng": -117.2425355
            },
            "Walnut Creek": {
                "lat": 37.9063131,
                "lng": -122.064963
            },
            "Watsonville": {
                "lat": 36.910231,
                "lng": -121.7568946
            },
            "West Covina": {
                "lat": 34.0686208,
                "lng": -117.9389526
            },
            "Westminster": {
                "lat": 33.7513419,
                "lng": -117.9939921
            },
            "West Sacramento": {
                "lat": 38.5804609,
                "lng": -121.530234
            },
            "Whittier": {
                "lat": 33.9791793,
                "lng": -118.032844
            },
            "Woodland": {
                "lat": 38.67851570000001,
                "lng": -121.7732971
            },
            "Yorba Linda": {
                "lat": 33.8886259,
                "lng": -117.8131125
            },
            "Yuba City": {
                "lat": 39.1404477,
                "lng": -121.6169108
            },
            "Yucaipa": {
                "lat": 34.033625,
                "lng": -117.0430865
            }
        },
        "center": {
            "lat": 36.17,
            "lng": -119.7462
        }
    },
    "NY": {
        "counties": {
            "Albany": {
                "lat": 42.588271,
                "lng": -73.974014
            },
            "Allegany": {
                "lat": 42.247894,
                "lng": -78.026176
            },
            "Bronx": {
                "lat": 40.848711,
                "lng": -73.852939
            },
            "Broome": {
                "lat": 42.161977,
                "lng": -75.830291
            },
            "Cattaraugus": {
                "lat": 42.244853,
                "lng": -78.681006
            },
            "Cayuga": {
                "lat": 43.008546,
                "lng": -76.574587
            },
            "Chautauqua": {
                "lat": 42.304216,
                "lng": -79.407595
            },
            "Chemung": {
                "lat": 42.155281,
                "lng": -76.747179
            },
            "Chenango": {
                "lat": 42.489732,
                "lng": -75.604905
            },
            "Clinton": {
                "lat": 44.75271,
                "lng": -73.705648
            },
            "Columbia": {
                "lat": 42.247729,
                "lng": -73.626805
            },
            "Cortland": {
                "lat": 42.593824,
                "lng": -76.076265
            },
            "Delaware": {
                "lat": 42.193987,
                "lng": -74.966728
            },
            "Dutchess": {
                "lat": 41.755009,
                "lng": -73.739951
            },
            "Erie": {
                "lat": 42.752759,
                "lng": -78.778192
            },
            "Essex": {
                "lat": 44.108971,
                "lng": -73.777573
            },
            "Franklin": {
                "lat": 44.594374,
                "lng": -74.31067
            },
            "Fulton": {
                "lat": 43.115609,
                "lng": -74.423678
            },
            "Genesee": {
                "lat": 43.00091,
                "lng": -78.192778
            },
            "Greene": {
                "lat": 42.286951,
                "lng": -74.149495
            },
            "Hamilton": {
                "lat": 43.657879,
                "lng": -74.502456
            },
            "Herkimer": {
                "lat": 43.461635,
                "lng": -74.894694
            },
            "Jefferson": {
                "lat": 43.995371,
                "lng": -76.053522
            },
            "Kings": {
                "lat": 40.635133,
                "lng": -73.950777
            },
            "Lewis": {
                "lat": 43.786397,
                "lng": -75.442617
            },
            "Livingston": {
                "lat": 42.727485,
                "lng": -77.76978
            },
            "Madison": {
                "lat": 42.910026,
                "lng": -75.663575
            },
            "Monroe": {
                "lat": 43.464475,
                "lng": -77.664656
            },
            "Montgomery": {
                "lat": 42.900891,
                "lng": -74.435358
            },
            "Nassau": {
                "lat": 40.729687,
                "lng": -73.589384
            },
            "New York": {
                "lat": 40.776557,
                "lng": -73.970174
            },
            "Niagara": {
                "lat": 43.456731,
                "lng": -78.792143
            },
            "Oneida": {
                "lat": 43.242727,
                "lng": -75.434282
            },
            "Onondaga": {
                "lat": 43.00653,
                "lng": -76.196117
            },
            "Ontario": {
                "lat": 42.856695,
                "lng": -77.303277
            },
            "Orange": {
                "lat": 41.40241,
                "lng": -74.306252
            },
            "Orleans": {
                "lat": 43.502287,
                "lng": -78.229726
            },
            "Oswego": {
                "lat": 43.461443,
                "lng": -76.209258
            },
            "Otsego": {
                "lat": 42.629776,
                "lng": -75.028841
            },
            "Putnam": {
                "lat": 41.427904,
                "lng": -73.743882
            },
            "Queens": {
                "lat": 40.658557,
                "lng": -73.837929
            },
            "Rensselaer": {
                "lat": 42.710421,
                "lng": -73.513845
            },
            "Richmond": {
                "lat": 40.563855,
                "lng": -74.137063
            },
            "Rockland": {
                "lat": 41.154785,
                "lng": -74.024772
            },
            "St. Lawrence": {
                "lat": 44.488113,
                "lng": -75.074311
            },
            "Saratoga": {
                "lat": 43.106135,
                "lng": -73.855387
            },
            "Schenectady": {
                "lat": 42.817542,
                "lng": -74.043583
            },
            "Schoharie": {
                "lat": 42.591294,
                "lng": -74.438172
            },
            "Schuyler": {
                "lat": 42.419776,
                "lng": -76.938604
            },
            "Seneca": {
                "lat": 42.782294,
                "lng": -76.827088
            },
            "Steuben": {
                "lat": 42.266725,
                "lng": -77.385525
            },
            "Suffolk": {
                "lat": 40.943554,
                "lng": -72.692218
            },
            "Sullivan": {
                "lat": 41.720176,
                "lng": -74.76468
            },
            "Tioga": {
                "lat": 42.178057,
                "lng": -76.29745
            },
            "Tompkins": {
                "lat": 42.453281,
                "lng": -76.473712
            },
            "Ulster": {
                "lat": 41.947232,
                "lng": -74.265447
            },
            "Warren": {
                "lat": 43.555105,
                "lng": -73.838139
            },
            "Washington": {
                "lat": 43.312377,
                "lng": -73.439428
            },
            "Wayne": {
                "lat": 43.458758,
                "lng": -77.063164
            },
            "Westchester": {
                "lat": 41.15277,
                "lng": -73.745912
            },
            "Wyoming": {
                "lat": 42.701363,
                "lng": -78.228567
            },
            "Yates": {
                "lat": 42.638237,
                "lng": -77.104324
            }
        },
        "cities": {
            "Albany": {
                "lat": 42.6525793,
                "lng": -73.7562317
            },
            "Binghamton": {
                "lat": 42.09868669999999,
                "lng": -75.91797380000001
            },
            "Brentwood": {
                "lat": 40.7812093,
                "lng": -73.2462273
            },
            "Buffalo": {
                "lat": 42.88644679999999,
                "lng": -78.8783689
            },
            "Cheektowaga": {
                "lat": 42.9026136,
                "lng": -78.74457199999999
            },
            "Freeport": {
                "lat": 40.6576022,
                "lng": -73.58318349999999
            },
            "Hempstead": {
                "lat": 40.7062128,
                "lng": -73.6187397
            },
            "Hicksville": {
                "lat": 40.7684331,
                "lng": -73.5251253
            },
            "Irondequoit": {
                "lat": 43.2133955,
                "lng": -77.5797226
            },
            "Levittown": {
                "lat": 40.7259336,
                "lng": -73.51429209999999
            },
            "Mt Vernon": {
                "lat": 40.9125992,
                "lng": -73.8370786
            },
            "New Rochelle": {
                "lat": 40.9114882,
                "lng": -73.7823549
            },
            "New York": {
                "lat": 40.7143528,
                "lng": -74.00597309999999
            },
            "Manhattan": {
                "lat": 40.7834345,
                "lng": -73.9662495
            },
            "Niagara Falls": {
                "lat": 43.0962143,
                "lng": -79.0377388
            },
            "Rochester": {
                "lat": 43.16103,
                "lng": -77.6109219
            },
            "Schenectady": {
                "lat": 42.8142432,
                "lng": -73.9395687
            },
            "Syracuse": {
                "lat": 43.114397,
                "lng": -76.2710833
            },
            "Troy": {
                "lat": 42.7284117,
                "lng": -73.69178509999999
            },
            "Utica": {
                "lat": 43.100903,
                "lng": -75.232664
            },
            "West Babylon": {
                "lat": 40.718155,
                "lng": -73.354287
            },
            "West Seneca": {
                "lat": 42.8500585,
                "lng": -78.79975470000001
            },
            "White Plains": {
                "lat": 41.03398620000001,
                "lng": -73.7629097
            },
            "Yonkers": {
                "lat": 40.9312099,
                "lng": -73.89874689999999
            }
        },
        "center": {
            "lat": 42.1497,
            "lng": -74.9384
        }
    },
    "GA": {
        "counties": {
            "Appling": {
                "lat": 31.739712,
                "lng": -82.290103
            },
            "Atkinson": {
                "lat": 31.300562,
                "lng": -82.883614
            },
            "Bacon": {
                "lat": 31.563327,
                "lng": -82.387859
            },
            "Baker": {
                "lat": 31.319622,
                "lng": -84.454857
            },
            "Baldwin": {
                "lat": 33.059532,
                "lng": -83.255362
            },
            "Banks": {
                "lat": 34.351922,
                "lng": -83.498441
            },
            "Barrow": {
                "lat": 33.992009,
                "lng": -83.712303
            },
            "Bartow": {
                "lat": 34.240918,
                "lng": -84.838188
            },
            "Ben Hill": {
                "lat": 31.740776,
                "lng": -83.14719
            },
            "Berrien": {
                "lat": 31.274308,
                "lng": -83.231906
            },
            "Bibb": {
                "lat": 32.808844,
                "lng": -83.694193
            },
            "Bleckley": {
                "lat": 32.435403,
                "lng": -83.331717
            },
            "Brantley": {
                "lat": 31.197334,
                "lng": -81.982978
            },
            "Brooks": {
                "lat": 30.833696,
                "lng": -83.588971
            },
            "Bryan": {
                "lat": 32.017969,
                "lng": -81.438543
            },
            "Bulloch": {
                "lat": 32.393408,
                "lng": -81.74381
            },
            "Burke": {
                "lat": 33.063737,
                "lng": -82.00389
            },
            "Butts": {
                "lat": 33.290355,
                "lng": -83.958221
            },
            "Calhoun": {
                "lat": 31.521279,
                "lng": -84.62629
            },
            "Camden": {
                "lat": 30.916358,
                "lng": -81.636516
            },
            "Candler": {
                "lat": 32.403986,
                "lng": -82.071446
            },
            "Carroll": {
                "lat": 33.582237,
                "lng": -85.080527
            },
            "Catoosa": {
                "lat": 34.899393,
                "lng": -85.137353
            },
            "Charlton": {
                "lat": 30.779904,
                "lng": -82.139644
            },
            "Chatham": {
                "lat": 31.974756,
                "lng": -81.091768
            },
            "Chattahoochee": {
                "lat": 32.347445,
                "lng": -84.788021
            },
            "Chattooga": {
                "lat": 34.474179,
                "lng": -85.345289
            },
            "Cherokee": {
                "lat": 34.244317,
                "lng": -84.475057
            },
            "Clarke": {
                "lat": 33.952234,
                "lng": -83.36713
            },
            "Clay": {
                "lat": 31.619831,
                "lng": -84.992583
            },
            "Clayton": {
                "lat": 33.552242,
                "lng": -84.412977
            },
            "Clinch": {
                "lat": 30.917653,
                "lng": -82.702614
            },
            "Cobb": {
                "lat": 33.93994,
                "lng": -84.574166
            },
            "Coffee": {
                "lat": 31.549245,
                "lng": -82.844938
            },
            "Colquitt": {
                "lat": 31.189758,
                "lng": -83.769741
            },
            "Columbia": {
                "lat": 33.550556,
                "lng": -82.251342
            },
            "Cook": {
                "lat": 31.152935,
                "lng": -83.429552
            },
            "Coweta": {
                "lat": 33.352897,
                "lng": -84.762138
            },
            "Crawford": {
                "lat": 32.709446,
                "lng": -83.979182
            },
            "Crisp": {
                "lat": 31.914753,
                "lng": -83.753338
            },
            "Dade": {
                "lat": 34.852424,
                "lng": -85.506201
            },
            "Dawson": {
                "lat": 34.442842,
                "lng": -84.173284
            },
            "Decatur": {
                "lat": 30.877961,
                "lng": -84.577744
            },
            "DeKalb": {
                "lat": 33.770661,
                "lng": -84.226343
            },
            "Dodge": {
                "lat": 32.160656,
                "lng": -83.156818
            },
            "Dooly": {
                "lat": 32.151995,
                "lng": -83.807167
            },
            "Dougherty": {
                "lat": 31.535068,
                "lng": -84.214444
            },
            "Douglas": {
                "lat": 33.699317,
                "lng": -84.765944
            },
            "Early": {
                "lat": 31.324191,
                "lng": -84.906723
            },
            "Echols": {
                "lat": 30.7085,
                "lng": -82.836132
            },
            "Effingham": {
                "lat": 32.361711,
                "lng": -81.343337
            },
            "Elbert": {
                "lat": 34.115017,
                "lng": -82.842057
            },
            "Emanuel": {
                "lat": 32.5911,
                "lng": -82.299763
            },
            "Evans": {
                "lat": 32.151902,
                "lng": -81.887618
            },
            "Fannin": {
                "lat": 34.863837,
                "lng": -84.319287
            },
            "Fayette": {
                "lat": 33.412717,
                "lng": -84.493941
            },
            "Floyd": {
                "lat": 34.263677,
                "lng": -85.21373
            },
            "Forsyth": {
                "lat": 34.225143,
                "lng": -84.127336
            },
            "Franklin": {
                "lat": 34.375155,
                "lng": -83.227291
            },
            "Fulton": {
                "lat": 33.790034,
                "lng": -84.468182
            },
            "Gilmer": {
                "lat": 34.690541,
                "lng": -84.453984
            },
            "Glascock": {
                "lat": 33.227491,
                "lng": -82.606913
            },
            "Glynn": {
                "lat": 31.212747,
                "lng": -81.496517
            },
            "Gordon": {
                "lat": 34.509667,
                "lng": -84.873862
            },
            "Grady": {
                "lat": 30.875863,
                "lng": -84.244772
            },
            "Greene": {
                "lat": 33.576836,
                "lng": -83.167103
            },
            "Gwinnett": {
                "lat": 33.959101,
                "lng": -84.022938
            },
            "Habersham": {
                "lat": 34.635108,
                "lng": -83.526406
            },
            "Hall": {
                "lat": 34.317588,
                "lng": -83.818497
            },
            "Hancock": {
                "lat": 33.26922,
                "lng": -83.000465
            },
            "Haralson": {
                "lat": 33.795165,
                "lng": -85.220062
            },
            "Harris": {
                "lat": 32.731549,
                "lng": -84.912432
            },
            "Hart": {
                "lat": 34.348733,
                "lng": -82.96329
            },
            "Heard": {
                "lat": 33.290968,
                "lng": -85.139594
            },
            "Henry": {
                "lat": 33.452881,
                "lng": -84.15444
            },
            "Houston": {
                "lat": 32.458381,
                "lng": -83.662856
            },
            "Irwin": {
                "lat": 31.604306,
                "lng": -83.277037
            },
            "Jackson": {
                "lat": 34.134157,
                "lng": -83.565133
            },
            "Jasper": {
                "lat": 33.314905,
                "lng": -83.687892
            },
            "Jeff Davis": {
                "lat": 31.811615,
                "lng": -82.636825
            },
            "Jefferson": {
                "lat": 33.051874,
                "lng": -82.41905
            },
            "Jenkins": {
                "lat": 32.794563,
                "lng": -81.971524
            },
            "Johnson": {
                "lat": 32.689831,
                "lng": -82.661354
            },
            "Jones": {
                "lat": 33.020226,
                "lng": -83.562339
            },
            "Lamar": {
                "lat": 33.07446,
                "lng": -84.146721
            },
            "Lanier": {
                "lat": 31.038197,
                "lng": -83.063164
            },
            "Laurens": {
                "lat": 32.39322,
                "lng": -82.926317
            },
            "Lee": {
                "lat": 31.818419,
                "lng": -84.146681
            },
            "Liberty": {
                "lat": 31.807245,
                "lng": -81.457969
            },
            "Lincoln": {
                "lat": 33.792151,
                "lng": -82.448299
            },
            "Long": {
                "lat": 31.749563,
                "lng": -81.74287
            },
            "Lowndes": {
                "lat": 30.83368,
                "lng": -83.268967
            },
            "Lumpkin": {
                "lat": 34.568149,
                "lng": -83.998828
            },
            "McDuffie": {
                "lat": 33.482464,
                "lng": -82.473188
            },
            "McIntosh": {
                "lat": 31.482978,
                "lng": -81.370199
            },
            "Macon": {
                "lat": 32.366216,
                "lng": -84.052162
            },
            "Madison": {
                "lat": 34.128486,
                "lng": -83.203637
            },
            "Marion": {
                "lat": 32.359538,
                "lng": -84.529561
            },
            "Meriwether": {
                "lat": 33.03022,
                "lng": -84.663279
            },
            "Miller": {
                "lat": 31.162908,
                "lng": -84.730386
            },
            "Mitchell": {
                "lat": 31.22894,
                "lng": -84.192407
            },
            "Monroe": {
                "lat": 33.017435,
                "lng": -83.922938
            },
            "Montgomery": {
                "lat": 32.172108,
                "lng": -82.533349
            },
            "Morgan": {
                "lat": 33.593732,
                "lng": -83.492324
            },
            "Murray": {
                "lat": 34.797097,
                "lng": -84.73799
            },
            "Muscogee": {
                "lat": 32.510197,
                "lng": -84.874946
            },
            "Newton": {
                "lat": 33.544046,
                "lng": -83.855189
            },
            "Oconee": {
                "lat": 33.834125,
                "lng": -83.437728
            },
            "Oglethorpe": {
                "lat": 33.866806,
                "lng": -83.074081
            },
            "Paulding": {
                "lat": 33.920903,
                "lng": -84.866979
            },
            "Peach": {
                "lat": 32.571324,
                "lng": -83.831978
            },
            "Pickens": {
                "lat": 34.456621,
                "lng": -84.490256
            },
            "Pierce": {
                "lat": 31.353988,
                "lng": -82.210427
            },
            "Pike": {
                "lat": 33.090769,
                "lng": -84.386627
            },
            "Polk": {
                "lat": 33.995961,
                "lng": -85.186826
            },
            "Pulaski": {
                "lat": 32.238794,
                "lng": -83.481855
            },
            "Putnam": {
                "lat": 33.321061,
                "lng": -83.37179
            },
            "Quitman": {
                "lat": 31.861487,
                "lng": -85.009317
            },
            "Rabun": {
                "lat": 34.883026,
                "lng": -83.404735
            },
            "Randolph": {
                "lat": 31.762651,
                "lng": -84.752311
            },
            "Richmond": {
                "lat": 33.361487,
                "lng": -82.074998
            },
            "Rockdale": {
                "lat": 33.652081,
                "lng": -84.02637
            },
            "Schley": {
                "lat": 32.263441,
                "lng": -84.322724
            },
            "Screven": {
                "lat": 32.744751,
                "lng": -81.617585
            },
            "Seminole": {
                "lat": 30.933894,
                "lng": -84.867592
            },
            "Spalding": {
                "lat": 33.262389,
                "lng": -84.286067
            },
            "Stephens": {
                "lat": 34.552914,
                "lng": -83.290216
            },
            "Stewart": {
                "lat": 32.073225,
                "lng": -84.834912
            },
            "Sumter": {
                "lat": 32.042203,
                "lng": -84.204283
            },
            "Talbot": {
                "lat": 32.704603,
                "lng": -84.530029
            },
            "Taliaferro": {
                "lat": 33.559314,
                "lng": -82.875208
            },
            "Tattnall": {
                "lat": 32.043768,
                "lng": -82.059208
            },
            "Taylor": {
                "lat": 32.554667,
                "lng": -84.251426
            },
            "Telfair": {
                "lat": 31.913639,
                "lng": -82.931062
            },
            "Terrell": {
                "lat": 31.777191,
                "lng": -84.439446
            },
            "Thomas": {
                "lat": 30.864616,
                "lng": -83.919783
            },
            "Tift": {
                "lat": 31.457003,
                "lng": -83.525931
            },
            "Toombs": {
                "lat": 32.126698,
                "lng": -82.332071
            },
            "Towns": {
                "lat": 34.90265,
                "lng": -83.732158
            },
            "Treutlen": {
                "lat": 32.409586,
                "lng": -82.570882
            },
            "Troup": {
                "lat": 33.034482,
                "lng": -85.02836
            },
            "Turner": {
                "lat": 31.718232,
                "lng": -83.628567
            },
            "Twiggs": {
                "lat": 32.665847,
                "lng": -83.425879
            },
            "Union": {
                "lat": 34.83377,
                "lng": -83.989573
            },
            "Upson": {
                "lat": 32.881837,
                "lng": -84.292281
            },
            "Walker": {
                "lat": 34.735827,
                "lng": -85.305385
            },
            "Walton": {
                "lat": 33.782649,
                "lng": -83.734215
            },
            "Ware": {
                "lat": 31.050881,
                "lng": -82.421507
            },
            "Warren": {
                "lat": 33.419169,
                "lng": -82.688012
            },
            "Washington": {
                "lat": 32.971848,
                "lng": -82.798112
            },
            "Wayne": {
                "lat": 31.547845,
                "lng": -81.912376
            },
            "Webster": {
                "lat": 32.046554,
                "lng": -84.553218
            },
            "Wheeler": {
                "lat": 32.109276,
                "lng": -82.738701
            },
            "White": {
                "lat": 34.643677,
                "lng": -83.743713
            },
            "Whitfield": {
                "lat": 34.801726,
                "lng": -84.968541
            },
            "Wilcox": {
                "lat": 31.962717,
                "lng": -83.438262
            },
            "Wilkes": {
                "lat": 33.77904,
                "lng": -82.747922
            },
            "Wilkinson": {
                "lat": 32.804321,
                "lng": -83.175587
            },
            "Worth": {
                "lat": 31.551773,
                "lng": -83.84996
            }
        },
        "cities": {
            "Albany": {
                "lat": 31.5785074,
                "lng": -84.15574099999999
            },
            "Alpharetta": {
                "lat": 34.0753762,
                "lng": -84.2940899
            },
            "Athens": {
                "lat": 33.955802,
                "lng": -83.3823656
            },
            "Atlanta": {
                "lat": 33.7489954,
                "lng": -84.3879824
            },
            "Augusta": {
                "lat": 33.474246,
                "lng": -82.00967
            },
            "Columbus": {
                "lat": 32.4609764,
                "lng": -84.9877094
            },
            "Dunwoody": {
                "lat": 33.9462125,
                "lng": -84.3346473
            },
            "Johns Creek": {
                "lat": 34.0289259,
                "lng": -84.198579
            },
            "Macon": {
                "lat": 32.8406946,
                "lng": -83.6324022
            },
            "Marietta": {
                "lat": 33.95260200000001,
                "lng": -84.5499327
            },
            "North Atlanta": {
                "lat": 33.8651033,
                "lng": -84.3365917
            },
            "Roswell": {
                "lat": 34.02315530000001,
                "lng": -84.3615928
            },
            "Sandy Springs": {
                "lat": 33.9242688,
                "lng": -84.3785379
            },
            "Savannah": {
                "lat": 32.0835407,
                "lng": -81.09983419999999
            },
            "Smyrna": {
                "lat": 33.8839926,
                "lng": -84.51437609999999
            },
            "Valdosta": {
                "lat": 30.8327022,
                "lng": -83.2784851
            },
            "Warner Robins": {
                "lat": 32.6086111,
                "lng": -83.6380556
            }
        },
        "center": {
            "lat": 32.9866,
            "lng": -83.6487
        }
    },
    "OR": {
        "counties": {
            "Baker": {
                "lat": 44.703427,
                "lng": -117.691933
            },
            "Benton": {
                "lat": 44.490623,
                "lng": -123.426317
            },
            "Clackamas": {
                "lat": 45.160493,
                "lng": -122.195127
            },
            "Clatsop": {
                "lat": 46.024509,
                "lng": -123.705014
            },
            "Columbia": {
                "lat": 45.941932,
                "lng": -123.081079
            },
            "Coos": {
                "lat": 43.184193,
                "lng": -124.092557
            },
            "Crook": {
                "lat": 44.163054,
                "lng": -120.371585
            },
            "Curry": {
                "lat": 42.466671,
                "lng": -124.211407
            },
            "Deschutes": {
                "lat": 43.915118,
                "lng": -121.225575
            },
            "Douglas": {
                "lat": 43.285904,
                "lng": -123.15438
            },
            "Gilliam": {
                "lat": 45.381666,
                "lng": -120.211851
            },
            "Grant": {
                "lat": 44.496326,
                "lng": -119.014057
            },
            "Harney": {
                "lat": 43.064355,
                "lng": -118.985949
            },
            "Hood River": {
                "lat": 45.511775,
                "lng": -121.655976
            },
            "Jackson": {
                "lat": 42.411782,
                "lng": -122.675797
            },
            "Jefferson": {
                "lat": 44.64379,
                "lng": -121.183021
            },
            "Josephine": {
                "lat": 42.385382,
                "lng": -123.597245
            },
            "Klamath": {
                "lat": 42.683761,
                "lng": -121.646168
            },
            "Lake": {
                "lat": 42.788401,
                "lng": -120.38979
            },
            "Lane": {
                "lat": 43.928276,
                "lng": -122.897678
            },
            "Lincoln": {
                "lat": 44.641076,
                "lng": -123.911183
            },
            "Linn": {
                "lat": 44.494824,
                "lng": -122.543756
            },
            "Malheur": {
                "lat": 43.1877,
                "lng": -117.603976
            },
            "Marion": {
                "lat": 44.900898,
                "lng": -122.57626
            },
            "Morrow": {
                "lat": 45.425496,
                "lng": -119.602311
            },
            "Multnomah": {
                "lat": 45.547693,
                "lng": -122.417173
            },
            "Polk": {
                "lat": 44.904395,
                "lng": -123.397329
            },
            "Sherman": {
                "lat": 45.399216,
                "lng": -120.678512
            },
            "Tillamook": {
                "lat": 45.455743,
                "lng": -123.759327
            },
            "Umatilla": {
                "lat": 45.5912,
                "lng": -118.73388
            },
            "Union": {
                "lat": 45.304047,
                "lng": -117.999136
            },
            "Wallowa": {
                "lat": 45.593753,
                "lng": -117.18558
            },
            "Wasco": {
                "lat": 45.164536,
                "lng": -121.165069
            },
            "Washington": {
                "lat": 45.553542,
                "lng": -123.097615
            },
            "Wheeler": {
                "lat": 44.736411,
                "lng": -120.026875
            },
            "Yamhill": {
                "lat": 45.248138,
                "lng": -123.316117
            }
        },
        "cities": {
            "Albany": {
                "lat": 44.6365107,
                "lng": -123.1059282
            },
            "Aloha": {
                "lat": 45.4942838,
                "lng": -122.8670454
            },
            "Beaverton": {
                "lat": 45.48706199999999,
                "lng": -122.8037102
            },
            "Bend": {
                "lat": 44.0581728,
                "lng": -121.3153096
            },
            "Corvallis": {
                "lat": 44.5645659,
                "lng": -123.2620435
            },
            "Eugene": {
                "lat": 44.0520691,
                "lng": -123.0867536
            },
            "Gresham": {
                "lat": 45.5001357,
                "lng": -122.4302013
            },
            "Hillsboro": {
                "lat": 45.5228939,
                "lng": -122.989827
            },
            "Medford": {
                "lat": 42.3265152,
                "lng": -122.8755949
            },
            "Portland": {
                "lat": 45.5234515,
                "lng": -122.6762071
            },
            "Salem": {
                "lat": 44.9428975,
                "lng": -123.0350963
            },
            "Springfield": {
                "lat": 44.0462362,
                "lng": -123.0220289
            },
            "Tigard": {
                "lat": 45.4312294,
                "lng": -122.7714861
            }
        },
        "center": {
            "lat": 44.5672,
            "lng": -122.1269
        }
    },
    "NM": {
        "counties": {
            "Bernalillo": {
                "lat": 35.054002,
                "lng": -106.669065
            },
            "Catron": {
                "lat": 33.901814,
                "lng": -108.392097
            },
            "Chaves": {
                "lat": 33.361605,
                "lng": -104.469837
            },
            "Cibola": {
                "lat": 34.93205,
                "lng": -108.000255
            },
            "Colfax": {
                "lat": 36.612963,
                "lng": -104.640126
            },
            "Curry": {
                "lat": 34.572984,
                "lng": -103.346055
            },
            "De Baca": {
                "lat": 34.351429,
                "lng": -104.401527
            },
            "Dona Ana": {
                "lat": 32.350912,
                "lng": -106.832182
            },
            "Eddy": {
                "lat": 32.457858,
                "lng": -104.306471
            },
            "Grant": {
                "lat": 32.732087,
                "lng": -108.381504
            },
            "Guadalupe": {
                "lat": 34.869782,
                "lng": -104.784968
            },
            "Harding": {
                "lat": 35.863152,
                "lng": -103.829931
            },
            "Hidalgo": {
                "lat": 31.899658,
                "lng": -108.745729
            },
            "Lea": {
                "lat": 32.795687,
                "lng": -103.413271
            },
            "Lincoln": {
                "lat": 33.740941,
                "lng": -105.449083
            },
            "Los Alamos": {
                "lat": 35.870047,
                "lng": -106.307968
            },
            "Luna": {
                "lat": 32.184482,
                "lng": -107.746639
            },
            "McKinley": {
                "lat": 35.573732,
                "lng": -108.255307
            },
            "Mora": {
                "lat": 35.982841,
                "lng": -104.921898
            },
            "Otero": {
                "lat": 32.588776,
                "lng": -105.781079
            },
            "Quay": {
                "lat": 35.107018,
                "lng": -103.548071
            },
            "Rio Arriba": {
                "lat": 36.509669,
                "lng": -106.693983
            },
            "Roosevelt": {
                "lat": 34.021457,
                "lng": -103.482725
            },
            "Sandoval": {
                "lat": 35.685073,
                "lng": -106.882618
            },
            "San Juan": {
                "lat": 36.511625,
                "lng": -108.324578
            },
            "San Miguel": {
                "lat": 35.476876,
                "lng": -104.803515
            },
            "Santa Fe": {
                "lat": 35.513722,
                "lng": -105.966441
            },
            "Sierra": {
                "lat": 33.119479,
                "lng": -107.188161
            },
            "Socorro": {
                "lat": 33.991614,
                "lng": -106.939003
            },
            "Taos": {
                "lat": 36.576529,
                "lng": -105.637987
            },
            "Torrance": {
                "lat": 34.634644,
                "lng": -105.846836
            },
            "Union": {
                "lat": 36.488085,
                "lng": -103.475723
            },
            "Valencia": {
                "lat": 34.71684,
                "lng": -106.806582
            }
        },
        "cities": {
            "Albuquerque": {
                "lat": 35.0844909,
                "lng": -106.6511367
            },
            "Farmington": {
                "lat": 36.72805830000001,
                "lng": -108.2186856
            },
            "Las Cruces": {
                "lat": 32.3199396,
                "lng": -106.7636538
            },
            "Rio Rancho": {
                "lat": 35.2327544,
                "lng": -106.6630437
            },
            "Roswell": {
                "lat": 33.3942655,
                "lng": -104.5230242
            },
            "Santa Fe": {
                "lat": 35.6869752,
                "lng": -105.937799
            },
            "South Valley": {
                "lat": 35.0100487,
                "lng": -106.6780809
            }
        },
        "center": {
            "lat": 34.8375,
            "lng": -106.2371
        }
    },
    "VA": {
        "counties": {
            "Accomack": {
                "lat": 37.765944,
                "lng": -75.757807
            },
            "Albemarle": {
                "lat": 38.024184,
                "lng": -78.553506
            },
            "Alleghany": {
                "lat": 37.787905,
                "lng": -80.008669
            },
            "Amelia": {
                "lat": 37.336131,
                "lng": -77.973218
            },
            "Amherst": {
                "lat": 37.630362,
                "lng": -79.147848
            },
            "Appomattox": {
                "lat": 37.370725,
                "lng": -78.81094
            },
            "Arlington": {
                "lat": 38.878337,
                "lng": -77.100703
            },
            "Augusta": {
                "lat": 38.167807,
                "lng": -79.146682
            },
            "Bath": {
                "lat": 38.068988,
                "lng": -79.732898
            },
            "Bedford": {
                "lat": 37.338156,
                "lng": -79.520705
            },
            "Bland": {
                "lat": 37.130612,
                "lng": -81.125853
            },
            "Botetourt": {
                "lat": 37.553193,
                "lng": -79.805318
            },
            "Brunswick": {
                "lat": 36.764531,
                "lng": -77.860916
            },
            "Buchanan": {
                "lat": 37.26812,
                "lng": -82.038151
            },
            "Buckingham": {
                "lat": 37.573928,
                "lng": -78.529169
            },
            "Campbell": {
                "lat": 37.210151,
                "lng": -79.095429
            },
            "Caroline": {
                "lat": 38.030319,
                "lng": -77.352348
            },
            "Carroll": {
                "lat": 36.732426,
                "lng": -80.728043
            },
            "Charles City": {
                "lat": 37.361048,
                "lng": -77.054171
            },
            "Charlotte": {
                "lat": 37.014091,
                "lng": -78.661424
            },
            "Chesterfield": {
                "lat": 37.378434,
                "lng": -77.585847
            },
            "Clarke": {
                "lat": 39.115931,
                "lng": -77.992004
            },
            "Craig": {
                "lat": 37.473129,
                "lng": -80.231734
            },
            "Culpeper": {
                "lat": 38.48593,
                "lng": -77.956476
            },
            "Cumberland": {
                "lat": 37.520189,
                "lng": -78.252836
            },
            "Dickenson": {
                "lat": 37.137081,
                "lng": -82.349208
            },
            "Dinwiddie": {
                "lat": 37.073498,
                "lng": -77.635492
            },
            "Essex": {
                "lat": 37.93948,
                "lng": -76.941871
            },
            "Fairfax": {
                "lat": 38.853183,
                "lng": -77.299025
            },
            "Fauquier": {
                "lat": 38.744103,
                "lng": -77.821585
            },
            "Floyd": {
                "lat": 36.931438,
                "lng": -80.350309
            },
            "Fluvanna": {
                "lat": 37.830606,
                "lng": -78.284445
            },
            "Franklin": {
                "lat": 36.684014,
                "lng": -76.941396
            },
            "Frederick": {
                "lat": 39.203637,
                "lng": -78.263916
            },
            "Giles": {
                "lat": 37.31193,
                "lng": -80.717178
            },
            "Gloucester": {
                "lat": 37.403541,
                "lng": -76.523505
            },
            "Goochland": {
                "lat": 37.724166,
                "lng": -77.914273
            },
            "Grayson": {
                "lat": 36.656303,
                "lng": -81.225337
            },
            "Greene": {
                "lat": 38.297981,
                "lng": -78.470163
            },
            "Greensville": {
                "lat": 36.680225,
                "lng": -77.560261
            },
            "Halifax": {
                "lat": 36.766461,
                "lng": -78.939614
            },
            "Hanover": {
                "lat": 37.760166,
                "lng": -77.490992
            },
            "Henrico": {
                "lat": 37.437521,
                "lng": -77.300333
            },
            "Henry": {
                "lat": 36.620593,
                "lng": -79.980584
            },
            "Highland": {
                "lat": 38.356672,
                "lng": -79.567958
            },
            "Isle of Wight": {
                "lat": 36.901418,
                "lng": -76.707569
            },
            "James City": {
                "lat": 37.324427,
                "lng": -76.778319
            },
            "King and Queen": {
                "lat": 37.720995,
                "lng": -76.89109
            },
            "King George": {
                "lat": 38.277179,
                "lng": -77.162702
            },
            "King William": {
                "lat": 37.70826,
                "lng": -77.091054
            },
            "Lancaster": {
                "lat": 37.703831,
                "lng": -76.413199
            },
            "Lee": {
                "lat": 36.702162,
                "lng": -83.130334
            },
            "Loudoun": {
                "lat": 39.08113,
                "lng": -77.638857
            },
            "Louisa": {
                "lat": 37.971681,
                "lng": -77.959178
            },
            "Lunenburg": {
                "lat": 36.945757,
                "lng": -78.242313
            },
            "Madison": {
                "lat": 38.412059,
                "lng": -78.276961
            },
            "Mathews": {
                "lat": 37.425348,
                "lng": -76.268808
            },
            "Mecklenburg": {
                "lat": 36.687256,
                "lng": -78.368959
            },
            "Middlesex": {
                "lat": 37.606828,
                "lng": -76.527958
            },
            "Montgomery": {
                "lat": 37.174885,
                "lng": -80.387314
            },
            "Nelson": {
                "lat": 37.790016,
                "lng": -78.879394
            },
            "New Kent": {
                "lat": 37.498974,
                "lng": -76.993339
            },
            "Northampton": {
                "lat": 37.302629,
                "lng": -75.923868
            },
            "Northumberland": {
                "lat": 37.856974,
                "lng": -76.379687
            },
            "Nottoway": {
                "lat": 37.143696,
                "lng": -78.052162
            },
            "Orange": {
                "lat": 38.250439,
                "lng": -78.00998
            },
            "Page": {
                "lat": 38.623751,
                "lng": -78.490471
            },
            "Patrick": {
                "lat": 36.667327,
                "lng": -80.286141
            },
            "Pittsylvania": {
                "lat": 36.821721,
                "lng": -79.398502
            },
            "Powhatan": {
                "lat": 37.549404,
                "lng": -77.912855
            },
            "Prince Edward": {
                "lat": 37.224881,
                "lng": -78.432957
            },
            "Prince George": {
                "lat": 37.187326,
                "lng": -77.220993
            },
            "Prince William": {
                "lat": 38.702332,
                "lng": -77.478887
            },
            "Pulaski": {
                "lat": 37.063385,
                "lng": -80.713444
            },
            "Rappahannock": {
                "lat": 38.684522,
                "lng": -78.168824
            },
            "Richmond": {
                "lat": 37.531399,
                "lng": -77.476009
            },
            "Roanoke": {
                "lat": 37.27783,
                "lng": -79.958472
            },
            "Rockbridge": {
                "lat": 37.814517,
                "lng": -79.447754
            },
            "Rockingham": {
                "lat": 38.511257,
                "lng": -78.876307
            },
            "Russell": {
                "lat": 36.93342,
                "lng": -82.095934
            },
            "Scott": {
                "lat": 36.712778,
                "lng": -82.613627
            },
            "Shenandoah": {
                "lat": 38.856204,
                "lng": -78.573987
            },
            "Smyth": {
                "lat": 36.842318,
                "lng": -81.539786
            },
            "Southampton": {
                "lat": 36.720173,
                "lng": -77.103856
            },
            "Spotsylvania": {
                "lat": 38.182311,
                "lng": -77.65628
            },
            "Stafford": {
                "lat": 38.418933,
                "lng": -77.459043
            },
            "Surry": {
                "lat": 37.119761,
                "lng": -76.880172
            },
            "Sussex": {
                "lat": 36.926645,
                "lng": -77.259732
            },
            "Tazewell": {
                "lat": 37.125395,
                "lng": -81.562924
            },
            "Warren": {
                "lat": 38.908187,
                "lng": -78.207131
            },
            "Washington": {
                "lat": 36.747813,
                "lng": -81.950291
            },
            "Westmoreland": {
                "lat": 38.109191,
                "lng": -76.80417
            },
            "Wise": {
                "lat": 36.974561,
                "lng": -82.62156
            },
            "Wythe": {
                "lat": 36.901471,
                "lng": -81.084209
            },
            "York": {
                "lat": 37.220914,
                "lng": -76.395533
            },
            "Alexandria": {
                "lat": 38.818343,
                "lng": -77.082026
            },
            "Bristol": {
                "lat": 36.616954,
                "lng": -82.157564
            },
            "Buena Vista": {
                "lat": 37.731663,
                "lng": -79.356375
            },
            "Charlottesville": {
                "lat": 38.037658,
                "lng": -78.485381
            },
            "Chesapeake": {
                "lat": 36.679376,
                "lng": -76.301788
            },
            "Colonial Heights": {
                "lat": 37.261685,
                "lng": -77.396804
            },
            "Covington": {
                "lat": 37.778143,
                "lng": -79.986039
            },
            "Danville": {
                "lat": 36.583334,
                "lng": -79.408071
            },
            "Emporia": {
                "lat": 36.696182,
                "lng": -77.535975
            },
            "Falls Church": {
                "lat": 38.883787,
                "lng": -77.174639
            },
            "Fredericksburg": {
                "lat": 38.299272,
                "lng": -77.486658
            },
            "Galax": {
                "lat": 36.66564,
                "lng": -80.914308
            },
            "Hampton": {
                "lat": 37.04803,
                "lng": -76.297149
            },
            "Harrisonburg": {
                "lat": 38.436013,
                "lng": -78.874197
            },
            "Hopewell": {
                "lat": 37.29101,
                "lng": -77.298944
            },
            "Lexington": {
                "lat": 37.782332,
                "lng": -79.44432
            },
            "Lynchburg": {
                "lat": 37.399016,
                "lng": -79.195458
            },
            "Manassas": {
                "lat": 38.747561,
                "lng": -77.484727
            },
            "Manassas Park": {
                "lat": 38.768991,
                "lng": -77.448681
            },
            "Martinsville": {
                "lat": 36.683527,
                "lng": -79.863648
            },
            "Newport News": {
                "lat": 37.075978,
                "lng": -76.521719
            },
            "Norfolk": {
                "lat": 36.923015,
                "lng": -76.244641
            },
            "Norton": {
                "lat": 36.931549,
                "lng": -82.625996
            },
            "Petersburg": {
                "lat": 37.20473,
                "lng": -77.392368
            },
            "Poquoson": {
                "lat": 37.12836,
                "lng": -76.303534
            },
            "Portsmouth": {
                "lat": 36.85943,
                "lng": -76.356269
            },
            "Radford": {
                "lat": 37.120036,
                "lng": -80.557048
            },
            "Salem": {
                "lat": 37.285333,
                "lng": -80.055241
            },
            "Staunton": {
                "lat": 38.158056,
                "lng": -79.061501
            },
            "Suffolk": {
                "lat": 36.697157,
                "lng": -76.634781
            },
            "Virginia Beach": {
                "lat": 36.779322,
                "lng": -76.02402
            },
            "Waynesboro": {
                "lat": 38.067157,
                "lng": -78.90142
            },
            "Williamsburg": {
                "lat": 37.269293,
                "lng": -76.706717
            },
            "Winchester": {
                "lat": 39.173869,
                "lng": -78.176356
            }
        },
        "cities": {
            "Alexandria": {
                "lat": 38.8048355,
                "lng": -77.0469214
            },
            "Arlington": {
                "lat": 38.8799697,
                "lng": -77.1067698
            },
            "Ashburn": {
                "lat": 39.0414079,
                "lng": -77.48101799999999
            },
            "Blacksburg": {
                "lat": 37.2295733,
                "lng": -80.4139393
            },
            "Centreville": {
                "lat": 38.8403909,
                "lng": -77.42887689999999
            },
            "Charlottesville": {
                "lat": 38.0293059,
                "lng": -78.47667810000002
            },
            "Chesapeake": {
                "lat": 36.7682088,
                "lng": -76.2874927
            },
            "Dale City": {
                "lat": 38.6370622,
                "lng": -77.31109459999999
            },
            "Danville": {
                "lat": 36.5859718,
                "lng": -79.39502279999999
            },
            "Hampton": {
                "lat": 37.0298687,
                "lng": -76.34522179999999
            },
            "Harrisonburg": {
                "lat": 38.4495688,
                "lng": -78.8689155
            },
            "Lake Ridge": {
                "lat": 38.68789400000001,
                "lng": -77.29776180000002
            },
            "Leesburg": {
                "lat": 39.1156615,
                "lng": -77.56360149999999
            },
            "Linton Hall": {
                "lat": 38.7598381,
                "lng": -77.5749905
            },
            "Lynchburg": {
                "lat": 37.4137536,
                "lng": -79.14224639999999
            },
            "McLean": {
                "lat": 38.9338676,
                "lng": -77.1772604
            },
            "Newport News": {
                "lat": 37.0870821,
                "lng": -76.4730122
            },
            "Norfolk": {
                "lat": 36.8507689,
                "lng": -76.28587259999999
            },
            "Portsmouth": {
                "lat": 36.8354258,
                "lng": -76.2982742
            },
            "Reston": {
                "lat": 38.9586307,
                "lng": -77.35700279999999
            },
            "Richmond": {
                "lat": 37.5407246,
                "lng": -77.4360481
            },
            "Roanoke": {
                "lat": 37.2709704,
                "lng": -79.9414266
            },
            "Suffolk": {
                "lat": 36.7282054,
                "lng": -76.5835621
            },
            "Tuckahoe": {
                "lat": 37.5901463,
                "lng": -77.5563761
            },
            "Virginia Beach": {
                "lat": 36.8529263,
                "lng": -75.97798499999999
            }
        },
        "center": {
            "lat": 37.768,
            "lng": -78.2057
        }
    },
    "LA": {
        "counties": {
            "Acadia": {
                "lat": 30.291497,
                "lng": -92.411037
            },
            "Allen": {
                "lat": 30.652744,
                "lng": -92.819605
            },
            "Ascension": {
                "lat": 30.202946,
                "lng": -90.910023
            },
            "Assumption": {
                "lat": 29.899884,
                "lng": -91.050528
            },
            "Avoyelles": {
                "lat": 31.085094,
                "lng": -91.993798
            },
            "Beauregard": {
                "lat": 30.645018,
                "lng": -93.340253
            },
            "Bienville": {
                "lat": 32.344268,
                "lng": -93.061513
            },
            "Bossier": {
                "lat": 32.696202,
                "lng": -93.617977
            },
            "Caddo": {
                "lat": 32.577195,
                "lng": -93.882423
            },
            "Calcasieu": {
                "lat": 30.229559,
                "lng": -93.358015
            },
            "Caldwell": {
                "lat": 32.101244,
                "lng": -92.11418
            },
            "Cameron": {
                "lat": 29.871989,
                "lng": -93.165437
            },
            "Catahoula": {
                "lat": 31.666517,
                "lng": -91.846703
            },
            "Claiborne": {
                "lat": 32.827585,
                "lng": -92.991125
            },
            "Concordia": {
                "lat": 31.469806,
                "lng": -91.626314
            },
            "De Soto": {
                "lat": 32.059248,
                "lng": -93.740797
            },
            "East Baton Rouge": {
                "lat": 30.544002,
                "lng": -91.093174
            },
            "East Carroll": {
                "lat": 32.73017,
                "lng": -91.234141
            },
            "East Feliciana": {
                "lat": 30.839784,
                "lng": -91.043434
            },
            "Evangeline": {
                "lat": 30.720693,
                "lng": -92.404086
            },
            "Franklin": {
                "lat": 32.138279,
                "lng": -91.672101
            },
            "Grant": {
                "lat": 31.597787,
                "lng": -92.561716
            },
            "Iberia": {
                "lat": 29.606013,
                "lng": -91.842706
            },
            "Iberville": {
                "lat": 30.288394,
                "lng": -91.36315
            },
            "Jackson": {
                "lat": 32.30448,
                "lng": -92.556672
            },
            "Jefferson": {
                "lat": 29.5033,
                "lng": -90.036231
            },
            "Jefferson Davis": {
                "lat": 30.269529,
                "lng": -92.816221
            },
            "Lafayette": {
                "lat": 30.206507,
                "lng": -92.06417
            },
            "Lafourche": {
                "lat": 29.491993,
                "lng": -90.394849
            },
            "La Salle": {
                "lat": 31.680836,
                "lng": -92.161809
            },
            "Lincoln": {
                "lat": 32.601148,
                "lng": -92.662082
            },
            "Livingston": {
                "lat": 30.440419,
                "lng": -90.727474
            },
            "Madison": {
                "lat": 32.365824,
                "lng": -91.240729
            },
            "Morehouse": {
                "lat": 32.820008,
                "lng": -91.800399
            },
            "Natchitoches": {
                "lat": 31.734982,
                "lng": -93.086106
            },
            "Orleans": {
                "lat": 30.068636,
                "lng": -89.939007
            },
            "Ouachita": {
                "lat": 32.477495,
                "lng": -92.154798
            },
            "Plaquemines": {
                "lat": 29.402337,
                "lng": -89.298489
            },
            "Pointe Coupee": {
                "lat": 30.708319,
                "lng": -91.604621
            },
            "Rapides": {
                "lat": 31.193204,
                "lng": -92.535953
            },
            "Red River": {
                "lat": 32.101213,
                "lng": -93.34905
            },
            "Richland": {
                "lat": 32.418121,
                "lng": -91.758375
            },
            "Sabine": {
                "lat": 31.560209,
                "lng": -93.559228
            },
            "St. Bernard": {
                "lat": 29.91811,
                "lng": -89.263494
            },
            "St. Charles": {
                "lat": 29.913833,
                "lng": -90.359314
            },
            "St. Helena": {
                "lat": 30.821423,
                "lng": -90.70935
            },
            "St. James": {
                "lat": 30.02482,
                "lng": -90.793956
            },
            "St. John the Baptist": {
                "lat": 30.117471,
                "lng": -90.504677
            },
            "St. Landry": {
                "lat": 30.583441,
                "lng": -91.989275
            },
            "St. Martin": {
                "lat": 30.121433,
                "lng": -91.611481
            },
            "St. Mary": {
                "lat": 29.629349,
                "lng": -91.463804
            },
            "St. Tammany": {
                "lat": 30.410022,
                "lng": -89.951962
            },
            "Tangipahoa": {
                "lat": 30.621581,
                "lng": -90.406633
            },
            "Tensas": {
                "lat": 32.001489,
                "lng": -91.342576
            },
            "Terrebonne": {
                "lat": 29.333266,
                "lng": -90.844191
            },
            "Union": {
                "lat": 32.829349,
                "lng": -92.37565
            },
            "Vermilion": {
                "lat": 29.786872,
                "lng": -92.29009
            },
            "Vernon": {
                "lat": 31.110563,
                "lng": -93.18152
            },
            "Washington": {
                "lat": 30.852144,
                "lng": -90.046253
            },
            "Webster": {
                "lat": 32.732152,
                "lng": -93.339825
            },
            "West Baton Rouge": {
                "lat": 30.464052,
                "lng": -91.309808
            },
            "West Carroll": {
                "lat": 32.79248,
                "lng": -91.451998
            },
            "West Feliciana": {
                "lat": 30.872701,
                "lng": -91.421008
            },
            "Winn": {
                "lat": 31.941187,
                "lng": -92.641269
            }
        },
        "cities": {
            "Alexandria": {
                "lat": 31.3112936,
                "lng": -92.4451371
            },
            "Baton Rouge": {
                "lat": 30.4582829,
                "lng": -91.1403196
            },
            "Bossier City": {
                "lat": 32.5159852,
                "lng": -93.7321228
            },
            "Kenner": {
                "lat": 29.9940924,
                "lng": -90.2417434
            },
            "Lafayette": {
                "lat": 30.2240897,
                "lng": -92.0198427
            },
            "Lake Charles": {
                "lat": 30.2265949,
                "lng": -93.2173758
            },
            "Metairie": {
                "lat": 29.9840922,
                "lng": -90.1528519
            },
            "Monroe": {
                "lat": 32.5093109,
                "lng": -92.1193012
            },
            "New Orleans": {
                "lat": 29.95106579999999,
                "lng": -90.0715323
            },
            "Shreveport": {
                "lat": 32.5251516,
                "lng": -93.7501789
            }
        },
        "center": {
            "lat": 31.1801,
            "lng": -91.8749
        }
    },
    "PA": {
        "counties": {
            "Adams": {
                "lat": 39.869471,
                "lng": -77.21773
            },
            "Allegheny": {
                "lat": 40.46892,
                "lng": -79.98092
            },
            "Armstrong": {
                "lat": 40.812379,
                "lng": -79.464128
            },
            "Beaver": {
                "lat": 40.68414,
                "lng": -80.350721
            },
            "Bedford": {
                "lat": 39.997115,
                "lng": -78.48998
            },
            "Berks": {
                "lat": 40.413957,
                "lng": -75.92686
            },
            "Blair": {
                "lat": 40.497926,
                "lng": -78.31064
            },
            "Bradford": {
                "lat": 41.791495,
                "lng": -76.502124
            },
            "Bucks": {
                "lat": 40.336887,
                "lng": -75.10706
            },
            "Butler": {
                "lat": 40.913834,
                "lng": -79.91896
            },
            "Cambria": {
                "lat": 40.494127,
                "lng": -78.715284
            },
            "Cameron": {
                "lat": 41.438289,
                "lng": -78.198315
            },
            "Carbon": {
                "lat": 40.917833,
                "lng": -75.709428
            },
            "Centre": {
                "lat": 40.90916,
                "lng": -77.84783
            },
            "Chester": {
                "lat": 39.973965,
                "lng": -75.749732
            },
            "Clarion": {
                "lat": 41.198239,
                "lng": -79.420404
            },
            "Clearfield": {
                "lat": 41.000249,
                "lng": -78.473749
            },
            "Clinton": {
                "lat": 41.245301,
                "lng": -77.649141
            },
            "Columbia": {
                "lat": 41.045517,
                "lng": -76.40426
            },
            "Crawford": {
                "lat": 41.68684,
                "lng": -80.107811
            },
            "Cumberland": {
                "lat": 40.164782,
                "lng": -77.26344
            },
            "Dauphin": {
                "lat": 40.412565,
                "lng": -76.792634
            },
            "Delaware": {
                "lat": 39.91667,
                "lng": -75.398786
            },
            "Elk": {
                "lat": 41.427334,
                "lng": -78.653938
            },
            "Erie": {
                "lat": 42.117952,
                "lng": -80.096386
            },
            "Fayette": {
                "lat": 39.914115,
                "lng": -79.644586
            },
            "Forest": {
                "lat": 41.513304,
                "lng": -79.249705
            },
            "Franklin": {
                "lat": 39.926686,
                "lng": -77.724485
            },
            "Fulton": {
                "lat": 39.910751,
                "lng": -78.122617
            },
            "Greene": {
                "lat": 39.848983,
                "lng": -80.225694
            },
            "Huntingdon": {
                "lat": 40.422321,
                "lng": -77.968584
            },
            "Indiana": {
                "lat": 40.651432,
                "lng": -79.087545
            },
            "Jefferson": {
                "lat": 41.130287,
                "lng": -78.999044
            },
            "Juniata": {
                "lat": 40.530673,
                "lng": -77.400438
            },
            "Lackawanna": {
                "lat": 41.44025,
                "lng": -75.609587
            },
            "Lancaster": {
                "lat": 40.041992,
                "lng": -76.250198
            },
            "Lawrence": {
                "lat": 40.992735,
                "lng": -80.334446
            },
            "Lebanon": {
                "lat": 40.367344,
                "lng": -76.458009
            },
            "Lehigh": {
                "lat": 40.614241,
                "lng": -75.590627
            },
            "Luzerne": {
                "lat": 41.172787,
                "lng": -75.976035
            },
            "Lycoming": {
                "lat": 41.343624,
                "lng": -77.055253
            },
            "McKean": {
                "lat": 41.81459,
                "lng": -78.572463
            },
            "Mercer": {
                "lat": 41.300014,
                "lng": -80.252786
            },
            "Mifflin": {
                "lat": 40.61189,
                "lng": -77.620661
            },
            "Monroe": {
                "lat": 41.056233,
                "lng": -75.329037
            },
            "Montgomery": {
                "lat": 40.209999,
                "lng": -75.370201
            },
            "Montour": {
                "lat": 41.029261,
                "lng": -76.665259
            },
            "Northampton": {
                "lat": 40.752791,
                "lng": -75.307447
            },
            "Northumberland": {
                "lat": 40.851524,
                "lng": -76.709877
            },
            "Perry": {
                "lat": 40.39778,
                "lng": -77.266328
            },
            "Philadelphia": {
                "lat": 40.009376,
                "lng": -75.133346
            },
            "Pike": {
                "lat": 41.325949,
                "lng": -75.031514
            },
            "Potter": {
                "lat": 41.748222,
                "lng": -77.894735
            },
            "Schuylkill": {
                "lat": 40.70369,
                "lng": -76.2178
            },
            "Snyder": {
                "lat": 40.755348,
                "lng": -77.072954
            },
            "Somerset": {
                "lat": 39.981297,
                "lng": -79.028486
            },
            "Sullivan": {
                "lat": 41.43979,
                "lng": -76.511525
            },
            "Susquehanna": {
                "lat": 41.819665,
                "lng": -75.800969
            },
            "Tioga": {
                "lat": 41.766859,
                "lng": -77.257288
            },
            "Union": {
                "lat": 40.962179,
                "lng": -77.055475
            },
            "Venango": {
                "lat": 41.40198,
                "lng": -79.754418
            },
            "Warren": {
                "lat": 41.843669,
                "lng": -79.313173
            },
            "Washington": {
                "lat": 40.200005,
                "lng": -80.252132
            },
            "Wayne": {
                "lat": 41.646589,
                "lng": -75.292485
            },
            "Westmoreland": {
                "lat": 40.311068,
                "lng": -79.466688
            },
            "Wyoming": {
                "lat": 41.525137,
                "lng": -76.00878
            },
            "York": {
                "lat": 39.921839,
                "lng": -76.728446
            }
        },
        "cities": {
            "Allentown": {
                "lat": 40.6084305,
                "lng": -75.4901833
            },
            "Altoona": {
                "lat": 40.5186809,
                "lng": -78.3947359
            },
            "Bethlehem": {
                "lat": 40.6259316,
                "lng": -75.37045789999999
            },
            "Erie": {
                "lat": 42.12922409999999,
                "lng": -80.085059
            },
            "Harrisburg": {
                "lat": 40.2737002,
                "lng": -76.8844179
            },
            "Lancaster": {
                "lat": 40.0378755,
                "lng": -76.3055144
            },
            "Levittown": {
                "lat": 40.1551096,
                "lng": -74.8287747
            },
            "Philadelphia": {
                "lat": 39.952335,
                "lng": -75.16378900000001
            },
            "California-Kirkbride": {
                "lat": 40.4600435,
                "lng": -80.0213538
            },
            "Pittsburgh": {
                "lat": 40.44062479999999,
                "lng": -79.9958864
            },
            "Reading": {
                "lat": 40.3356483,
                "lng": -75.9268747
            },
            "Scranton": {
                "lat": 41.408969,
                "lng": -75.66241219999999
            },
            "State College": {
                "lat": 40.7933949,
                "lng": -77.8600012
            },
            "Wilkes-Barre": {
                "lat": 41.2459149,
                "lng": -75.88130749999999
            },
            "York": {
                "lat": 39.9625984,
                "lng": -76.727745
            }
        },
        "center": {
            "lat": 40.5773,
            "lng": -77.264
        }
    },
    "IA": {
        "counties": {
            "Adair": {
                "lat": 41.328528,
                "lng": -94.478164
            },
            "Adams": {
                "lat": 41.021656,
                "lng": -94.696906
            },
            "Allamakee": {
                "lat": 43.274964,
                "lng": -91.382751
            },
            "Appanoose": {
                "lat": 40.744683,
                "lng": -92.870345
            },
            "Audubon": {
                "lat": 41.679178,
                "lng": -94.904312
            },
            "Benton": {
                "lat": 42.092547,
                "lng": -92.05763
            },
            "Black Hawk": {
                "lat": 42.472888,
                "lng": -92.306059
            },
            "Boone": {
                "lat": 42.038601,
                "lng": -93.939138
            },
            "Bremer": {
                "lat": 42.78089,
                "lng": -92.327586
            },
            "Buchanan": {
                "lat": 42.470328,
                "lng": -91.838666
            },
            "Buena Vista": {
                "lat": 42.741522,
                "lng": -95.141433
            },
            "Butler": {
                "lat": 42.734708,
                "lng": -92.780066
            },
            "Calhoun": {
                "lat": 42.38617,
                "lng": -94.643683
            },
            "Carroll": {
                "lat": 42.039492,
                "lng": -94.867647
            },
            "Cass": {
                "lat": 41.333824,
                "lng": -94.933302
            },
            "Cedar": {
                "lat": 41.772355,
                "lng": -91.13219
            },
            "Cerro Gordo": {
                "lat": 43.075171,
                "lng": -93.251266
            },
            "Cherokee": {
                "lat": 42.742738,
                "lng": -95.633262
            },
            "Chickasaw": {
                "lat": 43.059741,
                "lng": -92.31721
            },
            "Clarke": {
                "lat": 41.029191,
                "lng": -93.784096
            },
            "Clay": {
                "lat": 43.079822,
                "lng": -95.149726
            },
            "Clayton": {
                "lat": 42.840998,
                "lng": -91.323511
            },
            "Clinton": {
                "lat": 41.898073,
                "lng": -90.534243
            },
            "Crawford": {
                "lat": 42.043119,
                "lng": -95.38909
            },
            "Dallas": {
                "lat": 41.685321,
                "lng": -94.040707
            },
            "Davis": {
                "lat": 40.748089,
                "lng": -92.410345
            },
            "Decatur": {
                "lat": 40.736379,
                "lng": -93.78458
            },
            "Delaware": {
                "lat": 42.473003,
                "lng": -91.359443
            },
            "Des Moines": {
                "lat": 40.915339,
                "lng": -91.186925
            },
            "Dickinson": {
                "lat": 43.389611,
                "lng": -95.196057
            },
            "Dubuque": {
                "lat": 42.463481,
                "lng": -90.878771
            },
            "Emmet": {
                "lat": 43.377984,
                "lng": -94.66937
            },
            "Fayette": {
                "lat": 42.86445,
                "lng": -91.839373
            },
            "Floyd": {
                "lat": 43.052741,
                "lng": -92.787367
            },
            "Franklin": {
                "lat": 42.736549,
                "lng": -93.271425
            },
            "Fremont": {
                "lat": 40.743726,
                "lng": -95.599516
            },
            "Greene": {
                "lat": 42.042494,
                "lng": -94.388703
            },
            "Grundy": {
                "lat": 42.403323,
                "lng": -92.790261
            },
            "Guthrie": {
                "lat": 41.683573,
                "lng": -94.501272
            },
            "Hamilton": {
                "lat": 42.390768,
                "lng": -93.709198
            },
            "Hancock": {
                "lat": 43.075411,
                "lng": -93.743697
            },
            "Hardin": {
                "lat": 42.389955,
                "lng": -93.241081
            },
            "Harrison": {
                "lat": 41.688584,
                "lng": -95.827149
            },
            "Henry": {
                "lat": 40.985864,
                "lng": -91.54427
            },
            "Howard": {
                "lat": 43.365313,
                "lng": -92.321908
            },
            "Humboldt": {
                "lat": 42.782221,
                "lng": -94.202775
            },
            "Ida": {
                "lat": 42.39186,
                "lng": -95.507421
            },
            "Iowa": {
                "lat": 41.683918,
                "lng": -92.059123
            },
            "Jackson": {
                "lat": 42.164281,
                "lng": -90.574597
            },
            "Jasper": {
                "lat": 41.685686,
                "lng": -93.052971
            },
            "Jefferson": {
                "lat": 41.00688,
                "lng": -91.967137
            },
            "Johnson": {
                "lat": 41.668737,
                "lng": -91.588812
            },
            "Jones": {
                "lat": 42.125118,
                "lng": -91.116914
            },
            "Keokuk": {
                "lat": 41.331182,
                "lng": -92.167721
            },
            "Kossuth": {
                "lat": 43.212478,
                "lng": -94.213983
            },
            "Lee": {
                "lat": 40.647588,
                "lng": -91.477157
            },
            "Linn": {
                "lat": 42.077951,
                "lng": -91.597674
            },
            "Louisa": {
                "lat": 41.218211,
                "lng": -91.256994
            },
            "Lucas": {
                "lat": 41.033344,
                "lng": -93.331467
            },
            "Lyon": {
                "lat": 43.38358,
                "lng": -96.207201
            },
            "Madison": {
                "lat": 41.330622,
                "lng": -94.015184
            },
            "Mahaska": {
                "lat": 41.330797,
                "lng": -92.636366
            },
            "Marion": {
                "lat": 41.331455,
                "lng": -93.093849
            },
            "Marshall": {
                "lat": 42.041691,
                "lng": -92.981452
            },
            "Mills": {
                "lat": 41.033703,
                "lng": -95.619101
            },
            "Mitchell": {
                "lat": 43.348564,
                "lng": -92.784466
            },
            "Monona": {
                "lat": 42.049432,
                "lng": -95.956566
            },
            "Monroe": {
                "lat": 41.028847,
                "lng": -92.869642
            },
            "Montgomery": {
                "lat": 41.021735,
                "lng": -95.15779
            },
            "Muscatine": {
                "lat": 41.483776,
                "lng": -91.118699
            },
            "O'Brien": {
                "lat": 43.083746,
                "lng": -95.625624
            },
            "Osceola": {
                "lat": 43.378542,
                "lng": -95.633788
            },
            "Page": {
                "lat": 40.73909,
                "lng": -95.14429
            },
            "Palo Alto": {
                "lat": 43.075854,
                "lng": -94.667297
            },
            "Plymouth": {
                "lat": 42.737585,
                "lng": -96.215864
            },
            "Pocahontas": {
                "lat": 42.734033,
                "lng": -94.678279
            },
            "Polk": {
                "lat": 41.684281,
                "lng": -93.56972
            },
            "Pottawattamie": {
                "lat": 41.340184,
                "lng": -95.544905
            },
            "Poweshiek": {
                "lat": 41.684526,
                "lng": -92.522882
            },
            "Ringgold": {
                "lat": 40.735334,
                "lng": -94.244251
            },
            "Sac": {
                "lat": 42.387526,
                "lng": -95.105224
            },
            "Scott": {
                "lat": 41.641679,
                "lng": -90.62229
            },
            "Shelby": {
                "lat": 41.679014,
                "lng": -95.308917
            },
            "Sioux": {
                "lat": 43.082854,
                "lng": -96.177929
            },
            "Story": {
                "lat": 42.037538,
                "lng": -93.466093
            },
            "Tama": {
                "lat": 42.074848,
                "lng": -92.529412
            },
            "Taylor": {
                "lat": 40.737949,
                "lng": -94.697108
            },
            "Union": {
                "lat": 41.02855,
                "lng": -94.245091
            },
            "Van Buren": {
                "lat": 40.754117,
                "lng": -91.952943
            },
            "Wapello": {
                "lat": 41.031263,
                "lng": -92.409482
            },
            "Warren": {
                "lat": 41.336769,
                "lng": -93.564366
            },
            "Washington": {
                "lat": 41.329401,
                "lng": -91.725052
            },
            "Wayne": {
                "lat": 40.739983,
                "lng": -93.332613
            },
            "Webster": {
                "lat": 42.434397,
                "lng": -94.179157
            },
            "Winnebago": {
                "lat": 43.378124,
                "lng": -93.743488
            },
            "Winneshiek": {
                "lat": 43.292989,
                "lng": -91.850788
            },
            "Woodbury": {
                "lat": 42.39322,
                "lng": -96.053296
            },
            "Worth": {
                "lat": 43.373491,
                "lng": -93.248533
            },
            "Wright": {
                "lat": 42.733007,
                "lng": -93.734735
            }
        },
        "cities": {
            "Ames": {
                "lat": 42.02335,
                "lng": -93.62562199999999
            },
            "Ankeny": {
                "lat": 41.7266667,
                "lng": -93.6041667
            },
            "Cedar Rapids": {
                "lat": 41.9778795,
                "lng": -91.6656232
            },
            "Council Bluffs": {
                "lat": 41.2619444,
                "lng": -95.8608333
            },
            "Davenport": {
                "lat": 41.5236437,
                "lng": -90.5776367
            },
            "Des Moines": {
                "lat": 41.6005448,
                "lng": -93.6091064
            },
            "Dubuque": {
                "lat": 42.5005583,
                "lng": -90.66457179999999
            },
            "Iowa City": {
                "lat": 41.6611277,
                "lng": -91.5301683
            },
            "Sioux City": {
                "lat": 42.4999942,
                "lng": -96.40030689999999
            },
            "Urbandale": {
                "lat": 41.6266555,
                "lng": -93.71216559999999
            },
            "Waterloo": {
                "lat": 42.4927641,
                "lng": -92.34296309999999
            },
            "West Des Moines": {
                "lat": 41.5772115,
                "lng": -93.711332
            }
        },
        "center": {
            "lat": 42.0046,
            "lng": -93.214
        }
    },
    "AK": {
        "counties": {
            "Aleutians East": {
                "lat": 55.243722,
                "lng": -161.950749
            },
            "Aleutians West": {
                "lat": 51.959447,
                "lng": -178.338813
            },
            "Anchorage": {
                "lat": 61.177549,
                "lng": -149.274354
            },
            "Bethel": {
                "lat": 60.928916,
                "lng": -160.15335
            },
            "Bristol Bay": {
                "lat": 58.731373,
                "lng": -156.986612
            },
            "Denali": {
                "lat": 63.682732,
                "lng": -150.026719
            },
            "Dillingham": {
                "lat": 59.824816,
                "lng": -158.602233
            },
            "Fairbanks North Star": {
                "lat": 64.690832,
                "lng": -146.599867
            },
            "Haines": {
                "lat": 59.099905,
                "lng": -135.578102
            },
            "Hoonah-Angoon": {
                "lat": 58.076434,
                "lng": -135.1851
            },
            "Juneau": {
                "lat": 58.3727,
                "lng": -134.178781
            },
            "Kenai Peninsula": {
                "lat": 60.366373,
                "lng": -152.321973
            },
            "Ketchikan Gateway": {
                "lat": 55.449938,
                "lng": -131.106685
            },
            "Kodiak Island": {
                "lat": 57.553611,
                "lng": -153.630911
            },
            "Lake and Peninsula": {
                "lat": 58.205065,
                "lng": -156.705188
            },
            "Matanuska-Susitna": {
                "lat": 62.182174,
                "lng": -149.407974
            },
            "Nome": {
                "lat": 64.783686,
                "lng": -164.188912
            },
            "North Slope": {
                "lat": 69.449343,
                "lng": -153.47283
            },
            "Northwest Arctic": {
                "lat": 67.005066,
                "lng": -160.021086
            },
            "Petersburg": {
                "lat": 56.639612,
                "lng": -133.527996
            },
            "Prince of Wales-Hyder": {
                "lat": 55.415683,
                "lng": -132.875734
            },
            "Sitka": {
                "lat": 57.142509,
                "lng": -135.332624
            },
            "Skagway": {
                "lat": 59.575097,
                "lng": -135.335418
            },
            "Southeast Fairbanks": {
                "lat": 63.864997,
                "lng": -143.218628
            },
            "Valdez-Cordova": {
                "lat": 61.34984,
                "lng": -145.023141
            },
            "Wade Hampton": {
                "lat": 62.283174,
                "lng": -163.19095
            },
            "Wrangell": {
                "lat": 56.279121,
                "lng": -132.040326
            },
            "Yakutat": {
                "lat": 59.999083,
                "lng": -140.239593
            },
            "Yukon-Koyukuk": {
                "lat": 65.376131,
                "lng": -151.576855
            }
        },
        "cities": {
            "Anchorage": {
                "lat": 61.2180556,
                "lng": -149.9002778
            }
        },
        "center": {
            "lat": 61.385,
            "lng": -152.2683
        }
    },
    "IN": {
        "counties": {
            "Adams": {
                "lat": 40.745733,
                "lng": -84.936131
            },
            "Allen": {
                "lat": 41.091855,
                "lng": -85.07223
            },
            "Bartholomew": {
                "lat": 39.205843,
                "lng": -85.897999
            },
            "Benton": {
                "lat": 40.608253,
                "lng": -87.315479
            },
            "Blackford": {
                "lat": 40.472672,
                "lng": -85.32373
            },
            "Boone": {
                "lat": 40.050892,
                "lng": -86.469014
            },
            "Brown": {
                "lat": 39.192585,
                "lng": -86.23941
            },
            "Carroll": {
                "lat": 40.58498,
                "lng": -86.565141
            },
            "Cass": {
                "lat": 40.753799,
                "lng": -86.355169
            },
            "Clark": {
                "lat": 38.476217,
                "lng": -85.711122
            },
            "Clay": {
                "lat": 39.393951,
                "lng": -87.115837
            },
            "Clinton": {
                "lat": 40.305944,
                "lng": -86.477567
            },
            "Crawford": {
                "lat": 38.289433,
                "lng": -86.440871
            },
            "Daviess": {
                "lat": 38.696155,
                "lng": -87.076988
            },
            "Dearborn": {
                "lat": 39.151491,
                "lng": -84.97346
            },
            "Decatur": {
                "lat": 39.30598,
                "lng": -85.499831
            },
            "DeKalb": {
                "lat": 41.401189,
                "lng": -85.000185
            },
            "Delaware": {
                "lat": 40.227165,
                "lng": -85.398856
            },
            "Dubois": {
                "lat": 38.373344,
                "lng": -86.873385
            },
            "Elkhart": {
                "lat": 41.600693,
                "lng": -85.863986
            },
            "Fayette": {
                "lat": 39.639655,
                "lng": -85.185032
            },
            "Floyd": {
                "lat": 38.317937,
                "lng": -85.911474
            },
            "Fountain": {
                "lat": 40.121282,
                "lng": -87.234806
            },
            "Franklin": {
                "lat": 39.409762,
                "lng": -85.066964
            },
            "Fulton": {
                "lat": 41.050384,
                "lng": -86.265006
            },
            "Gibson": {
                "lat": 38.317413,
                "lng": -87.580566
            },
            "Grant": {
                "lat": 40.515758,
                "lng": -85.654946
            },
            "Greene": {
                "lat": 39.0486,
                "lng": -87.005245
            },
            "Hamilton": {
                "lat": 40.04987,
                "lng": -86.020586
            },
            "Hancock": {
                "lat": 39.822604,
                "lng": -85.772904
            },
            "Harrison": {
                "lat": 38.18644,
                "lng": -86.103681
            },
            "Hendricks": {
                "lat": 39.768749,
                "lng": -86.510287
            },
            "Henry": {
                "lat": 39.929576,
                "lng": -85.397338
            },
            "Howard": {
                "lat": 40.483537,
                "lng": -86.114118
            },
            "Huntington": {
                "lat": 40.826394,
                "lng": -85.478598
            },
            "Jackson": {
                "lat": 38.911957,
                "lng": -86.042516
            },
            "Jasper": {
                "lat": 41.017688,
                "lng": -87.118814
            },
            "Jay": {
                "lat": 40.434972,
                "lng": -85.00338
            },
            "Jefferson": {
                "lat": 38.783604,
                "lng": -85.44009
            },
            "Jennings": {
                "lat": 38.996234,
                "lng": -85.628111
            },
            "Johnson": {
                "lat": 39.495986,
                "lng": -86.0946
            },
            "Knox": {
                "lat": 38.688663,
                "lng": -87.420182
            },
            "Kosciusko": {
                "lat": 41.244293,
                "lng": -85.861575
            },
            "LaGrange": {
                "lat": 41.642468,
                "lng": -85.426302
            },
            "Lake": {
                "lat": 41.472239,
                "lng": -87.374337
            },
            "LaPorte": {
                "lat": 41.549011,
                "lng": -86.744729
            },
            "Lawrence": {
                "lat": 38.839815,
                "lng": -86.48782
            },
            "Madison": {
                "lat": 40.166203,
                "lng": -85.722454
            },
            "Marion": {
                "lat": 39.782976,
                "lng": -86.135794
            },
            "Marshall": {
                "lat": 41.325003,
                "lng": -86.269036
            },
            "Martin": {
                "lat": 38.705322,
                "lng": -86.801847
            },
            "Miami": {
                "lat": 40.772881,
                "lng": -86.044259
            },
            "Monroe": {
                "lat": 39.160751,
                "lng": -86.523325
            },
            "Montgomery": {
                "lat": 40.040296,
                "lng": -86.892715
            },
            "Morgan": {
                "lat": 39.482646,
                "lng": -86.447457
            },
            "Newton": {
                "lat": 40.962399,
                "lng": -87.402172
            },
            "Noble": {
                "lat": 41.400794,
                "lng": -85.41785
            },
            "Ohio": {
                "lat": 38.940527,
                "lng": -84.964299
            },
            "Orange": {
                "lat": 38.547381,
                "lng": -86.489257
            },
            "Owen": {
                "lat": 39.317339,
                "lng": -86.838845
            },
            "Parke": {
                "lat": 39.77425,
                "lng": -87.19695
            },
            "Perry": {
                "lat": 38.081436,
                "lng": -86.62654
            },
            "Pike": {
                "lat": 38.397898,
                "lng": -87.232532
            },
            "Porter": {
                "lat": 41.509922,
                "lng": -87.071308
            },
            "Posey": {
                "lat": 38.027614,
                "lng": -87.868653
            },
            "Pulaski": {
                "lat": 41.045272,
                "lng": -86.692538
            },
            "Putnam": {
                "lat": 39.665545,
                "lng": -86.853325
            },
            "Randolph": {
                "lat": 40.164414,
                "lng": -85.005004
            },
            "Ripley": {
                "lat": 39.10023,
                "lng": -85.260541
            },
            "Rush": {
                "lat": 39.622312,
                "lng": -85.466527
            },
            "St. Joseph": {
                "lat": 41.617699,
                "lng": -86.288159
            },
            "Scott": {
                "lat": 38.679431,
                "lng": -85.751898
            },
            "Shelby": {
                "lat": 39.524135,
                "lng": -85.792174
            },
            "Spencer": {
                "lat": 38.009789,
                "lng": -87.010645
            },
            "Starke": {
                "lat": 41.28322,
                "lng": -86.64757
            },
            "Steuben": {
                "lat": 41.643437,
                "lng": -85.002467
            },
            "Sullivan": {
                "lat": 39.089225,
                "lng": -87.415843
            },
            "Switzerland": {
                "lat": 38.825846,
                "lng": -85.029679
            },
            "Tippecanoe": {
                "lat": 40.38926,
                "lng": -86.893943
            },
            "Tipton": {
                "lat": 40.310229,
                "lng": -86.056207
            },
            "Union": {
                "lat": 39.623111,
                "lng": -84.925152
            },
            "Vanderburgh": {
                "lat": 38.02007,
                "lng": -87.586166
            },
            "Vermillion": {
                "lat": 39.854045,
                "lng": -87.462071
            },
            "Vigo": {
                "lat": 39.429143,
                "lng": -87.390375
            },
            "Wabash": {
                "lat": 40.843717,
                "lng": -85.795175
            },
            "Warren": {
                "lat": 40.352658,
                "lng": -87.375847
            },
            "Warrick": {
                "lat": 38.097764,
                "lng": -87.272023
            },
            "Washington": {
                "lat": 38.600613,
                "lng": -86.104751
            },
            "Wayne": {
                "lat": 39.863091,
                "lng": -85.006735
            },
            "Wells": {
                "lat": 40.735273,
                "lng": -85.212974
            },
            "White": {
                "lat": 40.75095,
                "lng": -86.864293
            },
            "Whitley": {
                "lat": 41.136426,
                "lng": -85.501892
            }
        },
        "cities": {
            "Anderson": {
                "lat": 40.1053196,
                "lng": -85.6802541
            },
            "Bloomington": {
                "lat": 39.165325,
                "lng": -86.52638569999999
            },
            "Carmel": {
                "lat": 39.978371,
                "lng": -86.1180435
            },
            "Columbus": {
                "lat": 39.2014404,
                "lng": -85.9213796
            },
            "Elkhart": {
                "lat": 41.6819935,
                "lng": -85.9766671
            },
            "Evansville": {
                "lat": 37.9715592,
                "lng": -87.5710898
            },
            "Fishers": {
                "lat": 39.9555928,
                "lng": -86.0138729
            },
            "Fort Wayne": {
                "lat": 41.079273,
                "lng": -85.1393513
            },
            "Gary": {
                "lat": 41.5933696,
                "lng": -87.3464271
            },
            "Greenwood": {
                "lat": 39.6136578,
                "lng": -86.10665259999999
            },
            "Hammond": {
                "lat": 41.5833688,
                "lng": -87.5000412
            },
            "Indianapolis": {
                "lat": 39.7685155,
                "lng": -86.1580736
            },
            "Jeffersonville": {
                "lat": 38.2775702,
                "lng": -85.7371847
            },
            "Kokomo": {
                "lat": 40.486427,
                "lng": -86.13360329999999
            },
            "Lafayette": {
                "lat": 40.4167022,
                "lng": -86.87528689999999
            },
            "Lawrence": {
                "lat": 39.8386516,
                "lng": -86.0252612
            },
            "Mishawaka": {
                "lat": 41.6619927,
                "lng": -86.15861559999999
            },
            "Muncie": {
                "lat": 40.1933767,
                "lng": -85.3863599
            },
            "Noblesville": {
                "lat": 40.0455917,
                "lng": -86.0085955
            },
            "South Bend": {
                "lat": 41.6833813,
                "lng": -86.25000659999999
            },
            "Terre Haute": {
                "lat": 39.4667034,
                "lng": -87.41390919999999
            }
        },
        "center": {
            "lat": 39.8647,
            "lng": -86.2604
        }
    },
    "MI": {
        "counties": {
            "Alcona": {
                "lat": 44.682535,
                "lng": -82.83408
            },
            "Alger": {
                "lat": 47.080077,
                "lng": -86.564108
            },
            "Allegan": {
                "lat": 42.595788,
                "lng": -86.634745
            },
            "Alpena": {
                "lat": 44.894954,
                "lng": -83.426574
            },
            "Antrim": {
                "lat": 45.005457,
                "lng": -85.175625
            },
            "Arenac": {
                "lat": 44.03687,
                "lng": -83.740675
            },
            "Baraga": {
                "lat": 46.696068,
                "lng": -88.356022
            },
            "Barry": {
                "lat": 42.582811,
                "lng": -85.31455
            },
            "Bay": {
                "lat": 43.699711,
                "lng": -83.978701
            },
            "Benzie": {
                "lat": 44.648621,
                "lng": -86.494317
            },
            "Berrien": {
                "lat": 41.792639,
                "lng": -86.741822
            },
            "Branch": {
                "lat": 41.918585,
                "lng": -85.066523
            },
            "Calhoun": {
                "lat": 42.24299,
                "lng": -85.012385
            },
            "Cass": {
                "lat": 41.91624,
                "lng": -85.999457
            },
            "Charlevoix": {
                "lat": 45.513164,
                "lng": -85.450392
            },
            "Cheboygan": {
                "lat": 45.47612,
                "lng": -84.495271
            },
            "Chippewa": {
                "lat": 46.321819,
                "lng": -84.52063
            },
            "Clare": {
                "lat": 43.991137,
                "lng": -84.838325
            },
            "Clinton": {
                "lat": 42.950455,
                "lng": -84.591695
            },
            "Crawford": {
                "lat": 44.680208,
                "lng": -84.611132
            },
            "Delta": {
                "lat": 45.805101,
                "lng": -86.901373
            },
            "Dickinson": {
                "lat": 46.012823,
                "lng": -87.866119
            },
            "Eaton": {
                "lat": 42.589614,
                "lng": -84.846524
            },
            "Emmet": {
                "lat": 45.590094,
                "lng": -84.986822
            },
            "Genesee": {
                "lat": 43.021077,
                "lng": -83.706372
            },
            "Gladwin": {
                "lat": 43.98975,
                "lng": -84.389816
            },
            "Gogebic": {
                "lat": 46.488054,
                "lng": -89.788314
            },
            "Grand Traverse": {
                "lat": 44.718688,
                "lng": -85.553848
            },
            "Gratiot": {
                "lat": 43.292326,
                "lng": -84.60469
            },
            "Hillsdale": {
                "lat": 41.864475,
                "lng": -84.642409
            },
            "Houghton": {
                "lat": 46.998305,
                "lng": -88.652066
            },
            "Huron": {
                "lat": 43.907616,
                "lng": -82.857045
            },
            "Ingham": {
                "lat": 42.603534,
                "lng": -84.373811
            },
            "Ionia": {
                "lat": 42.94465,
                "lng": -85.073766
            },
            "Iosco": {
                "lat": 44.329482,
                "lng": -82.849447
            },
            "Iron": {
                "lat": 46.170249,
                "lng": -88.540409
            },
            "Isabella": {
                "lat": 43.645233,
                "lng": -84.839425
            },
            "Jackson": {
                "lat": 42.248474,
                "lng": -84.420868
            },
            "Kalamazoo": {
                "lat": 42.246266,
                "lng": -85.532854
            },
            "Kalkaska": {
                "lat": 44.678881,
                "lng": -85.088992
            },
            "Kent": {
                "lat": 43.032497,
                "lng": -85.547446
            },
            "Keweenaw": {
                "lat": 47.681981,
                "lng": -88.148802
            },
            "Lake": {
                "lat": 43.995187,
                "lng": -85.8114
            },
            "Lapeer": {
                "lat": 43.088633,
                "lng": -83.224325
            },
            "Leelanau": {
                "lat": 45.146182,
                "lng": -86.051574
            },
            "Lenawee": {
                "lat": 41.895915,
                "lng": -84.066853
            },
            "Livingston": {
                "lat": 42.602532,
                "lng": -83.911718
            },
            "Luce": {
                "lat": 46.940602,
                "lng": -85.582368
            },
            "Mackinac": {
                "lat": 46.167981,
                "lng": -85.303756
            },
            "Macomb": {
                "lat": 42.671467,
                "lng": -82.910869
            },
            "Manistee": {
                "lat": 44.350385,
                "lng": -86.602967
            },
            "Marquette": {
                "lat": 46.656597,
                "lng": -87.584028
            },
            "Mason": {
                "lat": 43.996636,
                "lng": -86.750814
            },
            "Mecosta": {
                "lat": 43.635295,
                "lng": -85.332751
            },
            "Menominee": {
                "lat": 45.544174,
                "lng": -87.509892
            },
            "Midland": {
                "lat": 43.648378,
                "lng": -84.37922
            },
            "Missaukee": {
                "lat": 44.325424,
                "lng": -85.085471
            },
            "Monroe": {
                "lat": 41.916097,
                "lng": -83.487106
            },
            "Montcalm": {
                "lat": 43.312782,
                "lng": -85.149468
            },
            "Montmorency": {
                "lat": 45.024134,
                "lng": -84.130107
            },
            "Muskegon": {
                "lat": 43.289258,
                "lng": -86.751892
            },
            "Newaygo": {
                "lat": 43.562709,
                "lng": -85.791423
            },
            "Oakland": {
                "lat": 42.660452,
                "lng": -83.38421
            },
            "Oceana": {
                "lat": 43.647255,
                "lng": -86.807575
            },
            "Ogemaw": {
                "lat": 44.33328,
                "lng": -84.128073
            },
            "Ontonagon": {
                "lat": 47.216604,
                "lng": -89.500461
            },
            "Osceola": {
                "lat": 43.997552,
                "lng": -85.322283
            },
            "Oscoda": {
                "lat": 44.685121,
                "lng": -84.124894
            },
            "Otsego": {
                "lat": 45.021794,
                "lng": -84.576597
            },
            "Ottawa": {
                "lat": 42.942346,
                "lng": -86.655342
            },
            "Presque Isle": {
                "lat": 45.489515,
                "lng": -83.384019
            },
            "Roscommon": {
                "lat": 44.339517,
                "lng": -84.611272
            },
            "Saginaw": {
                "lat": 43.328267,
                "lng": -84.05541
            },
            "St. Clair": {
                "lat": 42.928804,
                "lng": -82.668914
            },
            "St. Joseph": {
                "lat": 41.911488,
                "lng": -85.52287
            },
            "Sanilac": {
                "lat": 43.449155,
                "lng": -82.642815
            },
            "Schoolcraft": {
                "lat": 46.020758,
                "lng": -86.199352
            },
            "Shiawassee": {
                "lat": 42.951545,
                "lng": -84.146352
            },
            "Tuscola": {
                "lat": 43.487902,
                "lng": -83.436618
            },
            "Van Buren": {
                "lat": 42.283986,
                "lng": -86.305697
            },
            "Washtenaw": {
                "lat": 42.252327,
                "lng": -83.844634
            },
            "Wayne": {
                "lat": 42.284664,
                "lng": -83.261953
            },
            "Wexford": {
                "lat": 44.331375,
                "lng": -85.570046
            }
        },
        "cities": {
            "Ann Arbor": {
                "lat": 42.3076493,
                "lng": -83.8473015
            },
            "Battle Creek": {
                "lat": 42.3211522,
                "lng": -85.17971419999999
            },
            "Dearborn": {
                "lat": 42.3222599,
                "lng": -83.17631449999999
            },
            "Dearborn Heights": {
                "lat": 42.3369816,
                "lng": -83.27326269999999
            },
            "Detroit": {
                "lat": 42.331427,
                "lng": -83.0457538
            },
            "East Lansing": {
                "lat": 42.7369792,
                "lng": -84.48386540000001
            },
            "Farmington Hills": {
                "lat": 42.4828221,
                "lng": -83.41838229999999
            },
            "Flint": {
                "lat": 43.0777289,
                "lng": -83.67739279999999
            },
            "Grand Rapids": {
                "lat": 42.9633599,
                "lng": -85.6680863
            },
            "Grand Rapids Charter Township": {
                "lat": 43.0020023,
                "lng": -85.57150150000001
            },
            "Kalamazoo": {
                "lat": 42.2917069,
                "lng": -85.5872286
            },
            "Kentwood": {
                "lat": 42.8694731,
                "lng": -85.64474919999999
            },
            "Lansing": {
                "lat": 42.732535,
                "lng": -84.5555347
            },
            "Lansing Charter Township": {
                "lat": 42.7563594,
                "lng": -84.5283267
            },
            "Livonia": {
                "lat": 42.36837,
                "lng": -83.35270969999999
            },
            "Midland": {
                "lat": 43.57509779999999,
                "lng": -84.3542049
            },
            "Novi": {
                "lat": 42.48059,
                "lng": -83.4754913
            },
            "Pontiac": {
                "lat": 42.6389216,
                "lng": -83.29104679999999
            },
            "Portage": {
                "lat": 42.2011538,
                "lng": -85.5800022
            },
            "Portage Township": {
                "lat": 46.9338608,
                "lng": -88.66166109999999
            },
            "Rochester Hills": {
                "lat": 42.65836609999999,
                "lng": -83.1499322
            },
            "Roseville": {
                "lat": 42.4972583,
                "lng": -82.9371409
            },
            "Royal Oak": {
                "lat": 42.4894801,
                "lng": -83.1446485
            },
            "Saginaw": {
                "lat": 43.4194699,
                "lng": -83.9508068
            },
            "St Clair Shores": {
                "lat": 42.4931,
                "lng": -82.8911339
            },
            "Southfield": {
                "lat": 42.4733688,
                "lng": -83.2218731
            },
            "Sterling Heights": {
                "lat": 42.5803122,
                "lng": -83.0302033
            },
            "Taylor": {
                "lat": 42.240872,
                "lng": -83.2696509
            },
            "Troy": {
                "lat": 42.6055893,
                "lng": -83.1499304
            },
            "Warren": {
                "lat": 42.49299999999999,
                "lng": -83.02819699999999
            },
            "Westland": {
                "lat": 42.32420399999999,
                "lng": -83.400211
            },
            "Wyoming": {
                "lat": 42.9133602,
                "lng": -85.7053085
            }
        },
        "center": {
            "lat": 43.3504,
            "lng": -84.5603
        }
    },
    "AZ": {
        "counties": {
            "Apache": {
                "lat": 35.385845,
                "lng": -109.493747
            },
            "Cochise": {
                "lat": 31.881793,
                "lng": -109.75412
            },
            "Coconino": {
                "lat": 35.829692,
                "lng": -111.773728
            },
            "Gila": {
                "lat": 33.789618,
                "lng": -110.81187
            },
            "Graham": {
                "lat": 32.931828,
                "lng": -109.87831
            },
            "Greenlee": {
                "lat": 33.238872,
                "lng": -109.242323
            },
            "La Paz": {
                "lat": 33.727625,
                "lng": -114.038793
            },
            "Maricopa": {
                "lat": 33.346541,
                "lng": -112.495534
            },
            "Mohave": {
                "lat": 35.717705,
                "lng": -113.749689
            },
            "Navajo": {
                "lat": 35.390934,
                "lng": -110.320908
            },
            "Pima": {
                "lat": 32.128237,
                "lng": -111.783018
            },
            "Pinal": {
                "lat": 32.91891,
                "lng": -111.367257
            },
            "Santa Cruz": {
                "lat": 31.525904,
                "lng": -110.84519
            },
            "Yavapai": {
                "lat": 34.630044,
                "lng": -112.573745
            },
            "Yuma": {
                "lat": 32.773942,
                "lng": -113.910905
            }
        },
        "cities": {
            "Apache Junction": {
                "lat": 33.4150485,
                "lng": -111.5495777
            },
            "Avondale": {
                "lat": 33.4355977,
                "lng": -112.3496021
            },
            "Buckeye": {
                "lat": 33.3703197,
                "lng": -112.5837766
            },
            "Bullhead City": {
                "lat": 35.1477774,
                "lng": -114.5682983
            },
            "Casa Grande": {
                "lat": 32.8795022,
                "lng": -111.7573521
            },
            "Casas Adobes": {
                "lat": 32.3234078,
                "lng": -110.9950966
            },
            "Catalina Foothills": {
                "lat": 32.297853,
                "lng": -110.9187037
            },
            "Chandler": {
                "lat": 33.3061605,
                "lng": -111.8412502
            },
            "Flagstaff": {
                "lat": 35.2013516,
                "lng": -111.639249
            },
            "Gilbert": {
                "lat": 33.3528264,
                "lng": -111.789027
            },
            "Glendale": {
                "lat": 33.5386523,
                "lng": -112.1859866
            },
            "Goodyear": {
                "lat": 33.449806,
                "lng": -112.3582136
            },
            "Lake Havasu City": {
                "lat": 34.483901,
                "lng": -114.3224548
            },
            "Maricopa": {
                "lat": 33.0581063,
                "lng": -112.0476423
            },
            "Mesa": {
                "lat": 33.4151843,
                "lng": -111.8314724
            },
            "Oro Valley": {
                "lat": 32.3909071,
                "lng": -110.966488
            },
            "Peoria": {
                "lat": 33.5805955,
                "lng": -112.2373779
            },
            "Phoenix": {
                "lat": 33.4483771,
                "lng": -112.0740373
            },
            "Prescott": {
                "lat": 34.5400242,
                "lng": -112.4685025
            },
            "Prescott Valley": {
                "lat": 34.6100243,
                "lng": -112.315721
            },
            "San Tan Valley": {
                "lat": 33.1702778,
                "lng": -111.5722222
            },
            "Scottsdale": {
                "lat": 33.4941704,
                "lng": -111.9260519
            },
            "Sierra Vista": {
                "lat": 31.5455001,
                "lng": -110.2772856
            },
            "Surprise": {
                "lat": 33.639099,
                "lng": -112.3957576
            },
            "Tempe": {
                "lat": 33.4255104,
                "lng": -111.9400054
            },
            "Tucson": {
                "lat": 32.2217429,
                "lng": -110.926479
            },
            "Yuma": {
                "lat": 32.6926512,
                "lng": -114.6276916
            }
        },
        "center": {
            "lat": 33.7712,
            "lng": -111.3877
        }
    },
    "NC": {
        "counties": {
            "Alamance": {
                "lat": 36.041974,
                "lng": -79.399935
            },
            "Alexander": {
                "lat": 35.920951,
                "lng": -81.177467
            },
            "Alleghany": {
                "lat": 36.489356,
                "lng": -81.132299
            },
            "Anson": {
                "lat": 34.974996,
                "lng": -80.109959
            },
            "Ashe": {
                "lat": 36.436305,
                "lng": -81.49877
            },
            "Avery": {
                "lat": 36.072894,
                "lng": -81.920363
            },
            "Beaufort": {
                "lat": 35.482313,
                "lng": -76.842014
            },
            "Bertie": {
                "lat": 36.06133,
                "lng": -76.962367
            },
            "Bladen": {
                "lat": 34.591949,
                "lng": -78.539513
            },
            "Brunswick": {
                "lat": 34.038708,
                "lng": -78.227688
            },
            "Buncombe": {
                "lat": 35.609371,
                "lng": -82.530426
            },
            "Burke": {
                "lat": 35.746182,
                "lng": -81.70618
            },
            "Cabarrus": {
                "lat": 35.387845,
                "lng": -80.552868
            },
            "Caldwell": {
                "lat": 35.957857,
                "lng": -81.530076
            },
            "Camden": {
                "lat": 36.342344,
                "lng": -76.162488
            },
            "Carteret": {
                "lat": 34.858313,
                "lng": -76.526967
            },
            "Caswell": {
                "lat": 36.393097,
                "lng": -79.332546
            },
            "Catawba": {
                "lat": 35.663182,
                "lng": -81.214151
            },
            "Chatham": {
                "lat": 35.704994,
                "lng": -79.251454
            },
            "Cherokee": {
                "lat": 35.136233,
                "lng": -84.061308
            },
            "Chowan": {
                "lat": 36.127288,
                "lng": -76.60207
            },
            "Clay": {
                "lat": 35.052997,
                "lng": -83.752264
            },
            "Cleveland": {
                "lat": 35.33463,
                "lng": -81.557115
            },
            "Columbus": {
                "lat": 34.260471,
                "lng": -78.636378
            },
            "Craven": {
                "lat": 35.118179,
                "lng": -77.082541
            },
            "Cumberland": {
                "lat": 35.050192,
                "lng": -78.828719
            },
            "Currituck": {
                "lat": 36.372174,
                "lng": -75.941224
            },
            "Dare": {
                "lat": 35.606269,
                "lng": -75.767536
            },
            "Davidson": {
                "lat": 35.795123,
                "lng": -80.206525
            },
            "Davie": {
                "lat": 35.929356,
                "lng": -80.542542
            },
            "Duplin": {
                "lat": 34.934403,
                "lng": -77.933543
            },
            "Durham": {
                "lat": 36.036589,
                "lng": -78.877919
            },
            "Edgecombe": {
                "lat": 35.917055,
                "lng": -77.602655
            },
            "Forsyth": {
                "lat": 36.131667,
                "lng": -80.257289
            },
            "Franklin": {
                "lat": 36.088241,
                "lng": -78.28309
            },
            "Gaston": {
                "lat": 35.293344,
                "lng": -81.177256
            },
            "Gates": {
                "lat": 36.442135,
                "lng": -76.702355
            },
            "Graham": {
                "lat": 35.348111,
                "lng": -83.830909
            },
            "Granville": {
                "lat": 36.299884,
                "lng": -78.657634
            },
            "Greene": {
                "lat": 35.481933,
                "lng": -77.681667
            },
            "Guilford": {
                "lat": 36.079065,
                "lng": -79.788665
            },
            "Halifax": {
                "lat": 36.251438,
                "lng": -77.644842
            },
            "Harnett": {
                "lat": 35.368635,
                "lng": -78.87161
            },
            "Haywood": {
                "lat": 35.557097,
                "lng": -82.972807
            },
            "Henderson": {
                "lat": 35.336424,
                "lng": -82.479634
            },
            "Hertford": {
                "lat": 36.363517,
                "lng": -76.981616
            },
            "Hoke": {
                "lat": 35.017233,
                "lng": -79.241964
            },
            "Hyde": {
                "lat": 35.408157,
                "lng": -76.153687
            },
            "Iredell": {
                "lat": 35.806356,
                "lng": -80.874545
            },
            "Jackson": {
                "lat": 35.286463,
                "lng": -83.130641
            },
            "Johnston": {
                "lat": 35.513405,
                "lng": -78.367267
            },
            "Jones": {
                "lat": 35.03216,
                "lng": -77.356443
            },
            "Lee": {
                "lat": 35.476075,
                "lng": -79.17222
            },
            "Lenoir": {
                "lat": 35.238062,
                "lng": -77.639023
            },
            "Lincoln": {
                "lat": 35.487825,
                "lng": -81.225176
            },
            "McDowell": {
                "lat": 35.682232,
                "lng": -82.048029
            },
            "Macon": {
                "lat": 35.152959,
                "lng": -83.421901
            },
            "Madison": {
                "lat": 35.86408,
                "lng": -82.712731
            },
            "Martin": {
                "lat": 35.841059,
                "lng": -77.112867
            },
            "Mecklenburg": {
                "lat": 35.246862,
                "lng": -80.833832
            },
            "Mitchell": {
                "lat": 36.013102,
                "lng": -82.163554
            },
            "Montgomery": {
                "lat": 35.338071,
                "lng": -79.904196
            },
            "Moore": {
                "lat": 35.310163,
                "lng": -79.480664
            },
            "Nash": {
                "lat": 35.965945,
                "lng": -77.987555
            },
            "New Hanover": {
                "lat": 34.177466,
                "lng": -77.871378
            },
            "Northampton": {
                "lat": 36.421774,
                "lng": -77.398352
            },
            "Onslow": {
                "lat": 34.76346,
                "lng": -77.503297
            },
            "Orange": {
                "lat": 36.062499,
                "lng": -79.119355
            },
            "Pamlico": {
                "lat": 35.147462,
                "lng": -76.665069
            },
            "Pasquotank": {
                "lat": 36.265276,
                "lng": -76.260355
            },
            "Pender": {
                "lat": 34.512581,
                "lng": -77.888029
            },
            "Perquimans": {
                "lat": 36.178261,
                "lng": -76.404269
            },
            "Person": {
                "lat": 36.386387,
                "lng": -78.965471
            },
            "Pitt": {
                "lat": 35.591065,
                "lng": -77.372404
            },
            "Polk": {
                "lat": 35.278928,
                "lng": -82.167667
            },
            "Randolph": {
                "lat": 35.709915,
                "lng": -79.806215
            },
            "Richmond": {
                "lat": 35.001957,
                "lng": -79.747809
            },
            "Robeson": {
                "lat": 34.63921,
                "lng": -79.100881
            },
            "Rockingham": {
                "lat": 36.380927,
                "lng": -79.782889
            },
            "Rowan": {
                "lat": 35.639218,
                "lng": -80.525344
            },
            "Rutherford": {
                "lat": 35.402747,
                "lng": -81.919583
            },
            "Sampson": {
                "lat": 34.990575,
                "lng": -78.371382
            },
            "Scotland": {
                "lat": 34.840023,
                "lng": -79.477337
            },
            "Stanly": {
                "lat": 35.310523,
                "lng": -80.254355
            },
            "Stokes": {
                "lat": 36.404195,
                "lng": -80.239271
            },
            "Surry": {
                "lat": 36.415416,
                "lng": -80.686463
            },
            "Swain": {
                "lat": 35.568849,
                "lng": -83.465614
            },
            "Transylvania": {
                "lat": 35.210095,
                "lng": -82.816696
            },
            "Tyrrell": {
                "lat": 35.87042,
                "lng": -76.165345
            },
            "Union": {
                "lat": 34.991501,
                "lng": -80.530131
            },
            "Vance": {
                "lat": 36.365481,
                "lng": -78.405434
            },
            "Wake": {
                "lat": 35.789846,
                "lng": -78.650624
            },
            "Warren": {
                "lat": 36.397979,
                "lng": -78.099924
            },
            "Washington": {
                "lat": 35.844589,
                "lng": -76.572334
            },
            "Watauga": {
                "lat": 36.235371,
                "lng": -81.709919
            },
            "Wayne": {
                "lat": 35.362741,
                "lng": -78.004826
            },
            "Wilkes": {
                "lat": 36.209303,
                "lng": -81.165354
            },
            "Wilson": {
                "lat": 35.704125,
                "lng": -77.918982
            },
            "Yadkin": {
                "lat": 36.158765,
                "lng": -80.665164
            },
            "Yancey": {
                "lat": 35.889504,
                "lng": -82.30398
            }
        },
        "cities": {
            "Apex": {
                "lat": 35.732652,
                "lng": -78.85028559999999
            },
            "Asheville": {
                "lat": 35.6009452,
                "lng": -82.55401499999999
            },
            "Burlington": {
                "lat": 36.0956918,
                "lng": -79.43779909999999
            },
            "Cary": {
                "lat": 35.79154,
                "lng": -78.7811169
            },
            "Chapel Hill": {
                "lat": 35.9131996,
                "lng": -79.0558445
            },
            "Charlotte": {
                "lat": 35.2270869,
                "lng": -80.8431267
            },
            "Concord": {
                "lat": 35.4087517,
                "lng": -80.579511
            },
            "Durham": {
                "lat": 35.9940329,
                "lng": -78.898619
            },
            "Fayetteville": {
                "lat": 35.0526641,
                "lng": -78.87835849999999
            },
            "Gastonia": {
                "lat": 35.262082,
                "lng": -81.18730049999999
            },
            "Greensboro": {
                "lat": 36.0726354,
                "lng": -79.7919754
            },
            "Greenville": {
                "lat": 35.612661,
                "lng": -77.3663538
            },
            "High Point": {
                "lat": 35.9556923,
                "lng": -80.0053176
            },
            "Huntersville": {
                "lat": 35.410694,
                "lng": -80.84285040000002
            },
            "Jacksonville": {
                "lat": 34.7540524,
                "lng": -77.4302414
            },
            "Kannapolis": {
                "lat": 35.4873613,
                "lng": -80.6217341
            },
            "Raleigh": {
                "lat": 35.772096,
                "lng": -78.6386145
            },
            "Rocky Mt": {
                "lat": 35.9382103,
                "lng": -77.7905339
            },
            "Wilmington": {
                "lat": 34.2257255,
                "lng": -77.9447102
            },
            "Wilson": {
                "lat": 35.7212689,
                "lng": -77.9155395
            },
            "Winston-Salem": {
                "lat": 36.09985959999999,
                "lng": -80.244216
            }
        },
        "center": {
            "lat": 35.6411,
            "lng": -79.8431
        }
    },
    "WI": {
        "counties": {
            "Adams": {
                "lat": 43.973763,
                "lng": -89.767223
            },
            "Ashland": {
                "lat": 46.546291,
                "lng": -90.665154
            },
            "Barron": {
                "lat": 45.437192,
                "lng": -91.852892
            },
            "Bayfield": {
                "lat": 46.634199,
                "lng": -91.177282
            },
            "Brown": {
                "lat": 44.473961,
                "lng": -87.995926
            },
            "Buffalo": {
                "lat": 44.389759,
                "lng": -91.758714
            },
            "Burnett": {
                "lat": 45.865255,
                "lng": -92.367978
            },
            "Calumet": {
                "lat": 44.07841,
                "lng": -88.212132
            },
            "Chippewa": {
                "lat": 45.069092,
                "lng": -91.283505
            },
            "Clark": {
                "lat": 44.733596,
                "lng": -90.610201
            },
            "Columbia": {
                "lat": 43.471882,
                "lng": -89.330472
            },
            "Crawford": {
                "lat": 43.24991,
                "lng": -90.95123
            },
            "Dane": {
                "lat": 43.067468,
                "lng": -89.417852
            },
            "Dodge": {
                "lat": 43.422706,
                "lng": -88.704379
            },
            "Door": {
                "lat": 45.067808,
                "lng": -87.087936
            },
            "Douglas": {
                "lat": 46.463316,
                "lng": -91.89258
            },
            "Dunn": {
                "lat": 44.947741,
                "lng": -91.89772
            },
            "Eau Claire": {
                "lat": 44.726355,
                "lng": -91.286414
            },
            "Florence": {
                "lat": 45.849646,
                "lng": -88.400322
            },
            "Fond du Lac": {
                "lat": 43.754722,
                "lng": -88.493284
            },
            "Forest": {
                "lat": 45.666882,
                "lng": -88.773225
            },
            "Grant": {
                "lat": 42.870062,
                "lng": -90.695368
            },
            "Green": {
                "lat": 42.677728,
                "lng": -89.605639
            },
            "Green Lake": {
                "lat": 43.76141,
                "lng": -88.987228
            },
            "Iowa": {
                "lat": 43.001021,
                "lng": -90.133692
            },
            "Iron": {
                "lat": 46.32655,
                "lng": -90.261299
            },
            "Jackson": {
                "lat": 44.324895,
                "lng": -90.806541
            },
            "Jefferson": {
                "lat": 43.013807,
                "lng": -88.773986
            },
            "Juneau": {
                "lat": 43.932836,
                "lng": -90.113984
            },
            "Kenosha": {
                "lat": 42.579703,
                "lng": -87.424898
            },
            "Kewaunee": {
                "lat": 44.500949,
                "lng": -87.161813
            },
            "La Crosse": {
                "lat": 43.908222,
                "lng": -91.111758
            },
            "Lafayette": {
                "lat": 42.655578,
                "lng": -90.130292
            },
            "Langlade": {
                "lat": 45.259204,
                "lng": -89.06819
            },
            "Lincoln": {
                "lat": 45.338319,
                "lng": -89.742082
            },
            "Manitowoc": {
                "lat": 44.105108,
                "lng": -87.313828
            },
            "Marathon": {
                "lat": 44.898036,
                "lng": -89.757823
            },
            "Marinette": {
                "lat": 45.346899,
                "lng": -87.991198
            },
            "Marquette": {
                "lat": 43.826053,
                "lng": -89.409095
            },
            "Menominee": {
                "lat": 44.991304,
                "lng": -88.669251
            },
            "Milwaukee": {
                "lat": 43.017655,
                "lng": -87.481575
            },
            "Monroe": {
                "lat": 43.945175,
                "lng": -90.619969
            },
            "Oconto": {
                "lat": 44.996575,
                "lng": -88.206516
            },
            "Oneida": {
                "lat": 45.713791,
                "lng": -89.536693
            },
            "Outagamie": {
                "lat": 44.418226,
                "lng": -88.464988
            },
            "Ozaukee": {
                "lat": 43.360715,
                "lng": -87.496553
            },
            "Pepin": {
                "lat": 44.627436,
                "lng": -91.83489
            },
            "Pierce": {
                "lat": 44.725337,
                "lng": -92.426279
            },
            "Polk": {
                "lat": 45.46803,
                "lng": -92.453154
            },
            "Portage": {
                "lat": 44.476246,
                "lng": -89.49807
            },
            "Price": {
                "lat": 45.679072,
                "lng": -90.35965
            },
            "Racine": {
                "lat": 42.754075,
                "lng": -87.414676
            },
            "Richland": {
                "lat": 43.376199,
                "lng": -90.435693
            },
            "Rock": {
                "lat": 42.669931,
                "lng": -89.075119
            },
            "Rusk": {
                "lat": 45.472734,
                "lng": -91.136745
            },
            "St. Croix": {
                "lat": 45.028959,
                "lng": -92.447284
            },
            "Sauk": {
                "lat": 43.427998,
                "lng": -89.943329
            },
            "Sawyer": {
                "lat": 45.864913,
                "lng": -91.14713
            },
            "Shawano": {
                "lat": 44.789641,
                "lng": -88.755813
            },
            "Sheboygan": {
                "lat": 43.746002,
                "lng": -87.730546
            },
            "Taylor": {
                "lat": 45.211656,
                "lng": -90.504853
            },
            "Trempealeau": {
                "lat": 44.30305,
                "lng": -91.358867
            },
            "Vernon": {
                "lat": 43.599858,
                "lng": -90.815226
            },
            "Vilas": {
                "lat": 46.049848,
                "lng": -89.501254
            },
            "Walworth": {
                "lat": 42.66811,
                "lng": -88.541731
            },
            "Washburn": {
                "lat": 45.892463,
                "lng": -91.796423
            },
            "Washington": {
                "lat": 43.391156,
                "lng": -88.232917
            },
            "Waukesha": {
                "lat": 43.019308,
                "lng": -88.306707
            },
            "Waupaca": {
                "lat": 44.478004,
                "lng": -88.967006
            },
            "Waushara": {
                "lat": 44.112825,
                "lng": -89.239752
            },
            "Winnebago": {
                "lat": 44.085707,
                "lng": -88.668149
            },
            "Wood": {
                "lat": 44.461413,
                "lng": -90.038825
            }
        },
        "cities": {
            "Appleton": {
                "lat": 44.2619309,
                "lng": -88.41538469999999
            },
            "Eau Claire": {
                "lat": 44.811349,
                "lng": -91.4984941
            },
            "Fond du Lac": {
                "lat": 43.7730448,
                "lng": -88.4470508
            },
            "Green Bay": {
                "lat": 44.51915899999999,
                "lng": -88.019826
            },
            "Janesville": {
                "lat": 42.6827885,
                "lng": -89.0187222
            },
            "Kenosha": {
                "lat": 42.5847425,
                "lng": -87.82118539999999
            },
            "La Crosse": {
                "lat": 43.8013556,
                "lng": -91.23958069999999
            },
            "Madison": {
                "lat": 43.0730517,
                "lng": -89.4012302
            },
            "Milwaukee": {
                "lat": 43.0389025,
                "lng": -87.9064736
            },
            "Oshkosh": {
                "lat": 44.0247062,
                "lng": -88.5426136
            },
            "Racine": {
                "lat": 42.7261309,
                "lng": -87.78285230000002
            },
            "Sheboygan": {
                "lat": 43.7508284,
                "lng": -87.71453
            },
            "Waukesha": {
                "lat": 43.0116784,
                "lng": -88.2314813
            },
            "Wauwatosa": {
                "lat": 43.0494572,
                "lng": -88.0075875
            },
            "West Allis": {
                "lat": 43.0166806,
                "lng": -88.0070315
            }
        },
        "center": {
            "lat": 44.2563,
            "lng": -89.6385
        }
    },
    "MN": {
        "counties": {
            "Aitkin": {
                "lat": 46.602446,
                "lng": -93.41976
            },
            "Anoka": {
                "lat": 45.27411,
                "lng": -93.242723
            },
            "Becker": {
                "lat": 46.937629,
                "lng": -95.741757
            },
            "Beltrami": {
                "lat": 47.878825,
                "lng": -94.986698
            },
            "Benton": {
                "lat": 45.701227,
                "lng": -94.00144
            },
            "Big Stone": {
                "lat": 45.419925,
                "lng": -96.402226
            },
            "Blue Earth": {
                "lat": 44.038225,
                "lng": -94.064071
            },
            "Brown": {
                "lat": 44.246542,
                "lng": -94.733647
            },
            "Carlton": {
                "lat": 46.603818,
                "lng": -92.671044
            },
            "Carver": {
                "lat": 44.821381,
                "lng": -93.800575
            },
            "Cass": {
                "lat": 46.951427,
                "lng": -94.333773
            },
            "Chippewa": {
                "lat": 45.028625,
                "lng": -95.564108
            },
            "Chisago": {
                "lat": 45.505444,
                "lng": -92.903849
            },
            "Clay": {
                "lat": 46.898377,
                "lng": -96.494901
            },
            "Clearwater": {
                "lat": 47.575873,
                "lng": -95.371117
            },
            "Cook": {
                "lat": 47.538571,
                "lng": -90.29019
            },
            "Cottonwood": {
                "lat": 44.010711,
                "lng": -95.18313
            },
            "Crow Wing": {
                "lat": 46.491114,
                "lng": -94.071213
            },
            "Dakota": {
                "lat": 44.670893,
                "lng": -93.062481
            },
            "Dodge": {
                "lat": 44.020706,
                "lng": -92.869353
            },
            "Douglas": {
                "lat": 45.936429,
                "lng": -95.46061
            },
            "Faribault": {
                "lat": 43.676522,
                "lng": -93.947234
            },
            "Fillmore": {
                "lat": 43.67727,
                "lng": -92.093681
            },
            "Freeborn": {
                "lat": 43.674202,
                "lng": -93.350289
            },
            "Goodhue": {
                "lat": 44.406178,
                "lng": -92.716
            },
            "Grant": {
                "lat": 45.930743,
                "lng": -96.010699
            },
            "Hennepin": {
                "lat": 45.006064,
                "lng": -93.475185
            },
            "Houston": {
                "lat": 43.66699,
                "lng": -91.501556
            },
            "Hubbard": {
                "lat": 47.095551,
                "lng": -94.91329
            },
            "Isanti": {
                "lat": 45.562431,
                "lng": -93.296339
            },
            "Itasca": {
                "lat": 47.490843,
                "lng": -93.613128
            },
            "Jackson": {
                "lat": 43.673025,
                "lng": -95.149704
            },
            "Kanabec": {
                "lat": 45.94776,
                "lng": -93.297788
            },
            "Kandiyohi": {
                "lat": 45.152714,
                "lng": -95.004981
            },
            "Kittson": {
                "lat": 48.77604,
                "lng": -96.780349
            },
            "Koochiching": {
                "lat": 48.24549,
                "lng": -93.782842
            },
            "Lac qui Parle": {
                "lat": 44.999855,
                "lng": -96.176836
            },
            "Lake": {
                "lat": 47.517111,
                "lng": -91.411704
            },
            "Lake of the Woods": {
                "lat": 48.7681,
                "lng": -94.904634
            },
            "Le Sueur": {
                "lat": 44.373397,
                "lng": -93.73018
            },
            "Lincoln": {
                "lat": 44.408238,
                "lng": -96.272032
            },
            "Lyon": {
                "lat": 44.409195,
                "lng": -95.847268
            },
            "McLeod": {
                "lat": 44.821644,
                "lng": -94.27232
            },
            "Mahnomen": {
                "lat": 47.325842,
                "lng": -95.810703
            },
            "Marshall": {
                "lat": 48.362728,
                "lng": -96.357761
            },
            "Martin": {
                "lat": 43.677118,
                "lng": -94.537198
            },
            "Meeker": {
                "lat": 45.123156,
                "lng": -94.527346
            },
            "Mille Lacs": {
                "lat": 45.929043,
                "lng": -93.632996
            },
            "Morrison": {
                "lat": 46.020484,
                "lng": -94.266619
            },
            "Mower": {
                "lat": 43.666249,
                "lng": -92.759514
            },
            "Murray": {
                "lat": 44.015594,
                "lng": -95.761581
            },
            "Nicollet": {
                "lat": 44.35882,
                "lng": -94.245685
            },
            "Nobles": {
                "lat": 43.677686,
                "lng": -95.763132
            },
            "Norman": {
                "lat": 47.32947,
                "lng": -96.463807
            },
            "Olmsted": {
                "lat": 44.00343,
                "lng": -92.406722
            },
            "Otter Tail": {
                "lat": 46.405725,
                "lng": -95.714578
            },
            "Pennington": {
                "lat": 48.069247,
                "lng": -96.037725
            },
            "Pine": {
                "lat": 46.10094,
                "lng": -92.763094
            },
            "Pipestone": {
                "lat": 44.015361,
                "lng": -96.257015
            },
            "Polk": {
                "lat": 47.774254,
                "lng": -96.400027
            },
            "Pope": {
                "lat": 45.589623,
                "lng": -95.446705
            },
            "Ramsey": {
                "lat": 45.01525,
                "lng": -93.100141
            },
            "Red Lake": {
                "lat": 47.865487,
                "lng": -96.08718
            },
            "Redwood": {
                "lat": 44.403536,
                "lng": -95.254242
            },
            "Renville": {
                "lat": 44.723697,
                "lng": -94.955617
            },
            "Rice": {
                "lat": 44.350943,
                "lng": -93.298503
            },
            "Rock": {
                "lat": 43.669587,
                "lng": -96.263238
            },
            "Roseau": {
                "lat": 48.761066,
                "lng": -95.82153
            },
            "St. Louis": {
                "lat": 47.583852,
                "lng": -92.463645
            },
            "Scott": {
                "lat": 44.651932,
                "lng": -93.534553
            },
            "Sherburne": {
                "lat": 45.443171,
                "lng": -93.775092
            },
            "Sibley": {
                "lat": 44.575734,
                "lng": -94.230123
            },
            "Stearns": {
                "lat": 45.555235,
                "lng": -94.610482
            },
            "Steele": {
                "lat": 44.015261,
                "lng": -93.220453
            },
            "Stevens": {
                "lat": 45.593461,
                "lng": -95.992315
            },
            "Swift": {
                "lat": 45.27545,
                "lng": -95.690398
            },
            "Todd": {
                "lat": 46.066569,
                "lng": -94.900576
            },
            "Traverse": {
                "lat": 45.76984,
                "lng": -96.475049
            },
            "Wabasha": {
                "lat": 44.289693,
                "lng": -92.233341
            },
            "Wadena": {
                "lat": 46.586784,
                "lng": -94.988331
            },
            "Waseca": {
                "lat": 44.01846,
                "lng": -93.589844
            },
            "Washington": {
                "lat": 45.037929,
                "lng": -92.890117
            },
            "Watonwan": {
                "lat": 43.978366,
                "lng": -94.614128
            },
            "Wilkin": {
                "lat": 46.362335,
                "lng": -96.476657
            },
            "Winona": {
                "lat": 43.982268,
                "lng": -91.776708
            },
            "Wright": {
                "lat": 45.175091,
                "lng": -93.966397
            },
            "Yellow Medicine": {
                "lat": 44.715736,
                "lng": -95.862756
            }
        },
        "cities": {
            "Apple Valley": {
                "lat": 44.7319094,
                "lng": -93.21772000000001
            },
            "Blaine": {
                "lat": 45.1607987,
                "lng": -93.23494889999999
            },
            "Bloomington": {
                "lat": 44.840798,
                "lng": -93.2982799
            },
            "Brooklyn Park": {
                "lat": 45.0941315,
                "lng": -93.3563405
            },
            "Burnsville": {
                "lat": 44.7677424,
                "lng": -93.27772259999999
            },
            "Coon Rapids": {
                "lat": 45.1199652,
                "lng": -93.28772769999999
            },
            "Duluth": {
                "lat": 46.78667189999999,
                "lng": -92.1004852
            },
            "Eagan": {
                "lat": 44.8041322,
                "lng": -93.1668858
            },
            "Eden Prairie": {
                "lat": 44.8546856,
                "lng": -93.47078599999999
            },
            "Edina": {
                "lat": 44.8896866,
                "lng": -93.3499489
            },
            "Lakeville": {
                "lat": 44.6496868,
                "lng": -93.24271999999999
            },
            "Maple Grove": {
                "lat": 45.0724642,
                "lng": -93.4557877
            },
            "Minneapolis": {
                "lat": 44.9799654,
                "lng": -93.26383609999999
            },
            "Minnetonka": {
                "lat": 44.9211836,
                "lng": -93.4687489
            },
            "Plymouth": {
                "lat": 45.0105194,
                "lng": -93.4555093
            },
            "Rochester": {
                "lat": 44.0216306,
                "lng": -92.4698992
            },
            "St Cloud": {
                "lat": 45.5538889,
                "lng": -94.1702778
            },
            "St Louis Park": {
                "lat": 44.9597376,
                "lng": -93.3702186
            },
            "St Paul": {
                "lat": 44.95416669999999,
                "lng": -93.11388889999999
            },
            "Shakopee": {
                "lat": 44.7973962,
                "lng": -93.5272861
            },
            "Woodbury": {
                "lat": 44.9238552,
                "lng": -92.9593797
            }
        },
        "center": {
            "lat": 45.7326,
            "lng": -93.9196
        }
    },
    "MA": {
        "counties": {
            "Barnstable": {
                "lat": 41.798819,
                "lng": -70.211083
            },
            "Berkshire": {
                "lat": 42.375314,
                "lng": -73.213948
            },
            "Bristol": {
                "lat": 41.748576,
                "lng": -71.087062
            },
            "Dukes": {
                "lat": 41.380939,
                "lng": -70.701536
            },
            "Essex": {
                "lat": 42.642711,
                "lng": -70.865107
            },
            "Franklin": {
                "lat": 42.583791,
                "lng": -72.591655
            },
            "Hampden": {
                "lat": 42.136198,
                "lng": -72.635648
            },
            "Hampshire": {
                "lat": 42.339459,
                "lng": -72.663694
            },
            "Middlesex": {
                "lat": 42.479477,
                "lng": -71.396507
            },
            "Nantucket": {
                "lat": 41.305878,
                "lng": -70.14191
            },
            "Norfolk": {
                "lat": 42.169703,
                "lng": -71.179875
            },
            "Plymouth": {
                "lat": 41.987196,
                "lng": -70.741942
            },
            "Suffolk": {
                "lat": 42.33196,
                "lng": -71.020173
            },
            "Worcester": {
                "lat": 42.311693,
                "lng": -71.940282
            }
        },
        "cities": {
            "Arlington": {
                "lat": 42.4153925,
                "lng": -71.1564729
            },
            "Attleboro": {
                "lat": 41.94454409999999,
                "lng": -71.2856082
            },
            "Barnstable": {
                "lat": 41.7014167,
                "lng": -70.3030556
            },
            "Billerica": {
                "lat": 42.5584218,
                "lng": -71.2689461
            },
            "Boston": {
                "lat": 42.3584308,
                "lng": -71.0597732
            },
            "Brockton": {
                "lat": 42.0834335,
                "lng": -71.0183787
            },
            "Brookline": {
                "lat": 42.33176419999999,
                "lng": -71.1211635
            },
            "Cambridge": {
                "lat": 42.3726399,
                "lng": -71.10965279999999
            },
            "Chicopee": {
                "lat": 42.1487043,
                "lng": -72.6078672
            },
            "Everett": {
                "lat": 42.40843,
                "lng": -71.0536625
            },
            "Fall River": {
                "lat": 41.7014912,
                "lng": -71.1550451
            },
            "Framingham": {
                "lat": 42.279286,
                "lng": -71.4161565
            },
            "Haverhill": {
                "lat": 42.7762015,
                "lng": -71.0772796
            },
            "Lawrence": {
                "lat": 42.7070354,
                "lng": -71.1631137
            },
            "Lowell": {
                "lat": 42.6334247,
                "lng": -71.31617179999999
            },
            "Lynn": {
                "lat": 42.46676300000001,
                "lng": -70.9494938
            },
            "Malden": {
                "lat": 42.4250964,
                "lng": -71.066163
            },
            "Medford": {
                "lat": 42.4184296,
                "lng": -71.1061639
            },
            "Methuen": {
                "lat": 42.7262016,
                "lng": -71.1908924
            },
            "New Bedford": {
                "lat": 41.6362152,
                "lng": -70.93420499999999
            },
            "Newton": {
                "lat": 42.3370413,
                "lng": -71.20922139999999
            },
            "North Attleboro": {
                "lat": 41.9695516,
                "lng": -71.35654389999999
            },
            "Peabody": {
                "lat": 42.5278731,
                "lng": -70.9286609
            },
            "Pittsfield": {
                "lat": 42.4500845,
                "lng": -73.2453824
            },
            "Quincy": {
                "lat": 42.2528772,
                "lng": -71.0022705
            },
            "Revere": {
                "lat": 42.4084302,
                "lng": -71.0119948
            },
            "Salem": {
                "lat": 42.51954,
                "lng": -70.8967155
            },
            "Somerville": {
                "lat": 42.3875968,
                "lng": -71.0994968
            },
            "Springfield": {
                "lat": 42.1014831,
                "lng": -72.589811
            },
            "Taunton": {
                "lat": 41.900101,
                "lng": -71.0897674
            },
            "Waltham": {
                "lat": 42.3764852,
                "lng": -71.2356113
            },
            "Westfield": {
                "lat": 42.1250929,
                "lng": -72.749538
            },
            "Weymouth": {
                "lat": 42.2180724,
                "lng": -70.94103559999999
            },
            "Worcester": {
                "lat": 42.2625932,
                "lng": -71.8022934
            }
        },
        "center": {
            "lat": 42.2373,
            "lng": -71.5314
        }
    },
    "IL": {
        "counties": {
            "Adams": {
                "lat": 39.986053,
                "lng": -91.194961
            },
            "Alexander": {
                "lat": 37.183683,
                "lng": -89.349506
            },
            "Bond": {
                "lat": 38.885924,
                "lng": -89.436592
            },
            "Boone": {
                "lat": 42.318983,
                "lng": -88.824295
            },
            "Brown": {
                "lat": 39.962069,
                "lng": -90.75031
            },
            "Bureau": {
                "lat": 41.401304,
                "lng": -89.528377
            },
            "Calhoun": {
                "lat": 39.164262,
                "lng": -90.666295
            },
            "Carroll": {
                "lat": 42.059084,
                "lng": -89.926485
            },
            "Cass": {
                "lat": 39.969202,
                "lng": -90.245705
            },
            "Champaign": {
                "lat": 40.13915,
                "lng": -88.197201
            },
            "Christian": {
                "lat": 39.545524,
                "lng": -89.279593
            },
            "Clark": {
                "lat": 39.332364,
                "lng": -87.791687
            },
            "Clay": {
                "lat": 38.747312,
                "lng": -88.483789
            },
            "Clinton": {
                "lat": 38.606423,
                "lng": -89.423136
            },
            "Coles": {
                "lat": 39.51368,
                "lng": -88.220782
            },
            "Cook": {
                "lat": 41.894294,
                "lng": -87.645455
            },
            "Crawford": {
                "lat": 39.00373,
                "lng": -87.757172
            },
            "Cumberland": {
                "lat": 39.273121,
                "lng": -88.240619
            },
            "DeKalb": {
                "lat": 41.894613,
                "lng": -88.768991
            },
            "De Witt": {
                "lat": 40.181499,
                "lng": -88.901853
            },
            "Douglas": {
                "lat": 39.766078,
                "lng": -88.222866
            },
            "DuPage": {
                "lat": 41.852058,
                "lng": -88.086038
            },
            "Edgar": {
                "lat": 39.679037,
                "lng": -87.74711
            },
            "Edwards": {
                "lat": 38.417095,
                "lng": -88.047941
            },
            "Effingham": {
                "lat": 39.047694,
                "lng": -88.592786
            },
            "Fayette": {
                "lat": 39.001125,
                "lng": -89.017923
            },
            "Ford": {
                "lat": 40.594423,
                "lng": -88.224746
            },
            "Franklin": {
                "lat": 37.991848,
                "lng": -88.926246
            },
            "Fulton": {
                "lat": 40.465688,
                "lng": -90.206793
            },
            "Gallatin": {
                "lat": 37.768677,
                "lng": -88.227964
            },
            "Greene": {
                "lat": 39.355444,
                "lng": -90.387757
            },
            "Grundy": {
                "lat": 41.29241,
                "lng": -88.401055
            },
            "Hamilton": {
                "lat": 38.085226,
                "lng": -88.539005
            },
            "Hancock": {
                "lat": 40.405792,
                "lng": -91.167988
            },
            "Hardin": {
                "lat": 37.517852,
                "lng": -88.266148
            },
            "Henderson": {
                "lat": 40.815141,
                "lng": -90.93848
            },
            "Henry": {
                "lat": 41.350021,
                "lng": -90.130838
            },
            "Iroquois": {
                "lat": 40.748867,
                "lng": -87.833601
            },
            "Jackson": {
                "lat": 37.786096,
                "lng": -89.381212
            },
            "Jasper": {
                "lat": 39.004874,
                "lng": -88.150763
            },
            "Jefferson": {
                "lat": 38.30078,
                "lng": -88.92421
            },
            "Jersey": {
                "lat": 39.080192,
                "lng": -90.361365
            },
            "Jo Daviess": {
                "lat": 42.362391,
                "lng": -90.211471
            },
            "Johnson": {
                "lat": 37.460815,
                "lng": -88.882962
            },
            "Kane": {
                "lat": 41.939594,
                "lng": -88.42804
            },
            "Kankakee": {
                "lat": 41.139494,
                "lng": -87.861125
            },
            "Kendall": {
                "lat": 41.58814,
                "lng": -88.430626
            },
            "Knox": {
                "lat": 40.930941,
                "lng": -90.213761
            },
            "Lake": {
                "lat": 42.326444,
                "lng": -87.436118
            },
            "La Salle": {
                "lat": 41.343341,
                "lng": -88.885931
            },
            "Lawrence": {
                "lat": 38.718954,
                "lng": -87.730221
            },
            "Lee": {
                "lat": 41.747442,
                "lng": -89.299351
            },
            "Livingston": {
                "lat": 40.894376,
                "lng": -88.552852
            },
            "Logan": {
                "lat": 40.12907,
                "lng": -89.365308
            },
            "McDonough": {
                "lat": 40.455789,
                "lng": -90.677579
            },
            "McHenry": {
                "lat": 42.324298,
                "lng": -88.452245
            },
            "McLean": {
                "lat": 40.494559,
                "lng": -88.844539
            },
            "Macon": {
                "lat": 39.860237,
                "lng": -88.961529
            },
            "Macoupin": {
                "lat": 39.2659,
                "lng": -89.926344
            },
            "Madison": {
                "lat": 38.827082,
                "lng": -89.900195
            },
            "Marion": {
                "lat": 38.648396,
                "lng": -88.920221
            },
            "Marshall": {
                "lat": 41.031119,
                "lng": -89.342371
            },
            "Mason": {
                "lat": 40.236993,
                "lng": -89.913575
            },
            "Massac": {
                "lat": 37.216119,
                "lng": -88.705658
            },
            "Menard": {
                "lat": 40.022569,
                "lng": -89.794133
            },
            "Mercer": {
                "lat": 41.204791,
                "lng": -90.741433
            },
            "Monroe": {
                "lat": 38.277983,
                "lng": -90.179078
            },
            "Montgomery": {
                "lat": 39.228092,
                "lng": -89.478007
            },
            "Morgan": {
                "lat": 39.716806,
                "lng": -90.202277
            },
            "Moultrie": {
                "lat": 39.636896,
                "lng": -88.625726
            },
            "Ogle": {
                "lat": 42.041884,
                "lng": -89.320176
            },
            "Peoria": {
                "lat": 40.785999,
                "lng": -89.767358
            },
            "Perry": {
                "lat": 38.084385,
                "lng": -89.368487
            },
            "Piatt": {
                "lat": 40.009056,
                "lng": -88.592328
            },
            "Pike": {
                "lat": 39.625106,
                "lng": -90.889034
            },
            "Pope": {
                "lat": 37.417169,
                "lng": -88.542374
            },
            "Pulaski": {
                "lat": 37.215615,
                "lng": -89.127755
            },
            "Putnam": {
                "lat": 41.19894,
                "lng": -89.298386
            },
            "Randolph": {
                "lat": 38.056515,
                "lng": -89.82121
            },
            "Richland": {
                "lat": 38.71155,
                "lng": -88.085698
            },
            "Rock Island": {
                "lat": 41.468404,
                "lng": -90.572203
            },
            "St. Clair": {
                "lat": 38.470198,
                "lng": -89.928546
            },
            "Saline": {
                "lat": 37.751653,
                "lng": -88.545031
            },
            "Sangamon": {
                "lat": 39.756378,
                "lng": -89.662311
            },
            "Schuyler": {
                "lat": 40.156905,
                "lng": -90.613464
            },
            "Scott": {
                "lat": 39.63698,
                "lng": -90.477759
            },
            "Shelby": {
                "lat": 39.384926,
                "lng": -88.798862
            },
            "Stark": {
                "lat": 41.096908,
                "lng": -89.797411
            },
            "Stephenson": {
                "lat": 42.349726,
                "lng": -89.665994
            },
            "Tazewell": {
                "lat": 40.508074,
                "lng": -89.51626
            },
            "Union": {
                "lat": 37.475104,
                "lng": -89.252875
            },
            "Vermilion": {
                "lat": 40.18674,
                "lng": -87.726772
            },
            "Wabash": {
                "lat": 38.445821,
                "lng": -87.839167
            },
            "Warren": {
                "lat": 40.850441,
                "lng": -90.620223
            },
            "Washington": {
                "lat": 38.353141,
                "lng": -89.417187
            },
            "Wayne": {
                "lat": 38.431948,
                "lng": -88.432129
            },
            "White": {
                "lat": 38.087372,
                "lng": -88.178585
            },
            "Whiteside": {
                "lat": 41.750571,
                "lng": -89.910957
            },
            "Will": {
                "lat": 41.448474,
                "lng": -87.978456
            },
            "Williamson": {
                "lat": 37.730353,
                "lng": -88.930018
            },
            "Winnebago": {
                "lat": 42.337396,
                "lng": -89.161205
            },
            "Woodford": {
                "lat": 40.789596,
                "lng": -89.210301
            }
        },
        "cities": {
            "Arlington Heights": {
                "lat": 42.0883603,
                "lng": -87.98062650000001
            },
            "Aurora": {
                "lat": 41.7605849,
                "lng": -88.32007150000001
            },
            "Bartlett": {
                "lat": 41.9950276,
                "lng": -88.1856301
            },
            "Belleville": {
                "lat": 38.5200504,
                "lng": -89.9839935
            },
            "Berwyn": {
                "lat": 41.85058739999999,
                "lng": -87.7936685
            },
            "Bloomington": {
                "lat": 40.4842027,
                "lng": -88.99368729999999
            },
            "Bolingbrook": {
                "lat": 41.69864159999999,
                "lng": -88.0683955
            },
            "Buffalo Grove": {
                "lat": 42.1662831,
                "lng": -87.9631308
            },
            "Champaign": {
                "lat": 40.1164204,
                "lng": -88.2433829
            },
            "Chicago": {
                "lat": 41.8781136,
                "lng": -87.6297982
            },
            "Cicero": {
                "lat": 41.8455877,
                "lng": -87.7539448
            },
            "Crystal Lake": {
                "lat": 42.2411344,
                "lng": -88.31619649999999
            },
            "Decatur": {
                "lat": 39.8403147,
                "lng": -88.9548001
            },
            "DeKalb": {
                "lat": 41.9294736,
                "lng": -88.75036469999999
            },
            "Des Plaines": {
                "lat": 42.0333623,
                "lng": -87.88339909999999
            },
            "Downers Grove": {
                "lat": 41.8089191,
                "lng": -88.01117459999999
            },
            "Elgin": {
                "lat": 42.0372487,
                "lng": -88.2811895
            },
            "Elmhurst": {
                "lat": 41.8994744,
                "lng": -87.9403418
            },
            "Evanston": {
                "lat": 42.0411414,
                "lng": -87.6900587
            },
            "Glenview": {
                "lat": 42.0697509,
                "lng": -87.7878408
            },
            "Hoffman Estates": {
                "lat": 42.0629915,
                "lng": -88.12271989999999
            },
            "Joliet": {
                "lat": 41.525031,
                "lng": -88.0817251
            },
            "Lombard": {
                "lat": 41.8800296,
                "lng": -88.00784349999999
            },
            "Moline": {
                "lat": 41.5067003,
                "lng": -90.51513419999999
            },
            "Mt Prospect": {
                "lat": 42.0664167,
                "lng": -87.9372908
            },
            "Naperville": {
                "lat": 41.7858629,
                "lng": -88.1472893
            },
            "Normal": {
                "lat": 40.5142026,
                "lng": -88.9906312
            },
            "Oak Lawn": {
                "lat": 41.7108662,
                "lng": -87.7581081
            },
            "Oak Park": {
                "lat": 41.8850317,
                "lng": -87.7845025
            },
            "Orland Park": {
                "lat": 41.6303103,
                "lng": -87.85394250000002
            },
            "Palatine": {
                "lat": 42.1103041,
                "lng": -88.03424000000001
            },
            "Peoria": {
                "lat": 40.6936488,
                "lng": -89.5889864
            },
            "Plainfield": {
                "lat": 41.615915,
                "lng": -88.20406899999999
            },
            "Rockford": {
                "lat": 42.2711311,
                "lng": -89.0939952
            },
            "Romeoville": {
                "lat": 41.6475306,
                "lng": -88.0895061
            },
            "Schaumburg": {
                "lat": 42.0333607,
                "lng": -88.0834059
            },
            "Skokie": {
                "lat": 42.0333636,
                "lng": -87.7333934
            },
            "Springfield": {
                "lat": 39.78172130000001,
                "lng": -89.6501481
            },
            "Tinley Park": {
                "lat": 41.5733669,
                "lng": -87.7844944
            },
            "Urbana": {
                "lat": 40.1105875,
                "lng": -88.2072697
            },
            "Waukegan": {
                "lat": 42.3636331,
                "lng": -87.84479379999999
            },
            "Wheaton": {
                "lat": 41.8661403,
                "lng": -88.1070127
            }
        },
        "center": {
            "lat": 40.3363,
            "lng": -89.0022
        }
    },
    "CO": {
        "counties": {
            "Adams": {
                "lat": 39.874325,
                "lng": -104.331872
            },
            "Alamosa": {
                "lat": 37.568442,
                "lng": -105.788041
            },
            "Arapahoe": {
                "lat": 39.644632,
                "lng": -104.331733
            },
            "Archuleta": {
                "lat": 37.202395,
                "lng": -107.050863
            },
            "Baca": {
                "lat": 37.303144,
                "lng": -102.535457
            },
            "Bent": {
                "lat": 37.931891,
                "lng": -103.077584
            },
            "Boulder": {
                "lat": 40.094826,
                "lng": -105.398382
            },
            "Broomfield": {
                "lat": 39.953383,
                "lng": -105.052125
            },
            "Chaffee": {
                "lat": 38.738246,
                "lng": -106.316972
            },
            "Cheyenne": {
                "lat": 38.835387,
                "lng": -102.604585
            },
            "Clear Creek": {
                "lat": 39.689403,
                "lng": -105.670791
            },
            "Conejos": {
                "lat": 37.213407,
                "lng": -106.176447
            },
            "Costilla": {
                "lat": 37.277547,
                "lng": -105.42894
            },
            "Crowley": {
                "lat": 38.321956,
                "lng": -103.787562
            },
            "Custer": {
                "lat": 38.101994,
                "lng": -105.373515
            },
            "Delta": {
                "lat": 38.861756,
                "lng": -107.864757
            },
            "Denver": {
                "lat": 39.761849,
                "lng": -104.880625
            },
            "Dolores": {
                "lat": 37.747602,
                "lng": -108.530383
            },
            "Douglas": {
                "lat": 39.326435,
                "lng": -104.926199
            },
            "Eagle": {
                "lat": 39.630638,
                "lng": -106.692944
            },
            "Elbert": {
                "lat": 39.310817,
                "lng": -104.117928
            },
            "El Paso": {
                "lat": 38.827383,
                "lng": -104.527472
            },
            "Fremont": {
                "lat": 38.455658,
                "lng": -105.421438
            },
            "Garfield": {
                "lat": 39.599352,
                "lng": -107.90978
            },
            "Gilpin": {
                "lat": 39.861082,
                "lng": -105.528947
            },
            "Grand": {
                "lat": 40.123289,
                "lng": -106.095876
            },
            "Gunnison": {
                "lat": 38.669679,
                "lng": -107.078108
            },
            "Hinsdale": {
                "lat": 37.811625,
                "lng": -107.383405
            },
            "Huerfano": {
                "lat": 37.687815,
                "lng": -104.959928
            },
            "Jackson": {
                "lat": 40.663432,
                "lng": -106.329248
            },
            "Jefferson": {
                "lat": 39.58646,
                "lng": -105.245601
            },
            "Kiowa": {
                "lat": 38.388466,
                "lng": -102.75621
            },
            "Kit Carson": {
                "lat": 39.30534,
                "lng": -102.603023
            },
            "Lake": {
                "lat": 39.204316,
                "lng": -106.349696
            },
            "La Plata": {
                "lat": 37.287367,
                "lng": -107.839718
            },
            "Larimer": {
                "lat": 40.663091,
                "lng": -105.482131
            },
            "Las Animas": {
                "lat": 37.318831,
                "lng": -104.04411
            },
            "Lincoln": {
                "lat": 38.99374,
                "lng": -103.507555
            },
            "Logan": {
                "lat": 40.728091,
                "lng": -103.090464
            },
            "Mesa": {
                "lat": 39.019492,
                "lng": -108.461837
            },
            "Mineral": {
                "lat": 37.651478,
                "lng": -106.9323
            },
            "Moffat": {
                "lat": 40.573984,
                "lng": -108.204521
            },
            "Montezuma": {
                "lat": 37.338025,
                "lng": -108.595786
            },
            "Montrose": {
                "lat": 38.413427,
                "lng": -108.263042
            },
            "Morgan": {
                "lat": 40.262354,
                "lng": -103.807092
            },
            "Otero": {
                "lat": 37.88417,
                "lng": -103.72126
            },
            "Ouray": {
                "lat": 38.1506,
                "lng": -107.767133
            },
            "Park": {
                "lat": 39.118914,
                "lng": -105.717648
            },
            "Phillips": {
                "lat": 40.594712,
                "lng": -102.345105
            },
            "Pitkin": {
                "lat": 39.217533,
                "lng": -106.915943
            },
            "Prowers": {
                "lat": 37.958181,
                "lng": -102.392161
            },
            "Pueblo": {
                "lat": 38.170658,
                "lng": -104.489893
            },
            "Rio Blanco": {
                "lat": 39.972606,
                "lng": -108.200685
            },
            "Rio Grande": {
                "lat": 37.485763,
                "lng": -106.453214
            },
            "Routt": {
                "lat": 40.48316,
                "lng": -106.985289
            },
            "Saguache": {
                "lat": 38.033952,
                "lng": -106.246675
            },
            "San Juan": {
                "lat": 37.781075,
                "lng": -107.670257
            },
            "San Miguel": {
                "lat": 38.009374,
                "lng": -108.427326
            },
            "Sedgwick": {
                "lat": 40.871568,
                "lng": -102.355358
            },
            "Summit": {
                "lat": 39.621023,
                "lng": -106.137555
            },
            "Teller": {
                "lat": 38.871994,
                "lng": -105.182552
            },
            "Washington": {
                "lat": 39.965413,
                "lng": -103.209605
            },
            "Weld": {
                "lat": 40.555794,
                "lng": -104.383649
            },
            "Yuma": {
                "lat": 40.000631,
                "lng": -102.422649
            }
        },
        "cities": {
            "Arvada": {
                "lat": 39.8027644,
                "lng": -105.0874842
            },
            "Aurora": {
                "lat": 39.7294319,
                "lng": -104.8319195
            },
            "Boulder": {
                "lat": 40.0149856,
                "lng": -105.2705456
            },
            "Broomfield": {
                "lat": 39.9205411,
                "lng": -105.0866504
            },
            "Castle Rock": {
                "lat": 39.3722121,
                "lng": -104.8560902
            },
            "Centennial": {
                "lat": 39.5807452,
                "lng": -104.8771726
            },
            "Colorado Springs": {
                "lat": 38.8338816,
                "lng": -104.8213634
            },
            "Commerce City": {
                "lat": 39.8083196,
                "lng": -104.9338675
            },
            "Denver": {
                "lat": 39.7391536,
                "lng": -104.9847034
            },
            "Fort Collins": {
                "lat": 40.5852602,
                "lng": -105.084423
            },
            "Grand Junction": {
                "lat": 39.0638705,
                "lng": -108.5506486
            },
            "Greeley": {
                "lat": 40.4233142,
                "lng": -104.7091322
            },
            "Highlands Ranch": {
                "lat": 39.5444444,
                "lng": -104.9680556
            },
            "Lakewood": {
                "lat": 39.7047095,
                "lng": -105.0813734
            },
            "Littleton": {
                "lat": 39.613321,
                "lng": -105.0166498
            },
            "Longmont": {
                "lat": 40.1672068,
                "lng": -105.1019275
            },
            "Loveland": {
                "lat": 40.3977612,
                "lng": -105.0749801
            },
            "Parker": {
                "lat": 39.5186002,
                "lng": -104.7613633
            },
            "Pueblo": {
                "lat": 38.2544472,
                "lng": -104.6091409
            },
            "Thornton": {
                "lat": 39.8680412,
                "lng": -104.9719243
            },
            "Westminster": {
                "lat": 39.8366528,
                "lng": -105.0372046
            }
        },
        "center": {
            "lat": 39.0646,
            "lng": -105.3272
        }
    },
    "MD": {
        "counties": {
            "Allegany": {
                "lat": 39.612309,
                "lng": -78.703108
            },
            "Anne Arundel": {
                "lat": 38.993374,
                "lng": -76.560511
            },
            "Baltimore": {
                "lat": 39.300214,
                "lng": -76.610516
            },
            "Calvert": {
                "lat": 38.521358,
                "lng": -76.525864
            },
            "Caroline": {
                "lat": 38.871531,
                "lng": -75.831631
            },
            "Carroll": {
                "lat": 39.563189,
                "lng": -77.015512
            },
            "Cecil": {
                "lat": 39.562352,
                "lng": -75.941584
            },
            "Charles": {
                "lat": 38.472853,
                "lng": -77.015427
            },
            "Dorchester": {
                "lat": 38.429196,
                "lng": -76.047433
            },
            "Frederick": {
                "lat": 39.470427,
                "lng": -77.397627
            },
            "Garrett": {
                "lat": 39.529871,
                "lng": -79.269416
            },
            "Harford": {
                "lat": 39.537429,
                "lng": -76.299789
            },
            "Howard": {
                "lat": 39.252264,
                "lng": -76.924406
            },
            "Kent": {
                "lat": 39.239177,
                "lng": -76.1242
            },
            "Montgomery": {
                "lat": 39.137382,
                "lng": -77.203063
            },
            "Prince George's": {
                "lat": 38.82588,
                "lng": -76.847272
            },
            "Queen Anne's": {
                "lat": 39.040693,
                "lng": -76.082405
            },
            "St. Mary's": {
                "lat": 38.222666,
                "lng": -76.534271
            },
            "Somerset": {
                "lat": 38.07445,
                "lng": -75.853323
            },
            "Talbot": {
                "lat": 38.749427,
                "lng": -76.17913
            },
            "Washington": {
                "lat": 39.603621,
                "lng": -77.814671
            },
            "Wicomico": {
                "lat": 38.367389,
                "lng": -75.632206
            },
            "Worcester": {
                "lat": 38.222133,
                "lng": -75.309932
            }
        },
        "cities": {
            "Aspen Hill": {
                "lat": 39.0795529,
                "lng": -77.07303379999999
            },
            "Baltimore": {
                "lat": 39.2903848,
                "lng": -76.6121893
            },
            "Bel Air South": {
                "lat": 39.504033,
                "lng": -76.3181
            },
            "Bethesda": {
                "lat": 38.984652,
                "lng": -77.0947092
            },
            "Bowie": {
                "lat": 39.0067768,
                "lng": -76.77913649999999
            },
            "Catonsville": {
                "lat": 39.2720509,
                "lng": -76.73191609999999
            },
            "Columbia": {
                "lat": 39.2040236,
                "lng": -76.860565
            },
            "Dundalk": {
                "lat": 39.2506633,
                "lng": -76.5205184
            },
            "Ellicott City": {
                "lat": 39.2673283,
                "lng": -76.7983067
            },
            "Frederick": {
                "lat": 39.41426879999999,
                "lng": -77.4105409
            },
            "Gaithersburg": {
                "lat": 39.1434406,
                "lng": -77.2013705
            },
            "Germantown": {
                "lat": 39.1731621,
                "lng": -77.2716502
            },
            "Glen Burnie": {
                "lat": 39.1626084,
                "lng": -76.6246886
            },
            "North Bethesda": {
                "lat": 39.0445535,
                "lng": -77.11886779999999
            },
            "Odenton": {
                "lat": 39.0839981,
                "lng": -76.7002462
            },
            "Potomac": {
                "lat": 39.0181651,
                "lng": -77.2085914
            },
            "Rockville": {
                "lat": 39.0839973,
                "lng": -77.1527578
            },
            "Severn": {
                "lat": 39.1370528,
                "lng": -76.6983022
            },
            "Silver Spring": {
                "lat": 38.99066570000001,
                "lng": -77.026088
            },
            "Towson": {
                "lat": 39.4014955,
                "lng": -76.6019125
            },
            "Waldorf": {
                "lat": 38.6343544,
                "lng": -76.90668289999999
            },
            "Wheaton": {
                "lat": 39.0398314,
                "lng": -77.05525550000002
            }
        },
        "center": {
            "lat": 39.0724,
            "lng": -76.7902
        }
    },
    "WA": {
        "counties": {
            "Adams": {
                "lat": 47.00484,
                "lng": -118.533308
            },
            "Asotin": {
                "lat": 46.181861,
                "lng": -117.227781
            },
            "Benton": {
                "lat": 46.228072,
                "lng": -119.516864
            },
            "Chelan": {
                "lat": 47.859892,
                "lng": -120.618543
            },
            "Clallam": {
                "lat": 48.113009,
                "lng": -123.930611
            },
            "Clark": {
                "lat": 45.771674,
                "lng": -122.485903
            },
            "Columbia": {
                "lat": 46.292851,
                "lng": -117.911635
            },
            "Cowlitz": {
                "lat": 46.185923,
                "lng": -122.658682
            },
            "Douglas": {
                "lat": 47.735866,
                "lng": -119.69588
            },
            "Ferry": {
                "lat": 48.437246,
                "lng": -118.517074
            },
            "Franklin": {
                "lat": 46.53458,
                "lng": -118.906944
            },
            "Garfield": {
                "lat": 46.429474,
                "lng": -117.536715
            },
            "Grant": {
                "lat": 47.213633,
                "lng": -119.467788
            },
            "Grays Harbor": {
                "lat": 47.142786,
                "lng": -123.827043
            },
            "Island": {
                "lat": 48.158436,
                "lng": -122.670503
            },
            "Jefferson": {
                "lat": 47.802641,
                "lng": -123.52181
            },
            "King": {
                "lat": 47.493554,
                "lng": -121.832375
            },
            "Kitsap": {
                "lat": 47.639687,
                "lng": -122.649636
            },
            "Kittitas": {
                "lat": 47.124444,
                "lng": -120.676714
            },
            "Klickitat": {
                "lat": 45.869509,
                "lng": -120.780117
            },
            "Lewis": {
                "lat": 46.580071,
                "lng": -122.377444
            },
            "Lincoln": {
                "lat": 47.582718,
                "lng": -118.417668
            },
            "Mason": {
                "lat": 47.354126,
                "lng": -123.17385
            },
            "Okanogan": {
                "lat": 48.550971,
                "lng": -119.691035
            },
            "Pacific": {
                "lat": 46.556587,
                "lng": -123.782419
            },
            "Pend Oreille": {
                "lat": 48.543877,
                "lng": -117.232183
            },
            "Pierce": {
                "lat": 47.040716,
                "lng": -122.144709
            },
            "San Juan": {
                "lat": 48.508862,
                "lng": -123.100616
            },
            "Skagit": {
                "lat": 48.493066,
                "lng": -121.816278
            },
            "Skamania": {
                "lat": 46.024782,
                "lng": -121.953227
            },
            "Snohomish": {
                "lat": 48.054913,
                "lng": -121.766412
            },
            "Spokane": {
                "lat": 47.620379,
                "lng": -117.404392
            },
            "Stevens": {
                "lat": 48.390648,
                "lng": -117.854897
            },
            "Thurston": {
                "lat": 46.932598,
                "lng": -122.829441
            },
            "Wahkiakum": {
                "lat": 46.294638,
                "lng": -123.424458
            },
            "Walla Walla": {
                "lat": 46.254606,
                "lng": -118.480374
            },
            "Whatcom": {
                "lat": 48.842653,
                "lng": -121.836433
            },
            "Whitman": {
                "lat": 46.903322,
                "lng": -117.522962
            },
            "Yakima": {
                "lat": 46.456558,
                "lng": -120.740145
            }
        },
        "cities": {
            "Auburn": {
                "lat": 47.30732279999999,
                "lng": -122.2284532
            },
            "Bellevue": {
                "lat": 47.610377,
                "lng": -122.2006786
            },
            "Bellingham": {
                "lat": 48.7595529,
                "lng": -122.4882249
            },
            "Everett": {
                "lat": 47.9789848,
                "lng": -122.2020794
            },
            "Federal Way": {
                "lat": 47.3223221,
                "lng": -122.3126222
            },
            "Kennewick": {
                "lat": 46.2112458,
                "lng": -119.1372338
            },
            "Kent": {
                "lat": 47.3809335,
                "lng": -122.2348431
            },
            "Kirkland": {
                "lat": 47.6814875,
                "lng": -122.2087353
            },
            "Lacey": {
                "lat": 47.03426289999999,
                "lng": -122.8231915
            },
            "Lakewood": {
                "lat": 47.1717649,
                "lng": -122.518458
            },
            "Marysville": {
                "lat": 48.0517637,
                "lng": -122.1770818
            },
            "Olympia": {
                "lat": 47.0378741,
                "lng": -122.9006951
            },
            "Pasco": {
                "lat": 46.2395793,
                "lng": -119.1005657
            },
            "Redmond": {
                "lat": 47.6739881,
                "lng": -122.121512
            },
            "Renton": {
                "lat": 47.48287759999999,
                "lng": -122.2170661
            },
            "Richland": {
                "lat": 46.2856907,
                "lng": -119.2844621
            },
            "Sammamish": {
                "lat": 47.64176639999999,
                "lng": -122.0803998
            },
            "Seattle": {
                "lat": 47.6062095,
                "lng": -122.3320708
            },
            "Shoreline": {
                "lat": 47.7556531,
                "lng": -122.3415178
            },
            "South Hill": {
                "lat": 47.1412122,
                "lng": -122.2701183
            },
            "Spokane": {
                "lat": 47.6587802,
                "lng": -117.4260466
            },
            "Spokane Valley": {
                "lat": 47.6732281,
                "lng": -117.2393748
            },
            "Tacoma": {
                "lat": 47.2528768,
                "lng": -122.4442906
            },
            "Vancouver": {
                "lat": 45.6387281,
                "lng": -122.6614861
            },
            "Yakima": {
                "lat": 46.6020711,
                "lng": -120.5058987
            }
        },
        "center": {
            "lat": 47.3917,
            "lng": -121.5708
        }
    },
    "AL": {
        "counties": {
            "Autauga": {
                "lat": 32.536382,
                "lng": -86.64449
            },
            "Baldwin": {
                "lat": 30.659218,
                "lng": -87.746067
            },
            "Barbour": {
                "lat": 31.87067,
                "lng": -85.405456
            },
            "Bibb": {
                "lat": 33.015893,
                "lng": -87.127148
            },
            "Blount": {
                "lat": 33.977448,
                "lng": -86.567246
            },
            "Bullock": {
                "lat": 32.101759,
                "lng": -85.717261
            },
            "Butler": {
                "lat": 31.751667,
                "lng": -86.681969
            },
            "Calhoun": {
                "lat": 33.771706,
                "lng": -85.822513
            },
            "Chambers": {
                "lat": 32.917943,
                "lng": -85.391812
            },
            "Cherokee": {
                "lat": 34.069515,
                "lng": -85.654242
            },
            "Chilton": {
                "lat": 32.85406,
                "lng": -86.726628
            },
            "Choctaw": {
                "lat": 31.991008,
                "lng": -88.248887
            },
            "Clarke": {
                "lat": 31.685521,
                "lng": -87.818624
            },
            "Clay": {
                "lat": 33.267809,
                "lng": -85.862051
            },
            "Cleburne": {
                "lat": 33.671981,
                "lng": -85.516109
            },
            "Coffee": {
                "lat": 31.402183,
                "lng": -85.989201
            },
            "Colbert": {
                "lat": 34.703112,
                "lng": -87.801457
            },
            "Conecuh": {
                "lat": 31.428293,
                "lng": -86.992029
            },
            "Coosa": {
                "lat": 32.931445,
                "lng": -86.243482
            },
            "Covington": {
                "lat": 31.243987,
                "lng": -86.448721
            },
            "Crenshaw": {
                "lat": 31.732826,
                "lng": -86.319222
            },
            "Cullman": {
                "lat": 34.131923,
                "lng": -86.869267
            },
            "Dale": {
                "lat": 31.430654,
                "lng": -85.609476
            },
            "Dallas": {
                "lat": 32.33354,
                "lng": -87.114356
            },
            "DeKalb": {
                "lat": 34.460929,
                "lng": -85.803992
            },
            "Elmore": {
                "lat": 32.597229,
                "lng": -86.142739
            },
            "Escambia": {
                "lat": 31.121748,
                "lng": -87.168429
            },
            "Etowah": {
                "lat": 34.047638,
                "lng": -86.03442
            },
            "Fayette": {
                "lat": 33.732249,
                "lng": -87.752049
            },
            "Franklin": {
                "lat": 34.441988,
                "lng": -87.842815
            },
            "Geneva": {
                "lat": 31.090866,
                "lng": -85.824346
            },
            "Greene": {
                "lat": 32.844497,
                "lng": -87.964201
            },
            "Hale": {
                "lat": 32.752796,
                "lng": -87.623061
            },
            "Henry": {
                "lat": 31.516978,
                "lng": -85.239971
            },
            "Houston": {
                "lat": 31.158193,
                "lng": -85.296398
            },
            "Jackson": {
                "lat": 34.763522,
                "lng": -85.9774
            },
            "Jefferson": {
                "lat": 33.553444,
                "lng": -86.896536
            },
            "Lamar": {
                "lat": 33.787085,
                "lng": -88.087431
            },
            "Lauderdale": {
                "lat": 34.904122,
                "lng": -87.650997
            },
            "Lawrence": {
                "lat": 34.529776,
                "lng": -87.321865
            },
            "Lee": {
                "lat": 32.604064,
                "lng": -85.353048
            },
            "Limestone": {
                "lat": 34.810239,
                "lng": -86.9814
            },
            "Lowndes": {
                "lat": 32.147888,
                "lng": -86.650586
            },
            "Macon": {
                "lat": 32.387027,
                "lng": -85.692887
            },
            "Madison": {
                "lat": 34.764238,
                "lng": -86.55108
            },
            "Marengo": {
                "lat": 32.247591,
                "lng": -87.791091
            },
            "Marion": {
                "lat": 34.138219,
                "lng": -87.881551
            },
            "Marshall": {
                "lat": 34.309564,
                "lng": -86.321668
            },
            "Mobile": {
                "lat": 30.684573,
                "lng": -88.196568
            },
            "Monroe": {
                "lat": 31.580332,
                "lng": -87.383266
            },
            "Montgomery": {
                "lat": 32.203651,
                "lng": -86.203831
            },
            "Morgan": {
                "lat": 34.454484,
                "lng": -86.846402
            },
            "Perry": {
                "lat": 32.639005,
                "lng": -87.293827
            },
            "Pickens": {
                "lat": 33.296809,
                "lng": -88.096878
            },
            "Pike": {
                "lat": 31.798726,
                "lng": -85.941997
            },
            "Randolph": {
                "lat": 33.296475,
                "lng": -85.464068
            },
            "Russell": {
                "lat": 32.289811,
                "lng": -85.18698
            },
            "St. Clair": {
                "lat": 33.712963,
                "lng": -86.315663
            },
            "Shelby": {
                "lat": 33.262937,
                "lng": -86.678104
            },
            "Sumter": {
                "lat": 32.597481,
                "lng": -88.200057
            },
            "Talladega": {
                "lat": 33.369277,
                "lng": -86.175805
            },
            "Tallapoosa": {
                "lat": 32.863369,
                "lng": -85.799553
            },
            "Tuscaloosa": {
                "lat": 33.290202,
                "lng": -87.52286
            },
            "Walker": {
                "lat": 33.791571,
                "lng": -87.301092
            },
            "Washington": {
                "lat": 31.406974,
                "lng": -88.202078
            },
            "Wilcox": {
                "lat": 31.99033,
                "lng": -87.302205
            },
            "Winston": {
                "lat": 34.155888,
                "lng": -87.364147
            }
        },
        "cities": {
            "Auburn": {
                "lat": 32.6098566,
                "lng": -85.48078249999999
            },
            "Birmingham": {
                "lat": 33.5206608,
                "lng": -86.80248999999999
            },
            "Decatur": {
                "lat": 34.6059253,
                "lng": -86.9833417
            },
            "Dothan": {
                "lat": 31.2232313,
                "lng": -85.3904888
            },
            "Hoover": {
                "lat": 33.4053867,
                "lng": -86.8113781
            },
            "Huntsville": {
                "lat": 34.7303688,
                "lng": -86.5861037
            },
            "Madison": {
                "lat": 34.6992579,
                "lng": -86.74833180000002
            },
            "Mobile": {
                "lat": 30.6943566,
                "lng": -88.04305409999999
            },
            "Montgomery": {
                "lat": 32.3668052,
                "lng": -86.2999689
            },
            "Tuscaloosa": {
                "lat": 33.2098407,
                "lng": -87.56917349999999
            }
        },
        "center": {
            "lat": 32.799,
            "lng": -86.8073
        }
    },
    "TN": {
        "counties": {
            "Anderson": {
                "lat": 36.116731,
                "lng": -84.195418
            },
            "Bedford": {
                "lat": 35.51366,
                "lng": -86.458294
            },
            "Benton": {
                "lat": 36.069253,
                "lng": -88.071212
            },
            "Bledsoe": {
                "lat": 35.593668,
                "lng": -85.205979
            },
            "Blount": {
                "lat": 35.688185,
                "lng": -83.922973
            },
            "Bradley": {
                "lat": 35.153914,
                "lng": -84.859414
            },
            "Campbell": {
                "lat": 36.401592,
                "lng": -84.15925
            },
            "Cannon": {
                "lat": 35.808394,
                "lng": -86.062404
            },
            "Carroll": {
                "lat": 35.967896,
                "lng": -88.451659
            },
            "Carter": {
                "lat": 36.284744,
                "lng": -82.126593
            },
            "Cheatham": {
                "lat": 36.25518,
                "lng": -87.100816
            },
            "Chester": {
                "lat": 35.416639,
                "lng": -88.605505
            },
            "Claiborne": {
                "lat": 36.501557,
                "lng": -83.660724
            },
            "Clay": {
                "lat": 36.545765,
                "lng": -85.545718
            },
            "Cocke": {
                "lat": 35.916198,
                "lng": -83.119223
            },
            "Coffee": {
                "lat": 35.488759,
                "lng": -86.078219
            },
            "Crockett": {
                "lat": 35.811312,
                "lng": -89.135349
            },
            "Cumberland": {
                "lat": 35.952398,
                "lng": -84.994761
            },
            "Davidson": {
                "lat": 36.169129,
                "lng": -86.78479
            },
            "Decatur": {
                "lat": 35.603422,
                "lng": -88.107384
            },
            "DeKalb": {
                "lat": 35.98222,
                "lng": -85.833596
            },
            "Dickson": {
                "lat": 36.145533,
                "lng": -87.364155
            },
            "Dyer": {
                "lat": 36.054196,
                "lng": -89.398306
            },
            "Fayette": {
                "lat": 35.196993,
                "lng": -89.413803
            },
            "Fentress": {
                "lat": 36.376079,
                "lng": -84.932703
            },
            "Franklin": {
                "lat": 35.155926,
                "lng": -86.099203
            },
            "Gibson": {
                "lat": 35.991694,
                "lng": -88.933776
            },
            "Giles": {
                "lat": 35.202723,
                "lng": -87.035319
            },
            "Grainger": {
                "lat": 36.277463,
                "lng": -83.509493
            },
            "Greene": {
                "lat": 36.178998,
                "lng": -82.847746
            },
            "Grundy": {
                "lat": 35.387273,
                "lng": -85.722188
            },
            "Hamblen": {
                "lat": 36.218397,
                "lng": -83.266071
            },
            "Hamilton": {
                "lat": 35.159186,
                "lng": -85.202296
            },
            "Hancock": {
                "lat": 36.52142,
                "lng": -83.227453
            },
            "Hardeman": {
                "lat": 35.218131,
                "lng": -88.989037
            },
            "Hardin": {
                "lat": 35.201893,
                "lng": -88.185696
            },
            "Hawkins": {
                "lat": 36.452206,
                "lng": -82.931386
            },
            "Haywood": {
                "lat": 35.58669,
                "lng": -89.282536
            },
            "Henderson": {
                "lat": 35.653995,
                "lng": -88.387674
            },
            "Henry": {
                "lat": 36.325398,
                "lng": -88.300384
            },
            "Hickman": {
                "lat": 35.802396,
                "lng": -87.467114
            },
            "Houston": {
                "lat": 36.285777,
                "lng": -87.705605
            },
            "Humphreys": {
                "lat": 36.04044,
                "lng": -87.790625
            },
            "Jackson": {
                "lat": 36.354242,
                "lng": -85.674182
            },
            "Jefferson": {
                "lat": 36.048479,
                "lng": -83.440966
            },
            "Johnson": {
                "lat": 36.453204,
                "lng": -81.861237
            },
            "Knox": {
                "lat": 35.992727,
                "lng": -83.937721
            },
            "Lake": {
                "lat": 36.333905,
                "lng": -89.485537
            },
            "Lauderdale": {
                "lat": 35.762951,
                "lng": -89.627732
            },
            "Lawrence": {
                "lat": 35.220476,
                "lng": -87.396546
            },
            "Lewis": {
                "lat": 35.523244,
                "lng": -87.496983
            },
            "Lincoln": {
                "lat": 35.142532,
                "lng": -86.593388
            },
            "Loudon": {
                "lat": 35.73745,
                "lng": -84.316204
            },
            "McMinn": {
                "lat": 35.424471,
                "lng": -84.619963
            },
            "McNairy": {
                "lat": 35.175626,
                "lng": -88.564671
            },
            "Macon": {
                "lat": 36.537838,
                "lng": -86.001231
            },
            "Madison": {
                "lat": 35.606056,
                "lng": -88.833424
            },
            "Marion": {
                "lat": 35.133422,
                "lng": -85.618399
            },
            "Marshall": {
                "lat": 35.468387,
                "lng": -86.765886
            },
            "Maury": {
                "lat": 35.615696,
                "lng": -87.077763
            },
            "Meigs": {
                "lat": 35.503397,
                "lng": -84.823888
            },
            "Monroe": {
                "lat": 35.447666,
                "lng": -84.249786
            },
            "Montgomery": {
                "lat": 36.500354,
                "lng": -87.380887
            },
            "Moore": {
                "lat": 35.288889,
                "lng": -86.358684
            },
            "Morgan": {
                "lat": 36.138697,
                "lng": -84.639262
            },
            "Obion": {
                "lat": 36.358175,
                "lng": -89.150175
            },
            "Overton": {
                "lat": 36.34485,
                "lng": -85.283076
            },
            "Perry": {
                "lat": 35.659785,
                "lng": -87.877027
            },
            "Pickett": {
                "lat": 36.559364,
                "lng": -85.075741
            },
            "Polk": {
                "lat": 35.109437,
                "lng": -84.541112
            },
            "Putnam": {
                "lat": 36.140807,
                "lng": -85.496928
            },
            "Rhea": {
                "lat": 35.600587,
                "lng": -84.949552
            },
            "Roane": {
                "lat": 35.847472,
                "lng": -84.523861
            },
            "Robertson": {
                "lat": 36.52753,
                "lng": -86.869377
            },
            "Rutherford": {
                "lat": 35.843369,
                "lng": -86.417213
            },
            "Scott": {
                "lat": 36.437239,
                "lng": -84.498386
            },
            "Sequatchie": {
                "lat": 35.372335,
                "lng": -85.410344
            },
            "Sevier": {
                "lat": 35.791284,
                "lng": -83.521955
            },
            "Shelby": {
                "lat": 35.183794,
                "lng": -89.895397
            },
            "Smith": {
                "lat": 36.25565,
                "lng": -85.942078
            },
            "Stewart": {
                "lat": 36.511756,
                "lng": -87.851548
            },
            "Sullivan": {
                "lat": 36.510212,
                "lng": -82.299397
            },
            "Sumner": {
                "lat": 36.470015,
                "lng": -86.458517
            },
            "Tipton": {
                "lat": 35.500297,
                "lng": -89.763708
            },
            "Trousdale": {
                "lat": 36.39303,
                "lng": -86.156691
            },
            "Unicoi": {
                "lat": 36.100215,
                "lng": -82.418245
            },
            "Union": {
                "lat": 36.28414,
                "lng": -83.836088
            },
            "Van Buren": {
                "lat": 35.699245,
                "lng": -85.458411
            },
            "Warren": {
                "lat": 35.678282,
                "lng": -85.777363
            },
            "Washington": {
                "lat": 36.295665,
                "lng": -82.495037
            },
            "Wayne": {
                "lat": 35.242687,
                "lng": -87.819703
            },
            "Weakley": {
                "lat": 36.303523,
                "lng": -88.720785
            },
            "White": {
                "lat": 35.927062,
                "lng": -85.455766
            },
            "Williamson": {
                "lat": 35.894972,
                "lng": -86.896958
            },
            "Wilson": {
                "lat": 36.148476,
                "lng": -86.29021
            }
        },
        "cities": {
            "Bartlett": {
                "lat": 35.2045328,
                "lng": -89.8739753
            },
            "Chattanooga": {
                "lat": 35.0456297,
                "lng": -85.3096801
            },
            "Clarksville": {
                "lat": 36.5297706,
                "lng": -87.3594528
            },
            "Cleveland": {
                "lat": 35.1595182,
                "lng": -84.8766115
            },
            "Collierville": {
                "lat": 35.042036,
                "lng": -89.6645266
            },
            "Franklin": {
                "lat": 35.9250637,
                "lng": -86.8688899
            },
            "Hendersonville": {
                "lat": 36.3047735,
                "lng": -86.6199957
            },
            "Jackson": {
                "lat": 35.6145169,
                "lng": -88.81394689999999
            },
            "Johnson City": {
                "lat": 36.3134397,
                "lng": -82.3534727
            },
            "Kingsport": {
                "lat": 36.548434,
                "lng": -82.5618186
            },
            "Knoxville": {
                "lat": 35.9606384,
                "lng": -83.9207392
            },
            "Memphis": {
                "lat": 35.1495343,
                "lng": -90.0489801
            },
            "Murfreesboro": {
                "lat": 35.8456213,
                "lng": -86.39027
            },
            "Nashville": {
                "lat": 36.1658899,
                "lng": -86.7844432
            },
            "Smyrna": {
                "lat": 35.9828412,
                "lng": -86.5186045
            }
        },
        "center": {
            "lat": 35.7449,
            "lng": -86.7489
        }
    },
    "NJ": {
        "counties": {
            "Atlantic": {
                "lat": 39.469354,
                "lng": -74.633758
            },
            "Bergen": {
                "lat": 40.95909,
                "lng": -74.074522
            },
            "Burlington": {
                "lat": 39.875786,
                "lng": -74.663006
            },
            "Camden": {
                "lat": 39.802352,
                "lng": -74.961251
            },
            "Cape May": {
                "lat": 39.086143,
                "lng": -74.847716
            },
            "Cumberland": {
                "lat": 39.328387,
                "lng": -75.121644
            },
            "Essex": {
                "lat": 40.787217,
                "lng": -74.246136
            },
            "Gloucester": {
                "lat": 39.721019,
                "lng": -75.143708
            },
            "Hudson": {
                "lat": 40.731384,
                "lng": -74.078627
            },
            "Hunterdon": {
                "lat": 40.565283,
                "lng": -74.91197
            },
            "Mercer": {
                "lat": 40.282503,
                "lng": -74.703724
            },
            "Middlesex": {
                "lat": 40.439593,
                "lng": -74.407585
            },
            "Monmouth": {
                "lat": 40.287056,
                "lng": -74.152446
            },
            "Morris": {
                "lat": 40.858581,
                "lng": -74.547427
            },
            "Ocean": {
                "lat": 39.86585,
                "lng": -74.263027
            },
            "Passaic": {
                "lat": 41.033763,
                "lng": -74.300308
            },
            "Salem": {
                "lat": 39.573828,
                "lng": -75.357356
            },
            "Somerset": {
                "lat": 40.565522,
                "lng": -74.61993
            },
            "Sussex": {
                "lat": 41.137424,
                "lng": -74.691855
            },
            "Union": {
                "lat": 40.659871,
                "lng": -74.308696
            },
            "Warren": {
                "lat": 40.853524,
                "lng": -75.009542
            }
        },
        "cities": {
            "Bayonne": {
                "lat": 40.6687141,
                "lng": -74.1143091
            },
            "Camden": {
                "lat": 39.9259463,
                "lng": -75.1196199
            },
            "Clifton": {
                "lat": 40.8584328,
                "lng": -74.16375529999999
            },
            "East Orange": {
                "lat": 40.767323,
                "lng": -74.2048677
            },
            "Elizabeth": {
                "lat": 40.6639916,
                "lng": -74.2107006
            },
            "Hackensack": {
                "lat": 40.8859325,
                "lng": -74.0434736
            },
            "Hoboken": {
                "lat": 40.7439905,
                "lng": -74.0323626
            },
            "Jersey City": {
                "lat": 40.72815749999999,
                "lng": -74.0776417
            },
            "Kearny": {
                "lat": 40.7684342,
                "lng": -74.1454214
            },
            "Lakewood Township": {
                "lat": 40.08212899999999,
                "lng": -74.2097014
            },
            "Newark": {
                "lat": 40.735657,
                "lng": -74.1723667
            },
            "New Brunswick": {
                "lat": 40.4862157,
                "lng": -74.4518188
            },
            "Passaic": {
                "lat": 40.8567662,
                "lng": -74.1284764
            },
            "Paterson": {
                "lat": 40.9167654,
                "lng": -74.17181099999999
            },
            "Perth Amboy": {
                "lat": 40.5067723,
                "lng": -74.2654234
            },
            "Plainfield": {
                "lat": 40.6337136,
                "lng": -74.4073736
            },
            "Sayreville": {
                "lat": 40.45940210000001,
                "lng": -74.360846
            },
            "Toms River": {
                "lat": 39.9537358,
                "lng": -74.1979458
            },
            "Trenton": {
                "lat": 40.2170534,
                "lng": -74.7429384
            },
            "Union City": {
                "lat": 40.7795455,
                "lng": -74.02375119999999
            },
            "Union": {
                "lat": 40.6357419,
                "lng": -74.9580495
            },
            "Vineland": {
                "lat": 39.4862267,
                "lng": -75.02573129999999
            },
            "West New York": {
                "lat": 40.7878788,
                "lng": -74.0143064
            }
        },
        "center": {
            "lat": 40.314,
            "lng": -74.5089
        }
    },
    "NE": {
        "counties": {
            "Adams": {
                "lat": 40.520632,
                "lng": -98.500044
            },
            "Antelope": {
                "lat": 42.183225,
                "lng": -98.058037
            },
            "Arthur": {
                "lat": 41.570856,
                "lng": -101.697045
            },
            "Banner": {
                "lat": 41.53975,
                "lng": -103.726263
            },
            "Blaine": {
                "lat": 41.92523,
                "lng": -99.990771
            },
            "Boone": {
                "lat": 41.7054,
                "lng": -98.066794
            },
            "Box Butte": {
                "lat": 42.215665,
                "lng": -103.087821
            },
            "Boyd": {
                "lat": 42.894448,
                "lng": -98.773022
            },
            "Brown": {
                "lat": 42.34939,
                "lng": -99.923176
            },
            "Buffalo": {
                "lat": 40.855226,
                "lng": -99.074983
            },
            "Burt": {
                "lat": 41.854179,
                "lng": -96.337746
            },
            "Butler": {
                "lat": 41.226072,
                "lng": -97.13204
            },
            "Cass": {
                "lat": 40.909878,
                "lng": -96.140609
            },
            "Cedar": {
                "lat": 42.604511,
                "lng": -97.256824
            },
            "Chase": {
                "lat": 40.53039,
                "lng": -101.694192
            },
            "Cherry": {
                "lat": 42.566985,
                "lng": -101.072622
            },
            "Cheyenne": {
                "lat": 41.214236,
                "lng": -103.011929
            },
            "Clay": {
                "lat": 40.523669,
                "lng": -98.05105
            },
            "Colfax": {
                "lat": 41.574675,
                "lng": -97.089455
            },
            "Cuming": {
                "lat": 41.915865,
                "lng": -96.788517
            },
            "Custer": {
                "lat": 41.393893,
                "lng": -99.726866
            },
            "Dakota": {
                "lat": 42.390456,
                "lng": -96.562549
            },
            "Dawes": {
                "lat": 42.711214,
                "lng": -103.134872
            },
            "Dawson": {
                "lat": 40.867378,
                "lng": -99.815154
            },
            "Deuel": {
                "lat": 41.112988,
                "lng": -102.332604
            },
            "Dixon": {
                "lat": 42.48528,
                "lng": -96.855862
            },
            "Dodge": {
                "lat": 41.577008,
                "lng": -96.645853
            },
            "Douglas": {
                "lat": 41.297091,
                "lng": -96.154066
            },
            "Dundy": {
                "lat": 40.180165,
                "lng": -101.681133
            },
            "Fillmore": {
                "lat": 40.52504,
                "lng": -97.596705
            },
            "Franklin": {
                "lat": 40.183203,
                "lng": -98.96208
            },
            "Frontier": {
                "lat": 40.530947,
                "lng": -100.406683
            },
            "Furnas": {
                "lat": 40.191991,
                "lng": -99.909661
            },
            "Gage": {
                "lat": 40.255234,
                "lng": -96.683453
            },
            "Garden": {
                "lat": 41.659381,
                "lng": -102.328229
            },
            "Garfield": {
                "lat": 41.905572,
                "lng": -98.922998
            },
            "Gosper": {
                "lat": 40.509838,
                "lng": -99.824078
            },
            "Grant": {
                "lat": 41.915867,
                "lng": -101.756875
            },
            "Greeley": {
                "lat": 41.5676,
                "lng": -98.530566
            },
            "Hall": {
                "lat": 40.866023,
                "lng": -98.498004
            },
            "Hamilton": {
                "lat": 40.877145,
                "lng": -98.021943
            },
            "Harlan": {
                "lat": 40.178766,
                "lng": -99.403418
            },
            "Hayes": {
                "lat": 40.535786,
                "lng": -101.05558
            },
            "Hitchcock": {
                "lat": 40.176896,
                "lng": -101.044217
            },
            "Holt": {
                "lat": 42.459287,
                "lng": -98.784766
            },
            "Hooker": {
                "lat": 41.9187,
                "lng": -101.11681
            },
            "Howard": {
                "lat": 41.219403,
                "lng": -98.513303
            },
            "Jefferson": {
                "lat": 40.175736,
                "lng": -97.143103
            },
            "Johnson": {
                "lat": 40.395457,
                "lng": -96.268562
            },
            "Kearney": {
                "lat": 40.506269,
                "lng": -98.948461
            },
            "Keith": {
                "lat": 41.194404,
                "lng": -101.644474
            },
            "Keya Paha": {
                "lat": 42.87548,
                "lng": -99.718351
            },
            "Kimball": {
                "lat": 41.199155,
                "lng": -103.711105
            },
            "Knox": {
                "lat": 42.634405,
                "lng": -97.891349
            },
            "Lancaster": {
                "lat": 40.783547,
                "lng": -96.688658
            },
            "Lincoln": {
                "lat": 41.050322,
                "lng": -100.744481
            },
            "Logan": {
                "lat": 41.542156,
                "lng": -100.443665
            },
            "Loup": {
                "lat": 41.897714,
                "lng": -99.509764
            },
            "McPherson": {
                "lat": 41.596473,
                "lng": -101.060237
            },
            "Madison": {
                "lat": 41.909929,
                "lng": -97.606856
            },
            "Merrick": {
                "lat": 41.169801,
                "lng": -98.031051
            },
            "Morrill": {
                "lat": 41.732205,
                "lng": -102.990599
            },
            "Nance": {
                "lat": 41.402386,
                "lng": -97.991408
            },
            "Nemaha": {
                "lat": 40.387448,
                "lng": -95.850954
            },
            "Nuckolls": {
                "lat": 40.176492,
                "lng": -98.046842
            },
            "Otoe": {
                "lat": 40.637992,
                "lng": -96.131027
            },
            "Pawnee": {
                "lat": 40.13785,
                "lng": -96.245225
            },
            "Perkins": {
                "lat": 40.856065,
                "lng": -101.636443
            },
            "Phelps": {
                "lat": 40.516365,
                "lng": -99.406557
            },
            "Pierce": {
                "lat": 42.271413,
                "lng": -97.610992
            },
            "Platte": {
                "lat": 41.576866,
                "lng": -97.513467
            },
            "Polk": {
                "lat": 41.187925,
                "lng": -97.570663
            },
            "Red Willow": {
                "lat": 40.16942,
                "lng": -100.468576
            },
            "Richardson": {
                "lat": 40.123743,
                "lng": -95.718603
            },
            "Rock": {
                "lat": 42.413325,
                "lng": -99.45853
            },
            "Saline": {
                "lat": 40.516802,
                "lng": -97.131755
            },
            "Sarpy": {
                "lat": 41.115064,
                "lng": -96.109125
            },
            "Saunders": {
                "lat": 41.223152,
                "lng": -96.640923
            },
            "Scotts Bluff": {
                "lat": 41.851589,
                "lng": -103.70586
            },
            "Seward": {
                "lat": 40.871944,
                "lng": -97.140383
            },
            "Sheridan": {
                "lat": 42.507074,
                "lng": -102.389698
            },
            "Sherman": {
                "lat": 41.218743,
                "lng": -98.972849
            },
            "Sioux": {
                "lat": 42.483806,
                "lng": -103.742605
            },
            "Stanton": {
                "lat": 41.904793,
                "lng": -97.174724
            },
            "Thayer": {
                "lat": 40.173845,
                "lng": -97.596263
            },
            "Thomas": {
                "lat": 41.84862,
                "lng": -100.506911
            },
            "Thurston": {
                "lat": 42.154061,
                "lng": -96.533943
            },
            "Valley": {
                "lat": 41.564094,
                "lng": -98.983484
            },
            "Washington": {
                "lat": 41.533979,
                "lng": -96.224574
            },
            "Wayne": {
                "lat": 42.210746,
                "lng": -97.126243
            },
            "Webster": {
                "lat": 40.180646,
                "lng": -98.49859
            },
            "Wheeler": {
                "lat": 41.937859,
                "lng": -98.522289
            },
            "York": {
                "lat": 40.873056,
                "lng": -97.596742
            }
        },
        "cities": {
            "Bellevue": {
                "lat": 41.1586111,
                "lng": -95.93416669999999
            },
            "Grand Island": {
                "lat": 40.9222222,
                "lng": -98.35805560000001
            },
            "Lincoln": {
                "lat": 40.806862,
                "lng": -96.681679
            },
            "Omaha": {
                "lat": 41.2523634,
                "lng": -95.99798829999999
            }
        },
        "center": {
            "lat": 41.1289,
            "lng": -98.2883
        }
    },
    "MT": {
        "counties": {
            "Beaverhead": {
                "lat": 45.133863,
                "lng": -112.892869
            },
            "Big Horn": {
                "lat": 45.407869,
                "lng": -107.518163
            },
            "Blaine": {
                "lat": 48.428282,
                "lng": -108.967648
            },
            "Broadwater": {
                "lat": 46.334476,
                "lng": -111.496103
            },
            "Carbon": {
                "lat": 45.224475,
                "lng": -109.028551
            },
            "Carter": {
                "lat": 45.516825,
                "lng": -104.515324
            },
            "Cascade": {
                "lat": 47.316443,
                "lng": -111.350571
            },
            "Chouteau": {
                "lat": 47.886837,
                "lng": -110.436189
            },
            "Custer": {
                "lat": 46.261481,
                "lng": -105.550508
            },
            "Daniels": {
                "lat": 48.794429,
                "lng": -105.541739
            },
            "Dawson": {
                "lat": 47.272425,
                "lng": -104.901027
            },
            "Deer Lodge": {
                "lat": 46.099059,
                "lng": -113.139108
            },
            "Fallon": {
                "lat": 46.318184,
                "lng": -104.405718
            },
            "Fergus": {
                "lat": 47.222997,
                "lng": -109.22328
            },
            "Flathead": {
                "lat": 48.314696,
                "lng": -114.054319
            },
            "Gallatin": {
                "lat": 45.535559,
                "lng": -111.173443
            },
            "Garfield": {
                "lat": 47.281174,
                "lng": -106.982212
            },
            "Glacier": {
                "lat": 48.705671,
                "lng": -112.990502
            },
            "Golden Valley": {
                "lat": 46.380624,
                "lng": -109.174586
            },
            "Granite": {
                "lat": 46.395358,
                "lng": -113.425683
            },
            "Hill": {
                "lat": 48.628331,
                "lng": -110.106372
            },
            "Jefferson": {
                "lat": 46.126557,
                "lng": -112.056771
            },
            "Judith Basin": {
                "lat": 47.032558,
                "lng": -110.30532
            },
            "Lake": {
                "lat": 47.642901,
                "lng": -114.083687
            },
            "Lewis and Clark": {
                "lat": 47.122133,
                "lng": -112.382954
            },
            "Liberty": {
                "lat": 48.559654,
                "lng": -111.036924
            },
            "Lincoln": {
                "lat": 48.542232,
                "lng": -115.404343
            },
            "McCone": {
                "lat": 47.629628,
                "lng": -105.757222
            },
            "Madison": {
                "lat": 45.319288,
                "lng": -111.917328
            },
            "Meagher": {
                "lat": 46.585706,
                "lng": -110.921781
            },
            "Mineral": {
                "lat": 47.155213,
                "lng": -115.06455
            },
            "Missoula": {
                "lat": 47.027263,
                "lng": -113.892681
            },
            "Musselshell": {
                "lat": 46.505665,
                "lng": -108.436982
            },
            "Park": {
                "lat": 45.421905,
                "lng": -110.532798
            },
            "Petroleum": {
                "lat": 47.141917,
                "lng": -108.226575
            },
            "Phillips": {
                "lat": 48.250155,
                "lng": -107.928833
            },
            "Pondera": {
                "lat": 48.230312,
                "lng": -112.219928
            },
            "Powder River": {
                "lat": 45.40889,
                "lng": -105.555259
            },
            "Powell": {
                "lat": 46.844225,
                "lng": -112.9311
            },
            "Prairie": {
                "lat": 46.852434,
                "lng": -105.375808
            },
            "Ravalli": {
                "lat": 46.079298,
                "lng": -114.119065
            },
            "Richland": {
                "lat": 47.785513,
                "lng": -104.563387
            },
            "Roosevelt": {
                "lat": 48.282747,
                "lng": -104.99517
            },
            "Rosebud": {
                "lat": 46.161734,
                "lng": -106.701953
            },
            "Sanders": {
                "lat": 47.756469,
                "lng": -115.180225
            },
            "Sheridan": {
                "lat": 48.705523,
                "lng": -104.533913
            },
            "Silver Bow": {
                "lat": 45.895959,
                "lng": -112.660222
            },
            "Stillwater": {
                "lat": 45.663496,
                "lng": -109.391752
            },
            "Sweet Grass": {
                "lat": 45.81306,
                "lng": -109.941312
            },
            "Teton": {
                "lat": 47.819035,
                "lng": -112.281725
            },
            "Toole": {
                "lat": 48.645052,
                "lng": -111.733493
            },
            "Treasure": {
                "lat": 46.209636,
                "lng": -107.280494
            },
            "Valley": {
                "lat": 48.365713,
                "lng": -106.687883
            },
            "Wheatland": {
                "lat": 46.497047,
                "lng": -109.857147
            },
            "Wibaux": {
                "lat": 46.962866,
                "lng": -104.274466
            },
            "Yellowstone": {
                "lat": 45.936987,
                "lng": -108.276656
            }
        },
        "cities": {
            "Billings": {
                "lat": 45.7832856,
                "lng": -108.5006904
            },
            "Great Falls": {
                "lat": 47.5002354,
                "lng": -111.3008083
            },
            "Missoula": {
                "lat": 46.8605189,
                "lng": -114.019501
            }
        },
        "center": {
            "lat": 46.9048,
            "lng": -110.3261
        }
    },
    "MS": {
        "counties": {
            "Adams": {
                "lat": 31.486218,
                "lng": -91.351781
            },
            "Alcorn": {
                "lat": 34.886648,
                "lng": -88.581014
            },
            "Amite": {
                "lat": 31.203933,
                "lng": -90.795542
            },
            "Attala": {
                "lat": 33.09047,
                "lng": -89.588622
            },
            "Benton": {
                "lat": 34.810773,
                "lng": -89.200029
            },
            "Bolivar": {
                "lat": 33.799278,
                "lng": -90.884476
            },
            "Calhoun": {
                "lat": 33.936634,
                "lng": -89.337114
            },
            "Carroll": {
                "lat": 33.440795,
                "lng": -89.918887
            },
            "Chickasaw": {
                "lat": 33.921654,
                "lng": -88.945808
            },
            "Choctaw": {
                "lat": 33.345964,
                "lng": -89.251332
            },
            "Claiborne": {
                "lat": 31.97281,
                "lng": -90.915424
            },
            "Clarke": {
                "lat": 32.048448,
                "lng": -88.685964
            },
            "Clay": {
                "lat": 33.661734,
                "lng": -88.783326
            },
            "Coahoma": {
                "lat": 34.22867,
                "lng": -90.603165
            },
            "Copiah": {
                "lat": 31.866915,
                "lng": -90.448758
            },
            "Covington": {
                "lat": 31.633331,
                "lng": -89.548897
            },
            "DeSoto": {
                "lat": 34.874266,
                "lng": -89.99324
            },
            "Forrest": {
                "lat": 31.18858,
                "lng": -89.259447
            },
            "Franklin": {
                "lat": 31.477798,
                "lng": -90.895884
            },
            "George": {
                "lat": 30.855431,
                "lng": -88.642268
            },
            "Greene": {
                "lat": 31.212846,
                "lng": -88.634811
            },
            "Grenada": {
                "lat": 33.770031,
                "lng": -89.80274
            },
            "Hancock": {
                "lat": 30.391437,
                "lng": -89.47985
            },
            "Harrison": {
                "lat": 30.416536,
                "lng": -89.083376
            },
            "Hinds": {
                "lat": 32.267924,
                "lng": -90.4659
            },
            "Holmes": {
                "lat": 33.125942,
                "lng": -90.091197
            },
            "Humphreys": {
                "lat": 33.132978,
                "lng": -90.523911
            },
            "Issaquena": {
                "lat": 32.754977,
                "lng": -90.988552
            },
            "Itawamba": {
                "lat": 34.281075,
                "lng": -88.363127
            },
            "Jackson": {
                "lat": 30.458491,
                "lng": -88.619991
            },
            "Jasper": {
                "lat": 32.016989,
                "lng": -89.11943
            },
            "Jefferson": {
                "lat": 31.733633,
                "lng": -91.043878
            },
            "Jefferson Davis": {
                "lat": 31.564734,
                "lng": -89.826626
            },
            "Jones": {
                "lat": 31.621044,
                "lng": -89.167262
            },
            "Kemper": {
                "lat": 32.750136,
                "lng": -88.625631
            },
            "Lafayette": {
                "lat": 34.349298,
                "lng": -89.485903
            },
            "Lamar": {
                "lat": 31.197135,
                "lng": -89.514952
            },
            "Lauderdale": {
                "lat": 32.403998,
                "lng": -88.660449
            },
            "Lawrence": {
                "lat": 31.550009,
                "lng": -90.10753
            },
            "Leake": {
                "lat": 32.753268,
                "lng": -89.522568
            },
            "Lee": {
                "lat": 34.288965,
                "lng": -88.680887
            },
            "Leflore": {
                "lat": 33.54979,
                "lng": -90.294934
            },
            "Lincoln": {
                "lat": 31.535216,
                "lng": -90.453566
            },
            "Lowndes": {
                "lat": 33.471424,
                "lng": -88.439723
            },
            "Madison": {
                "lat": 32.63437,
                "lng": -90.03416
            },
            "Marion": {
                "lat": 31.230126,
                "lng": -89.821736
            },
            "Marshall": {
                "lat": 34.76619,
                "lng": -89.504231
            },
            "Monroe": {
                "lat": 33.89003,
                "lng": -88.485038
            },
            "Montgomery": {
                "lat": 33.500714,
                "lng": -89.639625
            },
            "Neshoba": {
                "lat": 32.752518,
                "lng": -89.119274
            },
            "Newton": {
                "lat": 32.40197,
                "lng": -89.118412
            },
            "Noxubee": {
                "lat": 33.10627,
                "lng": -88.565787
            },
            "Oktibbeha": {
                "lat": 33.422313,
                "lng": -88.876151
            },
            "Panola": {
                "lat": 34.365205,
                "lng": -89.963065
            },
            "Pearl River": {
                "lat": 30.773791,
                "lng": -89.586832
            },
            "Perry": {
                "lat": 31.169307,
                "lng": -88.988755
            },
            "Pike": {
                "lat": 31.177517,
                "lng": -90.397725
            },
            "Pontotoc": {
                "lat": 34.227081,
                "lng": -89.037239
            },
            "Prentiss": {
                "lat": 34.620866,
                "lng": -88.52224
            },
            "Quitman": {
                "lat": 34.25264,
                "lng": -90.290525
            },
            "Rankin": {
                "lat": 32.262057,
                "lng": -89.946552
            },
            "Scott": {
                "lat": 32.427127,
                "lng": -89.533209
            },
            "Sharkey": {
                "lat": 32.89249,
                "lng": -90.827388
            },
            "Simpson": {
                "lat": 31.902503,
                "lng": -89.917707
            },
            "Smith": {
                "lat": 32.019034,
                "lng": -89.494973
            },
            "Stone": {
                "lat": 30.790184,
                "lng": -89.112297
            },
            "Sunflower": {
                "lat": 33.605529,
                "lng": -90.59509
            },
            "Tallahatchie": {
                "lat": 33.955891,
                "lng": -90.172833
            },
            "Tate": {
                "lat": 34.649553,
                "lng": -89.943105
            },
            "Tippah": {
                "lat": 34.763618,
                "lng": -88.918819
            },
            "Tishomingo": {
                "lat": 34.737699,
                "lng": -88.236067
            },
            "Tunica": {
                "lat": 34.652201,
                "lng": -90.37177
            },
            "Union": {
                "lat": 34.489101,
                "lng": -89.0023
            },
            "Walthall": {
                "lat": 31.164492,
                "lng": -90.103431
            },
            "Warren": {
                "lat": 32.357005,
                "lng": -90.851791
            },
            "Washington": {
                "lat": 33.273131,
                "lng": -90.94443
            },
            "Wayne": {
                "lat": 31.64476,
                "lng": -88.682057
            },
            "Webster": {
                "lat": 33.612048,
                "lng": -89.283836
            },
            "Wilkinson": {
                "lat": 31.160249,
                "lng": -91.325567
            },
            "Winston": {
                "lat": 33.078724,
                "lng": -89.037391
            },
            "Yalobusha": {
                "lat": 34.030669,
                "lng": -89.703793
            },
            "Yazoo": {
                "lat": 32.765675,
                "lng": -90.387928
            }
        },
        "cities": {
            "Biloxi": {
                "lat": 30.3960318,
                "lng": -88.88530779999999
            },
            "Gulfport": {
                "lat": 30.3674198,
                "lng": -89.0928155
            },
            "Hattiesburg": {
                "lat": 31.3271189,
                "lng": -89.29033919999999
            },
            "Jackson": {
                "lat": 32.2987573,
                "lng": -90.1848103
            },
            "Meridian": {
                "lat": 32.3643098,
                "lng": -88.703656
            },
            "Southaven": {
                "lat": 34.9889818,
                "lng": -90.0125913
            }
        },
        "center": {
            "lat": 32.7673,
            "lng": -89.6812
        }
    },
    "ND": {
        "counties": {
            "Adams": {
                "lat": 46.096815,
                "lng": -102.533198
            },
            "Barnes": {
                "lat": 46.94255,
                "lng": -98.070195
            },
            "Benson": {
                "lat": 48.071738,
                "lng": -99.361987
            },
            "Billings": {
                "lat": 47.009283,
                "lng": -103.364924
            },
            "Bottineau": {
                "lat": 48.794412,
                "lng": -100.831257
            },
            "Bowman": {
                "lat": 46.107807,
                "lng": -103.506586
            },
            "Burke": {
                "lat": 48.786453,
                "lng": -102.520087
            },
            "Burleigh": {
                "lat": 46.971843,
                "lng": -100.462001
            },
            "Cass": {
                "lat": 46.927003,
                "lng": -97.252375
            },
            "Cavalier": {
                "lat": 48.768439,
                "lng": -98.46379
            },
            "Dickey": {
                "lat": 46.107756,
                "lng": -98.496518
            },
            "Divide": {
                "lat": 48.818142,
                "lng": -103.497653
            },
            "Dunn": {
                "lat": 47.35461,
                "lng": -102.612365
            },
            "Eddy": {
                "lat": 47.723436,
                "lng": -98.900475
            },
            "Emmons": {
                "lat": 46.284255,
                "lng": -100.237842
            },
            "Foster": {
                "lat": 47.464327,
                "lng": -98.872817
            },
            "Golden Valley": {
                "lat": 46.938924,
                "lng": -103.844612
            },
            "Grand Forks": {
                "lat": 47.926003,
                "lng": -97.450851
            },
            "Grant": {
                "lat": 46.357827,
                "lng": -101.639049
            },
            "Griggs": {
                "lat": 47.463463,
                "lng": -98.232444
            },
            "Hettinger": {
                "lat": 46.434939,
                "lng": -102.458385
            },
            "Kidder": {
                "lat": 46.935385,
                "lng": -99.742727
            },
            "LaMoure": {
                "lat": 46.464195,
                "lng": -98.526057
            },
            "Logan": {
                "lat": 46.469278,
                "lng": -99.504585
            },
            "McHenry": {
                "lat": 48.233842,
                "lng": -100.633267
            },
            "McIntosh": {
                "lat": 46.117034,
                "lng": -99.443041
            },
            "McKenzie": {
                "lat": 47.742475,
                "lng": -103.403215
            },
            "McLean": {
                "lat": 47.653055,
                "lng": -101.421794
            },
            "Mercer": {
                "lat": 47.303279,
                "lng": -101.820765
            },
            "Morton": {
                "lat": 46.713789,
                "lng": -101.279743
            },
            "Mountrail": {
                "lat": 48.210291,
                "lng": -102.364756
            },
            "Nelson": {
                "lat": 47.918667,
                "lng": -98.204428
            },
            "Oliver": {
                "lat": 47.118079,
                "lng": -101.33142
            },
            "Pembina": {
                "lat": 48.766896,
                "lng": -97.545405
            },
            "Pierce": {
                "lat": 48.238883,
                "lng": -99.966497
            },
            "Ramsey": {
                "lat": 48.265551,
                "lng": -98.737329
            },
            "Ransom": {
                "lat": 46.449276,
                "lng": -97.647554
            },
            "Renville": {
                "lat": 48.712782,
                "lng": -101.658152
            },
            "Richland": {
                "lat": 46.265219,
                "lng": -96.93796
            },
            "Rolette": {
                "lat": 48.768272,
                "lng": -99.840463
            },
            "Sargent": {
                "lat": 46.108206,
                "lng": -97.63003
            },
            "Sheridan": {
                "lat": 47.581373,
                "lng": -100.341499
            },
            "Sioux": {
                "lat": 46.109282,
                "lng": -101.047525
            },
            "Slope": {
                "lat": 46.445834,
                "lng": -103.462462
            },
            "Stark": {
                "lat": 46.817031,
                "lng": -102.662026
            },
            "Steele": {
                "lat": 47.458288,
                "lng": -97.718895
            },
            "Stutsman": {
                "lat": 46.971103,
                "lng": -98.957592
            },
            "Towner": {
                "lat": 48.682183,
                "lng": -99.248158
            },
            "Traill": {
                "lat": 47.446215,
                "lng": -97.164754
            },
            "Walsh": {
                "lat": 48.376979,
                "lng": -97.72223
            },
            "Ward": {
                "lat": 48.216686,
                "lng": -101.540537
            },
            "Wells": {
                "lat": 47.580851,
                "lng": -99.671502
            },
            "Williams": {
                "lat": 48.345867,
                "lng": -103.4874
            }
        },
        "cities": {
            "Bismarck": {
                "lat": 46.8083268,
                "lng": -100.7837392
            },
            "Fargo": {
                "lat": 46.8771863,
                "lng": -96.7898034
            },
            "Grand Forks": {
                "lat": 47.9252568,
                "lng": -97.0328547
            },
            "Minot": {
                "lat": 48.2325095,
                "lng": -101.2962732
            }
        },
        "center": {
            "lat": 47.5362,
            "lng": -99.793
        }
    },
    "MO": {
        "counties": {
            "Adair": {
                "lat": 40.190666,
                "lng": -92.603592
            },
            "Andrew": {
                "lat": 39.988863,
                "lng": -94.803551
            },
            "Atchison": {
                "lat": 40.431846,
                "lng": -95.437555
            },
            "Audrain": {
                "lat": 39.21448,
                "lng": -91.843415
            },
            "Barry": {
                "lat": 36.699378,
                "lng": -93.834326
            },
            "Barton": {
                "lat": 37.500799,
                "lng": -94.344089
            },
            "Bates": {
                "lat": 38.257217,
                "lng": -94.339246
            },
            "Benton": {
                "lat": 38.301036,
                "lng": -93.287942
            },
            "Bollinger": {
                "lat": 37.318349,
                "lng": -90.024601
            },
            "Boone": {
                "lat": 38.989657,
                "lng": -92.310779
            },
            "Buchanan": {
                "lat": 39.66037,
                "lng": -94.808173
            },
            "Butler": {
                "lat": 36.71518,
                "lng": -90.40313
            },
            "Caldwell": {
                "lat": 39.658998,
                "lng": -93.979179
            },
            "Callaway": {
                "lat": 38.835966,
                "lng": -91.924089
            },
            "Camden": {
                "lat": 38.031995,
                "lng": -92.765138
            },
            "Cape Girardeau": {
                "lat": 37.383882,
                "lng": -89.684908
            },
            "Carroll": {
                "lat": 39.427375,
                "lng": -93.500227
            },
            "Carter": {
                "lat": 36.944783,
                "lng": -90.945626
            },
            "Cass": {
                "lat": 38.647159,
                "lng": -94.354242
            },
            "Cedar": {
                "lat": 37.733655,
                "lng": -93.850014
            },
            "Chariton": {
                "lat": 39.517969,
                "lng": -92.961621
            },
            "Christian": {
                "lat": 36.969739,
                "lng": -93.187614
            },
            "Clark": {
                "lat": 40.407275,
                "lng": -91.729472
            },
            "Clay": {
                "lat": 39.315551,
                "lng": -94.421502
            },
            "Clinton": {
                "lat": 39.608723,
                "lng": -94.395803
            },
            "Cole": {
                "lat": 38.506847,
                "lng": -92.271404
            },
            "Cooper": {
                "lat": 38.845386,
                "lng": -92.812323
            },
            "Crawford": {
                "lat": 37.966561,
                "lng": -91.313933
            },
            "Dade": {
                "lat": 37.43235,
                "lng": -93.854878
            },
            "Dallas": {
                "lat": 37.683583,
                "lng": -93.033812
            },
            "Daviess": {
                "lat": 39.962839,
                "lng": -93.970053
            },
            "DeKalb": {
                "lat": 39.894665,
                "lng": -94.40719
            },
            "Dent": {
                "lat": 37.60325,
                "lng": -91.495916
            },
            "Douglas": {
                "lat": 36.946517,
                "lng": -92.515892
            },
            "Dunklin": {
                "lat": 36.153025,
                "lng": -90.062254
            },
            "Franklin": {
                "lat": 38.408313,
                "lng": -91.07341
            },
            "Gasconade": {
                "lat": 38.441183,
                "lng": -91.50578
            },
            "Gentry": {
                "lat": 40.209379,
                "lng": -94.40411
            },
            "Greene": {
                "lat": 37.258196,
                "lng": -93.340641
            },
            "Grundy": {
                "lat": 40.112541,
                "lng": -93.565054
            },
            "Harrison": {
                "lat": 40.34562,
                "lng": -93.992582
            },
            "Henry": {
                "lat": 38.386491,
                "lng": -93.792628
            },
            "Hickory": {
                "lat": 37.9367,
                "lng": -93.322835
            },
            "Holt": {
                "lat": 40.095724,
                "lng": -95.219072
            },
            "Howard": {
                "lat": 39.143365,
                "lng": -92.695926
            },
            "Howell": {
                "lat": 36.774369,
                "lng": -91.887368
            },
            "Iron": {
                "lat": 37.62596,
                "lng": -90.699627
            },
            "Jackson": {
                "lat": 39.007233,
                "lng": -94.342507
            },
            "Jasper": {
                "lat": 37.200865,
                "lng": -94.338869
            },
            "Jefferson": {
                "lat": 38.257414,
                "lng": -90.543138
            },
            "Johnson": {
                "lat": 38.74588,
                "lng": -93.805999
            },
            "Knox": {
                "lat": 40.136776,
                "lng": -92.146809
            },
            "Laclede": {
                "lat": 37.65969,
                "lng": -92.594832
            },
            "Lafayette": {
                "lat": 39.068705,
                "lng": -93.802639
            },
            "Lawrence": {
                "lat": 37.106135,
                "lng": -93.833262
            },
            "Lewis": {
                "lat": 40.084559,
                "lng": -91.728803
            },
            "Lincoln": {
                "lat": 39.058568,
                "lng": -90.957771
            },
            "Linn": {
                "lat": 39.86444,
                "lng": -93.108019
            },
            "Livingston": {
                "lat": 39.778587,
                "lng": -93.548201
            },
            "McDonald": {
                "lat": 36.630218,
                "lng": -94.343956
            },
            "Macon": {
                "lat": 39.829795,
                "lng": -92.56434
            },
            "Madison": {
                "lat": 37.473235,
                "lng": -90.345453
            },
            "Maries": {
                "lat": 38.162615,
                "lng": -91.923601
            },
            "Marion": {
                "lat": 39.807538,
                "lng": -91.635379
            },
            "Mercer": {
                "lat": 40.421414,
                "lng": -93.567631
            },
            "Miller": {
                "lat": 38.21672,
                "lng": -92.429871
            },
            "Mississippi": {
                "lat": 36.826264,
                "lng": -89.295929
            },
            "Moniteau": {
                "lat": 38.633037,
                "lng": -92.583642
            },
            "Monroe": {
                "lat": 39.49827,
                "lng": -92.006458
            },
            "Montgomery": {
                "lat": 38.935162,
                "lng": -91.465437
            },
            "Morgan": {
                "lat": 38.420807,
                "lng": -92.874835
            },
            "New Madrid": {
                "lat": 36.594261,
                "lng": -89.655949
            },
            "Newton": {
                "lat": 36.908017,
                "lng": -94.334741
            },
            "Nodaway": {
                "lat": 40.360484,
                "lng": -94.883281
            },
            "Oregon": {
                "lat": 36.684867,
                "lng": -91.402902
            },
            "Osage": {
                "lat": 38.464254,
                "lng": -91.859504
            },
            "Ozark": {
                "lat": 36.649643,
                "lng": -92.45858
            },
            "Pemiscot": {
                "lat": 36.209916,
                "lng": -89.785942
            },
            "Perry": {
                "lat": 37.71113,
                "lng": -89.802125
            },
            "Pettis": {
                "lat": 38.727367,
                "lng": -93.285207
            },
            "Phelps": {
                "lat": 37.866326,
                "lng": -91.790349
            },
            "Pike": {
                "lat": 39.344178,
                "lng": -91.171042
            },
            "Platte": {
                "lat": 39.378696,
                "lng": -94.761472
            },
            "Polk": {
                "lat": 37.616761,
                "lng": -93.400817
            },
            "Pulaski": {
                "lat": 37.824835,
                "lng": -92.207022
            },
            "Putnam": {
                "lat": 40.478606,
                "lng": -93.014531
            },
            "Ralls": {
                "lat": 39.553455,
                "lng": -91.524787
            },
            "Randolph": {
                "lat": 39.441601,
                "lng": -92.492725
            },
            "Ray": {
                "lat": 39.308401,
                "lng": -93.995746
            },
            "Reynolds": {
                "lat": 37.360857,
                "lng": -90.969516
            },
            "Ripley": {
                "lat": 36.648902,
                "lng": -90.86706
            },
            "St. Charles": {
                "lat": 38.781102,
                "lng": -90.674915
            },
            "St. Clair": {
                "lat": 38.039069,
                "lng": -93.773077
            },
            "Ste. Genevieve": {
                "lat": 37.89018,
                "lng": -90.18117
            },
            "St. Francois": {
                "lat": 37.810707,
                "lng": -90.473868
            },
            "St. Louis": {
                "lat": 38.635699,
                "lng": -90.244582
            },
            "Saline": {
                "lat": 39.13584,
                "lng": -93.204164
            },
            "Schuyler": {
                "lat": 40.469361,
                "lng": -92.519016
            },
            "Scotland": {
                "lat": 40.447686,
                "lng": -92.142824
            },
            "Scott": {
                "lat": 37.047793,
                "lng": -89.568098
            },
            "Shannon": {
                "lat": 37.15198,
                "lng": -91.398364
            },
            "Shelby": {
                "lat": 39.797531,
                "lng": -92.088719
            },
            "Stoddard": {
                "lat": 36.855428,
                "lng": -89.941735
            },
            "Stone": {
                "lat": 36.747857,
                "lng": -93.467782
            },
            "Sullivan": {
                "lat": 40.209587,
                "lng": -93.109783
            },
            "Taney": {
                "lat": 36.649827,
                "lng": -93.042819
            },
            "Texas": {
                "lat": 37.314257,
                "lng": -91.964478
            },
            "Vernon": {
                "lat": 37.850196,
                "lng": -94.341597
            },
            "Warren": {
                "lat": 38.761902,
                "lng": -91.159307
            },
            "Washington": {
                "lat": 37.942315,
                "lng": -90.897056
            },
            "Wayne": {
                "lat": 37.113825,
                "lng": -90.460868
            },
            "Webster": {
                "lat": 37.280804,
                "lng": -92.87608
            },
            "Worth": {
                "lat": 40.480482,
                "lng": -94.419129
            },
            "Wright": {
                "lat": 37.267636,
                "lng": -92.48001
            }
        },
        "cities": {
            "Blue Springs": {
                "lat": 39.0169509,
                "lng": -94.2816148
            },
            "Chesterfield": {
                "lat": 38.6631083,
                "lng": -90.5770675
            },
            "Columbia": {
                "lat": 38.9517053,
                "lng": -92.3340724
            },
            "Florissant": {
                "lat": 38.789217,
                "lng": -90.322614
            },
            "Independence": {
                "lat": 39.0911161,
                "lng": -94.41550679999999
            },
            "Jefferson City": {
                "lat": 38.57670170000001,
                "lng": -92.1735164
            },
            "Joplin": {
                "lat": 37.08422710000001,
                "lng": -94.51328099999999
            },
            "Kansas City": {
                "lat": 39.0997265,
                "lng": -94.5785667
            },
            "Lee's Summit": {
                "lat": 38.916343,
                "lng": -94.383516
            },
            "O'Fallon": {
                "lat": 38.8106075,
                "lng": -90.69984769999999
            },
            "St Charles": {
                "lat": 38.7833333,
                "lng": -90.5166667
            },
            "St Joseph": {
                "lat": 39.7577778,
                "lng": -94.83638889999999
            },
            "St Louis": {
                "lat": 38.6270025,
                "lng": -90.19940419999999
            },
            "St Peters": {
                "lat": 38.778475,
                "lng": -90.60528099999999
            },
            "Springfield": {
                "lat": 37.2089572,
                "lng": -93.29229889999999
            }
        },
        "center": {
            "lat": 38.4623,
            "lng": -92.302
        }
    },
    "ID": {
        "counties": {
            "Ada": {
                "lat": 43.447861,
                "lng": -116.244456
            },
            "Adams": {
                "lat": 44.884583,
                "lng": -116.431873
            },
            "Bannock": {
                "lat": 42.692939,
                "lng": -112.228986
            },
            "Bear Lake": {
                "lat": 42.285833,
                "lng": -111.327445
            },
            "Benewah": {
                "lat": 47.218451,
                "lng": -116.633541
            },
            "Bingham": {
                "lat": 43.216357,
                "lng": -112.399206
            },
            "Blaine": {
                "lat": 43.394482,
                "lng": -113.95529
            },
            "Boise": {
                "lat": 43.987275,
                "lng": -115.715111
            },
            "Bonner": {
                "lat": 48.312512,
                "lng": -116.59694
            },
            "Bonneville": {
                "lat": 43.395171,
                "lng": -111.621878
            },
            "Boundary": {
                "lat": 48.773065,
                "lng": -116.524619
            },
            "Butte": {
                "lat": 43.6851,
                "lng": -113.177627
            },
            "Camas": {
                "lat": 43.463396,
                "lng": -114.804427
            },
            "Canyon": {
                "lat": 43.623051,
                "lng": -116.708527
            },
            "Caribou": {
                "lat": 42.786273,
                "lng": -111.544172
            },
            "Cassia": {
                "lat": 42.288635,
                "lng": -113.605498
            },
            "Clark": {
                "lat": 44.286251,
                "lng": -112.36112
            },
            "Clearwater": {
                "lat": 46.67257,
                "lng": -115.6535
            },
            "Custer": {
                "lat": 44.273341,
                "lng": -114.252251
            },
            "Elmore": {
                "lat": 43.394826,
                "lng": -115.470751
            },
            "Franklin": {
                "lat": 42.173589,
                "lng": -111.822955
            },
            "Fremont": {
                "lat": 44.218091,
                "lng": -111.484429
            },
            "Gem": {
                "lat": 44.061473,
                "lng": -116.398784
            },
            "Gooding": {
                "lat": 42.973185,
                "lng": -114.82142
            },
            "Idaho": {
                "lat": 45.849237,
                "lng": -115.467376
            },
            "Jefferson": {
                "lat": 43.796965,
                "lng": -112.318588
            },
            "Jerome": {
                "lat": 42.691172,
                "lng": -114.263009
            },
            "Kootenai": {
                "lat": 47.677113,
                "lng": -116.694918
            },
            "Latah": {
                "lat": 46.81892,
                "lng": -116.730974
            },
            "Lemhi": {
                "lat": 44.928789,
                "lng": -113.887841
            },
            "Lewis": {
                "lat": 46.236328,
                "lng": -116.42376
            },
            "Lincoln": {
                "lat": 42.986181,
                "lng": -114.153899
            },
            "Madison": {
                "lat": 43.789709,
                "lng": -111.65655
            },
            "Minidoka": {
                "lat": 42.856937,
                "lng": -113.64001
            },
            "Nez Perce": {
                "lat": 46.333766,
                "lng": -116.760903
            },
            "Oneida": {
                "lat": 42.18389,
                "lng": -112.520465
            },
            "Owyhee": {
                "lat": 42.593063,
                "lng": -116.142655
            },
            "Payette": {
                "lat": 44.00274,
                "lng": -116.748655
            },
            "Power": {
                "lat": 42.694126,
                "lng": -112.844407
            },
            "Shoshone": {
                "lat": 47.347694,
                "lng": -115.885092
            },
            "Teton": {
                "lat": 43.760994,
                "lng": -111.211765
            },
            "Twin Falls": {
                "lat": 42.352309,
                "lng": -114.665639
            },
            "Valley": {
                "lat": 44.771532,
                "lng": -115.637875
            },
            "Washington": {
                "lat": 44.448213,
                "lng": -116.79783
            }
        },
        "cities": {
            "Boise": {
                "lat": 43.612631,
                "lng": -116.211076
            },
            "Caldwell": {
                "lat": 43.66293839999999,
                "lng": -116.6873596
            },
            "Coeur d'Alene": {
                "lat": 47.6776832,
                "lng": -116.7804664
            },
            "Idaho Falls": {
                "lat": 43.49165139999999,
                "lng": -112.0339645
            },
            "Meridian": {
                "lat": 43.6121087,
                "lng": -116.3915131
            },
            "Nampa": {
                "lat": 43.5407172,
                "lng": -116.5634624
            },
            "Pocatello": {
                "lat": 42.8713032,
                "lng": -112.4455344
            },
            "Twin Falls": {
                "lat": 42.5629668,
                "lng": -114.4608711
            }
        },
        "center": {
            "lat": 44.2394,
            "lng": -114.5103
        }
    },
    "UT": {
        "counties": {
            "Beaver": {
                "lat": 38.357535,
                "lng": -113.238948
            },
            "Box Elder": {
                "lat": 41.476021,
                "lng": -113.052922
            },
            "Cache": {
                "lat": 41.734225,
                "lng": -111.744581
            },
            "Carbon": {
                "lat": 39.67005,
                "lng": -110.590357
            },
            "Daggett": {
                "lat": 40.890099,
                "lng": -109.505786
            },
            "Davis": {
                "lat": 41.037045,
                "lng": -112.202123
            },
            "Duchesne": {
                "lat": 40.289649,
                "lng": -110.42983
            },
            "Emery": {
                "lat": 39.009028,
                "lng": -110.721111
            },
            "Garfield": {
                "lat": 37.831622,
                "lng": -111.450886
            },
            "Grand": {
                "lat": 38.974326,
                "lng": -109.57345
            },
            "Iron": {
                "lat": 37.882727,
                "lng": -113.290059
            },
            "Juab": {
                "lat": 39.710827,
                "lng": -112.794262
            },
            "Kane": {
                "lat": 37.275118,
                "lng": -111.815413
            },
            "Millard": {
                "lat": 39.09454,
                "lng": -113.525014
            },
            "Morgan": {
                "lat": 41.091027,
                "lng": -111.577885
            },
            "Piute": {
                "lat": 38.335881,
                "lng": -112.129376
            },
            "Rich": {
                "lat": 41.627598,
                "lng": -111.240227
            },
            "Salt Lake": {
                "lat": 40.667882,
                "lng": -111.924244
            },
            "San Juan": {
                "lat": 37.623064,
                "lng": -109.78932
            },
            "Sanpete": {
                "lat": 39.380588,
                "lng": -111.570451
            },
            "Sevier": {
                "lat": 38.746825,
                "lng": -111.81193
            },
            "Summit": {
                "lat": 40.87206,
                "lng": -110.968486
            },
            "Tooele": {
                "lat": 40.467692,
                "lng": -113.124015
            },
            "Uintah": {
                "lat": 40.125887,
                "lng": -109.517748
            },
            "Utah": {
                "lat": 40.120409,
                "lng": -111.668667
            },
            "Wasatch": {
                "lat": 40.334884,
                "lng": -111.161568
            },
            "Washington": {
                "lat": 37.262531,
                "lng": -113.4878
            },
            "Wayne": {
                "lat": 38.261229,
                "lng": -110.990323
            },
            "Weber": {
                "lat": 41.270355,
                "lng": -111.875879
            }
        },
        "cities": {
            "Bountiful": {
                "lat": 40.8893895,
                "lng": -111.880771
            },
            "Draper": {
                "lat": 40.5246711,
                "lng": -111.8638226
            },
            "Layton": {
                "lat": 41.0602216,
                "lng": -111.9710529
            },
            "Lehi": {
                "lat": 40.3916172,
                "lng": -111.8507662
            },
            "Logan": {
                "lat": 41.7354861,
                "lng": -111.834388
            },
            "Millcreek": {
                "lat": 40.6868914,
                "lng": -111.8754907
            },
            "Murray": {
                "lat": 40.6668916,
                "lng": -111.8879909
            },
            "Ogden": {
                "lat": 41.223,
                "lng": -111.9738304
            },
            "Orem": {
                "lat": 40.2968979,
                "lng": -111.6946475
            },
            "Provo": {
                "lat": 40.2338438,
                "lng": -111.6585337
            },
            "Riverton": {
                "lat": 40.521893,
                "lng": -111.9391023
            },
            "St George": {
                "lat": 37.0952778,
                "lng": -113.5780556
            },
            "Salt Lake City": {
                "lat": 40.7607793,
                "lng": -111.8910474
            },
            "Sandy": {
                "lat": 40.57250000000001,
                "lng": -111.8597222
            },
            "South Jordan": {
                "lat": 40.5621704,
                "lng": -111.929658
            },
            "Taylorsville": {
                "lat": 40.66772479999999,
                "lng": -111.9388258
            },
            "West Jordan": {
                "lat": 40.6096698,
                "lng": -111.9391031
            },
            "West Valley City": {
                "lat": 40.6916132,
                "lng": -112.0010501
            }
        },
        "center": {
            "lat": 40.1135,
            "lng": -111.8535
        }
    },
    "KY": {
        "counties": {
            "Adair": {
                "lat": 37.105541,
                "lng": -85.281401
            },
            "Allen": {
                "lat": 36.75077,
                "lng": -86.192458
            },
            "Anderson": {
                "lat": 38.005396,
                "lng": -84.986417
            },
            "Ballard": {
                "lat": 37.05112,
                "lng": -89.009178
            },
            "Barren": {
                "lat": 36.963614,
                "lng": -85.92499
            },
            "Bath": {
                "lat": 38.152249,
                "lng": -83.737641
            },
            "Bell": {
                "lat": 36.72268,
                "lng": -83.681046
            },
            "Boone": {
                "lat": 38.974595,
                "lng": -84.731444
            },
            "Bourbon": {
                "lat": 38.202562,
                "lng": -84.20986
            },
            "Boyd": {
                "lat": 38.360004,
                "lng": -82.681406
            },
            "Boyle": {
                "lat": 37.6182,
                "lng": -84.873016
            },
            "Bracken": {
                "lat": 38.678523,
                "lng": -84.100355
            },
            "Breathitt": {
                "lat": 37.521178,
                "lng": -83.322401
            },
            "Breckinridge": {
                "lat": 37.778109,
                "lng": -86.432829
            },
            "Bullitt": {
                "lat": 37.969572,
                "lng": -85.703036
            },
            "Butler": {
                "lat": 37.207013,
                "lng": -86.682471
            },
            "Caldwell": {
                "lat": 37.148643,
                "lng": -87.87051
            },
            "Calloway": {
                "lat": 36.620978,
                "lng": -88.274086
            },
            "Campbell": {
                "lat": 38.946981,
                "lng": -84.379583
            },
            "Carlisle": {
                "lat": 36.857726,
                "lng": -88.975757
            },
            "Carroll": {
                "lat": 38.668284,
                "lng": -85.124083
            },
            "Carter": {
                "lat": 38.309555,
                "lng": -83.048821
            },
            "Casey": {
                "lat": 37.321962,
                "lng": -84.92822
            },
            "Christian": {
                "lat": 36.893388,
                "lng": -87.493554
            },
            "Clark": {
                "lat": 37.970133,
                "lng": -84.144974
            },
            "Clay": {
                "lat": 37.164466,
                "lng": -83.710763
            },
            "Clinton": {
                "lat": 36.729124,
                "lng": -85.153499
            },
            "Crittenden": {
                "lat": 37.358149,
                "lng": -88.10501
            },
            "Cumberland": {
                "lat": 36.784227,
                "lng": -85.393499
            },
            "Daviess": {
                "lat": 37.731671,
                "lng": -87.087139
            },
            "Edmonson": {
                "lat": 37.227856,
                "lng": -86.217778
            },
            "Elliott": {
                "lat": 38.116425,
                "lng": -83.097541
            },
            "Estill": {
                "lat": 37.69246,
                "lng": -83.963927
            },
            "Fayette": {
                "lat": 38.040157,
                "lng": -84.458443
            },
            "Fleming": {
                "lat": 38.368431,
                "lng": -83.706152
            },
            "Floyd": {
                "lat": 37.558283,
                "lng": -82.740337
            },
            "Franklin": {
                "lat": 38.234919,
                "lng": -84.868786
            },
            "Fulton": {
                "lat": 36.55262,
                "lng": -89.187723
            },
            "Gallatin": {
                "lat": 38.760184,
                "lng": -84.862114
            },
            "Garrard": {
                "lat": 37.630162,
                "lng": -84.545856
            },
            "Grant": {
                "lat": 38.64921,
                "lng": -84.625946
            },
            "Graves": {
                "lat": 36.723344,
                "lng": -88.649897
            },
            "Grayson": {
                "lat": 37.458577,
                "lng": -86.344011
            },
            "Green": {
                "lat": 37.269637,
                "lng": -85.561403
            },
            "Greenup": {
                "lat": 38.563596,
                "lng": -82.933833
            },
            "Hancock": {
                "lat": 37.843389,
                "lng": -86.792773
            },
            "Hardin": {
                "lat": 37.695836,
                "lng": -85.963183
            },
            "Harlan": {
                "lat": 36.859223,
                "lng": -83.221497
            },
            "Harrison": {
                "lat": 38.443489,
                "lng": -84.332796
            },
            "Hart": {
                "lat": 37.313856,
                "lng": -85.881995
            },
            "Henderson": {
                "lat": 37.792542,
                "lng": -87.572577
            },
            "Henry": {
                "lat": 38.451561,
                "lng": -85.120079
            },
            "Hickman": {
                "lat": 36.675916,
                "lng": -88.97202
            },
            "Hopkins": {
                "lat": 37.31107,
                "lng": -87.542196
            },
            "Jackson": {
                "lat": 37.40332,
                "lng": -84.020686
            },
            "Jefferson": {
                "lat": 38.189533,
                "lng": -85.657624
            },
            "Jessamine": {
                "lat": 37.873291,
                "lng": -84.58396
            },
            "Johnson": {
                "lat": 37.84926,
                "lng": -82.830639
            },
            "Kenton": {
                "lat": 38.930477,
                "lng": -84.533492
            },
            "Knott": {
                "lat": 37.354703,
                "lng": -82.949138
            },
            "Knox": {
                "lat": 36.887476,
                "lng": -83.85563
            },
            "Larue": {
                "lat": 37.545518,
                "lng": -85.697209
            },
            "Laurel": {
                "lat": 37.113268,
                "lng": -84.119395
            },
            "Lawrence": {
                "lat": 38.074459,
                "lng": -82.738305
            },
            "Lee": {
                "lat": 37.605383,
                "lng": -83.718497
            },
            "Leslie": {
                "lat": 37.087846,
                "lng": -83.388616
            },
            "Letcher": {
                "lat": 37.118503,
                "lng": -82.861175
            },
            "Lewis": {
                "lat": 38.532051,
                "lng": -83.373303
            },
            "Lincoln": {
                "lat": 37.457257,
                "lng": -84.658074
            },
            "Livingston": {
                "lat": 37.209517,
                "lng": -88.363426
            },
            "Logan": {
                "lat": 36.859829,
                "lng": -86.881436
            },
            "Lyon": {
                "lat": 37.023976,
                "lng": -88.083391
            },
            "McCracken": {
                "lat": 37.053688,
                "lng": -88.712378
            },
            "McCreary": {
                "lat": 36.731136,
                "lng": -84.491052
            },
            "McLean": {
                "lat": 37.530575,
                "lng": -87.262931
            },
            "Madison": {
                "lat": 37.723528,
                "lng": -84.277008
            },
            "Magoffin": {
                "lat": 37.698954,
                "lng": -83.069716
            },
            "Marion": {
                "lat": 37.552247,
                "lng": -85.269242
            },
            "Marshall": {
                "lat": 36.882017,
                "lng": -88.332752
            },
            "Martin": {
                "lat": 37.796774,
                "lng": -82.506623
            },
            "Mason": {
                "lat": 38.594068,
                "lng": -83.828052
            },
            "Meade": {
                "lat": 37.967476,
                "lng": -86.200863
            },
            "Menifee": {
                "lat": 37.950715,
                "lng": -83.597345
            },
            "Mercer": {
                "lat": 37.812085,
                "lng": -84.879695
            },
            "Metcalfe": {
                "lat": 36.990394,
                "lng": -85.629554
            },
            "Monroe": {
                "lat": 36.714077,
                "lng": -85.713508
            },
            "Montgomery": {
                "lat": 38.038138,
                "lng": -83.912338
            },
            "Morgan": {
                "lat": 37.92294,
                "lng": -83.258944
            },
            "Muhlenberg": {
                "lat": 37.213816,
                "lng": -87.134092
            },
            "Nelson": {
                "lat": 37.803188,
                "lng": -85.465955
            },
            "Nicholas": {
                "lat": 38.337132,
                "lng": -84.025554
            },
            "Ohio": {
                "lat": 37.477859,
                "lng": -86.844871
            },
            "Oldham": {
                "lat": 38.400046,
                "lng": -85.456059
            },
            "Owen": {
                "lat": 38.499603,
                "lng": -84.841509
            },
            "Owsley": {
                "lat": 37.423452,
                "lng": -83.691566
            },
            "Pendleton": {
                "lat": 38.690765,
                "lng": -84.354041
            },
            "Perry": {
                "lat": 37.241282,
                "lng": -83.217772
            },
            "Pike": {
                "lat": 37.482067,
                "lng": -82.402869
            },
            "Powell": {
                "lat": 37.810379,
                "lng": -83.826985
            },
            "Pulaski": {
                "lat": 37.108312,
                "lng": -84.579986
            },
            "Robertson": {
                "lat": 38.513826,
                "lng": -84.063757
            },
            "Rockcastle": {
                "lat": 37.36122,
                "lng": -84.314419
            },
            "Rowan": {
                "lat": 38.205894,
                "lng": -83.425969
            },
            "Russell": {
                "lat": 36.989127,
                "lng": -85.058976
            },
            "Scott": {
                "lat": 38.289882,
                "lng": -84.579376
            },
            "Shelby": {
                "lat": 38.239426,
                "lng": -85.22836
            },
            "Simpson": {
                "lat": 36.740863,
                "lng": -86.581464
            },
            "Spencer": {
                "lat": 38.026976,
                "lng": -85.321525
            },
            "Taylor": {
                "lat": 37.365106,
                "lng": -85.326698
            },
            "Todd": {
                "lat": 36.840338,
                "lng": -87.183642
            },
            "Trigg": {
                "lat": 36.807681,
                "lng": -87.858652
            },
            "Trimble": {
                "lat": 38.618193,
                "lng": -85.355171
            },
            "Union": {
                "lat": 37.658029,
                "lng": -87.95165
            },
            "Warren": {
                "lat": 36.995634,
                "lng": -86.423579
            },
            "Washington": {
                "lat": 37.754209,
                "lng": -85.175416
            },
            "Wayne": {
                "lat": 36.802011,
                "lng": -84.83044
            },
            "Webster": {
                "lat": 37.520021,
                "lng": -87.685095
            },
            "Whitley": {
                "lat": 36.758021,
                "lng": -84.14455
            },
            "Wolfe": {
                "lat": 37.743774,
                "lng": -83.495068
            },
            "Woodford": {
                "lat": 38.042789,
                "lng": -84.748147
            }
        },
        "cities": {
            "Bowling Green": {
                "lat": 36.9903199,
                "lng": -86.4436018
            },
            "Lexington": {
                "lat": 38.0405837,
                "lng": -84.5037164
            },
            "Louisville": {
                "lat": 38.2526647,
                "lng": -85.7584557
            },
            "Owensboro": {
                "lat": 37.7719074,
                "lng": -87.1111676
            }
        },
        "center": {
            "lat": 37.669,
            "lng": -84.6514
        }
    },
    "CT": {
        "counties": {
            "Fairfield": {
                "lat": 41.228103,
                "lng": -73.366757
            },
            "Hartford": {
                "lat": 41.806053,
                "lng": -72.732916
            },
            "Litchfield": {
                "lat": 41.791897,
                "lng": -73.235428
            },
            "Middlesex": {
                "lat": 41.434525,
                "lng": -72.524227
            },
            "New Haven": {
                "lat": 41.349717,
                "lng": -72.900204
            },
            "New London": {
                "lat": 41.47863,
                "lng": -72.103452
            },
            "Tolland": {
                "lat": 41.858076,
                "lng": -72.340977
            },
            "Windham": {
                "lat": 41.824999,
                "lng": -71.990702
            }
        },
        "cities": {
            "Bridgeport": {
                "lat": 41.1865478,
                "lng": -73.19517669999999
            },
            "Bristol": {
                "lat": 41.67176480000001,
                "lng": -72.9492703
            },
            "Danbury": {
                "lat": 41.394817,
                "lng": -73.4540111
            },
            "East Hartford": {
                "lat": 41.7634219,
                "lng": -72.6128339
            },
            "Hartford": {
                "lat": 41.76371109999999,
                "lng": -72.6850932
            },
            "Meriden": {
                "lat": 41.5381535,
                "lng": -72.80704349999999
            },
            "Middletown": {
                "lat": 41.5623209,
                "lng": -72.6506488
            },
            "Milford": {
                "lat": 41.2308945,
                "lng": -73.0635844
            },
            "New Britain": {
                "lat": 41.6612104,
                "lng": -72.7795419
            },
            "New Haven": {
                "lat": 41.3081527,
                "lng": -72.9281577
            },
            "Norwalk": {
                "lat": 41.1175966,
                "lng": -73.40789680000002
            },
            "Stamford": {
                "lat": 41.0534302,
                "lng": -73.5387341
            },
            "Stratford": {
                "lat": 41.18454149999999,
                "lng": -73.1331651
            },
            "Waterbury": {
                "lat": 41.5581525,
                "lng": -73.0514965
            },
            "West Hartford": {
                "lat": 41.7620842,
                "lng": -72.7420151
            },
            "West Haven": {
                "lat": 41.2706527,
                "lng": -72.94704709999999
            }
        },
        "center": {
            "lat": 41.5834,
            "lng": -72.7622
        }
    },
    "OK": {
        "counties": {
            "Adair": {
                "lat": 35.8975,
                "lng": -94.651671
            },
            "Alfalfa": {
                "lat": 36.729703,
                "lng": -98.323445
            },
            "Atoka": {
                "lat": 34.374813,
                "lng": -96.034705
            },
            "Beaver": {
                "lat": 36.748334,
                "lng": -100.483056
            },
            "Beckham": {
                "lat": 35.273945,
                "lng": -99.671638
            },
            "Blaine": {
                "lat": 35.877782,
                "lng": -98.428934
            },
            "Bryan": {
                "lat": 33.964004,
                "lng": -96.264137
            },
            "Caddo": {
                "lat": 35.16792,
                "lng": -98.381045
            },
            "Canadian": {
                "lat": 35.543416,
                "lng": -97.979836
            },
            "Carter": {
                "lat": 34.251848,
                "lng": -97.287927
            },
            "Cherokee": {
                "lat": 35.904367,
                "lng": -94.996796
            },
            "Choctaw": {
                "lat": 34.027645,
                "lng": -95.554208
            },
            "Cimarron": {
                "lat": 36.755276,
                "lng": -102.508735
            },
            "Cleveland": {
                "lat": 35.203117,
                "lng": -97.328332
            },
            "Coal": {
                "lat": 34.582861,
                "lng": -96.288039
            },
            "Comanche": {
                "lat": 34.662628,
                "lng": -98.476597
            },
            "Cotton": {
                "lat": 34.290676,
                "lng": -98.373438
            },
            "Craig": {
                "lat": 36.76389,
                "lng": -95.201553
            },
            "Creek": {
                "lat": 35.907732,
                "lng": -96.379793
            },
            "Custer": {
                "lat": 35.645601,
                "lng": -98.997386
            },
            "Delaware": {
                "lat": 36.393369,
                "lng": -94.808206
            },
            "Dewey": {
                "lat": 35.978433,
                "lng": -99.014094
            },
            "Ellis": {
                "lat": 36.224258,
                "lng": -99.750139
            },
            "Garfield": {
                "lat": 36.378273,
                "lng": -97.787729
            },
            "Garvin": {
                "lat": 34.70935,
                "lng": -97.312723
            },
            "Grady": {
                "lat": 35.021058,
                "lng": -97.88689
            },
            "Grant": {
                "lat": 36.788254,
                "lng": -97.788151
            },
            "Greer": {
                "lat": 34.935263,
                "lng": -99.552968
            },
            "Harmon": {
                "lat": 34.745971,
                "lng": -99.844194
            },
            "Harper": {
                "lat": 36.800456,
                "lng": -99.662842
            },
            "Haskell": {
                "lat": 35.232294,
                "lng": -95.109578
            },
            "Hughes": {
                "lat": 35.052934,
                "lng": -96.251183
            },
            "Jackson": {
                "lat": 34.593949,
                "lng": -99.41221
            },
            "Jefferson": {
                "lat": 34.105092,
                "lng": -97.838814
            },
            "Johnston": {
                "lat": 34.313455,
                "lng": -96.654255
            },
            "Kay": {
                "lat": 36.814842,
                "lng": -97.143755
            },
            "Kingfisher": {
                "lat": 35.949431,
                "lng": -97.934568
            },
            "Kiowa": {
                "lat": 34.921489,
                "lng": -98.981617
            },
            "Latimer": {
                "lat": 34.875137,
                "lng": -95.272263
            },
            "Le Flore": {
                "lat": 34.899642,
                "lng": -94.703491
            },
            "Lincoln": {
                "lat": 35.703118,
                "lng": -96.881392
            },
            "Logan": {
                "lat": 35.914151,
                "lng": -97.450764
            },
            "Love": {
                "lat": 33.957775,
                "lng": -97.245124
            },
            "McClain": {
                "lat": 35.016414,
                "lng": -97.449811
            },
            "McCurtain": {
                "lat": 34.117073,
                "lng": -94.766086
            },
            "McIntosh": {
                "lat": 35.369092,
                "lng": -95.671764
            },
            "Major": {
                "lat": 36.313119,
                "lng": -98.542015
            },
            "Marshall": {
                "lat": 34.027007,
                "lng": -96.770533
            },
            "Mayes": {
                "lat": 36.303804,
                "lng": -95.235638
            },
            "Murray": {
                "lat": 34.485766,
                "lng": -97.071557
            },
            "Muskogee": {
                "lat": 35.617551,
                "lng": -95.383911
            },
            "Noble": {
                "lat": 36.384901,
                "lng": -97.236335
            },
            "Nowata": {
                "lat": 36.789615,
                "lng": -95.613312
            },
            "Okfuskee": {
                "lat": 35.466804,
                "lng": -96.327762
            },
            "Oklahoma": {
                "lat": 35.554611,
                "lng": -97.409401
            },
            "Okmulgee": {
                "lat": 35.646879,
                "lng": -95.96458
            },
            "Osage": {
                "lat": 36.62468,
                "lng": -96.408385
            },
            "Ottawa": {
                "lat": 36.835764,
                "lng": -94.802681
            },
            "Pawnee": {
                "lat": 36.313704,
                "lng": -96.696669
            },
            "Payne": {
                "lat": 36.079225,
                "lng": -96.975255
            },
            "Pittsburg": {
                "lat": 34.92554,
                "lng": -95.74813
            },
            "Pontotoc": {
                "lat": 34.721071,
                "lng": -96.692738
            },
            "Pottawatomie": {
                "lat": 35.211393,
                "lng": -96.957007
            },
            "Pushmataha": {
                "lat": 34.377896,
                "lng": -95.408085
            },
            "Roger Mills": {
                "lat": 35.708554,
                "lng": -99.741572
            },
            "Rogers": {
                "lat": 36.378082,
                "lng": -95.601337
            },
            "Seminole": {
                "lat": 35.158366,
                "lng": -96.602858
            },
            "Sequoyah": {
                "lat": 35.502435,
                "lng": -94.750757
            },
            "Stephens": {
                "lat": 34.481361,
                "lng": -97.855607
            },
            "Texas": {
                "lat": 36.741964,
                "lng": -101.488434
            },
            "Tillman": {
                "lat": 34.371085,
                "lng": -98.931701
            },
            "Tulsa": {
                "lat": 36.120121,
                "lng": -95.941731
            },
            "Wagoner": {
                "lat": 35.963479,
                "lng": -95.5141
            },
            "Washington": {
                "lat": 36.70438,
                "lng": -95.906155
            },
            "Washita": {
                "lat": 35.290177,
                "lng": -98.991962
            },
            "Woods": {
                "lat": 36.765141,
                "lng": -98.868967
            },
            "Woodward": {
                "lat": 36.425619,
                "lng": -99.273661
            }
        },
        "cities": {
            "Broken Arrow": {
                "lat": 36.0525993,
                "lng": -95.7908195
            },
            "Edmond": {
                "lat": 35.6528323,
                "lng": -97.47809540000002
            },
            "Enid": {
                "lat": 36.3955891,
                "lng": -97.8783911
            },
            "Lawton": {
                "lat": 34.6086854,
                "lng": -98.39033049999999
            },
            "Midwest City": {
                "lat": 35.4495065,
                "lng": -97.3967019
            },
            "Moore": {
                "lat": 35.3395079,
                "lng": -97.48670279999999
            },
            "Norman": {
                "lat": 35.2225668,
                "lng": -97.4394777
            },
            "Oklahoma City": {
                "lat": 35.5006256,
                "lng": -97.6114217
            },
            "Stillwater": {
                "lat": 36.1156071,
                "lng": -97.0583681
            },
            "Tulsa": {
                "lat": 36.1539816,
                "lng": -95.99277500000001
            }
        },
        "center": {
            "lat": 35.5376,
            "lng": -96.9247
        }
    },
    "VT": {
        "counties": {
            "Addison": {
                "lat": 44.031248,
                "lng": -73.141581
            },
            "Bennington": {
                "lat": 43.035325,
                "lng": -73.11146
            },
            "Caledonia": {
                "lat": 44.468791,
                "lng": -72.112168
            },
            "Chittenden": {
                "lat": 44.460676,
                "lng": -73.070525
            },
            "Essex": {
                "lat": 44.724021,
                "lng": -71.732736
            },
            "Franklin": {
                "lat": 44.858964,
                "lng": -72.909402
            },
            "Grand Isle": {
                "lat": 44.801788,
                "lng": -73.300758
            },
            "Lamoille": {
                "lat": 44.603504,
                "lng": -72.638356
            },
            "Orange": {
                "lat": 44.003392,
                "lng": -72.369687
            },
            "Orleans": {
                "lat": 44.828442,
                "lng": -72.25163
            },
            "Rutland": {
                "lat": 43.580844,
                "lng": -73.038196
            },
            "Washington": {
                "lat": 44.274953,
                "lng": -72.609475
            },
            "Windham": {
                "lat": 42.999143,
                "lng": -72.716335
            },
            "Windsor": {
                "lat": 43.588143,
                "lng": -72.591515
            }
        },
        "cities": {
            "Burlington": {
                "lat": 44.4758825,
                "lng": -73.21207199999999
            }
        },
        "center": {
            "lat": 44.0407,
            "lng": -72.7093
        }
    },
    "WY": {
        "counties": {
            "Albany": {
                "lat": 41.665514,
                "lng": -105.721883
            },
            "Big Horn": {
                "lat": 44.525654,
                "lng": -107.993321
            },
            "Campbell": {
                "lat": 44.241321,
                "lng": -105.552029
            },
            "Carbon": {
                "lat": 41.70359,
                "lng": -106.933153
            },
            "Converse": {
                "lat": 42.972839,
                "lng": -105.507367
            },
            "Crook": {
                "lat": 44.589266,
                "lng": -104.567298
            },
            "Fremont": {
                "lat": 43.055303,
                "lng": -108.605531
            },
            "Goshen": {
                "lat": 42.08958,
                "lng": -104.353482
            },
            "Hot Springs": {
                "lat": 43.720871,
                "lng": -108.435652
            },
            "Johnson": {
                "lat": 44.044048,
                "lng": -106.588541
            },
            "Laramie": {
                "lat": 41.29283,
                "lng": -104.660395
            },
            "Lincoln": {
                "lat": 42.228788,
                "lng": -110.679842
            },
            "Natrona": {
                "lat": 42.973641,
                "lng": -106.764877
            },
            "Niobrara": {
                "lat": 43.062159,
                "lng": -104.468373
            },
            "Park": {
                "lat": 44.492387,
                "lng": -109.593598
            },
            "Platte": {
                "lat": 42.130319,
                "lng": -104.960809
            },
            "Sheridan": {
                "lat": 44.781369,
                "lng": -106.881211
            },
            "Sublette": {
                "lat": 42.767928,
                "lng": -109.91617
            },
            "Sweetwater": {
                "lat": 41.660339,
                "lng": -108.875676
            },
            "Teton": {
                "lat": 44.049321,
                "lng": -110.588102
            },
            "Uinta": {
                "lat": 41.284726,
                "lng": -110.558947
            },
            "Washakie": {
                "lat": 43.878831,
                "lng": -107.669052
            },
            "Weston": {
                "lat": 43.846213,
                "lng": -104.57002
            }
        },
        "cities": {
            "Casper": {
                "lat": 42.866632,
                "lng": -106.313081
            },
            "Cheyenne": {
                "lat": 41.1399814,
                "lng": -104.8202462
            }
        },
        "center": {
            "lat": 42.7475,
            "lng": -107.2085
        }
    },
    "SC": {
        "counties": {
            "Abbeville": {
                "lat": 34.213809,
                "lng": -82.46046
            },
            "Aiken": {
                "lat": 33.549317,
                "lng": -81.63387
            },
            "Allendale": {
                "lat": 32.979784,
                "lng": -81.363421
            },
            "Anderson": {
                "lat": 34.519549,
                "lng": -82.638086
            },
            "Bamberg": {
                "lat": 33.203021,
                "lng": -81.053161
            },
            "Barnwell": {
                "lat": 33.26068,
                "lng": -81.433753
            },
            "Beaufort": {
                "lat": 32.358147,
                "lng": -80.68932
            },
            "Berkeley": {
                "lat": 33.2077,
                "lng": -79.953655
            },
            "Calhoun": {
                "lat": 33.67478,
                "lng": -80.780347
            },
            "Charleston": {
                "lat": 32.800458,
                "lng": -79.94248
            },
            "Cherokee": {
                "lat": 35.049796,
                "lng": -81.607647
            },
            "Chester": {
                "lat": 34.689345,
                "lng": -81.161249
            },
            "Chesterfield": {
                "lat": 34.637018,
                "lng": -80.159227
            },
            "Clarendon": {
                "lat": 33.664682,
                "lng": -80.217889
            },
            "Colleton": {
                "lat": 32.83498,
                "lng": -80.655345
            },
            "Darlington": {
                "lat": 34.332185,
                "lng": -79.962116
            },
            "Dillon": {
                "lat": 34.390172,
                "lng": -79.374964
            },
            "Dorchester": {
                "lat": 33.082186,
                "lng": -80.404697
            },
            "Edgefield": {
                "lat": 33.776498,
                "lng": -81.968245
            },
            "Fairfield": {
                "lat": 34.395669,
                "lng": -81.127001
            },
            "Florence": {
                "lat": 34.028535,
                "lng": -79.710233
            },
            "Georgetown": {
                "lat": 33.41753,
                "lng": -79.300812
            },
            "Greenville": {
                "lat": 34.892645,
                "lng": -82.372077
            },
            "Greenwood": {
                "lat": 34.155796,
                "lng": -82.127876
            },
            "Hampton": {
                "lat": 32.778323,
                "lng": -81.143362
            },
            "Horry": {
                "lat": 33.909269,
                "lng": -78.976675
            },
            "Jasper": {
                "lat": 32.43059,
                "lng": -81.021627
            },
            "Kershaw": {
                "lat": 34.338356,
                "lng": -80.590885
            },
            "Lancaster": {
                "lat": 34.686818,
                "lng": -80.703689
            },
            "Laurens": {
                "lat": 34.483477,
                "lng": -82.005657
            },
            "Lee": {
                "lat": 34.15864,
                "lng": -80.251209
            },
            "Lexington": {
                "lat": 33.892554,
                "lng": -81.272853
            },
            "McCormick": {
                "lat": 33.897605,
                "lng": -82.316192
            },
            "Marion": {
                "lat": 34.080701,
                "lng": -79.362131
            },
            "Marlboro": {
                "lat": 34.601805,
                "lng": -79.677942
            },
            "Newberry": {
                "lat": 34.28973,
                "lng": -81.600053
            },
            "Oconee": {
                "lat": 34.748759,
                "lng": -83.061522
            },
            "Orangeburg": {
                "lat": 33.436135,
                "lng": -80.802913
            },
            "Pickens": {
                "lat": 34.887362,
                "lng": -82.725368
            },
            "Richland": {
                "lat": 34.029783,
                "lng": -80.896566
            },
            "Saluda": {
                "lat": 34.005278,
                "lng": -81.727903
            },
            "Spartanburg": {
                "lat": 34.933239,
                "lng": -81.991053
            },
            "Sumter": {
                "lat": 33.916046,
                "lng": -80.382472
            },
            "Union": {
                "lat": 34.690514,
                "lng": -81.615831
            },
            "Williamsburg": {
                "lat": 33.626463,
                "lng": -79.716475
            },
            "York": {
                "lat": 34.97019,
                "lng": -81.183189
            }
        },
        "cities": {
            "Charleston": {
                "lat": 32.7765656,
                "lng": -79.93092159999999
            },
            "Columbia": {
                "lat": 34.0007104,
                "lng": -81.0348144
            },
            "Greenville": {
                "lat": 34.85261759999999,
                "lng": -82.3940104
            },
            "Mt Pleasant": {
                "lat": 32.7940651,
                "lng": -79.8625851
            },
            "North Charleston": {
                "lat": 32.8546197,
                "lng": -79.9748103
            },
            "Rock Hill": {
                "lat": 34.9248667,
                "lng": -81.02507840000001
            },
            "Summerville": {
                "lat": 33.0185039,
                "lng": -80.17564809999999
            }
        },
        "center": {
            "lat": 33.8191,
            "lng": -80.9066
        }
    },
    "WV": {
        "counties": {
            "Barbour": {
                "lat": 39.139754,
                "lng": -79.996914
            },
            "Berkeley": {
                "lat": 39.457854,
                "lng": -78.032338
            },
            "Boone": {
                "lat": 38.022838,
                "lng": -81.713314
            },
            "Braxton": {
                "lat": 38.699302,
                "lng": -80.731649
            },
            "Brooke": {
                "lat": 40.272645,
                "lng": -80.578691
            },
            "Cabell": {
                "lat": 38.41958,
                "lng": -82.243392
            },
            "Calhoun": {
                "lat": 38.844159,
                "lng": -81.115478
            },
            "Clay": {
                "lat": 38.459826,
                "lng": -81.081866
            },
            "Doddridge": {
                "lat": 39.263482,
                "lng": -80.701147
            },
            "Fayette": {
                "lat": 38.030933,
                "lng": -81.086051
            },
            "Gilmer": {
                "lat": 38.915865,
                "lng": -80.849409
            },
            "Grant": {
                "lat": 39.105988,
                "lng": -79.195064
            },
            "Greenbrier": {
                "lat": 37.924418,
                "lng": -80.45059
            },
            "Hampshire": {
                "lat": 39.31214,
                "lng": -78.611989
            },
            "Hancock": {
                "lat": 40.516931,
                "lng": -80.570057
            },
            "Hardy": {
                "lat": 39.010818,
                "lng": -78.843641
            },
            "Harrison": {
                "lat": 39.279199,
                "lng": -80.386487
            },
            "Jackson": {
                "lat": 38.834234,
                "lng": -81.677717
            },
            "Jefferson": {
                "lat": 39.307399,
                "lng": -77.86322
            },
            "Kanawha": {
                "lat": 38.328061,
                "lng": -81.523522
            },
            "Lewis": {
                "lat": 38.988844,
                "lng": -80.495518
            },
            "Lincoln": {
                "lat": 38.171651,
                "lng": -82.077547
            },
            "Logan": {
                "lat": 37.830591,
                "lng": -81.940853
            },
            "McDowell": {
                "lat": 37.382663,
                "lng": -81.658205
            },
            "Marion": {
                "lat": 39.505839,
                "lng": -80.243402
            },
            "Marshall": {
                "lat": 39.854717,
                "lng": -80.671378
            },
            "Mason": {
                "lat": 38.759288,
                "lng": -82.024172
            },
            "Mercer": {
                "lat": 37.403448,
                "lng": -81.106456
            },
            "Mineral": {
                "lat": 39.405626,
                "lng": -78.956581
            },
            "Mingo": {
                "lat": 37.721151,
                "lng": -82.158993
            },
            "Monongalia": {
                "lat": 39.633645,
                "lng": -80.059074
            },
            "Monroe": {
                "lat": 37.550353,
                "lng": -80.547891
            },
            "Morgan": {
                "lat": 39.554835,
                "lng": -78.257314
            },
            "Nicholas": {
                "lat": 38.291416,
                "lng": -80.797516
            },
            "Ohio": {
                "lat": 40.098932,
                "lng": -80.620728
            },
            "Pendleton": {
                "lat": 38.686836,
                "lng": -79.333707
            },
            "Pleasants": {
                "lat": 39.368133,
                "lng": -81.161172
            },
            "Pocahontas": {
                "lat": 38.332513,
                "lng": -80.012092
            },
            "Preston": {
                "lat": 39.46903,
                "lng": -79.668865
            },
            "Putnam": {
                "lat": 38.510513,
                "lng": -81.906109
            },
            "Raleigh": {
                "lat": 37.76247,
                "lng": -81.264671
            },
            "Randolph": {
                "lat": 38.781087,
                "lng": -79.867783
            },
            "Ritchie": {
                "lat": 39.177112,
                "lng": -81.066317
            },
            "Roane": {
                "lat": 38.743033,
                "lng": -81.354502
            },
            "Summers": {
                "lat": 37.656003,
                "lng": -80.856315
            },
            "Taylor": {
                "lat": 39.329072,
                "lng": -80.045629
            },
            "Tucker": {
                "lat": 39.111175,
                "lng": -79.559968
            },
            "Tyler": {
                "lat": 39.465981,
                "lng": -80.879493
            },
            "Upshur": {
                "lat": 38.902537,
                "lng": -80.231335
            },
            "Wayne": {
                "lat": 38.145531,
                "lng": -82.419698
            },
            "Webster": {
                "lat": 38.492985,
                "lng": -80.430262
            },
            "Wetzel": {
                "lat": 39.596574,
                "lng": -80.634394
            },
            "Wirt": {
                "lat": 39.020034,
                "lng": -81.382975
            },
            "Wood": {
                "lat": 39.211679,
                "lng": -81.515928
            },
            "Wyoming": {
                "lat": 37.603717,
                "lng": -81.548884
            }
        },
        "cities": {
            "Charleston": {
                "lat": 38.3498195,
                "lng": -81.6326234
            },
            "Huntington": {
                "lat": 38.4192496,
                "lng": -82.44515400000002
            }
        },
        "center": {
            "lat": 38.468,
            "lng": -80.9696
        }
    },
    "NH": {
        "counties": {
            "Belknap": {
                "lat": 43.519109,
                "lng": -71.425366
            },
            "Carroll": {
                "lat": 43.867567,
                "lng": -71.201665
            },
            "Cheshire": {
                "lat": 42.925455,
                "lng": -72.248217
            },
            "Coos": {
                "lat": 44.652419,
                "lng": -71.289383
            },
            "Grafton": {
                "lat": 43.926488,
                "lng": -71.842264
            },
            "Hillsborough": {
                "lat": 42.911643,
                "lng": -71.723101
            },
            "Merrimack": {
                "lat": 43.299485,
                "lng": -71.68013
            },
            "Rockingham": {
                "lat": 42.98936,
                "lng": -71.099437
            },
            "Strafford": {
                "lat": 43.293177,
                "lng": -71.035927
            },
            "Sullivan": {
                "lat": 43.361188,
                "lng": -72.222084
            }
        },
        "cities": {
            "Concord": {
                "lat": 43.2081366,
                "lng": -71.5375718
            },
            "Manchester": {
                "lat": 42.9956397,
                "lng": -71.4547891
            },
            "Nashua": {
                "lat": 42.7653662,
                "lng": -71.46756599999999
            }
        },
        "center": {
            "lat": 43.4108,
            "lng": -71.5653
        }
    },
    "AR": {
        "counties": {
            "Arkansas": {
                "lat": 34.289574,
                "lng": -91.376547
            },
            "Ashley": {
                "lat": 33.190835,
                "lng": -91.772267
            },
            "Baxter": {
                "lat": 36.28071,
                "lng": -92.330438
            },
            "Benton": {
                "lat": 36.337825,
                "lng": -94.256187
            },
            "Boone": {
                "lat": 36.304308,
                "lng": -93.079204
            },
            "Bradley": {
                "lat": 33.463819,
                "lng": -92.168164
            },
            "Calhoun": {
                "lat": 33.56046,
                "lng": -92.513879
            },
            "Carroll": {
                "lat": 36.337774,
                "lng": -93.541663
            },
            "Chicot": {
                "lat": 33.267139,
                "lng": -91.297158
            },
            "Clark": {
                "lat": 34.053312,
                "lng": -93.176205
            },
            "Clay": {
                "lat": 36.367302,
                "lng": -90.418704
            },
            "Cleburne": {
                "lat": 35.566288,
                "lng": -92.059974
            },
            "Cleveland": {
                "lat": 33.893201,
                "lng": -92.188714
            },
            "Columbia": {
                "lat": 33.21507,
                "lng": -93.226901
            },
            "Conway": {
                "lat": 35.265702,
                "lng": -92.689248
            },
            "Craighead": {
                "lat": 35.828268,
                "lng": -90.630411
            },
            "Crawford": {
                "lat": 35.583041,
                "lng": -94.236224
            },
            "Crittenden": {
                "lat": 35.211878,
                "lng": -90.315331
            },
            "Cross": {
                "lat": 35.291259,
                "lng": -90.773894
            },
            "Dallas": {
                "lat": 33.967823,
                "lng": -92.653999
            },
            "Desha": {
                "lat": 33.828748,
                "lng": -91.244427
            },
            "Drew": {
                "lat": 33.587242,
                "lng": -91.722778
            },
            "Faulkner": {
                "lat": 35.146356,
                "lng": -92.324654
            },
            "Franklin": {
                "lat": 35.508573,
                "lng": -93.887672
            },
            "Fulton": {
                "lat": 36.383443,
                "lng": -91.819239
            },
            "Garland": {
                "lat": 34.578861,
                "lng": -93.146915
            },
            "Grant": {
                "lat": 34.288063,
                "lng": -92.423984
            },
            "Greene": {
                "lat": 36.119922,
                "lng": -90.565241
            },
            "Hempstead": {
                "lat": 33.728611,
                "lng": -93.665809
            },
            "Hot Spring": {
                "lat": 34.315177,
                "lng": -92.944147
            },
            "Howard": {
                "lat": 34.083179,
                "lng": -93.990988
            },
            "Independence": {
                "lat": 35.737499,
                "lng": -91.559942
            },
            "Izard": {
                "lat": 36.094879,
                "lng": -91.913625
            },
            "Jackson": {
                "lat": 35.596605,
                "lng": -91.223178
            },
            "Jefferson": {
                "lat": 34.277696,
                "lng": -91.930701
            },
            "Johnson": {
                "lat": 35.573359,
                "lng": -93.466322
            },
            "Lafayette": {
                "lat": 33.24066,
                "lng": -93.611643
            },
            "Lawrence": {
                "lat": 36.041098,
                "lng": -91.101153
            },
            "Lee": {
                "lat": 34.77975,
                "lng": -90.779288
            },
            "Lincoln": {
                "lat": 33.957665,
                "lng": -91.727624
            },
            "Little River": {
                "lat": 33.699497,
                "lng": -94.229774
            },
            "Logan": {
                "lat": 35.21855,
                "lng": -93.720563
            },
            "Lonoke": {
                "lat": 34.755114,
                "lng": -91.894132
            },
            "Madison": {
                "lat": 36.012545,
                "lng": -93.724053
            },
            "Marion": {
                "lat": 36.266656,
                "lng": -92.678588
            },
            "Miller": {
                "lat": 33.305505,
                "lng": -93.901509
            },
            "Mississippi": {
                "lat": 35.766943,
                "lng": -90.052209
            },
            "Monroe": {
                "lat": 34.679513,
                "lng": -91.203314
            },
            "Montgomery": {
                "lat": 34.545652,
                "lng": -93.664147
            },
            "Nevada": {
                "lat": 33.666699,
                "lng": -93.305072
            },
            "Newton": {
                "lat": 35.910063,
                "lng": -93.215084
            },
            "Ouachita": {
                "lat": 33.591158,
                "lng": -92.878418
            },
            "Perry": {
                "lat": 34.946363,
                "lng": -92.926877
            },
            "Phillips": {
                "lat": 34.425842,
                "lng": -90.848386
            },
            "Pike": {
                "lat": 34.158191,
                "lng": -93.658659
            },
            "Poinsett": {
                "lat": 35.568981,
                "lng": -90.680595
            },
            "Polk": {
                "lat": 34.490915,
                "lng": -94.230884
            },
            "Pope": {
                "lat": 35.455297,
                "lng": -93.031535
            },
            "Prairie": {
                "lat": 34.828225,
                "lng": -91.5572
            },
            "Pulaski": {
                "lat": 34.773988,
                "lng": -92.316515
            },
            "Randolph": {
                "lat": 36.341299,
                "lng": -91.028441
            },
            "St. Francis": {
                "lat": 35.014438,
                "lng": -90.742199
            },
            "Saline": {
                "lat": 34.648525,
                "lng": -92.674463
            },
            "Scott": {
                "lat": 34.858869,
                "lng": -94.063641
            },
            "Searcy": {
                "lat": 35.90966,
                "lng": -92.699351
            },
            "Sebastian": {
                "lat": 35.196981,
                "lng": -94.274989
            },
            "Sevier": {
                "lat": 33.994608,
                "lng": -94.24329
            },
            "Sharp": {
                "lat": 36.173399,
                "lng": -91.471069
            },
            "Stone": {
                "lat": 35.856989,
                "lng": -92.140494
            },
            "Union": {
                "lat": 33.168219,
                "lng": -92.598145
            },
            "Van Buren": {
                "lat": 35.582959,
                "lng": -92.515977
            },
            "Washington": {
                "lat": 35.971209,
                "lng": -94.218417
            },
            "White": {
                "lat": 35.254722,
                "lng": -91.753158
            },
            "Woodruff": {
                "lat": 35.189071,
                "lng": -91.244418
            },
            "Yell": {
                "lat": 34.997713,
                "lng": -93.408303
            }
        },
        "cities": {
            "Conway": {
                "lat": 35.0886963,
                "lng": -92.4421011
            },
            "Fayetteville": {
                "lat": 36.0625795,
                "lng": -94.1574263
            },
            "Fort Smith": {
                "lat": 35.3859242,
                "lng": -94.39854749999999
            },
            "Jonesboro": {
                "lat": 35.84229670000001,
                "lng": -90.704279
            },
            "Little Rock": {
                "lat": 34.7464809,
                "lng": -92.28959479999999
            },
            "North Little Rock": {
                "lat": 34.769536,
                "lng": -92.2670941
            },
            "Pine Bluff": {
                "lat": 34.2284312,
                "lng": -92.00319549999999
            },
            "Rogers": {
                "lat": 36.3320196,
                "lng": -94.1185366
            },
            "Springdale": {
                "lat": 36.18674420000001,
                "lng": -94.1288141
            }
        },
        "center": {
            "lat": 34.9513,
            "lng": -92.3809
        }
    },
    "RI": {
        "counties": {
            "Bristol": {
                "lat": 41.705271,
                "lng": -71.285053
            },
            "Kent": {
                "lat": 41.67775,
                "lng": -71.576314
            },
            "Newport": {
                "lat": 41.502732,
                "lng": -71.284063
            },
            "Providence": {
                "lat": 41.870488,
                "lng": -71.578242
            },
            "Washington": {
                "lat": 41.401162,
                "lng": -71.617612
            }
        },
        "cities": {
            "Cranston": {
                "lat": 41.7798226,
                "lng": -71.4372796
            },
            "East Providence": {
                "lat": 41.8137116,
                "lng": -71.3700545
            },
            "Pawtucket": {
                "lat": 41.878711,
                "lng": -71.38255579999999
            },
            "Providence": {
                "lat": 41.8239891,
                "lng": -71.4128343
            },
            "Warwick": {
                "lat": 41.7001009,
                "lng": -71.4161671
            },
            "Woonsocket": {
                "lat": 42.00287609999999,
                "lng": -71.51478390000001
            }
        },
        "center": {
            "lat": 41.6772,
            "lng": -71.5101
        }
    },
    "HI": {
        "counties": {
            "Hawaiʻi": {
                "lat": 19.597764,
                "lng": -155.502443
            },
            "Honolulu": {
                "lat": 21.461364,
                "lng": -158.201976
            },
            "Kalawao": {
                "lat": 21.218764,
                "lng": -156.97401
            },
            "Kauaʻi": {
                "lat": 22.012038,
                "lng": -159.705965
            },
            "Maui": {
                "lat": 20.855931,
                "lng": -156.60155
            }
        },
        "cities": {
            "Honolulu": {
                "lat": 21.3069444,
                "lng": -157.8583333
            },
            "Hilo": {
                "lat": 19.5429151,
                "lng": -155.6658568
            },
            "Pearl City": {
                "lat": 21.3972222,
                "lng": -157.9733333
            }
        },
        "center": {
            "lat": 21.1098,
            "lng": -157.5311
        }
    },
    "NV": {
        "counties": {
            "Churchill": {
                "lat": 39.525701,
                "lng": -118.270419
            },
            "Clark": {
                "lat": 36.214236,
                "lng": -115.013819
            },
            "Douglas": {
                "lat": 38.905129,
                "lng": -119.609019
            },
            "Elko": {
                "lat": 41.141133,
                "lng": -115.351424
            },
            "Esmeralda": {
                "lat": 37.778966,
                "lng": -117.632382
            },
            "Eureka": {
                "lat": 39.977788,
                "lng": -116.272208
            },
            "Humboldt": {
                "lat": 41.407914,
                "lng": -118.127592
            },
            "Lander": {
                "lat": 39.900211,
                "lng": -117.04724
            },
            "Lincoln": {
                "lat": 37.634605,
                "lng": -114.863037
            },
            "Lyon": {
                "lat": 39.022214,
                "lng": -119.197417
            },
            "Mineral": {
                "lat": 38.516647,
                "lng": -118.416279
            },
            "Nye": {
                "lat": 37.966379,
                "lng": -116.459047
            },
            "Pershing": {
                "lat": 40.439639,
                "lng": -118.409477
            },
            "Storey": {
                "lat": 39.438385,
                "lng": -119.524646
            },
            "Washoe": {
                "lat": 40.703311,
                "lng": -119.710315
            },
            "White Pine": {
                "lat": 39.417804,
                "lng": -114.900945
            },
            "Carson City": {
                "lat": 39.153447,
                "lng": -119.743442
            }
        },
        "cities": {
            "Enterprise": {
                "lat": 36.0252503,
                "lng": -115.2419419
            },
            "Henderson": {
                "lat": 36.0395247,
                "lng": -114.9817213
            },
            "Las Vegas": {
                "lat": 36.114646,
                "lng": -115.172816
            },
            "North Las Vegas": {
                "lat": 36.1988592,
                "lng": -115.1175013
            },
            "Paradise": {
                "lat": 36.0971945,
                "lng": -115.1466648
            },
            "Reno": {
                "lat": 39.5296329,
                "lng": -119.8138027
            },
            "Sparks": {
                "lat": 39.5349112,
                "lng": -119.7526886
            },
            "Spring Valley": {
                "lat": 36.1080258,
                "lng": -115.2450006
            },
            "Sunrise Manor": {
                "lat": 36.2110819,
                "lng": -115.0730563
            },
            "Whitney": {
                "lat": 36.0966897,
                "lng": -115.0407412
            }
        },
        "center": {
            "lat": 38.4199,
            "lng": -117.1219
        }
    },
    "KS": {
        "counties": {
            "Allen": {
                "lat": 37.884229,
                "lng": -95.300945
            },
            "Anderson": {
                "lat": 38.215114,
                "lng": -95.292046
            },
            "Atchison": {
                "lat": 39.532544,
                "lng": -95.313398
            },
            "Barber": {
                "lat": 37.222906,
                "lng": -98.685052
            },
            "Barton": {
                "lat": 38.481239,
                "lng": -98.767837
            },
            "Bourbon": {
                "lat": 37.8561,
                "lng": -94.850928
            },
            "Brown": {
                "lat": 39.825931,
                "lng": -95.569905
            },
            "Butler": {
                "lat": 37.773681,
                "lng": -96.838762
            },
            "Chase": {
                "lat": 38.298553,
                "lng": -96.594064
            },
            "Chautauqua": {
                "lat": 37.154259,
                "lng": -96.245396
            },
            "Cherokee": {
                "lat": 37.169392,
                "lng": -94.845698
            },
            "Cheyenne": {
                "lat": 39.789256,
                "lng": -101.727302
            },
            "Clark": {
                "lat": 37.233831,
                "lng": -99.813869
            },
            "Clay": {
                "lat": 39.344964,
                "lng": -97.168853
            },
            "Cloud": {
                "lat": 39.487329,
                "lng": -97.64139
            },
            "Coffey": {
                "lat": 38.23645,
                "lng": -95.729137
            },
            "Comanche": {
                "lat": 37.189071,
                "lng": -99.254089
            },
            "Cowley": {
                "lat": 37.234507,
                "lng": -96.837247
            },
            "Crawford": {
                "lat": 37.505628,
                "lng": -94.853941
            },
            "Decatur": {
                "lat": 39.783542,
                "lng": -100.459708
            },
            "Dickinson": {
                "lat": 38.867735,
                "lng": -97.157943
            },
            "Doniphan": {
                "lat": 39.788502,
                "lng": -95.147225
            },
            "Douglas": {
                "lat": 38.896573,
                "lng": -95.290529
            },
            "Edwards": {
                "lat": 37.883595,
                "lng": -99.304746
            },
            "Elk": {
                "lat": 37.456026,
                "lng": -96.244642
            },
            "Ellis": {
                "lat": 38.914596,
                "lng": -99.317329
            },
            "Ellsworth": {
                "lat": 38.700845,
                "lng": -98.205355
            },
            "Finney": {
                "lat": 38.049855,
                "lng": -100.739929
            },
            "Ford": {
                "lat": 37.688365,
                "lng": -99.884734
            },
            "Franklin": {
                "lat": 38.558019,
                "lng": -95.278962
            },
            "Geary": {
                "lat": 39.002155,
                "lng": -96.768038
            },
            "Gove": {
                "lat": 38.917239,
                "lng": -100.48736
            },
            "Graham": {
                "lat": 39.349445,
                "lng": -99.880952
            },
            "Grant": {
                "lat": 37.547537,
                "lng": -101.299362
            },
            "Gray": {
                "lat": 37.744513,
                "lng": -100.451716
            },
            "Greeley": {
                "lat": 38.480408,
                "lng": -101.805984
            },
            "Greenwood": {
                "lat": 37.878659,
                "lng": -96.242232
            },
            "Hamilton": {
                "lat": 37.995244,
                "lng": -101.793689
            },
            "Harper": {
                "lat": 37.188184,
                "lng": -98.06659
            },
            "Harvey": {
                "lat": 38.050144,
                "lng": -97.436707
            },
            "Haskell": {
                "lat": 37.55855,
                "lng": -100.876869
            },
            "Hodgeman": {
                "lat": 38.087493,
                "lng": -99.898407
            },
            "Jackson": {
                "lat": 39.410989,
                "lng": -95.794509
            },
            "Jefferson": {
                "lat": 39.239644,
                "lng": -95.375314
            },
            "Jewell": {
                "lat": 39.77701,
                "lng": -98.222584
            },
            "Johnson": {
                "lat": 38.883907,
                "lng": -94.82233
            },
            "Kearny": {
                "lat": 37.994461,
                "lng": -101.308136
            },
            "Kingman": {
                "lat": 37.552951,
                "lng": -98.144529
            },
            "Kiowa": {
                "lat": 37.561231,
                "lng": -99.286539
            },
            "Labette": {
                "lat": 37.191468,
                "lng": -95.297473
            },
            "Lane": {
                "lat": 38.481286,
                "lng": -100.466185
            },
            "Leavenworth": {
                "lat": 39.189511,
                "lng": -95.038977
            },
            "Lincoln": {
                "lat": 39.047276,
                "lng": -98.214265
            },
            "Linn": {
                "lat": 38.216549,
                "lng": -94.844932
            },
            "Logan": {
                "lat": 38.91327,
                "lng": -101.157407
            },
            "Lyon": {
                "lat": 38.455498,
                "lng": -96.161589
            },
            "McPherson": {
                "lat": 38.395812,
                "lng": -97.647489
            },
            "Marion": {
                "lat": 38.359647,
                "lng": -97.102771
            },
            "Marshall": {
                "lat": 39.782709,
                "lng": -96.521243
            },
            "Meade": {
                "lat": 37.243886,
                "lng": -100.360094
            },
            "Miami": {
                "lat": 38.566772,
                "lng": -94.832963
            },
            "Mitchell": {
                "lat": 39.393026,
                "lng": -98.207362
            },
            "Montgomery": {
                "lat": 37.189537,
                "lng": -95.742403
            },
            "Morris": {
                "lat": 38.687696,
                "lng": -96.644905
            },
            "Morton": {
                "lat": 37.18525,
                "lng": -101.809516
            },
            "Nemaha": {
                "lat": 39.791043,
                "lng": -96.005381
            },
            "Neosho": {
                "lat": 37.564283,
                "lng": -95.315683
            },
            "Ness": {
                "lat": 38.480437,
                "lng": -99.908745
            },
            "Norton": {
                "lat": 39.783867,
                "lng": -99.899235
            },
            "Osage": {
                "lat": 38.649706,
                "lng": -95.727275
            },
            "Osborne": {
                "lat": 39.348649,
                "lng": -98.767876
            },
            "Ottawa": {
                "lat": 39.137963,
                "lng": -97.654803
            },
            "Pawnee": {
                "lat": 38.182873,
                "lng": -99.232154
            },
            "Phillips": {
                "lat": 39.784506,
                "lng": -99.34215
            },
            "Pottawatomie": {
                "lat": 39.382187,
                "lng": -96.337113
            },
            "Pratt": {
                "lat": 37.647594,
                "lng": -98.74012
            },
            "Rawlins": {
                "lat": 39.786198,
                "lng": -101.076738
            },
            "Reno": {
                "lat": 37.948185,
                "lng": -98.078346
            },
            "Republic": {
                "lat": 39.82891,
                "lng": -97.650921
            },
            "Rice": {
                "lat": 38.347178,
                "lng": -98.201415
            },
            "Riley": {
                "lat": 39.291211,
                "lng": -96.727489
            },
            "Rooks": {
                "lat": 39.346006,
                "lng": -99.324492
            },
            "Rush": {
                "lat": 38.523592,
                "lng": -99.309183
            },
            "Russell": {
                "lat": 38.916839,
                "lng": -98.765638
            },
            "Saline": {
                "lat": 38.786327,
                "lng": -97.650153
            },
            "Scott": {
                "lat": 38.481877,
                "lng": -100.90636
            },
            "Sedgwick": {
                "lat": 37.683807,
                "lng": -97.459451
            },
            "Seward": {
                "lat": 37.180585,
                "lng": -100.854741
            },
            "Shawnee": {
                "lat": 39.041805,
                "lng": -95.755664
            },
            "Sheridan": {
                "lat": 39.350543,
                "lng": -100.441206
            },
            "Sherman": {
                "lat": 39.351352,
                "lng": -101.719859
            },
            "Smith": {
                "lat": 39.78466,
                "lng": -98.78543
            },
            "Stafford": {
                "lat": 38.03563,
                "lng": -98.719889
            },
            "Stanton": {
                "lat": 37.565932,
                "lng": -101.789383
            },
            "Stevens": {
                "lat": 37.202356,
                "lng": -101.315796
            },
            "Sumner": {
                "lat": 37.236663,
                "lng": -97.493349
            },
            "Thomas": {
                "lat": 39.357706,
                "lng": -101.083439
            },
            "Trego": {
                "lat": 38.921302,
                "lng": -99.865423
            },
            "Wabaunsee": {
                "lat": 38.955154,
                "lng": -96.201262
            },
            "Wallace": {
                "lat": 38.926626,
                "lng": -101.771103
            },
            "Washington": {
                "lat": 39.776714,
                "lng": -97.095611
            },
            "Wichita": {
                "lat": 38.481922,
                "lng": -101.347434
            },
            "Wilson": {
                "lat": 37.558515,
                "lng": -95.745175
            },
            "Woodson": {
                "lat": 37.888484,
                "lng": -95.757553
            },
            "Wyandotte": {
                "lat": 39.115384,
                "lng": -94.763087
            }
        },
        "cities": {
            "Hutchinson": {
                "lat": 38.0608445,
                "lng": -97.92977429999999
            },
            "Kansas City": {
                "lat": 39.114053,
                "lng": -94.6274636
            },
            "Lawrence": {
                "lat": 38.9716689,
                "lng": -95.2352501
            },
            "Lenexa": {
                "lat": 38.9536174,
                "lng": -94.73357089999999
            },
            "Manhattan": {
                "lat": 39.18360819999999,
                "lng": -96.57166939999999
            },
            "Olathe": {
                "lat": 38.8813958,
                "lng": -94.81912849999999
            },
            "Overland Park": {
                "lat": 38.9822282,
                "lng": -94.6707917
            },
            "Salina": {
                "lat": 38.8402805,
                "lng": -97.61142369999999
            },
            "Shawnee": {
                "lat": 39.02284849999999,
                "lng": -94.7151865
            },
            "Topeka": {
                "lat": 39.0558235,
                "lng": -95.68901849999999
            },
            "Wichita": {
                "lat": 37.6922222,
                "lng": -97.3372222
            }
        },
        "center": {
            "lat": 38.5111,
            "lng": -96.8005
        }
    },
    "ME": {
        "counties": {
            "Androscoggin": {
                "lat": 44.167681,
                "lng": -70.207435
            },
            "Aroostook": {
                "lat": 46.727057,
                "lng": -68.64941
            },
            "Cumberland": {
                "lat": 43.808348,
                "lng": -70.330375
            },
            "Franklin": {
                "lat": 44.973012,
                "lng": -70.444727
            },
            "Hancock": {
                "lat": 44.564906,
                "lng": -68.370703
            },
            "Kennebec": {
                "lat": 44.417012,
                "lng": -69.765764
            },
            "Knox": {
                "lat": 44.042045,
                "lng": -69.038515
            },
            "Lincoln": {
                "lat": 43.994265,
                "lng": -69.514029
            },
            "Oxford": {
                "lat": 44.494585,
                "lng": -70.734688
            },
            "Penobscot": {
                "lat": 45.390602,
                "lng": -68.657487
            },
            "Piscataquis": {
                "lat": 45.917678,
                "lng": -69.104548
            },
            "Sagadahoc": {
                "lat": 43.916694,
                "lng": -69.843994
            },
            "Somerset": {
                "lat": 45.507482,
                "lng": -69.97604
            },
            "Waldo": {
                "lat": 44.505361,
                "lng": -69.139678
            },
            "Washington": {
                "lat": 44.967009,
                "lng": -67.609354
            },
            "York": {
                "lat": 43.427239,
                "lng": -70.670402
            }
        },
        "cities": {
            "Portland": {
                "lat": 43.66147100000001,
                "lng": -70.2553259
            }
        },
        "center": {
            "lat": 44.6074,
            "lng": -69.3977
        }
    },
    "SD": {
        "counties": {
            "Aurora": {
                "lat": 43.724719,
                "lng": -98.577587
            },
            "Beadle": {
                "lat": 44.418265,
                "lng": -98.279422
            },
            "Bennett": {
                "lat": 43.184826,
                "lng": -101.676426
            },
            "Bon Homme": {
                "lat": 42.986031,
                "lng": -97.885613
            },
            "Brookings": {
                "lat": 44.376675,
                "lng": -96.797797
            },
            "Brown": {
                "lat": 45.589254,
                "lng": -98.352175
            },
            "Brule": {
                "lat": 43.72988,
                "lng": -99.092941
            },
            "Buffalo": {
                "lat": 44.044306,
                "lng": -99.203998
            },
            "Butte": {
                "lat": 44.896435,
                "lng": -103.501762
            },
            "Campbell": {
                "lat": 45.782241,
                "lng": -100.027951
            },
            "Charles Mix": {
                "lat": 43.206185,
                "lng": -98.595143
            },
            "Clark": {
                "lat": 44.855211,
                "lng": -97.724912
            },
            "Clay": {
                "lat": 42.912997,
                "lng": -96.979795
            },
            "Codington": {
                "lat": 44.966324,
                "lng": -97.198843
            },
            "Corson": {
                "lat": 45.69834,
                "lng": -101.176017
            },
            "Custer": {
                "lat": 43.684943,
                "lng": -103.46225
            },
            "Davison": {
                "lat": 43.680439,
                "lng": -98.155868
            },
            "Day": {
                "lat": 45.362283,
                "lng": -97.593734
            },
            "Deuel": {
                "lat": 44.75629,
                "lng": -96.690239
            },
            "Dewey": {
                "lat": 45.150005,
                "lng": -100.852218
            },
            "Douglas": {
                "lat": 43.391506,
                "lng": -98.358433
            },
            "Edmunds": {
                "lat": 45.41168,
                "lng": -99.205362
            },
            "Fall River": {
                "lat": 43.221504,
                "lng": -103.512102
            },
            "Faulk": {
                "lat": 45.065476,
                "lng": -99.153564
            },
            "Grant": {
                "lat": 45.172637,
                "lng": -96.772261
            },
            "Gregory": {
                "lat": 43.179094,
                "lng": -99.202158
            },
            "Haakon": {
                "lat": 44.284312,
                "lng": -101.59179
            },
            "Hamlin": {
                "lat": 44.680619,
                "lng": -97.178598
            },
            "Hand": {
                "lat": 44.546713,
                "lng": -99.004575
            },
            "Hanson": {
                "lat": 43.680612,
                "lng": -97.796845
            },
            "Harding": {
                "lat": 45.596612,
                "lng": -103.473867
            },
            "Hughes": {
                "lat": 44.392258,
                "lng": -99.985846
            },
            "Hutchinson": {
                "lat": 43.33671,
                "lng": -97.749383
            },
            "Hyde": {
                "lat": 44.537301,
                "lng": -99.492148
            },
            "Jackson": {
                "lat": 43.677294,
                "lng": -101.626455
            },
            "Jerauld": {
                "lat": 44.063416,
                "lng": -98.623188
            },
            "Jones": {
                "lat": 43.95199,
                "lng": -100.686139
            },
            "Kingsbury": {
                "lat": 44.362969,
                "lng": -97.499313
            },
            "Lake": {
                "lat": 44.02845,
                "lng": -97.123223
            },
            "Lawrence": {
                "lat": 44.353669,
                "lng": -103.796528
            },
            "Lincoln": {
                "lat": 43.27942,
                "lng": -96.722286
            },
            "Lyman": {
                "lat": 43.894812,
                "lng": -99.841925
            },
            "McCook": {
                "lat": 43.678924,
                "lng": -97.362036
            },
            "McPherson": {
                "lat": 45.784249,
                "lng": -99.211421
            },
            "Marshall": {
                "lat": 45.737054,
                "lng": -97.580884
            },
            "Meade": {
                "lat": 44.606792,
                "lng": -102.715864
            },
            "Mellette": {
                "lat": 43.58493,
                "lng": -100.760598
            },
            "Miner": {
                "lat": 44.017327,
                "lng": -97.60979
            },
            "Minnehaha": {
                "lat": 43.667472,
                "lng": -96.795726
            },
            "Moody": {
                "lat": 44.012429,
                "lng": -96.676054
            },
            "Pennington": {
                "lat": 44.002349,
                "lng": -102.823802
            },
            "Perkins": {
                "lat": 45.483387,
                "lng": -102.467995
            },
            "Potter": {
                "lat": 45.064276,
                "lng": -99.949631
            },
            "Roberts": {
                "lat": 45.623397,
                "lng": -96.947551
            },
            "Sanborn": {
                "lat": 44.021032,
                "lng": -98.092105
            },
            "Shannon": {
                "lat": 43.341937,
                "lng": -102.55948
            },
            "Spink": {
                "lat": 44.931034,
                "lng": -98.339644
            },
            "Stanley": {
                "lat": 44.415547,
                "lng": -100.749163
            },
            "Sully": {
                "lat": 44.722325,
                "lng": -100.131399
            },
            "Todd": {
                "lat": 43.208172,
                "lng": -100.717204
            },
            "Tripp": {
                "lat": 43.349729,
                "lng": -99.876219
            },
            "Turner": {
                "lat": 43.30867,
                "lng": -97.150185
            },
            "Union": {
                "lat": 42.831106,
                "lng": -96.650829
            },
            "Walworth": {
                "lat": 45.427605,
                "lng": -100.027856
            },
            "Yankton": {
                "lat": 43.006607,
                "lng": -97.388339
            },
            "Ziebach": {
                "lat": 44.981666,
                "lng": -101.669225
            }
        },
        "cities": {
            "Rapid City": {
                "lat": 44.0805434,
                "lng": -103.2310149
            },
            "Sioux Falls": {
                "lat": 43.5499749,
                "lng": -96.700327
            }
        },
        "center": {
            "lat": 44.2853,
            "lng": -99.4632
        }
    },
    "DC": {
        "counties": {
            "District of Columbia": {
                "lat": 38.904149,
                "lng": -77.017094
            }
        },
        "cities": {
            "Washington": {
                "lat": 38.8951118,
                "lng": -77.0363658
            }
        },
        "center": {
            "lat": 38.8964,
            "lng": -77.0262
        }
    },
    "DE": {
        "counties": {
            "Kent": {
                "lat": 39.097088,
                "lng": -75.502982
            },
            "New Castle": {
                "lat": 39.575915,
                "lng": -75.644132
            },
            "Sussex": {
                "lat": 38.677511,
                "lng": -75.335495
            }
        },
        "cities": {
            "Wilmington": {
                "lat": 39.7458333,
                "lng": -75.5466667
            }
        },
        "center": {
            "lat": 39.3498,
            "lng": -75.5148
        }
    },
    "AS": {
        "counties": {},
        "cities": {},
        "center": {
            "lat": 14.2417,
            "lng": -170.7197
        }
    },
    "MP": {
        "counties": {},
        "cities": {},
        "center": {
            "lat": 14.8058,
            "lng": 145.5505
        }
    },
    "PR": {
        "counties": {},
        "cities": {},
        "center": {
            "lat": 18.2766,
            "lng": -66.335
        }
    },
    "VI": {
        "counties": {},
        "cities": {},
        "center": {
            "lat": 18.0001,
            "lng": -64.8199
        }
    }
}
},{}],5:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],6:[function(require,module,exports){
exports.deepGet = function(obj, path, fallbackValue) {
  if (undefined === obj || null === obj) {
    return fallbackValue;
  }

  var fields = path.split('.'),
    result = obj;

  for (var i=0; i<fields.length; ++i) {
    if ('object' !==  typeof result) {
      return fallbackValue;
    }

    result = result[fields[i]];
  }

  return result || fallbackValue;
};




// Based on https://github.com/neilco/twix/blob/master/twix.js
var Ajax = exports.Ajax = function() {};

Ajax.request = function(options) {
    options = options || {url:""};
    options.type = options.type || 'GET';
    options.headers = options.headers || {};
    options.timeout = parseInt(options.timeout) || 0;
    options.success = options.success || function() {};
    options.error = options.error || function() {};
    options.async = typeof options.async === 'undefined' ? true : options.async;

    var client = new XMLHttpRequest();
    if (options.timeout > 0) {
        client.timeout = options.timeout;
        client.ontimeout = function () { 
            options.error('timeout', 'timeout', client); 
        }
    }
    client.open(options.type, options.url, options.async);

    for (var i in options.headers) {
        if (options.headers.hasOwnProperty(i)) {
            client.setRequestHeader(i, options.headers[i]);
        }
    }
    
    client.send(options.data);
    client.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var data = this.responseText;
            var contentType = this.getResponseHeader('Content-Type');
            if (contentType && contentType.match(/json/)) {
                data = JSON.parse(this.responseText);
            }
            options.success(data, this.statusText, this);
        } else if (this.readyState == 4) {
            options.error(this.status, this.statusText, this);
        }
    };

    if (options.async == false) {
        if (client.readyState == 4 && client.status == 200) {
            options.success(client.responseText, client);
        } else if (client.readyState == 4) {
            options.error(client.status, client.statusText, client);
        }
    } 

    return client;
};

Ajax.get = function(url, data, callback) {
    if (typeof data === "function") {
        callback = data;
        data = undefined;
    }
    
    return Ajax.request({
        url: url,
        data: data, 
        success: callback
    });
};

Ajax.post = function(url, data, callback) {
    if (typeof data === "function") {
        callback = data;
        data = undefined;
    }
    
    return Ajax.request({
        url: url,
        type: 'POST',
        data: data, 
        success: callback
    });
};
  

},{}]},{},[1])