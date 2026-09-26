# PriceWatch WebApi：GitHub Container Registry 发布简版报告

## 1. 目标

将已经在本地验证成功的 `PriceWatch.WebApi` Docker image 发布到 GitHub Container Registry（GHCR）。

最终链路：

```text
PriceWatch.WebApi
↓
Docker Image
↓
GitHub Authentication
↓
GitHub Container Registry
↓
ghcr.io/jiantaoshen/pricewatch-webapi:latest
```

## 2. 前置状态

本地 Docker image 已经构建并验证成功：

```text
pricewatch-webapi:latest
```

WebApi 可以正常启动，并连接 PriceWatch 的认证、EF Core 和 Neon PostgreSQL。

## 3. 创建 GitHub Personal Access Token

进入：

```text
GitHub
→ Settings
→ Developer settings
→ Personal access tokens
→ Tokens (classic)
→ Generate new token (classic)
```

建议名称：

```text
PriceWatch GHCR
```

需要权限：

```text
read:packages
write:packages
```

生成后立即保存 Token，不要提交到 Git、Dockerfile 或源码。

## 4. 登录 GHCR

在 PowerShell 中临时设置 Token：

```powershell
$env:CR_PAT="你的GitHub Personal Access Token"
```

登录：

```powershell
$env:CR_PAT | docker login ghcr.io -u jiantaoshen --password-stdin
```

成功后应显示：

```text
Login Succeeded
```

## 5. Tag 并 Push Image

给本地 image 添加 GHCR tag：

```powershell
docker tag pricewatch-webapi:latest ghcr.io/jiantaoshen/pricewatch-webapi:latest
```

Push：

```powershell
docker push ghcr.io/jiantaoshen/pricewatch-webapi:latest
```

成功后会显示类似：

```text
latest: digest: sha256:...
```

### PowerShell 注意事项

如果使用变量，建议写：

```powershell
$GH_USER = "jiantaoshen"
$IMAGE = "pricewatch-webapi"

docker tag pricewatch-webapi:latest "ghcr.io/${GH_USER}/${IMAGE}:latest"
```

不要写：

```powershell
"ghcr.io/$GH_USER/$IMAGE:latest"
```

因为变量后紧跟 `:` 时可能被 PowerShell 错误解析。

## 6. 在 GitHub 验证

进入：

```text
GitHub
→ Profile
→ Packages
```

应看到：

```text
pricewatch-webapi
```

完整 image 地址：

```text
ghcr.io/jiantaoshen/pricewatch-webapi:latest
```

## 7. Secret 管理原则

Docker image 不保存运行时秘密，例如：

```text
ConnectionStrings__Database
Owner__Sub
Owner__Oid
Neon credentials
Microsoft authentication configuration
```

本地通过：

```text
.env.webapi.local
```

和：

```powershell
docker run --env-file .env.webapi.local ...
```

注入。

因此职责保持分离：

```text
Docker image
→ Application code
→ .NET runtime
→ Dependencies

Runtime environment
→ Database credentials
→ Owner identity
→ Authentication configuration
→ Production secrets
```

## 8. 完成状态

当前已经完成：

```text
Local Docker Image    ✅
GitHub PAT            ✅
GHCR Login            ✅
Image Tag             ✅
Docker Push           ✅
GitHub Package        ✅
```

最终成果：

```text
ghcr.io/jiantaoshen/pricewatch-webapi:latest
```

PriceWatch.WebApi 的 GHCR 发布流程已经验证成功，可继续用于后续 Cloud Run 部署和 GitHub Actions CI/CD。
