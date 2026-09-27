# PriceWatch WebApi：CI/CD 简版报告

## 1. 目标

将 WebApi 从手动部署改为自动 CI/CD：

```text
Pull Request
↓
Build / Test / Docker Build
↓
Merge to main
↓
Build Docker Image
↓
Push GHCR
↓
GitHub OIDC
↓
Google Workload Identity Federation
↓
Google Cloud Run
```

## 2. 配置 gcloud

登录 Google Cloud：

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
gcloud config get-value project
```

设置本地 PowerShell 变量：

```powershell
$PROJECT_ID = (gcloud config get-value project).Trim()
$REGION = "europe-north1"
$SERVICE = "pricewatch-webapi"

$GITHUB_REPO = "jiantaoshen/PriceWatch"
$SA_NAME = "github-cloud-run-deployer"
$SA_EMAIL = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID `
  --format="value(projectNumber)"
```

检查：

```powershell
Write-Host "PROJECT_ID     = $PROJECT_ID"
Write-Host "PROJECT_NUMBER = $PROJECT_NUMBER"
Write-Host "REGION         = $REGION"
Write-Host "SERVICE        = $SERVICE"
Write-Host "GITHUB_REPO    = $GITHUB_REPO"
Write-Host "SA_EMAIL       = $SA_EMAIL"
```

## 3. 启用 Google Cloud API

```powershell
gcloud services enable `
  run.googleapis.com `
  iamcredentials.googleapis.com `
  sts.googleapis.com
```

## 4. 创建 GitHub 部署 Service Account

```powershell
gcloud iam service-accounts create $SA_NAME `
  --project=$PROJECT_ID `
  --display-name="GitHub Cloud Run Deployer"
```

授予 Cloud Run 部署权限：

```powershell
gcloud projects add-iam-policy-binding $PROJECT_ID `
  --member="serviceAccount:$SA_EMAIL" `
  --role="roles/run.developer"
```

取得 Cloud Run runtime Service Account：

```powershell
$RUNTIME_SA = gcloud run services describe $SERVICE `
  --project=$PROJECT_ID `
  --region=$REGION `
  --format="value(spec.template.spec.serviceAccountName)"
```

如果为空：

```powershell
if (-not $RUNTIME_SA) {
  $RUNTIME_SA = "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
}
```

允许部署账号使用 runtime Service Account：

```powershell
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA `
  --project=$PROJECT_ID `
  --member="serviceAccount:$SA_EMAIL" `
  --role="roles/iam.serviceAccountUser"
```

## 5. 配置 Workload Identity Federation

创建 pool：

```powershell
gcloud iam workload-identity-pools create github `
  --project=$PROJECT_ID `
  --location=global `
  --display-name="GitHub Actions Pool"
```

创建 provider：

```powershell
gcloud iam workload-identity-pools providers create-oidc pricewatch `
  --project=$PROJECT_ID `
  --location=global `
  --workload-identity-pool=github `
  --display-name="PriceWatch GitHub Actions" `
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" `
  --attribute-condition="assertion.repository == '$GITHUB_REPO'" `
  --issuer-uri="https://token.actions.githubusercontent.com"
```

取得 pool：

```powershell
$POOL_ID = gcloud iam workload-identity-pools describe github `
  --project=$PROJECT_ID `
  --location=global `
  --format="value(name)"
```

允许 PriceWatch repository impersonate Service Account：

```powershell
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL `
  --project=$PROJECT_ID `
  --role="roles/iam.workloadIdentityUser" `
  --member="principalSet://iam.googleapis.com/$POOL_ID/attribute.repository/$GITHUB_REPO"
```

取得 provider 完整名称：

```powershell
$PROVIDER = gcloud iam workload-identity-pools providers describe pricewatch `
  --project=$PROJECT_ID `
  --location=global `
  --workload-identity-pool=github `
  --format="value(name)"
```

检查：

```powershell
$PROVIDER
$SA_EMAIL
```

## 6. GitHub Repository Variables

在：

```text
GitHub
→ Repository
→ Settings
→ Secrets and variables
→ Actions
→ Variables
```

添加：

```text
GCP_PROJECT_ID
GCP_REGION
GCP_CLOUD_RUN_SERVICE
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_SERVICE_ACCOUNT
```

其中：

```text
GCP_WORKLOAD_IDENTITY_PROVIDER = $PROVIDER
GCP_SERVICE_ACCOUNT            = $SA_EMAIL
```

Production secrets 继续保存在 Google Secret Manager，不放进 GitHub。

## 7. GitHub Actions

Workflow：

```text
.github/workflows/webapi-cicd.yml
```

PR 阶段执行：

```text
dotnet restore
dotnet build
dotnet test
docker build
```

任何一步失败都会阻止后续部署。

`main` 更新后继续：

```text
Docker build
↓
Push GHCR
↓
Deploy Cloud Run
```

## 8. GHCR

WebApi image：

```text
ghcr.io/jiantaoshen/pricewatch-webapi
```

CI 发布：

```text
:latest
:<git-sha>
```

Cloud Run 使用 Git SHA 对应的 image，方便追踪 production 版本。

GitHub Actions 使用 `GITHUB_TOKEN`，workflow 需要：

```yaml
permissions:
  contents: read
  packages: write
  id-token: write
```

## 9. Google Cloud Authentication

认证链：

```text
GitHub Actions
↓
OIDC
↓
Google Workload Identity Federation
↓
github-cloud-run-deployer
↓
Google Cloud Run
```

没有保存 Service Account JSON key。

## 10. 遇到的问题

### Solution 文件路径错误

CI 最初使用了错误的 solution 文件名，导致：

```text
MSB1009: Project file does not exist
```

修正 workflow 中的 solution 路径后解决。

### GHCR write_package

Docker build 成功，但 push GHCR 时出现：

```text
permission_denied: write_package
```

解决：

```text
GitHub
→ Packages
→ pricewatch-webapi
→ Package settings
→ Manage Actions access
→ PriceWatch
→ Write
```

### Workload Identity Provider 变量为空

`GCP_WORKLOAD_IDENTITY_PROVIDER` 未正确配置时，Google auth action 无法获得 provider。

在 GitHub Actions Variables 中加入完整 provider resource name 后解决。

### Repository 改名后的旧配置

Repository 曾从：

```text
jiantaoshen/PriceWatch_new
```

改名为：

```text
jiantaoshen/PriceWatch
```

Google Workload Identity Provider 仍保存旧 condition：

```text
assertion.repository == 'jiantaoshen/PriceWatch_new'
```

修改为：

```text
assertion.repository == 'jiantaoshen/PriceWatch'
```

后解决 attribute condition 错误。

Service Account 的 `roles/iam.workloadIdentityUser` binding 也需要改为新的 repository 名称，否则会出现：

```text
iam.serviceAccounts.getAccessToken denied
```

更新 IAM binding 后认证成功。

## 11. 最终状态

```text
PR CI                    ✅
.NET Restore / Build     ✅
.NET Test                ✅
Docker Build             ✅
GHCR Push                ✅
GitHub OIDC              ✅
Workload Identity        ✅
Cloud Run Deploy         ✅
Production               ✅
```

现在正常流程：

```text
git push
↓
Pull Request CI
↓
Merge to main
↓
Automatic GHCR publish
↓
Automatic Cloud Run deployment
```

不再需要手动执行：

```text
docker build
docker push
gcloud run deploy
```
