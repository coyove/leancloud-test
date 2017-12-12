# goflyway WebSocket 前置代理服务器

本脚本运行在LeanCloud云引擎上。进入控制台后创建一个实例，选择“部署”，填入本git地址部署即可。完成后设置Web主机域名（如：example.leanapp.cn），假设goflyway服务端运行在`1.2.3.4:8100`，goflyway使用以下命令连接：
```
./goflyway -up forwardws://example.leanapp.cn:80_1.2.3.4:8100
```