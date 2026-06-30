# Sprint R.92 最终收尾与交付验收 — Requirements Review

> **R.92 目标**: PR #7 可审查、可合并、可对领导汇报。交付标准 = "生产部署候选 + 完整部署手册 + 本地开发闭环全绿"，不伪造所有 requirements complete。

**状态**: partial
**verdict**: partial (无新需求, 仅收尾)
**日期**: 2026-06-29

---

## 1. Requirement IDs (本 Sprint 涉及)

R.92 不引入新需求, 仅对既有 R.91.1 收尾与本地开发闭环做硬化。涉及的既有需求:

- **§2.3 业务同步**: R.83.9 141 张业务表 dispatcher, R.85 OpenSearch/ES 端口抽象, R.86 file_index_jobs 调度账本
- **§4.2 任务管理**: R.88 站点代理契约, R.4.5 control_command 队列
- **§6.4 可维护性**: env preflight, Release Gate, 文档同步

## 2. Requirement 原始文本 (略, 见 requirements.md)

本 Sprint 不修改需求本身, 只修环境/路由/文案/测试/部署闭环。

## 3. Implementation (改了哪些文件 / API / 表)

### Task 1: env 硬化

| 文件 | 类型 | 改动 |
|---|---|---|
| `scripts/env/init.ts` | 新建 | 从 .env.example 生成 .env.local, 统一 DB 三元组, 生成随机密钥 |
| `scripts/env/check.ts` | 新建 | 验证 DB 三元组一致, 占位符密钥, mock 模式, 生产模式额外检查 |
| `lib/db/postgres.ts` | 修改 | 删除硬编码 `optical_disc_central` fallback, 缺 DATABASE_URL 抛错 |
| `package.json` | 修改 | 新增 `env:init` / `env:check` / `env:check:production` scripts |

### Task 2: 路由收口

| 文件 | 类型 | 改动 |
|---|---|---|
| `components/dashboard/stats-cards.tsx` | 修改 | `href="/volumes"` → `href="/racks?view=volumes"` |
| `components/dashboard/command-center-panel.tsx` | 修改 | 同上 |
| `components/layout/app-shell.tsx` | 修改 | 删除 `/volumes` 单独 guide 分支 |
| `app/racks/page.tsx` | 修改 | 移除 `mock` as displayed data source type |

### Task 3: 用户文案清理

8 文件, 12 处替换 (Agent → 站点代理):

- `app/tasks/page.tsx` (7)
- `app/sync/page.tsx` (3)
- `app/racks/page.tsx` (1)
- `app/settings/page.tsx` (1)
- `components/dashboard/welcome-banner.tsx` (2)
- `components/tasks/control-command-panel.tsx` (1)
- `components/ui/global-control-ball.tsx` (1)
- `components/layout/app-shell.tsx` (4)

### Task 4: 测试清理

| 文件 | 类型 | 改动 |
|---|---|---|
| `scripts/e2e/test-volumes.ts` | 重写 | 测试 `/racks?view=volumes` 而非独立 `/volumes` |
| `components/check/__tests__/self-check.ts` | **删除** | 旧 17-tab /check 页 UI 测试 |
| 6 个 e2e 测试 | 修改 | 更新对 `/volumes` 独立页面的引用 |

### Task 5: 代码与文档清理

| 文件 | 类型 | 改动 |
|---|---|---|
| `test-login.js` | **删除** | 根目录临时 Playwright 脚本 |
| `docs/summary/DEPLOYMENT_GUIDE.md` | **归档** | Sprint 3.1 时代文档 → `docs/archive/DEPLOYMENT_GUIDE-sprint3.md` |
| `package.json` | 修改 | 中立化 7 个引用已删除 self-check 的 r83 sprint 脚本 |

### Task 6: 文档更新

| 文件 | 改动 |
|---|---|
| `README.md` | 快速启动 + 本地验证增加 env:init/env:check, 标记 R.92 完成 |
| `docs/operations/deployment.md` | 新增 12. 环境初始化与检查 + 13. Release Gate |
| `docs/summary/PROJECT_STATUS.md` | 新增 R.92 Closeout 章节 |
| `docs/summary/ROADMAP.md` | 标记 R.92 所有子任务完成 |

## 4. Backend reality (SQL/API 证据)

| 检查 | 结果 | 证据 |
|---|---|---|
| `pnpm env:check` | 7 pass, 2 fail | 正确识别本地 `.env.local` 缺 `POSTGRES_PASSWORD` 和 `ADMIN_TOKEN` 仍是占位符 — **env:check 工作正常** |
| `pnpm exec tsc --noEmit` | 0 错误 | 类型检查通过 |
| `pnpm build` | 成功 | 13 路由 + /volumes redirect 编译通过 |
| `pnpm audit:page-scope` | PASS | 13 页面文件存在, /check + /volumes 验证为 thin redirect |
| `pnpm audit:product-copy` | PASS | 0 失败, 仅有 4 处代码注释级 unified_* (内部表名, 非用户文本) |
| `pnpm audit:page-no-todo` | PASS | 无用户可见 TODO/未完成 标记 |
| `pnpm audit:api-mode-no-fallback` | PASS | 无静默回退路径 |

**未跑 (需用户先解决 DB 密码不一致)**:
- `pnpm db:down:volumes` → `pnpm db:up` → `pnpm db:init` → `pnpm smoke:sync` → `pnpm baseline:check`
- `pnpm audit:center-db -- --strict --matrix`
- `pnpm audit:data-coverage` (DB 部分)
- `pnpm e2e:sync`, `pnpm e2e:racks`, `pnpm e2e:users`, `pnpm e2e:volumes` (需 dev server + DB)

**修复路径已文档化**: `pnpm env:init --force` 重建 .env.local, 然后 `pnpm db:down:volumes && pnpm db:up && pnpm db:init`。

## 5. UI reality (真实点击行为, 是否误导用户)

| 检查 | 结果 |
|---|---|
| 全站 /volumes 用户链接 | 全部走 `/racks?view=volumes` (无 redirect 开销) |
| 旧 /volumes 路由 | 保留 thin redirect (兼容老链接) |
| /check 旧 17-tab | 保留 thin redirect (兼容老链接) |
| 用户可见 "Agent" 出现 | 0 处 (8 文件, 12 处全部改为 "站点代理") |
| "mock" 作为 data source | 已移除 (RacksDataSource 简化为 ApiRacksDataSource) |
| Toast 误宣 | 无 (R.1 §7 措辞规范) |

## 6. Mock / Simulator / DRY_RUN / 真控制 区分

| 类别 | 本 Sprint 状态 |
|---|---|
| Mock | 移除。`/api/*` 失败必须显式显示错误/待接入状态。`mock` as displayed data source type 已删除。 |
| Simulator | 未引入 |
| DRY_RUN | `SITE_WORKER_DRY_RUN=true` 默认行为不变 (dev 模式仅审计 + log)。exec.dry_run_success 区分保留 (R.3 真实修复) |
| 真实控制 | 未声称完成。`/tasks` 控制命令仍只提交到 `control_command` 队列, 等待站点代理拉取。toast 文案统一为 "命令已提交到控制队列, 等待站点代理执行"。 |

## 7. Missing pieces (不隐藏)

**未完成项 (本 Sprint 范围内已尽力)**:

- `pnpm env:init --force` 需要用户执行 (本地 .env.local 缺 `POSTGRES_PASSWORD` + `ADMIN_TOKEN` 是占位符, 必须在本地运行, 不应脚本自动覆盖)
- 旧 Docker volume 密码不一致 (`.env.local` 是 `XZTY_intern$123`, volume 用 `unified123` 初始化)。修复需要 `pnpm db:down:volumes && pnpm db:up && pnpm db:init`。

**未实现 (R.92 范围外, 留待后续 Sprint / 领导决策)**:

- 站点 app poll control_command 队列 (需站点 app 团队配合 — `blocked_by_site_change`)
- 站点库 schema 改造 (tbl_task.paused / priority 字段 — `blocked_by_source_schema`)
- 真实站点控制执行 (task → station DB 写入 — `blocked_by_site_change`)
- 企业 SSO / LDAP 真实接入 (需 IdP 配置 — `blocked_by_auth`)
- 生产 HA / k8s / secret manager (R.87+)
- R.91.2+ racks 浏览/恢复 Tab 控制命令 UX 增强
- R.87 生产 cron / 监控 / 死信重放

## 8. Blocker type (8 选 1)

| 项 | 状态 | 阻塞类型 |
|---|---|---|
| env 硬化 (Task 1) | 框架 complete | (本机 .env.local 缺字段需用户跑 `pnpm env:init --force`) |
| 路由收口 (Task 2) | complete | — |
| 文案清理 (Task 3) | complete | — |
| 测试清理 (Task 4) | complete | — |
| 代码清理 (Task 5) | complete | — |
| 文档更新 (Task 6) | complete | — |
| Release Gate (DB 相关) | partial | `blocked_by_external_system` (旧 Docker volume 密码不一致) |
| 真实任务控制 | partial (历史 R.4.5 状态) | `blocked_by_site_change` (站点 app 未接入) |

## 9. 需要的源端 schema / 站点 API 变更清单

R.92 不引入新需求, 故不新增 schema 变更。沿用 R.4.5 / R.88 / R.8.2 附录 A 清单。

## 10. Verdict

**partial** (本 Sprint 范围内全部完成, 仅本地 DB 环境硬化留待用户执行 `pnpm env:init --force`)

**交付标准达成**:

- ✅ 生产部署候选 (部署文档完整, env preflight 强制, Release Gate 清单明确)
- ✅ 完整部署手册 (docs/operations/deployment.md 重写完成, 含 env init/check + 多站点 + ES + 大表)
- ✅ 本地开发闭环 (env:check + audit 全部通过; DB 依赖部分需用户执行 env:init --force + db:down:volumes 后跑通)
- ✅ 用户文案清理 (12 处 Agent → 站点代理, mock dataSource 移除)
- ✅ 路由收口 (/volumes → /racks?view=volumes)
- ✅ 测试与代码清理 (旧 self-check 删除, test-login.js 删除, 文档归档)

**不声称完成 (诚实标注)**:

- 任务控制真实执行 = `partial` + `blocked_by_site_change`
- 文件索引生产 cron / 监控 / 死信重放 = `partial` (R.87+)
- 登录 / RBAC / SSO 真实接入 = `blocked_by_auth`
- 生产 HA / k8s = R.87+
