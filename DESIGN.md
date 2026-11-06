# PriceWatch Local — Classic UI 设计

## 目标与原则

从原始 `PriceWatch(3).zip` 中的 `web` 和 `private-web` 页面提取交互与风格，同时保留已验证的新 SQLite 本地系统：

- 一套界面（Next.js），一份 SQLite，一个独立 Python/Playwright 爬虫。
- 使用原网页的蓝灰品牌色 `#5576a3`、`#dce8f5`、横向导航、商品价格卡片、筛选工具、目标价和历史曲线。
- 直接基于 SQLite Server Components/Server Actions 读取和修改数据，不使用云认证或 .NET 后端。
- **源码文件不超过 200 行**；每个源文件有用途注释，便于维护。
- Windows Task Scheduler 负责自动调度；网页 Schedule 标签可直接注册、修改、运行、停止、启用、禁用、删除同一任务。

## 页面结构

| 路径 | 用途 | SQLite |
| --- | --- | --- |
| `/` | Products、搜索、状态过滤、商品卡片 | `tracked_items`, `item_sources`, `price_history` |
| `/subscriptions` | Subscriptions 的同款卡片 | 同上 |
| `/items/new` | 添加商品或订阅 | `tracked_items` |
| `/items/[id]` | 编辑、归档/恢复、来源、手动报价、趋势图 | `tracked_items`, `item_sources`, `price_history`, `best_price_states` |
| `/reviews` | 查看/批准/拒绝可疑报价 | `scrape_results`, `price_history`, `best_price_states` |
| `/runs` | 爬虫运行及单条结果 | `scrape_runs`, `scrape_results` |
| `/notifications` | Windows 本地通知测试、已有目标价提醒记录 | `price_alert_events` |
| `/schedule` | 显示 Windows 计划任务状态，并从页面安装/调整每日或每周任务、手动运行/停止/启停/删除 | 不直接读写 SQLite；调度信息来自 Windows |

## 关键目录

```text
app/                 Next.js 路由与服务端表单动作
components/          原设计风格的导航、商品卡片、筛选、价格图
lib/db.ts            SQLite 打开、事务、参数化查询
lib/queries.ts       页面只读查询
lib/write-*.ts       商品、来源、报价变更
lib/reviews.ts       可疑价格的审核逻辑
lib/alerts.ts       价格提醒事件历史查询
scraper/run_once.py  独立爬虫入口
scraper/price_store.py 结果保存与最低价更新
scraper/windows_alerts.py 目标价提醒去重、Windows 通知提交
scraper/pricewatch/*  继承原来的提取/公共网络安全组件
scripts/             数据健康检查和 Windows 一键测试
```

## 数据库约定

保留迁移过来的 8 张业务表：`tracked_items`, `item_sources`, `scrape_runs`, `scrape_results`, `price_history`, `best_price_states`, `best_price_state_sources`, `price_alert_events`。无需清空或转换旧数据。旧版 `local_email_settings` 表不读取、不修改（如存在则继续保留）。

- 默认路径为 `data/pricewatch.sqlite3`；所有 SQL 参数绑定。
- 网站 Server Actions 写入短事务；SQLite 外键检查开启，锁等待 10 秒。
- 爬虫写入同一数据库，使用独立文件锁并设置锁等待；不启用 WAL。
- 迁移快照 `migration_audit` 只代表导出时的数据校验，业务变动后不会更新。
- 对价格的单位处理沿用现有 `comparison_quantity` 和 `default_quantity`。
- 归档来源不参与最低价；恢复商品后追踪保持关闭。

## 可疑价格处理

Playwright 抓取相对来源的上次单位价变化超过 80% 时，结果为 `Suspicious`，不会直接进入价格历史。`Reviews` 标签将这类 `Pending` 结果列出；审批时插入 `price_history` 并更新 `best_price_states`，拒绝时只保存审核状态。失败的抓取不会写入价格。

## Windows 桌面通知（替换邮件通道）

`python scraper/run_once.py` 在抓取完成并提交价格后，调用 `windows_alerts.send_alerts()`。仅**替换通知方式**，目标价判断和既有 SQLite 去重机制不变：

1. 查询本轮新增的 `best_price_states`，仅限未归档、启用追踪、目标单位价存在，且抓取最低价**小于或等于**目标价的商品。
2. `INSERT OR IGNORE` 到旧的 `price_alert_events` 表；`best_price_state_id` 唯一。已有状态（包括以前的邮件记录）不会再次通知。
3. 每次扫描最多发送一个汇总 Windows Shell 通知，展示最多三个商品的名称、现价、目标价，多出的商品在 Notifications 页面可见。Python 通过标准输入传 JSON 给固定的 `scripts/show-notification.ps1`，没有把抓取标题插入 PowerShell 命令行。
4. 使用 Windows 内建的 WinForms `NotifyIcon.ShowBalloonTip` 调用 Shell 通知，不增加 Python 第三方依赖；记录 `Sent`（已提交）或 `Failed`。通知失败不改变爬虫抓取结果，沿用旧版失败不自动重试的行为。
5. `/notifications` 用原有事件表显示历史，并可发送不写入数据库的测试通知。以前已发送的邮件事件依旧显示为历史提醒。

旧版 SMTP/DPAPI 代码已移除，但**不会自动删除**用户 SQLite 中遗留的 `local_email_settings` 表或备份，以免意外丢失用户数据。Windows 10 可显示横幅，Windows 11 的通知可能是短暂横幅而不保留在通知中心；通知还会受到勿扰模式影响。Windows Scheduler 必须使用已登录的交互式 Windows 用户会话运行。

## 安全和限制

- 服务仅绑定 `127.0.0.1`，没有公共认证；禁止转发到互联网。
- 旧版 React 界面是按源代码复现的结构与风格，不依赖 Tailwind、shadcn 或 MSAL；个别页面布局和细节不会逐像素相同。
- Windows 通知需要交互式 Windows 会话；勿扰模式可能抑制横幅，成功提交不代表用户一定看见。
- Python 爬虫对 HTTP(S) 全部请求及自动重定向逐跳做公网校验，通过 APIRequestContext `max_redirects=0` 手工处理；关闭 Service Workers、WebSockets、下载，按商品新建浏览器 context，并限制资源数/跳转数/大小。DNS 检查与真实连接之间仍存在竞态，不等于 OS 层的隔离。
- Windows 通知测试要求 Next.js 运行环境能找到 Python（可用 `PRICEWATCH_PYTHON` 指定），不新增依赖。
- Windows Task Scheduler 通过独立 `scripts/run-scraper.ps1` 运行 Python，与网站生命周期无关。`scripts/manage-scheduler.ps1` 在用户通过本机网页操作时注册/更新任务（旧 `install-scheduler.ps1` 为命令行兼容入口）。
- 当前运行环境无法下载 npm 依赖，因此完整 Next.js 构建必须由 Windows `verify-all.ps1` 验证。

## 验收与切换

1. 在独立文件夹解压，本机将现有 SQLite **复制成副本**。不要覆盖原项目。
2. 运行 `scripts/verify-all.ps1`；确认 Products/Subscriptions、Reviews、Runs、Notifications 和详情页能打开。
3. 在副本中试做新增商品、改目标价、录入手工价格、归档/恢复，刷新后确认数据仍在。
4. 打开 `/notifications`，使用测试按钮确认当前交互式桌面能出现本地通知。
5. 在副本中手动执行一次 Python 爬虫，核对 `/runs` 和价格历史，再观察是否生成符合条件的提醒。
6. 本版可显式注册新的 Windows 计划任务；只有在新项目验收后才停用旧任务，避免重复抓取。

## Windows 任务计划与 Run now（新版）

- `scripts/manage-scheduler.ps1` 在 Schedule 页面选定每日或每周时间时注册（原安装脚本仍可调用）的 `\PriceWatchLocalScraper`，运行当前 Windows 用户的 Python，采用 Interactive 登录方式与 `IgnoreNew`；计划任务注册是**用户在网页点击保存时才会发生**，解压和 npm 启动不会注册任务。
- `scripts/run-scraper.ps1` 以项目绝对路径调用 `scraper/run_once.py`；注入 `PRICEWATCH_SQLITE_PATH`、保存每次 stdout/stderr 和退出码，异常同样返回非零码。
- `app/api/scheduler/route.ts` 的 GET 查看任务状态；POST 仅接收预定义操作及校验过的时间/星期，通过 `execFile` 调用固定的 `manage-scheduler.ps1` 文件。不接收用户提供的命令，校验本地 Host 和写入请求 Origin；Next.js 只能监听回环地址，不能公网发布。
- `components/scheduler-control.tsx` 每五秒刷新状态并支持安装、更新、运行、停止、启停和删除。由于调度程序只负责触发，不能保证所有商品均成功。
- SQLite 仍由 Python 抓取进程写入，网页不会直接启动 Playwright 或创建其他后台进程。Python 文件锁防止网站按钮、计划运行和 CLI 并行抓取。
- 默认用户必须处于已登录状态；如果需要注销后运行，应单独变更 Windows 任务的安全上下文。
