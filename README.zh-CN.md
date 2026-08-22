# spicefe

> [!WARNING]
> **仅限在可信局域网中使用。** spice2x 通过明文 HTTP 发送未经身份验证的
> 视频；可选的 API 密码使用已过时的 RC4；spicefe 还会将保存的密码以明文
> 存入浏览器 `localStorage`。HTTP 兼容模式的页面也可能在传输途中被篡改。
> 浏览器支持时应优先使用 HTTPS 模式，并且只通过你信任的静态托管服务部署
> 已审查过的构建产物。

[English](./README.md)

[![CI](https://github.com/Avimitin/spicefe/actions/workflows/ci.yml/badge.svg)](https://github.com/Avimitin/spicefe/actions/workflows/ci.yml)

`spicefe` 是一个可在全球静态托管、用于 spice2x 副屏视频流的局域网客户端。
在手机、平板或其他现代浏览器中打开页面，选择已保存的游戏 PC，浏览器就会
直接连接 spice2x，提供视频、触控及画面缩放控制。

本项目不使用中继，也不要求在游戏 PC 上额外运行配套 Web 服务器。静态托管
服务只负责发送本应用；视频流和输入数据始终留在局域网内。

## 0.1 版本范围

- 优先使用 WebCodecs 播放 H.264，并提供 Media Source Extensions 回退路径
- H.264 不可用时自动回退到 MJPEG
- 支持鼠标、单点触控和多点触控输入
- 支持适应（Fit）、填充（Fill）和拉伸（Stretch）显示模式，并正确映射触控坐标
- 支持选择 spice2x 画面缩放场景（关闭及场景 1–4）
- 在 `localStorage` 中保存多个具名连接配置，并可为每个配置选择显示在 PC 名称
  旁的游戏图标
- 明确的连接、断开和切换行为；刷新页面后绝不会自动重连
- 自适应手机、平板和桌面设备的界面

音频、剪贴板共享、同时显示多个副屏、广域网中继和旧版浏览器均不在此版本
的范围内。

## 数据路径

界面中填写的 API 端口是 spice2x 的基础端口：

| 用途 | API 端口为 1337 时的浏览器端点 | 保护方式 |
| --- | --- | --- |
| 触控、画面缩放及游戏信息 | `ws://PC:1338` | 可选 spice2x 密码；使用旧式 RC4 |
| H.264 或 MJPEG 视频 | `http://PC:1339` | 无 |

CDN 不会代理上述任何连接。可用时，浏览器通过 WebCodecs 直接解码 H.264；
否则，固定版本的纯 JavaScript jMuxer 会在客户端将 Annex-B 重新封装为供 MSE
播放的分片 MP4，不会对视频进行转码。

## 游戏 PC 设置

使用包含 `-apistream` 的新版 spice2x，并以类似下方的参数启动游戏：

```text
spice64.exe ... -api 1337 -apipass choose-a-lan-password -apistream
```

密码是可选项，但 spice2x 建议设置密码。在 Windows 防火墙中允许 TCP 端口
1338 和 1339 的入站连接。浏览器不会使用 1337 上的原始 TCP 监听器，但
spice2x 仍然需要 `-api` 才会建立相邻的两个监听器。

在客户端设备上，应尽可能填写 PC 的私有 IPv4 地址，例如 `192.168.1.50`。
两台设备必须位于同一局域网，并且 Wi-Fi 网络必须关闭客户端隔离功能。

## 浏览器连接模式

spice2x 当前只提供明文 HTTP 和 WebSocket 端点。因此，从全球托管的页面访问
它时，无法绕过以下浏览器安全边界：

| 浏览器 | 推荐页面 | 操作方式 |
| --- | --- | --- |
| 当前版本的 Chrome 或 Edge | HTTPS | 允许“本地网络访问”权限请求 |
| 当前版本的 Safari 及基于 WebKit 的 iOS 浏览器 | HTTP 兼容模式 | 先打开 HTTPS 页面，再选择 **Open HTTP mode** |
| 当前版本的 Firefox | HTTP 兼容模式 | 先打开 HTTPS 页面，再选择 **Open HTTP mode** |

Chrome 142 引入了安全上下文中的本地网络访问权限；用户允许后，浏览器可以
放行本地明文请求，并解除这些请求受到的混合内容限制。其他浏览器路径通过
HTTP 加载同一个静态站点。应用会使用 URL 片段，在两个协议各自独立的存储
来源之间转移完整的连接配置库，并在导入后立即清除该片段。URL 片段不会包含
在 HTTP 请求中。

因此，部署必须同时提供 HTTP 和 HTTPS，且不能把所有 HTTP 流量重定向到
HTTPS。如果托管平台强制把兼容模式 URL 跳回 HTTPS，应用会检测到循环并说明
配置问题。

相关平台资料：

- [Chrome 本地网络访问权限](https://developer.chrome.com/blog/local-network-access)
- [Chrome 142 发布说明](https://developer.chrome.com/release-notes/142)
- [W3C Mixed Content](https://www.w3.org/TR/mixed-content/)
- [WebCodecs AVC 注册说明](https://www.w3.org/TR/webcodecs-avc-codec-registration/)

## 部署静态站点

先运行完整的可复现构建及测试检查：

```sh
nix flake check
nix build
```

可部署目录为 `result/`。仓库中的 `public/` 目录也已经包含完整产物，无需构建
即可直接上传。

### GitHub Actions

[`CI` 工作流](./.github/workflows/ci.yml)会在 Pull Request 及向 `main` 推送时
运行。它会执行全部 flake 检查、构建站点、确认仓库中的 `public/` 与 Nix 构建
结果一致，并将结果作为保留七天的 `spicefe-public` 构建产物上传。

该工作流只有仓库只读权限，绝不会提交生成文件。`public/` 本身已经是静态站点
源目录；让 CI 机器人把同一批文件复制回来，只会多生成一次提交及一次部署。
经过审查的改动进入 `main` 后，Cloudflare Pages 应继续直接发布 `public/`。

GitHub Actions 与 NixOS 官方安装器均固定到完整 commit ID。安装器可执行文件
还固定为 Nix `2.35.1`，并且会在运行前用仓库中记录的 SHA-256 校验。

### EdgeOne Pages

直接上传 `public/`（或 `result/` 的内容）。其中的 `edgeone.json` 会设置响应
头。在域名的 HTTPS 设置中保持 **Force HTTPS** 关闭，以确保
`http://your-client-domain` 仍可访问。

### Cloudflare Pages

不选择框架、不设置构建命令，并将 `public` 设为输出目录。Pages 会读取其中的
`_headers` 文件。请使用自定义域名并为该域名关闭 **Always Use HTTPS**；不要
在客户端域名上启用 HSTS。不建议在兼容模式中使用 `pages.dev` 域名。

上述部署设置可参考
[EdgeOne 直接上传](https://pages.edgeone.ai/document/direct-upload)、
[EdgeOne HTTPS 配置](https://pages.edgeone.ai/document/https-configuration-overview)、
[Cloudflare Pages 响应头](https://developers.cloudflare.com/pages/configuration/headers/)
和 [Cloudflare Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/)。

## 本地开发

flake 固定了 Nixpkgs，并提供 Node.js 和 Python，无需在系统中全局安装 npm。

```sh
nix develop
npm test
python tools/check_static.py public
```

在开发机上启动构建后的站点：

```sh
nix run
```

默认监听 `127.0.0.1:45000`。如需让其他局域网设备访问：

```sh
SPICEFE_BIND=0.0.0.0 SPICEFE_PORT=45000 nix run
```

## 依赖策略

唯一的浏览器依赖是纯 JavaScript 包 `jmuxer@2.1.1`，它没有传递依赖。npm
完整性元数据将其锁定在精确版本，并且该包没有安装生命周期脚本。Nix 构建会
传入 `--ignore-scripts`，通过固定输出的 Nix derivation 下载依赖，并在生成
站点之前，将其发布文件和许可证与 `public/vendor/` 中的副本逐字节比较。
构建不会下载或运行任何来自 npm 包的可执行二进制文件。

## 图标来源

站点图标及连接配置的默认图标，是来自固定版本 `b9c8afb` 的未经修改的 spice2x
官方图标；站点中同时提供其 GPLv3 许可证。可搜索的连接图标选择器还包含
[`bicarus-dev/bemani_fan_site_icons`](https://github.com/bicarus-dev/bemani_fan_site_icons)
固定版本 `225e494` 中全部 111 个浏览器图像。选择器会分批渲染图标，因此打开
时不会立即下载整个图标集合。

BEMANI 图标仓库没有提供许可证，并说明这些图像收集自 KONAMI BEMANI 粉丝
站点。站点运营者必须自行取得重新分发或公开提供这些图像所需的许可。本项目
不表示与 KONAMI 或各游戏存在关联，也不代表其认可。完整来源记录及上游
README 位于
[`public/vendor/bemani-fan-site-icons/`](./public/vendor/bemani-fan-site-icons/)。

## 安全模型

仅限在可信的家庭局域网中使用：

- spice2x 以明文发送视频，且视频流端口没有身份验证。
- 可选的 API 密码使用 RC4；这是旧式加密，不是现代安全信道。
- 为了在重新打开页面后立即使用，连接配置及密码会有意以明文保存在浏览器
  `localStorage` 中。
- HTTP 兼容模式无法验证传输中的静态页面。网络攻击者可能替换其中的
  JavaScript，因此可用时应优先选择 Chrome 的 HTTPS 模式，并且只在可信网络
  中使用兼容模式。
- 部署后的静态托管服务控制着可访问已保存配置及局域网端点的可执行代码。
  请部署经过审查的产物，并使用你信任的托管服务。

本项目不包含遥测、远程账户、Service Worker，也不会在页面加载时自动连接。

## 致谢

协议和客户端行为基于 spice2x 源码树及采用 BSD 许可证的参考客户端
[`spice2x/substream`](https://github.com/spice2x/substream)。站点标识使用 spice2x
官方图标，可选游戏图标来自 `bicarus-dev/bemani_fan_site_icons`。许可证、固定
版本以及 BEMANI 图像的注意事项详见
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
