# 统一光盘库总控平台

集团层统一管控平台。它不替代站点原有系统，只把各站点数据同步到中心库，再提供统一视图、统一检索、任务队列和审计能力。

## 当前结论

- 最高验收标准: [docs/source/requirements.md](docs/source/requirements.md)。
- 中心库: PostgreSQL 17，所有总控页面/API 默认读写中心库，不直接读生产站点库。
- 小/中表: 通过 `sync_package` + dispatcher 同步到 `unified_*`。
- 大表: `tbl_file*` / `tbl_folder*` 不进 PG 全量，规划走 OpenSearch/ES 文件索引，详见 [大表与 ES 规划](docs/architecture/es-large-table-roadmap.md)。
- 任务控制: 目前是控制队列框架；未取得站点 app poll、执行回写和 schema 配合前，不能宣称真实控制完成。

## 快速启动

```bash
# 1. 生成 .env.local (从 .env.example, 含一致 DB 三元组 + 随机密钥)
pnpm env:init

# 2. 验证配置
pnpm env:check

# 3. 启动 PostgreSQL (首次或密码不一致时: pnpm db:down:volumes && pnpm db:up)
pnpm db:up

# 4. 初始化中心库
pnpm db:init

# 5. 启动开发服务器
pnpm dev
```

打开 <http://localhost:3000>，本地默认账号为 `admin / admin`。

要求:

| 工具 | 版本 |
|---|---|
| Node.js | 22 LTS 或更高 |
| pnpm | 11.3.0 |
| Docker Desktop | 可运行 PostgreSQL 17 |

## 本地验证

```bash
set -a && source .env.local && set +a
pnpm env:check                 # R.93: 验证 DB 三元组一致 + 密钥非占位符
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm baseline:check
pnpm audit:center-db -- --strict --matrix
pnpm audit:page-scope
pnpm audit:product-copy
pnpm audit:data-coverage
pnpm audit:api-mode-no-fallback
pnpm audit:page-no-todo
```

涉及前端交互、控制命令、同步按钮或页面数据源时，还要跑对应 `scripts/e2e/*` 或 `pnpm e2e:all`。任何失败都不能宣称完成。

## 部署

完整部署手册见 [docs/operations/deployment.md](docs/operations/deployment.md)。

常用章节:

- 多站点接入: [deployment.md §9](docs/operations/deployment.md#9-多站点接入-r90)
- 定制同步: [deployment.md §10](docs/operations/deployment.md#10-定制同步-开发阶段真实支持项)
- R.85 OpenSearch/ES 检索: [deployment.md §8](docs/operations/deployment.md#8-r85-opensearches-搜索-profile)
- 新站点 checklist: [site-onboarding-checklist.md](docs/operations/site-onboarding-checklist.md)
- Site Agent HTTP 契约: [site-agent-contract.md](docs/source/site-agent-contract.md)

最小 Docker 镜像构建:

```bash
docker build -t unified-disc-platform:latest .
```

生产部署必须用环境变量或 secret manager 注入:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `DB_PASSWORD` (本地 Docker 初始化与脚本使用; 必须与 `DATABASE_URL` / `POSTGRES_PASSWORD` 匹配)
- `AUTH_SESSION_SECRET`
- `SYNC_PACKAGE_SECRET`
- `SITE_AGENT_SECRET`
- `SEARCH_ES_URL` / `SEARCH_ES_INDEX` (启用 OpenSearch/ES 文件检索时)
- 站点 Agent 各自的 `SITE_DATABASE_URL`

不要把真实密钥写进 README、compose、SQL、测试脚本或提交历史。
本地 Docker 首次建库后, 修改 `.env.local` 里的密码不会自动修改已有 volume; 密码不一致时按部署手册处理。

## 主要目录

| 路径 | 用途 |
|---|---|
| `app/` | Next.js 页面与 API routes |
| `components/` | UI 组件 |
| `lib/sync/` | 同步包 schema、dispatcher、dump ingest |
| `lib/auth/` | 本地 JWT/RBAC 与 API 鉴权边界 |
| `databases/` | 可复现 DDL patch |
| `scripts/` | e2e、审计、同步、清理和部署验证脚本 |
| `docs/architecture/` | 架构设计、质量属性、ES 大表规划 |
| `docs/operations/` | 部署与运维手册 |
| `docs/database-analysis/` | requirements review 与数据库审计材料 |

## 同步覆盖真相

> 中心库对外**只承诺同步业务白名单表**, 大表与逐表浏览不在总控范围。

- **PG 中心库**: 同步 `R.83.9 ALLOWED_PACKAGE_TABLES` 141 张业务表 (设备/任务/部门/权限/日志/检查/卷等)。
- **OpenSearch/ES**: 同步 `R.84 file_index_es` 29 张文件/目录表 (`tbl_file*` / `tbl_folder*`), 严禁进入 PG 全量。
- **前端展示**: 业务视图 (任务 / 设备 / 卷 / 检索 / 站点 / 同步状态), 不提供 170 张源表逐表浏览。
- **真实状态**:
  - §2.3 业务同步 → `complete` (R.83.9 中心库 dispatcher)
  - §5.2 文件索引 → `partial` (R.85 端口 + R.86 增量调度账本, R.87 cron/监控未做)
  - §4.2 任务控制 → `partial` + `blocked_by_site_change` (R.88 契约已落地, 站点代理未接入)
  - §2.2/§3.x 登录 / RBAC / SSO → `blocked_by_auth`

## 页面清单

### Primary Nav (9 个一级页面)

| 页面 | 路由 | 数据来源 |
|---|---|---|
| 控制台 (Dashboard) | `/` | `unified_*` 聚合, 真实数据 |
| 同步中心 (Sync) | `/sync` | `sync_package_log`, `sync_sites` 等, 真实数据 |
| 任务管理 (Tasks) | `/tasks` | `unified_tasks`, `control_command`; `?view=commands` 控制命令 |
| 盘架管理 (Racks) | `/racks` | `unified_devices`, `unified_cages`; `?view=inspection` 巡检, `?view=volumes` 存储卷 |
| 用户与权限 (Users) | `/users` | `unified_users`, `auth_accounts` |
| 站点管理 (Sites) | `/sites` | `sync_sites` 注册表 |
| 审计日志 (Logs) | `/logs` | 7 类日志表 |
| 系统设置 (Settings) | `/settings` | `sync_site_config`, `sync_sites` |
| 统一检索 (Search) | `/search` | 依赖 ES, 未接入时显示 blocker |

### Redirect Routes

| 原路由 | 跳转到 | 说明 |
|---|---|---|
| `/check` | → `/racks?view=inspection` | 原始 17-tab raw-table 浏览, R.91.1 合并 |
| `/volumes` | → `/racks?view=volumes` | 原始 475 行独立页面, R.91.1 合并 |

### Alias

| 路由 | 实际访问 |
|---|---|
| `/control` | → `/tasks?view=commands` (已合并别名) |

### 开发阶段可验收页面 (pnpm db:init + pnpm smoke:sync 后)

| 页面 | 真实数据? |
|---|---|
| `/sites` | ✅ SH01 站点已注册 |
| `/tasks` | ✅ `unified_tasks` 有同步数据 |
| `/racks` | ✅ `unified_devices` 有设备数据 |
| `/racks?view=volumes` | ✅ `unified_volumes` 有卷聚合数据 |
| `/users` | ✅ `unified_users` 有用户数据 |
| `/logs` | ✅ 7 类日志表有记录 |
| `/sync` | ✅ `sync_package_log` 有同步记录 |
| `/search` | ⚠️ 依赖 ES, 未接入时 0 条 |

### 从头部署验证步骤

```bash
# 1. 启动 PostgreSQL
pnpm db:up

# 2. 初始化数据库 (schema + seed)
pnpm db:init

# 3. 运行同步管道 (向中心库写入真实数据)
pnpm smoke:sync

# 4. 访问以下页面验证数据出现:
#    http://localhost:3000/sites       → 1+ 站点
#    http://localhost:3000/tasks       → 任务列表
#    http://localhost:3000/racks       → 设备列表
#    http://localhost:3000/racks?view=inspection → 巡检概览
#    http://localhost:3000/racks?view=volumes   → 存储卷
#    http://localhost:3000/users       → 用户列表
#    http://localhost:3000/logs        → 日志记录
#    http://localhost:3000/sync        → 同步状态
```

## 后续开发入口

- [R.93 requirements review](docs/database-analysis/sprint-r93-final-delivery-requirements-review.md) — 当前开发版可交付候选
- [R.92.1 requirements review](docs/database-analysis/sprint-r92.1-requirements-review.md) — 前置收尾
- [R.91.1 requirements review](docs/database-analysis/sprint-r91.1-requirements-review.md)
- [R.90 requirements review](docs/database-analysis/sprint-r90-requirements-review.md)
- [R.88 site agent 契约](docs/source/site-agent-contract.md)
- [架构质量路线图](docs/architecture/architecture-quality-roadmap.md)
- [大表与 ES 规划](docs/architecture/es-large-table-roadmap.md)

下一步:

- **R.93 已完成**: 本地开发版交付闭环 (R.83.9 dispatcher 业务主键映射, ES 端口 9201, 前端产品化文案, 部署文档 env:init 主路径)
- **R.87**: 生产 cron / 监控 / 死信重放 (R.86 之后)
- **R.91.2+**: racks 浏览/恢复 Tab 控制命令 UX 增强

## 禁止事项

- 不把 mock、simulator、DRY_RUN 说成真实完成。
- 不用 200 响应或 toast 文案冒充需求完成。
- 不把大表强塞进 PG 全量同步。
- 不提交 `.env.local`、真实连接串、真实 token、数据库密码。
- 不把历史 review 或 summary 当成当前事实；必须用当前代码、DB、测试重新验证。
