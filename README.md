<div align="center">

<img src="./doc/images/logo.png" width="100" height="100" alt="Leon Panel" />

# Leon Panel

极简扁平几何风格的轻量级服务器 / NAS 导航面板与浏览器首页，内置 **Leon Studio** 美化与扩展引擎。

A minimalist flat-geometric navigation panel for servers, NAS devices, and browser start pages, powered by the native **Leon Studio** customization engine.

</div>

- 当前版本：`0.1.0`
- 代码仓库：[Tleon-H/leon-panel](https://github.com/Tleon-H/leon-panel)
- 开源协议：[MIT](./LICENSE)
- 兼容性：**100% 兼容**旧版迁移配置、数据库结构、`docker-compose.yml` 挂载以及 `/custom/index.css` & `/custom/index.js`

更详细的架构说明、Leon Studio 持久化机制、备份恢复与自动化检查见 [doc/LEON-PANEL.md](./doc/LEON-PANEL.md)。

## 核心特性

### 视觉设计与主题系统
- **包豪斯极简扁平几何视觉**：全新几何品牌标识（含完整 SVG / ICO / PWA / Apple Touch Icon 套件与无冗余首屏启动动画），覆盖首页、登录页、设置中心与弹窗组件。
- **8 套内置外观预设 & 几何壁纸**：
  - 5 套极简扁平几何预设：**包豪斯网格（Bauhaus Grid）**、**瑞士素白（Swiss Paper）**、**极简墨黑（Mono Ink）**、**建筑蓝图（Blueprint Slate）**、**北欧冷灰（Nordic Stone）**，配套 5 张内置纯平几何 SVG 壁纸；
  - 完整保留 **海蓝玻璃**、**雾白纸感**、**深夜石墨** 3 套经典预设，支持按项（壁纸 / 卡片 / 图标）实时预览与局部应用。
- **全站 Naive UI 主题联动**：动态同步 Naive UI `themeOverrides` 与 CSS 变量，设置中心、按钮、开关、输入框与首页风格保持完全统一。
- **站点图标视觉统一策略**：默认保留每个网站自有的 Favicon / 自定义图标，通过统一包豪斯几何徽章容器（`bauhaus`）规整观感，支持一键开启**单色极简滤镜**（悬停还原彩色）；图标编辑器内置包豪斯色板与常用 HomeLab 单色图标快选。

### Leon Studio 原生美化与扩展引擎
无需额外 Sidecar 容器或修改现有 `docker-compose.yml`，直接在设置中心「**Leon Studio**」中完成一站式美化：
- **主题包 JSON 导入导出**：一键导出当前外观配置为可分享的主题包 JSON，支持导入校验与即时应用。
- **多布局与 Dock 模式**：支持在 **标准（Standard）**、**紧凑（Compact）** 与 **底部几何 Dock（Dock）** 三种首页布局模式间切换。
- **视觉特效与桌面小组件**：可视化开关装饰网格、扁平硬投影等视觉特效；基于现有 `ModuleConfig` 持久化支持 **增强时钟与问候语**、**云端便签（Memo）** 与 **沙箱 Iframe / Widget 卡片**。
- **管理员自定义 CSS / JS 管理器**：仅管理员可编辑的数据库持久化代码片段（前端 `try/catch` 隔离、哈希去重注入），与既有 `/custom/index.css`、`/custom/index.js` 共存互补。
- **防锁死安全模式（Safe Mode）**：访问 `/?safe=1`（或 Hash 路由 `#/?safe=1`）即可跳过自定义 CSS/JS 注入并显示顶部救援提示条，避免错误脚本导致页面无法操作。

### 导航与运维基础能力
- **分组与卡片管理**：支持分组拖拽排序、每个分组独立设置卡片样式（详情大卡片 / 小图标 / 跟随全局）；卡片支持默认地址与内网地址一键切换，右键菜单可直接按任意地址以当前页、新标签或页内小窗打开。
- **高性能首页加载**：一次请求加载分组、样式与排序后的卡片；支持顶部加载条、加载失败保留卡片并重试、按已确认身份隔离的本地卡片缓存与 `/clear` 缓存清理页。
- **搜索栏与自定义引擎**：支持 `/` 快捷键快速聚焦（不抢占输入框与中文输入法）、本地项目筛选，以及登录用户自定义搜索引擎增删改与排序。
- **自有图库与公共图库**：上传文件管理支持按图标 / 壁纸 / 未分类筛选、按文件名搜索、分页、批量上传与批量删除；管理员可将自己的图片设为公共图库供其他已登录账号选用。
- **多账号切换与公开模式**：支持多账号隔离与访客公开模式；可在同一浏览器记住多个已登录会话并快速切换（不保存密码）。
- **整站备份与覆盖恢复**：管理员支持导出 SQLite 一致性快照（含数据库、上传文件、`conf/conf.ini`、`web/custom` 及 SHA-256 清单），并支持带二次确认和失败回滚的整站覆盖恢复。
- **系统状态监控**：支持查看主机 CPU、内存与磁盘使用率。

## 设计资产与 Tokens

仓库内置完整的设计规范与图标构建流水线，可直接导入 Figma Tokens Studio 或用于二次定制：

- `design/logos/`：3 套纯平几何矢量 Logo 原稿（含单色版本，默认启用 Concept B 包豪斯圆方几何 `L`）
- `design/tokens.json`：兼容 Figma Tokens Studio / W3C Design Tokens 的全局与 5 套主题 Token 定义
- `scripts/build-brand-assets.py`：一键从矢量原稿生成 `favicon.svg`、`favicon-black.svg`、`favicon.ico`、`logo.png`、`doc/images/logo.png`、`pwa-192x192.png`、`pwa-512x512.png` 与 `apple-touch-icon.png`

```sh
python3 scripts/build-brand-assets.py --logo b
```

## 快速部署（Docker）

默认使用内置 SQLite 数据库，无需额外部署数据库服务：

```sh
docker compose up -d --build
```

启动后访问 `http://<你的IP>:3002`。默认持久化挂载目录为 `./conf`、`./uploads` 和 `./database`。

首次初始化将自动生成默认管理员账号，**部署后请务必立即修改密码**：

- 默认账号：`admin@leon.local`
- 默认密码：`12345678`

> 若从旧版本迁移，直接沿用原有持久化目录即可，无需变更数据库表结构或挂载配置。

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
rm -f bindata.go
go test ./...
go build -o leon-panel main.go
```

### 版本约定

- `package.json` 与 `service/assets/version` 必须保持一致（SemVer 格式 `X.Y.Z`），由 `pnpm run version:check` 和 CI 校验。
- Git 发布标签使用 `v<version>`（例如 `v0.1.0`），Docker 镜像标签使用 `<version>`（例如 `0.1.0`）。

## 功能截图参考

<details>
<summary>展开查看页内小窗与基础卡片模式示例</summary>

![SSH 小窗口](./doc/images/window-ssh.png)
![下载工具小窗口](./doc/images/window-xunlei.png)

</details>

## 许可证

本项目采用 [MIT License](./LICENSE) 开源。
