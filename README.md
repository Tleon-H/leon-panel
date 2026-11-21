<div align="center">

<img src="./doc/images/logo.png" width="100" height="100" alt="Leon Panel" />

# Leon Panel

轻量、简洁的服务器 / NAS 导航面板与浏览器首页。

A lightweight navigation panel for servers, NAS devices, and browser start pages.

</div>

- 当前版本：`0.1.0`
- 代码仓库：[Tleon-H/leon-panel](https://github.com/Tleon-H/leon-panel)
- 开源协议：[MIT](./LICENSE)

更详细的架构说明、备份恢复机制与自动化检查见 [doc/LEON-PANEL.md](./doc/LEON-PANEL.md)。

## 界面预览

![Leon Panel 首页](./doc/images/main-dark.png)

**图标样式**

![小图标](./doc/images/icon-small-new.png)
![透明详情](./doc/images/transparent-info.png)
![透明小图标](./doc/images/transparent-small.png)
![纯色详情](./doc/images/solid-color-info.png)
![全彩小图标](./doc/images/full-color-small.jpg)

**页面内小窗口**

![SSH 小窗口](./doc/images/window-ssh.png)
![下载工具小窗口](./doc/images/window-xunlei.png)

## 核心特性

- **外观预设与实时预览**：内置首页外观预设（海蓝玻璃、雾白纸感、深夜石墨），支持按项预览与应用，深色模式下优化描边和对比度。
- **分组与卡片管理**：支持分组拖拽排序、每个分组独立设置卡片样式（详情大卡片 / 小图标 / 跟随全局）；卡片支持默认地址与内网地址一键切换，右键菜单可直接按任意地址以当前页、新标签或页内小窗打开。
- **高性能首页加载**：一次请求加载分组、样式与排序后的卡片；支持顶部加载条、加载失败保留卡片并重试、按已确认身份隔离的本地卡片缓存与 `/clear` 缓存清理页。
- **搜索栏与自定义引擎**：支持 `/` 快捷键快速聚焦（不抢占输入框与中文输入法）、本地项目筛选，以及登录用户自定义搜索引擎增删改与排序。
- **自有图库与公共图库**：上传文件管理支持按图标 / 壁纸 / 未分类筛选、按文件名搜索、分页、批量上传与批量删除；管理员可将自己的图片设为公共图库供其他已登录账号选用。
- **多账号切换与公开模式**：支持多账号隔离与访客公开模式；可在同一浏览器记住多个已登录会话并快速切换（不保存密码）。
- **整站备份与覆盖恢复**：管理员支持导出 SQLite 一致性快照（含数据库、上传文件、`conf/conf.ini`、`web/custom` 及 SHA-256 清单），并支持带二次确认和失败回滚的整站覆盖恢复。
- **系统状态监控**：支持查看主机 CPU、内存与磁盘使用率。

## 快速部署（Docker）

默认使用内置 SQLite 数据库，无需额外部署数据库服务：

```sh
docker compose up -d --build
```

启动后访问 `http://<你的IP>:3002`。默认持久化挂载目录为 `./conf`、`./uploads` 和 `./database`。

首次初始化将自动生成默认管理员账号，**部署后请务必立即修改密码**：

- 默认账号：`admin@leon.local`
- 默认密码：`12345678`

### 独立测试容器

如需在独立目录与端口上试运行（使用 `./leon-test-data` 与主机端口 `13002`）：

```sh
docker compose -f docker-compose.leon-test.yml up --build
```

浏览器打开 `http://127.0.0.1:13002`。

## 本地开发与构建

环境要求：Node.js 22.6+、pnpm 8.15.9、Go 1.21+。

```sh
pnpm install
pnpm run version:check
pnpm run test:unit
pnpm run type-check
pnpm run build

cd service
go install github.com/go-bindata/go-bindata/go-bindata@v3.1.2+incompatible
go install github.com/elazarl/go-bindata-assetfs/go-bindata-assetfs@v1.0.1
go-bindata-assetfs -o=assets/bindata.go -pkg=assets assets/...
go test ./...
go build -o leon-panel main.go
```

### 版本约定

- `package.json` 与 `service/assets/version` 必须保持一致（SemVer 格式 `X.Y.Z`），由 `pnpm run version:check` 和 CI 校验。
- Git 发布标签使用 `v<version>`（例如 `v0.1.0`），Docker 镜像标签使用 `<version>`（例如 `0.1.0`）。

## 许可证

本项目采用 [MIT License](./LICENSE) 开源。
