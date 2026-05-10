# 阿里云 ECS 部署说明

这套部署方式用于小范围企业试用：一台 ECS 上运行 Next.js 应用、PostgreSQL 数据库和 Caddy HTTPS 反向代理。

## 已知信息

- 域名：`ai6c9.cn`
- 服务器公网 IP：`101.133.148.80`
- SSH 用户：`admin`
- 代码仓库：`https://github.com/caicai-cc666/lottery`
- 初始平台超级管理员：`irene.c.tsai@gmail.com`
- 初始企业：`润米`
- 初始企业超级管理员：`yhcai@run2me.com`

## 部署前确认

1. 安全组需要开放 `80`、`443`、`22`。
2. 不要开放 PostgreSQL 的 `5432`。
3. 宝塔面板如果已经占用 `80/443`，Caddy 会启动失败。部署脚本会先检查端口占用。
4. 当前 GitHub 仓库必须已经包含本项目代码，且服务器能 `git clone`。

## 在阿里云网页控制台执行

进入服务器终端后执行：

```bash
mkdir -p ~/apps
cd ~/apps

if [ ! -d okr-harness ]; then
  git clone https://github.com/caicai-cc666/lottery okr-harness
fi

cd okr-harness
git pull
bash scripts/install-aliyun-server.sh
```

脚本会自动完成：

- 安装 Docker / Git / Curl
- 启动 Docker
- 检查 `80/443` 端口
- 为 2GB 内存机器添加 swap
- 生成 `.env.production`
- 启动 PostgreSQL
- 初始化数据库表
- 创建初始平台账号和企业账号
- 启动应用和 HTTPS

## 初始密码

初始化脚本只会在账号首次创建时输出一次临时密码，并保存到：

```bash
~/apps/okr-harness/bootstrap-output.txt
```

这个文件包含初始密码，请保存到密码管理器后删除或妥善保管：

```bash
chmod 600 ~/apps/okr-harness/bootstrap-output.txt
```

## 常用运维命令

查看服务：

```bash
cd ~/apps/okr-harness
sudo docker compose --env-file .env.production ps
```

查看应用日志：

```bash
cd ~/apps/okr-harness
sudo docker compose --env-file .env.production logs -f app
```

查看 HTTPS 代理日志：

```bash
cd ~/apps/okr-harness
sudo docker compose --env-file .env.production logs -f caddy
```

更新代码并重启：

```bash
cd ~/apps/okr-harness
git pull
sudo docker compose --env-file .env.production up -d --build
```

## 敏感文件

这些文件不要发到聊天、邮件或 Git：

- `.env.production`
- `bootstrap-output.txt`

企业模型 API Key 后续应由企业管理员在系统内配置，并加密保存。
