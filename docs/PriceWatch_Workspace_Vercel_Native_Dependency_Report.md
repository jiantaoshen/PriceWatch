# PriceWatch 前端 Workspace 迁移后 Vercel 构建失败问题报告

## 1. 背景

PriceWatch 原本的两个 Next.js 前端分别独立维护：

```text
PriceWatch/
├── web/
│   ├── package.json
│   ├── package-lock.json
│   └── node_modules/
│
└── private-web/
    ├── package.json
    ├── package-lock.json
    └── node_modules/
```

后续为了共享 UI、主题、格式化工具和 HTTP 基础设施，前端结构调整为 npm workspaces：

```text
PriceWatch/
├── package.json
├── package-lock.json
│
├── web/
├── private-web/
│
└── packages/
    ├── api/
    ├── design-system/
    ├── shared/
    └── ui/
```

根目录 `package.json` 统一管理 workspace：

```json
{
  "name": "pricewatch",
  "private": true,
  "workspaces": [
    "web",
    "private-web",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm run dev --workspace=web",
    "dev:private": "npm run dev --workspace=pricewatch-private-web",
    "build:web": "npm run build --workspace=web",
    "build:private": "npm run build --workspace=pricewatch-private-web"
  }
}
```

两个旧的 lockfile 被删除：

```text
web/package-lock.json
private-web/package-lock.json
```

整个仓库只保留：

```text
PriceWatch/package-lock.json
```

本地 Windows 环境中：

```powershell
npm run build:web
```

可以正常通过。

---

## 2. 问题出现

迁移到 workspace 后，Vercel 构建失败。

第一阶段错误：

```text
Error: Cannot find module '../lightningcss.linux-x64-gnu.node'
```

错误出现在：

```text
./web/app/globals.css
```

但实际并不是 `globals.css` 本身存在语法错误，而是构建 CSS 时使用的 Lightning CSS native binding 缺失。

随后补充处理后，错误进一步变成：

```text
Error: Cannot find native binding.
Cannot find module '@tailwindcss/oxide-linux-x64-gnu'
```

并且 Vercel 日志明确显示：

```text
Error: Cannot find module './tailwindcss-oxide.linux-x64-gnu.node'
```

调用链包括：

```text
@tailwindcss/oxide
@tailwindcss/postcss
web/app/globals.css
```

---

## 3. 为什么本地能 Build，Vercel 却失败

本地开发环境是 Windows，而 Vercel 构建环境是 Linux x64。

Tailwind CSS 4 和 Lightning CSS 都依赖 native binary。

Tailwind CSS 4 的底层结构大致如下：

```text
@tailwindcss/postcss
        │
        ▼
@tailwindcss/oxide
        │
        ├── Windows
        │   └── @tailwindcss/oxide-win32-x64-msvc
        │
        ├── macOS
        │   └── @tailwindcss/oxide-darwin-...
        │
        └── Linux x64 glibc
            └── @tailwindcss/oxide-linux-x64-gnu
```

Lightning CSS 同样如此：

```text
lightningcss
    │
    ├── Windows
    │   └── lightningcss-win32-x64-msvc
    │
    └── Linux x64 glibc
        └── lightningcss-linux-x64-gnu
```

因此：

```text
Windows 本地
→ 加载 Windows native binary
→ npm run build:web 成功

Vercel Linux
→ 需要 Linux native binary
→ 如果没有安装
→ Next.js / Tailwind 构建失败
```

---

## 4. 为什么 Workspace 迁移后才暴露问题

Workspace 本身并不要求安装 Linux binary。

真正变化的是依赖管理方式。

迁移前：

```text
web/
├── package.json
├── package-lock.json
└── node_modules/
```

`web` 是一个独立 npm 项目。

迁移后：

```text
PriceWatch/
├── package.json
├── package-lock.json
├── web/
├── private-web/
└── packages/
```

现在整个 monorepo 共用：

```text
root package-lock.json
```

而这份 lockfile 是在 Windows 上生成的。

npm 对跨平台 `optionalDependencies` 的 lockfile 处理存在已知问题。某些情况下，在 Windows 上生成的 dependency tree 会正确包含 Windows native binary，却没有在最终安装过程中正确保留或安装 Linux 对应的 optional native package。

因此真正的链路是：

```text
迁移 npm workspaces
        ↓
改为共用 root package-lock.json
        ↓
root lockfile 在 Windows 上生成
        ↓
Tailwind / Lightning CSS 的跨平台 optional dependency 处理出现问题
        ↓
本地 Windows 构建正常
        ↓
Vercel Linux 构建缺少 native binary
        ↓
Build failed
```

所以更准确地说：

> 不是 workspace 需要额外安装这些包，而是 workspace 迁移后，共享 lockfile 暴露了 Windows → Linux 的 optional native dependency 问题。

---

## 5. 第一次排查：确认本地构建

首先验证 workspace 本身没有问题：

```powershell
npm run build:web
```

结果：

```text
✓ Compiled successfully
✓ Finished TypeScript
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
```

因此可以排除：

```text
Next.js 页面代码错误
TypeScript 错误
shared package import 错误
普通 CSS 语法错误
```

问题集中到：

```text
Vercel Linux 环境
+
native optional dependencies
```

---

## 6. 第二次排查：Lightning CSS

Vercel 最初报错：

```text
Cannot find module '../lightningcss.linux-x64-gnu.node'
```

首先检查根目录 lockfile：

```powershell
Select-String `
  -Path .\package-lock.json `
  -Pattern "lightningcss-linux-x64-gnu"
```

发现：

```text
lightningcss-linux-x64-gnu: 1.32.0
```

但仅仅出现 package 名称并不能证明 lockfile 中真的存在完整 package entry。

更精确的检查方式是：

```powershell
Select-String `
  -Path .\package-lock.json `
  -Pattern '"node_modules/lightningcss-linux-x64-gnu"' `
  -Context 0,15
```

真正有效的 lockfile entry 应类似：

```json
"node_modules/lightningcss-linux-x64-gnu": {
  "version": "1.32.0",
  "cpu": [
    "x64"
  ],
  "optional": true,
  "os": [
    "linux"
  ]
}
```

为避免 Vercel 安装阶段遗漏 Linux binary，在根目录 `package.json` 中显式加入：

```json
"optionalDependencies": {
  "lightningcss-linux-x64-gnu": "1.32.0"
}
```

---

## 7. 第三次排查：Tailwind Oxide

Lightning CSS 处理后，Vercel 的下一个错误变成：

```text
Cannot find module '@tailwindcss/oxide-linux-x64-gnu'
```

这说明 Lightning CSS 不再是第一个阻塞点，但 Tailwind CSS 4 的 native engine 同样缺少 Linux binary。

先确认当前 Tailwind Oxide 版本：

```powershell
npm ls @tailwindcss/oxide
```

输出：

```text
@tailwindcss/oxide@4.3.3
```

因此 Linux native package 必须使用完全一致的版本：

```text
@tailwindcss/oxide-linux-x64-gnu@4.3.3
```

最终根目录 `package.json` 调整为：

```json
{
  "name": "pricewatch",
  "private": true,
  "workspaces": [
    "web",
    "private-web",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm run dev --workspace=web",
    "dev:private": "npm run dev --workspace=pricewatch-private-web",
    "build:web": "npm run build --workspace=web",
    "build:private": "npm run build --workspace=pricewatch-private-web"
  },
  "optionalDependencies": {
    "@tailwindcss/oxide-linux-x64-gnu": "4.3.3",
    "lightningcss-linux-x64-gnu": "1.32.0"
  }
}
```

---

## 8. 为什么放在 optionalDependencies

这两个包都不是 PriceWatch 的业务依赖。

它们只是底层 CSS 构建工具在 Linux 环境中使用的 native binary。

使用：

```json
"optionalDependencies"
```

而不是：

```json
"dependencies"
```

是因为：

```text
Windows
→ Linux binary 不适用
→ npm 可以跳过
→ 本地开发不受影响

Vercel Linux
→ Linux binary 适用
→ npm 安装
→ Tailwind / Lightning CSS 正常运行
```

所以它们本质上是：

> 针对 Windows 开发 + Linux 部署环境的跨平台构建 workaround。

---

## 9. Lockfile 重新生成尝试

排查过程中尝试过重新生成 root lockfile：

```powershell
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
Remove-Item -Force .\package-lock.json -ErrorAction SilentlyContinue

npm install
```

原因是 npm 官方错误信息本身也提示：

```text
npm has a bug related to optional dependencies.
Please try npm i again after removing both package-lock.json and node_modules directory.
```

这一步可以帮助重新建立完整 dependency tree。

但是实践中，仅重新生成 lockfile 并不能保证 Vercel Linux native binary 一定被正确安装，因此最终仍采用显式 `optionalDependencies` 的方案。

---

## 10. 尝试过但不是根因的方向

### 10.1 怀疑 globals.css

错误 trace 中出现：

```text
./web/app/globals.css
```

一开始容易误以为是 CSS 文件问题。

实际上：

```text
globals.css
→ Tailwind PostCSS
→ Tailwind Oxide / Lightning CSS
→ native binary
```

所以 `globals.css` 只是触发 CSS 构建的入口，不是错误源。

因此没有必要修改：

```text
web/app/globals.css
packages/design-system/src/styles.css
```

### 10.2 怀疑 Turbopack

日志显示：

```text
Next.js 16.3.5 (Turbopack)
```

但实际错误发生在：

```text
@tailwindcss/oxide
lightningcss
```

不是 Turbopack 自身解析失败。

因此没有必要为了这个问题：

```text
关闭 Turbopack
改用 Webpack
修改 Next.js 构建模式
```

### 10.3 怀疑 shared packages

由于刚迁移到：

```text
packages/ui
packages/design-system
packages/shared
packages/api
```

也曾需要确认是否是：

```text
@pricewatch/ui
@pricewatch/design-system
```

无法被 Vercel解析。

但本地：

```powershell
npm run build:web
```

完全成功，而且 Vercel也能进入 CSS 构建阶段，因此 workspace package resolution 本身不是本次错误原因。

### 10.4 只搜索 package 名称

一开始使用：

```powershell
Select-String `
  -Path .\package-lock.json `
  -Pattern "lightningcss-linux-x64-gnu"
```

可以看到：

```text
lightningcss-linux-x64-gnu: 1.32.0
```

但这种结果可能只是某个 package 的：

```json
"optionalDependencies": {
  "lightningcss-linux-x64-gnu": "1.32.0"
}
```

并不能证明 lockfile 中真的存在：

```text
node_modules/lightningcss-linux-x64-gnu
```

因此后续改用更准确的检查：

```powershell
Select-String `
  -Path .\package-lock.json `
  -Pattern '"node_modules/lightningcss-linux-x64-gnu"'
```

同理检查 Tailwind：

```powershell
Select-String `
  -Path .\package-lock.json `
  -Pattern '"node_modules/@tailwindcss/oxide-linux-x64-gnu"'
```

---

## 11. Vercel Build Cache 的影响

失败日志多次出现：

```text
Restored build cache from previous deployment
```

说明 Vercel 持续复用了旧 dependency cache。

在依赖结构发生重大调整时，例如：

```text
单独 web
→ npm workspaces

web/package-lock.json
→ root/package-lock.json
```

旧缓存可能继续保留不完整的 native dependency tree。

因此在提交新的 `package.json` 和 `package-lock.json` 后，需要进行：

```text
Redeploy
→ Disable existing Build Cache
```

或等价的：

```text
Clear Build Cache
Redeploy without cache
```

---

## 12. 最终解决方案

最终方案由三部分组成。

### 12.1 保留单一 Root Lockfile

项目结构保持：

```text
PriceWatch/
├── package.json
├── package-lock.json
├── web/
├── private-web/
└── packages/
```

删除：

```text
web/package-lock.json
private-web/package-lock.json
```

### 12.2 显式声明 Linux Native Optional Dependencies

根目录：

```text
PriceWatch/package.json
```

加入：

```json
"optionalDependencies": {
  "@tailwindcss/oxide-linux-x64-gnu": "4.3.3",
  "lightningcss-linux-x64-gnu": "1.32.0"
}
```

版本必须和实际上游版本一致：

```text
@tailwindcss/oxide                4.3.3
@tailwindcss/oxide-linux-x64-gnu  4.3.3

lightningcss                      1.32.0
lightningcss-linux-x64-gnu        1.32.0
```

### 12.3 重新生成并提交 lockfile

执行：

```powershell
npm install
```

检查：

```powershell
Select-String `
  -Path .\package-lock.json `
  -Pattern '"node_modules/@tailwindcss/oxide-linux-x64-gnu"' `
  -Context 0,15
```

以及：

```powershell
Select-String `
  -Path .\package-lock.json `
  -Pattern '"node_modules/lightningcss-linux-x64-gnu"' `
  -Context 0,15
```

然后：

```powershell
npm run build:web
```

通过后提交：

```powershell
git add package.json package-lock.json
git commit -m "fix: include Linux native CSS dependencies"
git push
```

最后在 Vercel进行无缓存部署。

---

## 13. 当前推荐的根 package.json

```json
{
  "name": "pricewatch",
  "private": true,
  "workspaces": [
    "web",
    "private-web",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "npm run dev --workspace=web",
    "dev:private": "npm run dev --workspace=pricewatch-private-web",
    "build:web": "npm run build --workspace=web",
    "build:private": "npm run build --workspace=pricewatch-private-web"
  },
  "optionalDependencies": {
    "@tailwindcss/oxide-linux-x64-gnu": "4.3.3",
    "lightningcss-linux-x64-gnu": "1.32.0"
  }
}
```

---

## 14. 结论

本次问题不是：

```text
Next.js bug
Tailwind CSS 配置错误
globals.css 错误
shared package 设计错误
npm workspace 本身不能用于 Vercel
```

真正的问题是：

```text
Windows 开发环境
+
npm workspaces
+
root package-lock.json
+
Tailwind CSS 4 / Lightning CSS native optional dependencies
+
Vercel Linux 构建
```

共同触发了 npm 的跨平台 optional dependency 处理问题。

最关键的判断依据是：

```text
本地 Windows build 成功
Vercel Linux 缺少 *.linux-x64-gnu native package
```

最终通过在根 `package.json` 中显式声明：

```text
@tailwindcss/oxide-linux-x64-gnu
lightningcss-linux-x64-gnu
```

并重新生成 root lockfile、清除 Vercel旧缓存，确保 Linux 构建环境能够安装所需 native binary。

---

## 15. 后续维护建议

如果未来升级 Tailwind CSS 或 Lightning CSS，需要同步检查对应 Linux binary 版本。

例如：

```powershell
npm ls @tailwindcss/oxide
npm ls lightningcss
```

如果升级为：

```text
@tailwindcss/oxide@X.Y.Z
lightningcss@A.B.C
```

那么根目录的：

```json
"optionalDependencies"
```

也应同步为：

```json
{
  "@tailwindcss/oxide-linux-x64-gnu": "X.Y.Z",
  "lightningcss-linux-x64-gnu": "A.B.C"
}
```

如果后续 npm 修复了跨平台 optional dependency lockfile 问题，或者项目改为在 Linux CI 环境中生成和维护 lockfile，可以重新评估是否仍需要这两个显式 workaround。
