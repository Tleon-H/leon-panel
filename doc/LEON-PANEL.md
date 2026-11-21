# Leon Panel 技术与运维说明

当前版本：`0.1.0`（内部结构版本码 `1`）。仓库为 [Tleon-H/leon-panel](https://github.com/Tleon-H/leon-panel)，采用 [MIT License](../LICENSE)。

## 功能实现细节

- **首页外观预设与实时预览**：风格设置内置多套外观预设，支持按项预览（壁纸、卡片表面、图标徽章、文字颜色等）并局部或整套应用，不会意外清空已保存的其他自定义项。
- **分组独立卡片样式**：每个分组可单独设置为“跟随全局”“详情图标（大卡片）”或“小图标”。分组表 `item_icon_group` 使用可空字段 `icon_style`（`NULL` 跟随全局，`0` 详情大卡片，`1` 小图标）。
- **首页聚合加载与本地缓存**：首页通过 `includeItems` 一次获取当前账号的分组、每组样式及排序后的卡片；请求期间展示顶部加载条，失败时保留已有卡片并支持重试；按已确认身份隔离缓存首页快照，访问 `/clear` 可清除本地快照。
- **卡片右键双地址打开**：大卡片和小图标均在右键菜单中提供已填写的默认地址与内网地址，支持当前页、新标签页（`noopener`）及页内小窗打开，拒绝不安全协议。
- **搜索栏与自定义引擎**：支持 `/` 快捷键聚焦（编辑文本、中文输入法组合及弹窗期间不抢占按键）；登录后可增删改自定义搜索引擎并排序，仅接受 `http`/`https` 模板。
- **图库与公共图库**：文件按上传入口自动标记分类（图标 / 壁纸 / 未分类），支持按分类筛选、关键词搜索、分页、批量上传和批量删除（服务端逐项核对归属与路径边界）。管理员可将自己的图片标为公共，供其他已登录用户选用但不可删除。
- **多账号切换**：浏览器仅保存登录会话令牌，不保存密码；切换后按目标账号重新加载数据与设置，退出时撤销当前会话。
- **系统状态监控**：支持查看主机 CPU、内存和磁盘占用；离开页面时停止定时轮询，避免迟到响应写回。

## 管理员备份与恢复

入口位于登录后的「系统应用 → 备份导出」，仅管理员可见与可调用。

### 备份导出（`/api/backup/export`）

- **打包范围**：
  - SQLite 数据库：通过 `VACUUM INTO` 生成一致性快照（`database/database.sqlite`），并在 `manifest.json` 中记录 SQLite 版本与 `integrity_check` 结果，不直接拷贝正在写入的 `.db` / `-wal` / `-shm`。
  - 配置的上传目录（默认 `./uploads`，必须位于应用目录内）。
  - `conf/conf.ini`。
  - `web/custom`（若存在）。
- **安全与限额**：不跟随符号链接、拒绝越界路径、同一时间仅允许一次导出或恢复；单次最多约 2 万个文件、总计 512MB。MySQL 环境不提供在线导出与恢复，请使用 MySQL 原生工具备份。
- **隐私提示**：备份包包含密码哈希、密钥和私人导航配置，请妥善保管，切勿上传到公开位置。

### 整站覆盖恢复（`/api/backup/restore`）

- 页面会明确告知覆盖风险，管理员必须勾选确认并提交确认值才会执行写入。
- 服务端严格校验 `manifest.json`：来源必须为 `Leon Panel`、格式为 `1`、内部结构版本码与当前程序匹配、语义化版本号不高于当前程序；逐文件校验大小和 SHA-256，并对快照执行 `integrity_check`。
- 覆盖前先对临时解压库执行兼容迁移与校验，再将当前数据备份留存用于失败回滚；数据库通过 SQLite 在线备份写回当前连接，不中断服务。
- 端口等 `conf/conf.ini` 配置变更会在下次进程启动时生效。

## 端到端页面检查

仓库提供基于 `puppeteer-core` 的本地端到端检查脚本（需自行准备仅含示例数据的测试实例）：

```sh
BASE_URL=http://127.0.0.1:13002 E2E_USERNAME=admin@leon.local E2E_PASSWORD=你的密码 CHROME_PATH=/usr/local/bin/google-chrome node e2e/leon-flows.mjs
BASE_URL=http://127.0.0.1:13002 E2E_USERNAME=admin@leon.local E2E_PASSWORD=你的密码 E2E_MEMBER_PASSWORD=临时普通账号密码 CHROME_PATH=/usr/local/bin/google-chrome node e2e/own-gallery.mjs
BASE_URL=http://127.0.0.1:13002 E2E_USERNAME=admin@leon.local E2E_PASSWORD=你的密码 E2E_MEMBER_PASSWORD=临时普通账号密码 CHROME_PATH=/usr/local/bin/google-chrome node e2e/batch-delete.mjs
```

CI（`.github/workflows/ci.yml`）自动执行前端单元测试、TypeScript 类型检查、生产构建、`go test ./...` 及 Docker 镜像构建验证。

## 独立测试容器

```sh
docker compose -f docker-compose.leon-test.yml up --build
```

该测试栈使用独立数据目录 `./leon-test-data` 与主机端口 `13002`，不会影响正式数据目录。
