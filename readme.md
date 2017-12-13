# goflyway WebSocket 前置代理服务器

本脚本运行在LeanCloud云引擎上作为连接goflyway服务端的跳板，理论上也同样可以运行在任何支持WebSocket长连接的App Engine上。

## 部署
进入LeanCloud控制台后选择或创建一个实例，选择“部署”，填入本git地址（https://github.com/coyove/leancloud-test）即可。

部署完成后请设置一个Web主机域名（如：example.leanapp.cn），我们假设goflyway服务端运行在`1.2.3.4:8100`上，客户端使用以下命令连接：
```
./goflyway -up fwds://example.leanapp.cn:80/1.2.3.4:8100
```