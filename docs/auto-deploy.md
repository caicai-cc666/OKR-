# 自动部署说明

推荐使用“服务器自动拉取更新”。这种方式不需要把服务器 SSH 私钥放到 GitHub，也不会因为 GitHub Secrets 配置错误导致部署失败。

## 推荐方案：服务器自动更新

在阿里云服务器执行一次：

```bash
cd ~/apps
rm -rf okr-autoupdate-src okr-autoupdate.zip OKR--master
curl -L --connect-timeout 20 --retry 5 \
  -H "Cache-Control: no-cache" \
  -o okr-autoupdate.zip \
  "https://codeload.github.com/caicai-cc666/OKR-/zip/refs/heads/master?ts=$(date +%s)"
unzip -q okr-autoupdate.zip -d okr-autoupdate-src
cd okr-autoupdate-src/OKR--master
bash scripts/install-auto-update.sh
```

安装后，服务器会每 5 分钟检查一次 GitHub master 分支。如果发现新代码，会自动执行 `scripts/deploy-production.sh` 完成部署。

查看状态：

```bash
sudo systemctl status okr-harness-auto-update.timer --no-pager
sudo systemctl status okr-harness-auto-update.service --no-pager
```

查看日志：

```bash
sudo journalctl -u okr-harness-auto-update.service -n 120 --no-pager
```

手动立即更新：

```bash
sudo systemctl start okr-harness-auto-update.service
```

停止自动更新：

```bash
sudo systemctl disable --now okr-harness-auto-update.timer
```

## 可选方案：GitHub Actions SSH 部署

GitHub Actions 默认只做验证，不再自动 SSH 部署。即使 Repository variables 里曾经设置过 `ENABLE_SSH_DEPLOY=true`，普通 push 也不会触发 SSH 部署。

如果确实要临时启用 SSH 部署，需要同时满足两个条件：

```text
ENABLE_SSH_DEPLOY = true
```

并且在 GitHub Actions 页面手动运行 `Deploy production` 工作流时，勾选 `Run the legacy SSH deploy job`。

推送到 `master` 后，工作流会先运行：

```bash
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

验证通过后，GitHub 会通过 SSH 登录阿里云服务器，执行 `scripts/deploy-production.sh`。

## GitHub Secrets

推荐在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions -> Repository secrets` 添加：

| Secret | 示例 |
| --- | --- |
| `ALIYUN_HOST` | `101.133.148.80` |
| `ALIYUN_USER` | `admin` |
| `ALIYUN_PORT` | `22` |
| `ALIYUN_SSH_KEY` | 部署专用 SSH 私钥 |

如果你把这些值放在 `Settings -> Environments -> production -> Environment secrets`，工作流也可以读取，因为部署 job 已绑定 `production` environment。
`ALIYUN_HOST`、`ALIYUN_USER`、`ALIYUN_PORT` 也可以放在 Repository variables；`ALIYUN_SSH_KEY` 必须放在 Secrets。

## 服务器初始化

只需要做一次：生成部署专用 SSH key，并把公钥加入 `admin` 用户的 `authorized_keys`。

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh

ssh-keygen -t ed25519 -C "github-actions-okr-deploy" -f ~/.ssh/okr_github_actions -N ""
cat ~/.ssh/okr_github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

echo "===== COPY THIS PRIVATE KEY TO GITHUB SECRET: ALIYUN_SSH_KEY ====="
cat ~/.ssh/okr_github_actions
echo "===== END PRIVATE KEY ====="
```

复制输出的私钥到 GitHub Secret `ALIYUN_SSH_KEY` 后，建议在服务器删除私钥，只保留公钥授权：

```bash
rm -f ~/.ssh/okr_github_actions
```

## 部署策略

- 新版本会先构建 Docker 镜像。
- 构建成功后才停止当前服务。
- `.env.production` 会从当前线上目录复制到新版本，密钥不会进入 GitHub。
- PostgreSQL、Caddy 证书等 Docker volumes 会保留。
- 旧目录会备份为 `~/apps/okr-harness-backup-YYYYmmddHHMMSS`。

## 手动触发

也可以在 GitHub Actions 页面手动运行 `Deploy production` 工作流。
