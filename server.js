'use strict';

// 端口一定要从环境变量 `LEANCLOUD_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LEANCLOUD_APP_PORT || process.env.PORT || 3000);

var http = require('http'), httpProxy = require('./http-proxy.js');
var proxy = httpProxy.createProxyServer({ changeOrigin: true, ws: true, preserveHeaderKeyCase: true });
var URL = require('url');

var server = http.createServer(function (req, res) {
  if (req.url === '/1.1/functions/_ops/metadatas') {
    res.sendStatus(404);
    return res.end();
  }

  proxy.web(req, res, {});
});

server.on('upgrade', function (req, socket, head) {
  proxy.ws(req, socket, head);
});

server.listen(PORT);