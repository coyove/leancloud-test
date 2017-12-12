var common   = exports,
    url      = require('url'),
    extend   = require('util')._extend,
    required = require('requires-port');

var upgradeHeader = /(^|,)\s*upgrade\s*($|,)/i,
    isSSL = /^https|wss/,
    cookieDomainRegex = /(;\s*domain=)([^;]+)/i;

/**
 * Simple Regex for testing if protocol is https
 */
common.isSSL = isSSL;
/**
 * Copies the right headers from `options` and `req` to
 * `outgoing` which is then used to fire the proxied
 * request.
 *
 * Examples:
 *
 *    common.setupOutgoing(outgoing, options, req)
 *    // => { host: ..., hostname: ...}
 *
 * @param {Object} Outgoing Base object to be filled with required properties
 * @param {Object} Options Config object passed to the proxy
 * @param {ClientRequest} Req Request Object
 * @param {String} Forward String to select forward or target
 * 
 * @return {Object} Outgoing Object with all required properties set
 *
 * @api private
 */

common.setupOutgoing = function(req) {
  var outgoing = {};
  outgoing.method = req.method;
  outgoing.headers = extend({}, req.headers);
  delete outgoing.headers["x-forwarded-url"];

  outgoing.agent = false;
  outgoing.headers = outgoing.headers || {};
  
  if (typeof outgoing.headers.connection !== 'string' || !upgradeHeader.test(outgoing.headers.connection))
    outgoing.headers.connection = 'close';

  var outgoingPath = req.headers['x-forwarded-url'];

  if (outgoingPath) {
    outgoing.path = outgoingPath;
    var u = url.parse(outgoingPath);
    if (u) {
      outgoing.headers.host = u.hostname + ":" + (u.port ? u.port : "80");
      outgoing.host = u.hostname;
      outgoing.port = parseInt(u.port);
    }
  }
  
  return outgoing;
};

/**
 * Set the proper configuration for sockets,
 * set no delay and set keep alive, also set
 * the timeout to 0.
 *
 * Examples:
 *
 *    common.setupSocket(socket)
 *    // => Socket
 *
 * @param {Socket} Socket instance to setup
 * 
 * @return {Socket} Return the configured socket.
 *
 * @api private
 */

common.setupSocket = function(socket) {
  socket.setTimeout(0);
  socket.setNoDelay(true);

  socket.setKeepAlive(true, 0);

  return socket;
};

/**
 * Get the port number from the host. Or guess it based on the connection type.
 *
 * @param {Request} req Incoming HTTP request.
 *
 * @return {String} The port number.
 *
 * @api private
 */
common.getPort = function(req) {
  var res = req.headers.host ? req.headers.host.match(/:(\d+)/) : '';

  return res ?
    res[1] :
    common.hasEncryptedConnection(req) ? '443' : '80';
};

/**
 * Check if the request has an encrypted connection.
 *
 * @param {Request} req Incoming HTTP request.
 *
 * @return {Boolean} Whether the connection is encrypted or not.
 *
 * @api private
 */
common.hasEncryptedConnection = function(req) {
  return Boolean(req.connection.encrypted || req.connection.pair);
};

/**
 * OS-agnostic join (doesn't break on URLs like path.join does on Windows)>
 *
 * @return {String} The generated path.
 *
 * @api private
 */

common.urlJoin = function() {
    //
    // We do not want to mess with the query string. All we want to touch is the path.
    //
  var args = Array.prototype.slice.call(arguments),
      lastIndex = args.length - 1,
      last = args[lastIndex],
      lastSegs = last.split('?'),
      retSegs;

  args[lastIndex] = lastSegs.shift();

  //
  // Join all strings, but remove empty strings so we don't get extra slashes from
  // joining e.g. ['', 'am']
  //
  retSegs = [
    args.filter(Boolean).join('/')
        .replace(/\/+/g, '/')
        .replace('http:/', 'http://')
        .replace('https:/', 'https://')
  ];

  // Only join the query string if it exists so we don't have trailing a '?'
  // on every request

  // Handle case where there could be multiple ? in the URL.
  retSegs.push.apply(retSegs, lastSegs);

  return retSegs.join('?')
};

/**
 * Rewrites or removes the domain of a cookie header
 *
 * @param {String|Array} Header
 * @param {Object} Config, mapping of domain to rewritten domain.
 *                 '*' key to match any domain, null value to remove the domain.
 *
 * @api private
 */
common.rewriteCookieDomain = function rewriteCookieDomain(header, config) {
  if (Array.isArray(header)) {
    return header.map(function (headerElement) {
      return rewriteCookieDomain(headerElement, config);
    });
  }
  return header.replace(cookieDomainRegex, function(match, prefix, previousDomain) {
    var newDomain;
    if (previousDomain in config) {
      newDomain = config[previousDomain];
    } else if ('*' in config) {
      newDomain = config['*'];
    } else {
      //no match, return previous domain
      return match;
    }
    if (newDomain) {
      //replace domain
      return prefix + newDomain;
    } else {
      //remove domain
      return '';
    }
  });
};

/**
 * Check the host and see if it potentially has a port in it (keep it simple)
 *
 * @returns {Boolean} Whether we have one or not
 *
 * @api private
 */
function hasPort(host) {
  return !!~host.indexOf(':');
};
