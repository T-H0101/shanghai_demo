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
```

涉及前端交互、控制命令、同步按钮或页面数据源时，还要跑对应 `scripts/e2e/*` 或 `pnpm e2e:all`。任何失败都不能宣称完成。

## 部署

完整部署手册见 [docs/operations/deployment.md](docs/operations/deployment.md)。

最小 Docker 镜像构建:

```bash
docker build -t unified-disc-platform:latest .
```

生产部署必须用环境变量或 secret manager 注入:

- `DATABASE_URL`
- `POSTGRES_PASSWORD`
- `AUTH_SESSION_SECRET`
- `SYNC_PACKAGE_SECRET`
- `SITE_AGENT_SECRET`
- 站点 Agent 各自的 `SITE_DATABASE_URL`

不要把真实密钥写进 README、compose、SQL、测试脚本或提交历史。

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

## 后续开发入口

- [架构质量路线图](docs/architecture/architecture-quality-roadmap.md)
- [大表与 ES 规划](docs/architecture/es-large-table-roadmap.md)
- [可执行实施计划](docs/superpowers/plans/2026-06-29-architecture-cleanup-and-es-roadmap.md)

## 禁止事项

- 不把 mock、simulator、DRY_RUN 说成真实完成。
- 不用 200 响应或 toast 文案冒充需求完成。
- 不把大表强塞进 PG 全量同步。
- 不提交 `.env.local`、真实连接串、真实 token、数据库密码。
- 不把历史 review 或 summary 当成当前事实；必须用当前代码、DB、测试重新验证。
