/**
 * Module dependencies
 */

var pkg = require('../package');
var Emitter = require('emitter');
var parseLinks = require('links-parser');

// set the default api path to '/api'
var loc = window.location;
var base = loc.protocol + '//' + loc.host;
pkg.value('hyperHttpRoot', '/api');

// list of headers to check for refreshes
pkg.value('hyperHttpRefreshHeaders', [
  'location',
  'content-location'
]);

pkg.factory('hyperHttpEmitter', [
  '$http',
  function($http) {
    var subs = new Emitter();
    var external = new Emitter();

    function emitter(href, get) {
      if (href.indexOf('/') === 0) href = base + href;
      // Proxy the fn so it can be used more than once
      function handle(err, body, links) { get(err, body, links); }

      subs.on(href, handle);
      get();

      if (subs.listeners(href).length === 1) external.emit('subscribe', href);

      return function() {
        subs.off(href, handle);
        if (!subs.hasListeners(href)) external.emit('unsubscribe', href);
      };
    };

    emitter.refresh = function (href) {
      // bust the cache for everyone
      var req = {
        headers: {
          'cache-control': 'no-cache'
        },
        cache: false
      };

      $http.get(href, req)
        .success(function(body, status, headers) {
          subs.emit(href, body);
        })
        .error(function(err) {
          console.error(err.stack || err);
          // TODO send error to angular
        });
    };

    emitter.subscribe = function(fn) {
      external.on('subscribe', fn);
    };

    emitter.unsubscribe = function(fn) {
      external.on('unsubscribe', fn);
    };

    return emitter;
  }
]);

/**
 * hyper backend http service
 */

pkg.factory('hyperBackend', [
  '$http',
  'hyperHttpRoot',
  'hyperHttpEmitter',
  'hyperHttpRefreshHeaders',
  function($http, rootHref, emitter, refreshHeaders) {
    function root(fn) {
      return root.get(rootHref, fn);
    }

    root.get = function(href, fn) {
      return emitter(href, get(true));
      function get(recurse) {
        return function(body) {
          // The emitter just sent us a new response
          // We want everyone to have thier own copies as well
          if (body) return fn(null, angular.copy(body));

          $http
            .get(href, {cache: true})
            .success(function(body, status, headers) {
              var links = {};
              try {
                links = parseLinks(headers('link'));
              } catch (e) {}

              if (recurse &&
                  typeof body.href === 'string' &&
                  href !== body.href) emitter(body.href, get());

              fn(null, body, links);
            })
            .error(function(err, status) {
              // Just return an empty body if it's not found
              if (status === 404) return fn();
              fn(err);
            });
        };
      }
    };

    root.submit = function(method, action, data, fn) {
      method = method.toUpperCase();
      var req = {method: method, url: action};

      if (method === 'GET') req.params = data;
      else req.data = data;

      $http(req)
        .success(function(body, status, headers) {
          var links = {};
          try {
            links = parseLinks(headers('link'));
          } catch (e) {}
          fn(null, body, links);

          if (method === 'GET') return;

          emitter.refresh(action);
          angular.forEach(refreshHeaders, function(header) {
            var href = headers(header);
            if (href) emitter.refresh(href);
          });
        })
        .error(function(err) {
          fn(err);
        });
    };

    return root;
  }
]);
