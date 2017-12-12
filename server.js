'use strict';

// 端口一定要从环境变量 `LEANCLOUD_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LEANCLOUD_APP_PORT || process.env.PORT || 3000);

var extend = require('util')._extend;
var http = require('http');
var url = require('url');

const urlHeader = "x-forwarded-url";

function forward(req) {
  var outgoing = {};
  outgoing.method = req.method;
  outgoing.headers = extend({}, req.headers);
  delete outgoing.headers[urlHeader];

  outgoing.agent = false;
  outgoing.headers = outgoing.headers || {};
  
  if (typeof outgoing.headers.connection !== 'string' || !/(^|,)\s*upgrade\s*($|,)/i.test(outgoing.headers.connection))
    outgoing.headers.connection = 'close';

  var outgoingPath = req.headers[urlHeader];

  if (outgoingPath) {
    outgoing.path = outgoingPath;
    var u = url.parse(outgoingPath);
    if (u) {
      outgoing.headers.host = u.hostname + ":" + (u.port ? u.port : "80");
      outgoing.host = u.hostname;
      outgoing.port = parseInt(u.port);
    } else {
      console.log("can't parse url:", outgoingPath);
    }
  }
  
  return outgoing;
};

var server = http.createServer(function (req, res) {
  if (req.url === '/1.1/functions/_ops/metadatas') {
    res.writeHead(404, {"Content-Type": "text/plain"});
    return res.end();
  }

  if ((req.method === 'DELETE' || req.method === 'OPTIONS') && !req.headers['content-length']) {
    req.headers['content-length'] = '0';
    delete req.headers['transfer-encoding'];
  }

  var options = forward(req);
  if (!(urlHeader in req.headers)) {
    res.write('Hello World');
    return res.end();
  }

  var proxyReq = http.request(options);
  req.pipe(proxyReq);
  proxyReq.on('response', function(proxyRes) {
    if (req.httpVersion === '1.0') {
      delete proxyRes.headers['transfer-encoding'];
    }

    if (!proxyRes.headers.connection) {
      proxyRes.headers.connection = req.headers.connection || 'keep-alive';
    }

    var rawHeaderKeyMap = {};
    if (proxyRes.rawHeaders != undefined) {
      for (var i = 0; i < proxyRes.rawHeaders.length; i += 2) {
        var key = proxyRes.rawHeaders[i];
        rawHeaderKeyMap[key.toLowerCase()] = key;
      }
    }

    Object.keys(proxyRes.headers).forEach(function(key) {
      var header = proxyRes.headers[key];
      if (header == undefined) return;

      key = rawHeaderKeyMap[key] || key;
      res.setHeader(String(key).trim(), header);
    });

    if (proxyRes.statusMessage) {
      res.writeHead(proxyRes.statusCode, proxyRes.statusMessage);
    } else {
      res.writeHead(proxyRes.statusCode);
    }

    proxyRes.pipe(res);
  });

  //proxyReq.end();
});

server.on('upgrade', function (req, socket, head) {
  function setsockopt(socket) {
    socket.setTimeout(0);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 0);
    return socket;
  };

  function onOutgoingError(err) {
    console.log(err);
    socket.end();
  };

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

  setsockopt(socket);

  if (head && head.length) socket.unshift(head);

  var proxyReq = http.request(forward(req));

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

    setsockopt(proxySocket);

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
});

server.listen(PORT);