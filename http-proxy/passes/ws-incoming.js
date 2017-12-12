var http   = require('http'),
    https  = require('https'),
    common = require('../common');

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, socket, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

/*
 * Websockets Passes
 *
 */


module.exports = {
  /**
   * Does the actual proxying. Make the request and upgrade it
   * send the Switching Protocols request and pipe the sockets.
   *
   * @param {ClientRequest} Req Request object
   * @param {Socket} Websocket
   * @param {Object} Options Config object passed to the proxy
   *
   * @api private
   */
  stream : function stream(req, socket, options, head, server, clb) {
    if (req.method !== 'GET' || !req.headers.upgrade) {
      console.log("invalid method for WebSocket");
      socket.destroy();
      return;
    }

    if (req.headers.upgrade.toLowerCase() !== 'websocket') {
      console.log("invalid upgrade for WebSocket");
      socket.destroy();
      return;
    }

    socket.setTimeout(0);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 0);

    if (head && head.length) socket.unshift(head);

    var proxyReq = http.request(common.setupOutgoing(req));

    // Error Handler
    proxyReq.on('error', onOutgoingError);
    proxyReq.on('response', function (res) {
      // if upgrade event isn't going to happen, close the socket
      if (!res.upgrade) socket.end();
    });

    proxyReq.on('upgrade', function(proxyRes, proxySocket, proxyHead) {
      proxySocket.on('error', onOutgoingError);

      // The pipe below will end proxySocket if socket closes cleanly, but not
      // if it errors (eg, vanishes from the net and starts returning
      // EHOSTUNREACH). We need to do that explicitly.
      socket.on('error', function () {
        proxySocket.end();
      });

      common.setupSocket(proxySocket);

      if (proxyHead && proxyHead.length) proxySocket.unshift(proxyHead);

      //
      // Remark: Handle writing the headers to the socket when switching protocols
      // Also handles when a header is an array
      //
      socket.write(
        Object.keys(proxyRes.headers).reduce(function (head, key) {
          var value = proxyRes.headers[key];

          if (!Array.isArray(value)) {
            head.push(key + ': ' + value);
            return head;
          }

          for (var i = 0; i < value.length; i++) {
            head.push(key + ': ' + value[i]);
          }
          return head;
        }, ['HTTP/1.1 101 Switching Protocols'])
        .join('\r\n') + '\r\n\r\n'
      );

      proxySocket.pipe(socket).pipe(proxySocket);
    });

    return proxyReq.end(); // XXX: CHECK IF THIS IS THIS CORRECT

    function onOutgoingError(err) {
      console.log(err);
      socket.end();
    }
  }
};
