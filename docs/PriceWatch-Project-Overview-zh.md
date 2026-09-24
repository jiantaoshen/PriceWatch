# Price Watch 项目说明

## 项目概述

Price Watch 是一个个人使用的商品价格追踪与订阅支出管理系统，由云端 Web 应用、本地私有管理界面和本地抓取流程组成。

系统将两个不同领域分开处理：

- **Product**：追踪商品价格、来源、目标价格、价格历史和抓取结果。
- **Subscription**：记录持续性的订阅支出，重点关注名称、月费、货币和归档状态。

云端应用负责商品、订阅、审核流程和价格历史管理；独立的本地 `private-web` 用于抓取运行和调度。

两个前端保持独立，但通过 npm workspaces 共享设计系统、UI 组件、通用类型、格式化工具和 HTTP 基础设施。

## 要解决的问题

同一商品在不同商店可能具有不同包装规格和数量，只比较页面上的总价无法公平判断哪个来源真正更便宜。

Price Watch 会根据数量将商品价格标准化为可比较的单位价格，并记录价格历史。

商品可以使用手动、自动或混合更新方式。自动抓取过程中出现的可疑价格不会直接进入正式价格历史，而是先进入审核流程。

与此同时，系统也需要记录持续性的订阅支出，但订阅并不存在目标价格、抓取来源、价格历史等商品概念，因此 Subscription 被设计为独立且更简单的支出模型。

## 解决方案

系统将云端数据管理、本地浏览器自动化和共享前端基础分离。

云端 Next.js 应用通过 Microsoft Authentication 获取 Access Token，并通过经过认证的 ASP.NET Core Web API 访问数据。

Web API 使用 EF Core 和 Npgsql 连接 Neon PostgreSQL，并负责主要业务规则和数据持久化。

独立的本地 `private-web` 与 `PriceWatch.Private` 通信，由后者负责启动 Python Playwright 抓取器。抓取结果经过验证后写回同一个 production 数据库。

两个前端通过 npm workspaces 共享：

```text
design-system
ui
shared
api
```

从而保持视觉、类型和 HTTP 基础设施一致，同时仍然允许 Cloud Web 与 Private Web 独立运行和部署。

## 核心功能

### 商品价格追踪

Product 用于管理真正需要价格比较和历史分析的商品。

每个商品可以包含：

```text
名称
货币
单位
目标价格
比较数量
更新模式
Tracking 状态
Archive 状态
多个价格来源
```

Product 支持：

```text
Manual
Automatic
Hybrid
```

三种更新模式。

### 订阅支出管理

Subscription 用于记录周期性固定支出，而不是进行商品价格追踪。

用户主要管理：

```text
Name
Monthly Price
Currency
```

订阅不会暴露 Product 的：

```text
Target Price
Previous Price
Update Mode
Tracking
Check Interval
Sources
Price History
```

等概念。

Active Subscription 会计入月度总支出。

Archived Subscription 表示订阅已经取消或停止，不再计入 Monthly Total，但历史记录仍然保留，并可以 Restore。

### 多来源商品价格比较

每个 Product 可以配置多个商店来源。

系统同时保存来源价格和数量信息，并计算标准化单位价格，从而公平比较不同包装规格。

例如：

```text
100 SEK / 2 kg
→ 50 SEK / kg

60 SEK / 1 kg
→ 60 SEK / kg
```

因此即使页面总价不同，也可以基于统一单位进行比较。

### 价格历史

Product 的有效价格变化会写入价格历史。

价格历史用于：

```text
观察长期变化
比较历史价格
识别价格下降或上涨
分析当前价格位置
```

只有已经接受或确认的价格才会成为正式历史数据。

### 手动、自动与混合更新

Product 可以使用：

```text
Manual
→ 用户维护价格

Automatic
→ Playwright 自动抓取

Hybrid
→ 同时存在人工和自动来源
```

不同来源最终统一转换为可比较的价格数据。

### 审核流程

自动抓取到的异常或可疑价格不会立即成为正式价格。

它们可以进入 Pending Review，并由用户：

```text
Accept
Reject
Manual Override
```

审核完成以后，确认的数据才会进入正式价格状态和价格历史。

这种设计避免错误抓取污染长期历史数据。

### Archive 与 Restore

Archive 不等于 Delete。

系统使用：

```text
ArchivedAt
```

表示项目是否归档。

对于 Product，Archive 表示停止当前追踪，但保留：

```text
Sources
Price History
最后已知价格
其他历史数据
```

Restore 会重新恢复项目的 Active 状态。

对于 Subscription，Archive 表示订阅已经停止，并将其从月度总支出中排除。

Delete 主要用于删除错误或重复记录。

### 本地抓取

Python Playwright 只在本地设备运行。

云端 Web API：

```text
不会启动浏览器
不会管理本地浏览器进程
不会暴露本地抓取环境
```

抓取编排保留在：

```text
private-web
↓
PriceWatch.Private
↓
Python Playwright
```

这一可信本地环境中。

## 前端数据加载架构

Cloud Web 统一采用：

```text
Auth
↓
Access Token
↓
fetchXxxData()
↓
apiFetch()
↓
ASP.NET Core API
↓
React State
↓
Render
```

其中：

```text
AuthProvider
→ 登录状态和 Access Token

fetchXxxData
→ 获取和组合数据

apiFetch / request
→ HTTP transport

React Page
→ Loading / Error / Data 状态
```

Fetch 函数只负责读取和返回数据，不直接修改 React State。

API 请求统一使用：

```text
Authorization: Bearer <token>
cache: no-store
```

用户执行 Archive、Restore、Review 等操作后，前端通常会重新读取服务器状态，而不是在浏览器中复制后端业务逻辑。

## 挑战与决策

### Product 与 Subscription 分离

早期 Subscription 复用了较多 Product 概念。

随着功能发展，项目明确将两者分开：

```text
Product
→ price tracking

Subscription
→ recurring expense tracking
```

这样 Subscription UI 可以保持简单，而商品价格追踪逻辑不会被无关字段污染。

### 分离云端与私有组件

Cloud Web 和 Web API 可以独立部署，而抓取编排和浏览器自动化始终保留在可信本地设备。

这样既保持云端服务简单，也避免将 Playwright 和本地抓取环境暴露到公网。

### 共享前端基础

Cloud Web 与 Private Web 是两个独立 Next.js 应用。

它们不共享页面业务逻辑，但通过 npm workspaces 共享：

```text
Design System
UI Components
Shared Types / Utilities
HTTP Infrastructure
```

这样既保持应用职责独立，也避免重复维护基础代码。

### 保持价格比较一致

不同商品来源可能存在不同数量和包装规格。

系统不直接使用页面总价进行判断，而是基于数量计算标准化单位价格。

因此商品比较具有统一标准。

### Archive 与 Delete 分离

Archive 用于停止当前使用或追踪，同时保留历史。

Delete 用于真正删除错误或重复的数据。

这可以避免为了“暂时不用”而丢失历史记录。

### 单一 Production 数据库

云端服务和本地正式运行组件使用同一个 Neon PostgreSQL production 数据库。

本地抓取结果、Cloud Web 操作和 Web API 数据因此始终基于同一个数据源。

当前本地开发环境也使用同一数据源，以减少多数据库同步和维护复杂度。

## 部署

当前主要部署结构：

```text
Cloud Web
→ Vercel

ASP.NET Core Web API
→ Azure App Service

PostgreSQL
→ Neon

private-web
→ Local

PriceWatch.Private
→ Local

Python Playwright Scraper
→ Local
```

Cloud Web 通过经过认证的 Web API 访问数据。

本地私有组件直接承担抓取和调度职责，并与 production 数据保持同步。

## 后续更新

后续开发将主要集中在：

```text
提高抓取稳定性
完善审核流程
改善错误处理
增加通知能力
增强长期价格分析
增加测试覆盖
继续统一 Cloud / Private Web 开发规范
```

随着数据量和前端复杂度增加，再评估是否需要引入更复杂的缓存、Retry 或客户端数据管理方案。

## 补充说明

### 项目背景

Price Watch 是一个个人使用并持续维护的全栈项目。

它用于解决真实的商品价格追踪和订阅支出管理需求，同时实践：

```text
Next.js
React
TypeScript
ASP.NET Core
EF Core
PostgreSQL
Microsoft Authentication
Vercel
Azure
Neon
Python
Playwright
npm Workspaces
Shared UI Architecture
Multi-runtime System Design
```

项目当前的主要设计原则可以概括为：

```text
Product ≠ Subscription

Archive ≠ Delete

Automatic Data ≠ Trusted Data

Auth ≠ Fetch ≠ State

Cloud ≠ Local Scraping

Frontend ≠ Business Logic
```

整体架构已经从早期功能原型逐渐进入以**清晰职责、统一规范、稳定运行和长期维护**为重点的阶段。
