# 自动部署说明

本项目使用 GitHub Actions 自动部署生产环境。推送到 `master` 后，工作流会先运行：

```bash
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

验证通过后，GitHub 会通过 SSH 登录阿里云服务器，执行 `scripts/deploy-production.sh`。

## GitHub Secrets

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions -> Repository secrets` 添加：

| Secret | 示例 |
| --- | --- |
| `ALIYUN_HOST` | `101.133.148.80` |
| `ALIYUN_USER` | `admin` |
| `ALIYUN_PORT` | `22` |
| `ALIYUN_SSH_KEY` | 部署专用 SSH 私钥 |

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
