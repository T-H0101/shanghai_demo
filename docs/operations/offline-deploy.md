# 离线部署（Linux x64 服务器：仅需 Docker）

> 打包机（本机 Windows + Docker Desktop）产出目录默认：  
> `D:\项目记录\00-部署\unified-offline`  
> 服务器**不需要**系统级 Node / pnpm。

## 1. 打包机已完成的内容

| 内容 | 说明 |
|------|------|
| `tools/node` | Node.js 22.23.1 linux-x64 |
| `tools/pnpm` | pnpm 11.10（node 包装脚本）+ `pnpm-pkg/` |
| `images/postgres17.tar` | PostgreSQL 17 镜像 |
| `app/` | 源码 + Linux `node_modules` + 已 build 的 `.next/standalone` |
| `pnpm-store/` | 离线依赖仓（重装时用） |
| `bootstrap.sh` | 服务器一键：env → db → start（无 Compose 时自动 `docker run`） |
| `*.tgz`（vendor） | SWC / lightningcss / oxide 等 Linux 原生包备用 |

重新打包（可选）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\offline\prepare-bundle.ps1 `
  -OutDir "D:\项目记录\00-部署\unified-offline"
```

> 注意：当前环境 Docker 访问 npm 公网不稳定，完整 Linux build 需按 `scripts/offline/` 内脚本分步（fetch → install → 补齐原生包 → build）。`prepare-bundle.ps1` 覆盖拉取工具链与 PG 镜像；若 build 失败请按该目录下 `final-build.sh` / `link-natives-and-build.sh` 补跑。

### Shell 脚本必须是 LF

Windows 检出若变成 CRLF，在 Linux/Docker 里会报 `set: pipefail: invalid option name`。仓库已用 `.gitattributes`（`*.sh text eol=lf`）约束；`prepare-bundle.ps1` 同步后也会把 `app/**/*.sh` 写成 LF。

自检 / 修复：

```powershell
powershell -File scripts\check-shell-lf.ps1
powershell -File scripts\check-shell-lf.ps1 -Fix
```

### `.env.local`：构建 vs 部署到服务器（两回事）

| 场景 | 要不要 `.env.local` |
|------|---------------------|
| **打包机 Docker 里 `pnpm build`** | 需要（至少有 `NEXT_PUBLIC_*`）。可用 `.env.example`；`build-with-env.cjs` 会回退到它 |
| **同步 app 到服务器** | **不要覆盖**服务器已有的 `.env.local`（里面是真实 DB 密码/密钥） |
| **首次 bootstrap** | 服务器上由 `env:init` 生成 |

业务代码更新后在 Docker 内 build（PowerShell）：

```powershell
docker run --rm `
  -v "D:/项目记录/00-部署/unified-offline/app:/app" `
  -v "D:/项目记录/00-部署/unified-offline/tools:/tools" `
  -v "D:/xzty_project/shanghai_demo/scripts/offline/final-build.sh:/final-build.sh:ro" `
  -e NEXT_TELEMETRY_DISABLED=1 -e CI=true `
  node:22-bookworm-slim `
  bash /final-build.sh
```

若仍遇 pipefail 报错，用：

```powershell
# ... 同上挂载 ...
bash -c "tr -d '\r' < /final-build.sh > /tmp/f.sh && bash /tmp/f.sh"
```

若 `app` 下既无 `.env.local` 也无 `.env.example`，从仓库补一份示例即可：

```powershell
Copy-Item D:\xzty_project\shanghai_demo\.env.example `
  "D:\项目记录\00-部署\unified-offline\app\.env.example"
```

## 2. 拷到服务器

将整个 `unified-offline` 目录拷到例如 `/opt/unified-offline`（U 盘 / 内网）。

## 3. 服务器首次部署

```bash
cd /opt/unified-offline
bash bootstrap.sh
```

等价于你熟悉的流程：

```bash
pnpm env:init --force
pnpm env:check
# Postgres: 优先 docker compose / docker-compose；都没有则 docker run
pnpm db:init
pnpm start
```

（`PATH` 已指向本包 `tools/`，无需全局安装 pnpm。脚本设置 `CI=true`，避免 pnpm 交互确认。）

**无 Compose 插件的服务器**（`docker compose` / `docker-compose` 均不可用）可直接跑 `bootstrap.sh`，会走 `docker run` 启动 `unified_disc_postgres`。

部署后编辑 `app/.env.local`：

- `PUBLIC_APP_URL=http://<服务器IP>:3000`
- `DATABASE_URL` / `POSTGRES_PASSWORD` / `DB_PASSWORD` 三者密码一致
- `AUTH_SESSION_SECRET` / `SYNC_PACKAGE_SECRET` / `SITE_SSO_SECRET`

## 4. 日常启动

```bash
cd /opt/unified-offline
bash bootstrap.sh
# 若只需重启应用（库已在跑）:
cd /opt/unified-offline/app
export PATH="/opt/unified-offline/tools:/opt/unified-offline/tools/node/bin:$PATH"
pnpm start
```

无 Compose 时手动起库：

```bash
cd /opt/unified-offline
# 仅复用 bootstrap 内逻辑：再跑一次 bash bootstrap.sh 即可（已有容器会 docker start）
docker start unified_disc_postgres
```

## 5. 清库重建

有 Compose：

```bash
cd /opt/unified-offline/app
export PATH="/opt/unified-offline/tools:/opt/unified-offline/tools/node/bin:$PATH"
pnpm db:down:volumes
pnpm db:up
pnpm db:init
```

无 Compose：

```bash
docker rm -f unified_disc_postgres
docker volume rm unified_disc_postgres_data
cd /opt/unified-offline && bash bootstrap.sh
```

## 6. 验收

```bash
curl -fsS http://127.0.0.1:3000/api/system/health
```

浏览器打开 `http://<服务器IP>:3000`，默认开发账号 `admin / admin`（测试/生产务必更换）。
