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
cp -n .env.example .env.local
pnpm install
pnpm db:up
pnpm db:init
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
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm baseline:check
pnpm audit:center-db -- --strict --matrix
pnpm audit:classify-source-tables
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

## 后续开发入口

- [R.90 requirements review (PR #7)](docs/database-analysis/sprint-r90-requirements-review.md)
- [R.86 文件索引增量同步](docs/database-analysis/r86-file-index-incremental-sync.md)
- [R.88 site agent 契约](docs/source/site-agent-contract.md)
- [架构质量路线图](docs/architecture/architecture-quality-roadmap.md)
- [大表与 ES 规划](docs/architecture/es-large-table-roadmap.md)

下一步:

- **R.90.1 PR 收尾**: 清理 sync 页面开发者文案 + smoke 自清理 + 文档 review 矛盾 (本 Sprint)
- **R.91**: audit 启发式优化 (R.90.1 之后)
- **R.87**: 生产 cron / 监控 / 死信重放 (R.86 之后)

## 禁止事项

- 不把 mock、simulator、DRY_RUN 说成真实完成。
- 不用 200 响应或 toast 文案冒充需求完成。
- 不把大表强塞进 PG 全量同步。
- 不提交 `.env.local`、真实连接串、真实 token、数据库密码。
- 不把历史 review 或 summary 当成当前事实；必须用当前代码、DB、测试重新验证。
