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
pnpm install
pnpm env:init
pnpm env:check
pnpm db:up
pnpm db:init
pnpm smoke:sync
pnpm dev
```

验证:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
```

### 3.1 验证页面数据

部署后, 确认总控页面可加载真实数据:

```bash
# 1. 启动数据库 + 初始化
pnpm db:up
pnpm db:init

# 2. 运行同步管道 (写入真实数据到中心库)
pnpm smoke:sync

# 3. 启动开发服务器
pnpm dev
```

验证清单:

| 页面 | 路由 | 验证内容 |
|---|---|---|
| 站点管理 | `http://localhost:3000/sites` | 应显示 1+ 注册站点 |
| 任务管理 | `http://localhost:3000/tasks` | 应显示同步后的任务列表 |
| 盘架管理 | `http://localhost:3000/racks` | 应显示设备列表 |
| 巡检视图 | `http://localhost:3000/racks?view=inspection` | 应显示巡检概览 (原 `/check` 页面合并至此) |
| 存储卷视图 | `http://localhost:3000/racks?view=volumes` | 应显示存储卷数据 (原 `/volumes` 页面合并至此) |
| 用户与权限 | `http://localhost:3000/users` | 应显示用户列表 |
| 审计日志 | `http://localhost:3000/logs` | 应显示同步日志 |
| 同步中心 | `http://localhost:3000/sync` | 应显示同步状态 |
| 统一检索 | `http://localhost:3000/search` | 依赖 ES 接入, 未接入时显示 blocker banner |

**原始路由验证** (确认 redirect 生效):

```bash
# /check → /racks?view=inspection
curl -s -o /dev/null -w "%{redirect_url}" http://localhost:3000/check
# 期望: .../racks?view=inspection

# /volumes → /racks?view=volumes
curl -s -o /dev/null -w "%{redirect_url}" http://localhost:3000/volumes
# 期望: .../racks?view=volumes

# /control → /tasks?view=commands
curl -s -o /dev/null -w "%{redirect_url}" http://localhost:3000/control
# 期望: .../tasks?view=commands
```

页面路由一览:

| 路由 | 类型 | 说明 |
|---|---|---|
| `/` | 主页面 | 控制台 Dashboard |
| `/sync` | 主页面 | 同步中心 |
| `/tasks` | 主页面 | 任务管理 (`?view=commands` 控制命令) |
| `/racks` | 主页面 | 盘架管理 (`?view=inspection` 巡检, `?view=volumes` 存储卷) |
| `/users` | 主页面 | 用户与权限 |
| `/sites` | 主页面 | 站点管理 |
| `/logs` | 主页面 | 审计日志 |
| `/settings` | 主页面 | 系统设置 |
| `/search` | 主页面 | 统一检索 |
| `/check` | **redirect** → `/racks?view=inspection` | 原始 17-tab 页面已合并 |
| `/volumes` | **redirect** → `/racks?view=volumes` | 原始 475 行页面已合并 |
| `/control` | **alias redirect** → `/tasks?view=commands` | 控制命令已合并 |
| `/login` | 公开页面 | 登录 |

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
4. 跑一次真实验证:

```bash
pnpm scheduler:sync:once -- --siteCode=<site>
pnpm check:sync-consistency -- --siteCode=<site>
pnpm e2e:sites
```

> 中心不保存站点 DB 密码。每站点 Agent 自持 `SITE_DATABASE_URL`，凭据由运维通过 secret manager / EnvironmentFile 下发。

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
SEARCH_ES_URL=http://localhost:9201 \
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

## 9. 多站点接入 (R.90)

**原则**: 中心服务**只保存总控数据库** (`unified_disc_platform`); **不在中心服务里配置多个站点的数据库密码**。每个站点独立部署 Agent, Agent 侧持有 `SITE_DATABASE_URL`。

### 9.1 部署拓扑

```
[ Site A Agent ]   [ Site B Agent ]   [ Site C Agent ]
   SITE_DATABASE_URL  SITE_DATABASE_URL  SITE_DATABASE_URL
        |                  |                  |
        +------- HMAC + HTTPS ------------------+
                              |
                              v
                [ Center service (本仓库) ]
                    DATABASE_URL -> unified_disc_platform
                    sync_sites -> credential_ref (无明文)
```

### 9.2 接入步骤 (部署后只有总控数据库时)

1. **总控库准备**:
   ```bash
   set -a && source .env.local && set +a
   pnpm db:init            # 中心库 schema (含 sync_sites, file_index_jobs, R.83 中心库)
   pnpm audit:classify-source-tables   # 必须 needs_decision=0
   ```

2. **新站点 `sync_sites` 注册** (中心库):
   ```sql
   INSERT INTO sync_sites (
     site_code, site_name, source_type,
     db_host, db_port, db_name, db_user,
     credential_ref, enabled, sync_interval_seconds
   ) VALUES (
     'SH02', '上海 02 站点', 'postgres',
     'sh02-db.example.com', 5432, 'star_storage_db', 'sh02_agent',
     'CREDENTIAL_SH02_DB_PASSWORD', TRUE, 3600
   );
   ```

3. **站点 Agent 单独部署** (站点侧):
   - Agent 持有自己的 `SITE_DATABASE_URL` (不传给中心服务)。
   - Agent 持有自己的 `SITE_AGENT_SECRET` (HMAC-SHA256 凭据, 与中心服务的 `SITE_AGENT_SECRET` 对称)。
   - Agent 持有 `PLATFORM_BASE_URL=https://center.example.com`。

4. **文件索引 bootstrap** (中心库, 触发新站点的 file_index_jobs):
   ```bash
   pnpm import:file-index-job-bootstrap -- --sites SH02
   # 期望: inserted=29 skipped=0
   ```

5. **触发首次同步 + 校验**:
   ```bash
   # 中心库执行 (调度器会读 sync_sites, 派发到 Agent)
   pnpm scheduler:sync:once -- --siteCode=SH02

   # 一致性校验
   pnpm check:sync-consistency -- --siteCode=SH02
   # 期望: matched = pg_unified 表数, failed = 0
   ```

6. **`source_site_id` 校验** (确保中心库按站点隔离):
   ```sql
   -- 中心库 unified_* 表必须按 source_site_id 分桶
   SELECT source_site_id, COUNT(*) FROM unified_tasks GROUP BY source_site_id;
   -- 期望: 每个注册站点独立 bucket, 不串
   ```

### 9.3 禁止

- ❌ 在中心服务环境变量里配置多个站点的数据库连接串。
- ❌ 把 `db_password` 写在 `sync_sites` 里 (只能用 `credential_ref`)。
- ❌ 让中心服务直连站点 DB (绕开 Agent)。
- ❌ 跨站数据混桶 (无 `source_site_id` 过滤的查询)。

---

## 10. 定制同步 (开发阶段真实支持项)

> 本节只写**当前真实支持**的同步配置项。生产 HA / cron / 监控 / 死信重放 等
> 不在本 Sprint 范围, 留待 R.87 接管。

### 10.1 同步白名单 (固定 141 张)

- 全局白名单 = R.83.9 `ALLOWED_PACKAGE_TABLES` 141 张, 由 `lib/sync/package-schema.ts` 集中定义。
- 当前**没有**站点级覆盖 (`table_whitelist_override`) — R.91 后再实现。
- 真实校验: `pnpm audit:center-db -- --strict --matrix` 输出 `package whitelist tables present: 141/141`。

### 10.2 同步间隔

- 字段: `sync_sites.sync_interval_seconds` (默认 3600)。
- 调度方式: `pnpm scheduler:sync:once -- --siteCode=<site>` 手动触发一次; R.87 加 cron 自动跑。

### 10.3 表级 / 站点级启停

- 整站启停: `UPDATE sync_sites SET enabled = FALSE WHERE site_code = '<site>';`
- 单 (site, file_index_es table) 启停: `UPDATE file_index_jobs SET is_enabled = FALSE WHERE source_site_id = '<site>' AND source_table = '<table>';`
- 单 (site, pg_unified table) 启停: **当前没有**, 站点级 enabled 是唯一控制。需要的话手动 UPDATE `unified_<table>` 行 (开发阶段手动操作)。

### 10.4 文件索引 bootstrap (新站点必跑)

每站点接入后**必须**跑:

```bash
pnpm import:file-index-job-bootstrap -- --sites <site_code>
# 期望: inserted=29 skipped=0
```

跳过这一步 = `tbl_file*` / `tbl_folder*` 不进入 ES, `/api/search` 命中数=0。

### 10.5 校验一致性 (开发阶段)

```bash
# 同步链路 smoke
pnpm smoke:sync   # packageStatus=success

# 中心库完整性
pnpm audit:center-db -- --strict --matrix   # 0 fail

# 文件索引分类
pnpm audit:classify-source-tables   # needs_decision=0

# 单 (site, table) 索引 worker (手动触发)
pnpm import:file-index-job-runner -- --site SH02 --table tbl_file --batch 100
```

### 10.6 R.87 接管项 (本 Sprint 不实现)

| 项 | 接管点 |
|---|---|
| 调度 cron (`scheduler:file-index`) | R.87 生产硬化 |
| 监控告警 (status=dead_letter / stuck_running > 30m) | R.87 |
| 死信重放 CLI | R.87 |
| `last_run_duration_ms` 阈值告警 | R.87 |
| 站点级白名单覆盖 (`site_config.table_whitelist_override`) | R.91+ |
| 单 PG 表级启停 (admin UI) | R.91+ |
| 权限过滤强化 (按 dept / site) | R.87 + §4.1 业务 |

---

## 11. 常见问题

| 现象 | 处理 |
|---|---|
| `password authentication failed` | 运行 `pnpm env:check` 验证 DB 三元组；旧 volume 不会自动改密码 |
| `service app not found` | 根 `docker-compose.yml` 主要用于本地数据服务；应用建议用 Dockerfile 单独部署 |
| `baseline:check` 连接失败 | 先 `set -a && source .env.local && set +a`；或直接运行 `pnpm env:check` |
| `env:check` 报 POSTGRES_PASSWORD 缺失 | 旧 `.env.local` 缺字段，运行 `pnpm env:init --force` 重建 |
| `env:check` 报占位符密钥 | 运行 `pnpm env:init --force` 生成随机密钥 |
| 搜索结果为空 | OpenSearch/ES 未接入或索引未构建，按 [大表与 ES 规划](../architecture/es-large-table-roadmap.md) 处理 |
| SCRAM 认证失败 (旧 volume 密码不一致) | `pnpm env:init --force` → `pnpm env:check` → `pnpm db:down:volumes` → `pnpm db:up` → `pnpm db:init` → `pnpm smoke:sync` |

## 12. 环境初始化与检查 (R.92)

R.92 起所有 DB 依赖脚本前必须 `pnpm env:check` 通过。

### 12.1 首次初始化

```bash
# 1. 生成 .env.local (从 .env.example, 含一致 DB 三元组 + 随机密钥)
pnpm env:init

# 2. 验证配置
pnpm env:check
# 期望输出: ✅ .env.local 存在 / ✅ DB 三元组一致 / ✅ 密钥非占位符 ...

# 3. 启动 PostgreSQL
pnpm db:up

# 4. 初始化中心库
pnpm db:init
```

### 12.2 重建 .env.local

```bash
pnpm env:init --force
# 重新生成 .env.local (DB 三元组一致 + 新随机密钥)
```

### 12.3 生产环境检查

```bash
pnpm env:check:production
# 额外检查: AUTH_MODE != dev, 无占位符密钥, SITE_AGENT_SECRET 已配置
```

### 12.4 DB 三元组一致性

`.env.local` 中三处密码必须完全相同:

- `DATABASE_URL` 的 password 段
- `POSTGRES_PASSWORD` (Docker PG 初始化时使用)
- `DB_PASSWORD` (e2e 脚本直读)

`pnpm env:init` 自动统一三者；`pnpm env:check` 自动验证。

**重要**: 修改 `.env.local` 不会自动修改已有 Docker volume 内的密码。密码不一致时必须 `pnpm db:down:volumes` 重建数据卷。

## 13. Release Gate (R.92 强制)

每次 PR 合并前必须依次通过:

```bash
pnpm env:check                  # 1. 环境配置
pnpm exec tsc --noEmit          # 2. 类型检查
pnpm build                      # 3. 生产构建
pnpm smoke:sync                 # 4. 同步链路
pnpm cleanup:test-pollution     # 5. 清理中心库测试污染
pnpm baseline:check             # 6. 同步/控制基线
pnpm audit:center-db -- --strict --matrix  # 7. 中心库完整性
pnpm audit:page-scope           # 8. 页面范围
pnpm audit:product-copy         # 9. 用户文案
pnpm audit:data-coverage        # 10. 数据覆盖
pnpm audit:api-mode-no-fallback # 11. 禁止 mock fallback
pnpm audit:page-no-todo         # 12. 页面无 TODO 注释
pnpm e2e:route-page-integration # 13. 路由-页面集成
pnpm e2e:racks                  # 14. 盘架管理 (含 inspection/volumes 视图)
pnpm e2e:users                  # 15. 用户与权限
pnpm e2e:volumes                # 16. 存储卷视图
pnpm e2e:command-palette        # 17. 命令面板
pnpm e2e:security-boundaries    # 18. 安全边界
```

任一失败不允许合并。
