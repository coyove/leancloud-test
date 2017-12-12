var http   = require('http'),
    https  = require('https'),
    web_o  = require('./web-outgoing'),
    common = require('../common');

web_o = Object.keys(web_o).map(function(pass) {
  return web_o[pass];
});

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */


module.exports = {

  /**
   * Sets `content-length` to '0' if request is of DELETE type.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  deleteLength: function deleteLength(req, res, options) {
    if((req.method === 'DELETE' || req.method === 'OPTIONS')
       && !req.headers['content-length']) {
      req.headers['content-length'] = '0';
      delete req.headers['transfer-encoding'];
    }
  },

  /**
   * Sets timeout in request socket if it was specified in options.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  timeout: function timeout(req, res, options) {
    if(options.timeout) {
      req.socket.setTimeout(options.timeout);
    }
  },

  /**
   * Does the actual proxying. If `forward` is enabled fires up
   * a ForwardStream, same happens for ProxyStream. The request
   * just dies otherwise.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */

  stream: function stream(req, res, options, _, server, clb) {
    var options = common.setupOutgoing(options.ssl || {}, options, req);
    if (!("x-forwarded-url" in req.headers)) {
      res.write('Hello World');
      return res.end();
    }

    var proxyReq = http.request(options);

    // Enable developers to modify the proxyReq before headers are sent
    proxyReq.on('socket', function(socket) {
      server.emit('proxyReq', proxyReq, req, res, options);
    });

    req.pipe(proxyReq);

    proxyReq.on('response', function(proxyRes) {

      for(var i=0; i < web_o.length; i++) {
        if(web_o[i](req, res, proxyRes, options)) { break; }
      }

      proxyRes.pipe(res);
    });

    //proxyReq.end();
  }

};
