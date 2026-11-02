# PriceWatch Local — Classic UI 设计

## 目标与原则

从原始 `PriceWatch(3).zip` 中的 `web` 和 `private-web` 页面提取交互与风格，同时保留已验证的新 SQLite 本地系统：

- 一套界面（Next.js），一份 SQLite，一个独立 Python/Playwright 爬虫。
- 使用原网页的蓝灰品牌色 `#5576a3`、`#dce8f5`、横向导航、商品价格卡片、筛选工具、目标价和历史曲线。
- 直接基于 SQLite Server Components/Server Actions 读取和修改数据，不使用云认证或 .NET 后端。
- **源码文件不超过 200 行**；每个源文件有用途注释，便于维护。
- Windows Task Scheduler 负责自动调度；网页 Schedule 标签可以立即触发同一任务。

## 页面结构

| 路径 | 用途 | SQLite |
| --- | --- | --- |
| `/` | Products、搜索、状态过滤、商品卡片 | `tracked_items`, `item_sources`, `price_history` |
| `/subscriptions` | Subscriptions 的同款卡片 | 同上 |
| `/items/new` | 添加商品或订阅 | `tracked_items` |
| `/items/[id]` | 编辑、归档/恢复、来源、手动报价、趋势图 | `tracked_items`, `item_sources`, `price_history`, `best_price_states` |
| `/reviews` | 查看/批准/拒绝可疑报价 | `scrape_results`, `price_history`, `best_price_states` |
| `/runs` | 爬虫运行及单条结果 | `scrape_runs`, `scrape_results` |
| `/email` | SMTP 配置、测试发送、历史价格提醒 | `local_email_settings`, `price_alert_events` |
| `/schedule` | 显示 Windows 计划任务状态，Run now 立即触发 | 不直接读写 SQLite；调度信息来自 Windows |

## 关键目录

```text
app/                 Next.js 路由与服务端表单动作
components/          原设计风格的导航、商品卡片、筛选、价格图
lib/db.ts            SQLite 打开、事务、参数化查询
lib/queries.ts       页面只读查询
lib/write-*.ts       商品、来源、报价变更
lib/reviews.ts       可疑价格的审核逻辑
lib/email-settings.ts SMTP 配置本地读写
scraper/run_once.py  独立爬虫入口
scraper/price_store.py 结果保存与最低价更新
scraper/mail_alerts.py 邮件触发、SMTP 发送、幂等事件
scraper/pricewatch/*  继承原来的提取/公共网络安全组件
scripts/             数据健康检查和 Windows 一键测试
```

## 数据库约定

保留迁移过来的 8 张业务表：`tracked_items`, `item_sources`, `scrape_runs`, `scrape_results`, `price_history`, `best_price_states`, `best_price_state_sources`, `price_alert_events`。无需清空或转换旧数据。本版在第一次访问邮件页面时**额外创建** `local_email_settings` 单行配置表。

- 默认路径为 `data/pricewatch.sqlite3`；所有 SQL 参数绑定。
- 网站 Server Actions 写入短事务；SQLite 外键检查开启，锁等待 10 秒。
- 爬虫写入同一数据库，使用独立文件锁并设置锁等待；不启用 WAL。
- 迁移快照 `migration_audit` 只代表导出时的数据校验，业务变动后不会更新。
- 对价格的单位处理沿用现有 `comparison_quantity` 和 `default_quantity`。
- 归档来源不参与最低价；恢复商品后追踪保持关闭。

## 可疑价格处理

Playwright 抓取相对来源的上次单位价变化超过 80% 时，结果为 `Suspicious`，不会直接进入价格历史。`Reviews` 标签将这类 `Pending` 结果列出；审批时插入 `price_history` 并更新 `best_price_states`，拒绝时只保存审核状态。失败的抓取不会写入价格。

## 邮件提醒

邮件设置来自 `local_email_settings`：`enabled`, `smtp_host`, `smtp_port`, `use_tls`, `username`, `password`, `from_address`, `to_address`。默认关闭。密码**明文保存在 SQLite**，页面不返回密码，使用者必须自行保护文件，推荐使用一次性/专用 SMTP App Password。初次使用需重新填写（旧 .NET SMTP 配置未迁移）。

`python scraper/run_once.py` 在一轮抓取结束并提交价格后，调用 `mail_alerts.send_alerts()`：

1. 查询本轮新增的 `best_price_states`，确认商品启用追踪、目标单位价存在、最低价不高于目标。
2. `INSERT OR IGNORE` 一个 `price_alert_events`，该表对 `best_price_state_id` 唯一；这样每个最低价状态**至多发送一次**。
3. 通过 Python 标准库 `smtplib` 发送：465 端口使用隐式 TLS，其他端口在启用 TLS 时使用 STARTTLS。
4. 将状态更新成 `Sent` 或 `Failed` 并保存时间/错误；邮件失败不改变爬虫抓取结果。失败事件目前不会自动重试。
5. 点击网页的测试邮件按钮，Next.js 服务端调用同一个 Python 模块发送测试，不创建价格提醒事件。

只有新爬虫实际运行时才产生自动邮件；设置页面本身不提供调度器。**手动价格和人工审核不自动发送邮件**。新状态未创建或邮件未启用时，不会对历史低价补发。

## 安全和限制

- 服务仅绑定 `127.0.0.1`，没有公共认证；禁止转发到互联网。
- 旧版 React 界面是按源代码复现的结构与风格，不依赖 Tailwind、shadcn 或 MSAL；个别页面布局和细节不会逐像素相同。
- SMTP host 等设置只供本地使用；对凭据不做加密，文件备份必须私有。
- Python 爬虫沿用旧版 URL 公网安全限制；请不要绕过。
- 邮件测试要求 Next.js 运行环境能找到 Python（可用 `PRICEWATCH_PYTHON` 指定）。
- Windows Task Scheduler 通过独立 `scripts/run-scraper.ps1` 运行 Python，与网站生命周期无关。`scripts/install-scheduler.ps1` 在用户主动执行时注册/更新任务。
- 当前运行环境无法下载 npm 依赖，因此完整 Next.js 构建必须由 Windows `verify-all.ps1` 验证。

## 验收与切换

1. 在独立文件夹解压，本机将现有 SQLite **复制成副本**。不要覆盖原项目。
2. 运行 `scripts/verify-all.ps1`；确认 Products/Subscriptions、Reviews、Runs、Email 和详情页能打开。
3. 在副本中试做新增商品、改目标价、录入手工价格、归档/恢复，刷新后确认数据仍在。
4. 检查 `/email` 重新填写 SMTP 设置，通过发送测试邮件确认邮件服务器连接正常。
5. 在副本中手动执行一次 Python 爬虫，核对 `/runs` 和价格历史，再观察是否生成符合条件的提醒。
6. 本版可显式注册新的 Windows 计划任务；只有在新项目验收后才停用旧任务，避免重复抓取。

## Windows 任务计划与 Run now（新版）

- `scripts/install-scheduler.ps1` 注册每天 09:00（可配置）的 `\PriceWatchLocalScraper`，运行当前 Windows 用户的 Python，采用 Interactive 登录方式与 `IgnoreNew`；计划任务注册是**显式步骤**，解压和 npm 启动不会注册任务。
- `scripts/run-scraper.ps1` 以项目绝对路径调用 `scraper/run_once.py`；注入 `PRICEWATCH_SQLITE_PATH`、保存每次 stdout/stderr 和退出码，异常同样返回非零码。
- `app/api/scheduler/route.ts` 的 GET 查看任务状态；POST 固定执行 `schtasks.exe /Run /TN \PriceWatchLocalScraper`。不接收用户提供的命令，校验本地 Host 和写入请求 Origin；Next.js 只能监听回环地址，不能公网发布。
- `components/scheduler-control.tsx` 每五秒刷新状态，Run now 后提示用户到 `/runs` 查看实际抓取结果。由于调度程序只负责触发，不能保证所有商品均成功。
- SQLite 仍由 Python 抓取进程写入，网页不会直接启动 Playwright 或创建其他后台进程。Python 文件锁防止网站按钮、计划运行和 CLI 并行抓取。
- 默认用户必须处于已登录状态；如果需要注销后运行，应单独变更 Windows 任务的安全上下文。
