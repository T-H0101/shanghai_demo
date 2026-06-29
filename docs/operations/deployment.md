# 部署手册

本文是部署入口。README 只保留最短路径，细节放在这里。

## 1. 部署模式

| 场景 | 推荐方式 | 说明 |
|---|---|---|
| 本地开发 | `pnpm dev` + Docker PG | 只验证代码和中心库 |
| 测试服务器 | Docker image + 外部 PG | 推荐 |
| 生产 | k8s / systemd + secret manager | 推荐 |
| 只看页面 | 本地开发模式 | 不作为验收证据 |

## 2. 环境变量

中心服务必须配置:

```bash
DATABASE_URL=...
AUTH_SESSION_SECRET=...
SYNC_PACKAGE_SECRET=...
SITE_AGENT_SECRET=...
```

启用 OpenSearch/ES 文件检索时还需要:

```bash
SEARCH_ES_URL=...
SEARCH_ES_INDEX=...
```

本地 PostgreSQL 初始化还需要:

```bash
POSTGRES_PASSWORD=...
DB_PASSWORD=...
```

每个站点 Agent 单独配置:

```bash
SITE_CODE=SH01
SITE_DATABASE_URL=...
SITE_AGENT_SECRET=...
PLATFORM_BASE_URL=https://center.example.com
```

生产规则:

- 真实密钥只放 secret manager、systemd EnvironmentFile、k8s Secret 或 CI/CD secret。
- `sync_sites` 只能保存 `credential_ref`，不能保存数据库明文密码。
- 多站点不是在中心服务里写多个 `SITE_DATABASE_URL`；每个站点各跑自己的 Agent。

## 3. 本地首次启动

```bash
cp -n .env.example .env.local
pnpm install
pnpm db:up
pnpm db:init
pnpm dev
```

验证:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
```

## 4. Docker 镜像

构建:

```bash
docker build -t unified-disc-platform:latest .
```

运行前先准备 env 文件，不要把真实值提交:

```bash
docker run -d \
  --name unified-disc-platform \
  --env-file .env.production \
  -p 3000:3000 \
  unified-disc-platform:latest
```

健康检查:

```bash
curl -fsS http://127.0.0.1:3000/api/system/health
```

## 5. 数据库初始化

中心库初始化统一走:

```bash
pnpm db:init
```

它会执行 `databases/sprint-2b0/init-docker.sh` 中登记的 DDL patch。新增 schema 时必须追加到该脚本，不能只手动改库。

当前 `pnpm db:init` 已包含 R.86 `file_index_jobs` 调度账本。开发环境启用文件索引增量任务时, 初始化后执行:

```bash
pnpm import:file-index-job-bootstrap -- --sites SH01
```

## 6. 新站点接入

1. 在站点部署 Agent。
2. 在中心库 `sync_sites` 注册站点，只保存连接元数据和 `credential_ref`。
3. 在站点 Agent 侧配置真实 `SITE_DATABASE_URL`。
4. 跑一次 `pnpm test:r83.4-e2e` 或站点级同步验证。

注册示例:

```sql
INSERT INTO sync_sites (
  site_code,
  site_name,
  source_type,
  db_host,
  db_port,
  db_name,
  db_user,
  credential_ref,
  enabled,
  sync_interval_seconds
)
VALUES (
  'BJ02',
  '北京 02 站点',
  'postgres',
  'bj02-db.example.com',
  5432,
  'star_storage_db',
  'bj02_agent',
  'CREDENTIAL_BJ02_DB_PASSWORD',
  TRUE,
  3600
);
```

## 7. 发布前检查

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm baseline:check
pnpm audit:center-db -- --strict --matrix
docker build -t unified-disc-platform:release-check .
```

若涉及 UI 或事件:

```bash
pnpm e2e:all
```

## 8. R.85 OpenSearch/ES 搜索 profile

R.85 起, `tbl_file*` / `tbl_folder*` 走 OpenSearch/ES 检索, 由 `SearchPort` 抽象。

启动 search-only profile (不依赖 PG, 仅本地验证 ES wiring):

```bash
docker compose -f docker-compose.search.yml --env-file .env.local up -d
```

写入测试数据:

```bash
set -a && source .env.local && set +a
SEARCH_ES_URL=http://localhost:9200 \
SEARCH_ES_INDEX=disc_file_index \
pnpm tsx scripts/index/file-indexer.ts --limit 50 --site SH01
```

调用 `/api/search`:

```bash
curl -s 'http://localhost:3000/api/search?q=test'
# 期望:
#   - source=opensearch (ES 可用)
#   - source=blocked_by_external_system (ES 不可用, blocker=es_not_configured)
```

禁止:

- 不把 `tbl_file*` / `tbl_folder*` 全量写入 PG `unified_*`。
- 不在 API route 直接 import OpenSearch 客户端 (必须经 `SearchPort`)。
- 不在 route 写 SQL 拼接 (必须经 domain service + port + adapter)。

## 9. 常见问题

| 现象 | 处理 |
|---|---|
| `password authentication failed` | 确认 `DATABASE_URL`、`POSTGRES_PASSWORD`、`DB_PASSWORD` 同步；旧 volume 不会自动改密码 |
| `service app not found` | 根 `docker-compose.yml` 主要用于本地数据服务；应用建议用 Dockerfile 单独部署 |
| `baseline:check` 连接失败 | 先 `set -a && source .env.local && set +a` |
| 搜索结果为空 | OpenSearch/ES 未接入或索引未构建，按 [大表与 ES 规划](../architecture/es-large-table-roadmap.md) 处理 |
