/**
 * Module dependencies
 */

var request = require('hyper-path');

/**
 * Watch the value at a path
 */

exports.$watchPath = function(path, fn) {
  var $scope = this;

  // Make the request to the api
  var req = request(path);

  // we're not starting at the root of the api so we need to watch
  // the first property, or `req.index`, in the path
  if (!req.isRoot) $scope.$watch(req.index, function(parent) {
    var root = {};
    root[req.index] = parent;
    req.scope(root);
  }, true);

  // listen to any updates from the api
  req.on(function(err, value) {
    $safeApply.call($scope, function() {
      fn(err, value);
    });
  });

  // stop listening when our directive goes away
  $scope.$on('$destroy', function() {
    res.off();
  });

  return req;
};

/**
 * Safely call apply
 *
 * @param {Function} fn
 * @api private
 */

exports.$safeApply = $safeApply;
function $safeApply(fn) {
  var phase = this.$$phase;
  if (phase === '$apply' || phase === '$digest') return fn();
  this.$apply(fn);
}