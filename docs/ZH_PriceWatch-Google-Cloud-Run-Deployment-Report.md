# PriceWatch WebApi：Google Cloud Run 部署简版报告

## 1. 创建 Google Cloud Project

在 Google Cloud Console 创建新的 Project，例如：

```text
PriceWatch
```

记录 Project ID，后续 `gcloud` 使用它。

## 2. 配置 gcloud

登录：

```powershell
gcloud auth login
```

查看项目：

```powershell
gcloud projects list
```

设置当前 Project：

```powershell
gcloud config set project YOUR_PROJECT_ID
```

确认：

```powershell
gcloud config list
```

## 3. 启用 Cloud Run 和 Secret Manager

```powershell
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

选择部署区域，例如：

```powershell
$REGION = "europe-north1"
```

建议 Cloud Run 与 Neon 数据库尽量使用接近的区域。

## 4. 部署 GHCR Image 到 Cloud Run

PriceWatch WebApi 已发布到：

```text
ghcr.io/jiantaoshen/pricewatch-webapi:latest
```

部署：

```powershell
gcloud run deploy pricewatch-webapi `
  --image ghcr.io/jiantaoshen/pricewatch-webapi:latest `
  --region $REGION `
  --allow-unauthenticated `
  --port 8080
```

`--allow-unauthenticated` 只表示允许请求进入 Cloud Run。真正的 API 权限仍由 Microsoft Authentication、ASP.NET Core Authorization 和 `OwnerOnly` 负责。

## 5. 配置 Secrets

WebApi 主要需要：

```text
ConnectionStrings__Database
Owner__Sub
```

例如在 Secret Manager 中创建：

```text
pricewatch-database
pricewatch-owner-sub
```

然后映射到 Cloud Run：

```powershell
gcloud run services update pricewatch-webapi `
  --region $REGION `
  --update-secrets "ConnectionStrings__Database=pricewatch-database:latest,Owner__Sub=pricewatch-owner-sub:latest"
```

对应 ASP.NET Core 配置：

```text
ConnectionStrings:Database
Owner:Sub
```

修改 Secret 后不需要重新 build Docker image，只需要更新 Secret 和 Cloud Run revision。

## 6. Vercel 切换 API

Cloud Run 部署成功后会得到类似：

```text
https://pricewatch-webapi-xxxx.a.run.app
```

在 Vercel 中把：

```text
NEXT_PUBLIC_API_URL
```

改成新的 Cloud Run URL，然后重新部署 Web。

最终链路：

```text
Vercel Web
↓
Cloud Run
↓
PriceWatch.WebApi
↓
EF Core / Npgsql
↓
Neon PostgreSQL
```

## 7. 401 排错

直接测试：

```powershell
Invoke-WebRequest "https://YOUR-CLOUD-RUN-URL/api/items?includeArchived=true"
```

如果返回：

```text
401 Unauthorized
```

这是正常的，因为请求没有 Microsoft Access Token。

这说明：

```text
Cloud Run      ✅
Container      ✅
ASP.NET Core   ✅
Routing        ✅
Authentication ✅
```

## 8. 403 排错

如果登录网站后显示：

```text
No data available

This Microsoft account does not have access to the PriceWatch data.
```

通常表示：

```text
Authentication ✅
OwnerOnly      ❌
```

PriceWatch 当前继续使用：

```text
Owner__Sub
```

这是正确方案。

实际问题出现在最初通过 CLI 写入 Secret 时，可能会带入不可见字符，例如换行。

看起来相同的值，实际可能是：

```text
expected-sub
```

和：

```text
expected-sub\r\n
```

这样会导致：

```csharp
string.Equals(sub, ownerSub, StringComparison.Ordinal)
```

返回 `false`。

解决方法：

1. 打开 Google Cloud Console。
2. 进入 **Secret Manager**。
3. 找到 `pricewatch-owner-sub`。
4. 新建一个 Secret Version。
5. 手动重新输入完全相同的 `sub` 值。
6. 不加引号，不加前后空格，不通过 CLI 管道写入。
7. 让 Cloud Run 使用新的 Secret version 或 `latest`。

例如：

```powershell
gcloud run services update pricewatch-webapi `
  --region $REGION `
  --update-secrets "Owner__Sub=pricewatch-owner-sub:latest"
```

更新后 Cloud Run 会创建新的 revision。

## 9. Production 验证

最终访问：

```text
https://pricewatch.jiantao.dev
```

完成 Microsoft 登录后：

```text
Browser
↓
Vercel
↓
Microsoft Access Token
↓
Google Cloud Run
↓
ASP.NET Core Authentication
↓
OwnerOnly
↓
EF Core
↓
Npgsql
↓
Neon PostgreSQL
↓
200 OK
```

Products、Subscriptions、Reviews 等页面能够正常读取 production 数据，即表示部署成功。

## 10. 最终架构

```text
GitHub
↓
GHCR
↓
Google Cloud Run
↓
PriceWatch.WebApi
↓
Neon PostgreSQL

Vercel
↓
Next.js Web
↓
Cloud Run API
```

当前状态：

```text
Containerization      ✅
GHCR Publishing       ✅
Cloud Run Deployment  ✅
Secret Management     ✅
Vercel API Switch     ✅
Microsoft Auth        ✅
OwnerOnly             ✅
Neon Connection       ✅
Production Validation ✅
```
