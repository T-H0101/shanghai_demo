# Repository Cleanup Policy

> **目的**: 区分"git 应该追踪的源文件"和"运行/审计生成物", 防止历史脏数据、临时报告、`.env.local`、截图混入主线。
>
> **Sprint**: R.88 (cleanup track)
> **依据**: `docs/superpowers/plans/2026-06-29-r84-r88-development-architecture-cleanup-plan.md` Task 8

---

## 1. 三类文件分类

| 类别 | 是否进 git | 例子 |
|---|---|---|
| **Source** (源) | ✅ | `.ts` / `.tsx` / `.sql` / `.md` / `.yml` / `.sh` / `.json` schema |
| **Generated** (运行/审计生成物) | ❌ | `audit/*.json` / `docs/audit/consistency/consistency-*.json` / `audit/center-db-matrix.json` |
| **Local environment** (本地环境) | ❌ | `.env.local` / `.env.production` / `*.log` / `tmp/`, `node_modules/` |
| **Ephemeral** (临时) | ❌ | 本地截图 / 一次性调试脚本输出 / 一键生成的报告 |

---

## 2. Source 文件规则

### 必须 commit

- 文档: `docs/source/requirements.md`, `docs/architecture/*`, `docs/operations/*`, `docs/database-analysis/sprint-*-requirements-review.md`
- 代码: `app/`, `components/`, `lib/`, `scripts/` 中除"审计生成脚本输出"外的所有源文件
- 数据库: `databases/sprint-*/` 下的 DDL patch 和 init 脚本
- 配置: `.gitignore`, `.env.example`, `docker-compose*.yml`, `package.json`, `pnpm-lock.yaml`
- ADR: `docs/architecture/adr/000N-*.md`

### 不允许 commit

- 真实数据库连接串或密码 (用 `credential_ref` 引用)
- 生产环境真实 token / cookie / session
- 截图、PDF 临时报告
- 单次运行的完整审计 JSON 输出 (脚本输出到 `audit/`)

---

## 3. Generated 文件规则

### 视为生成物, 不进 git

| 路径模式 | 类型 |
|---|---|
| `audit/*.json` | 中心库审计 JSON (matrix / consistency) |
| `docs/audit/consistency/consistency-*.json` | 一致性审计 JSON |
| `audit/center-db-matrix.json` | R.83 治理矩阵生成物 |
| `docs/database-analysis/audit-r*.json` | 旧 audit JSON |
| `tmp/`, `*.tmp` | 临时输出 |

### 允许规则

```gitignore
# R.7C / R.83 audit output
audit/*.json
docs/audit/consistency/consistency-*.json

# Local env / runtime
.env.local
.env.production
.env.*.local

# OS / editor noise
.DS_Store
.vscode/
.idea/

# Build / dep
.next/
node_modules/
*.tsbuildinfo
```

---

## 4. Source docs vs Transient docs

| 类别 | 进 git? | 存放 |
|---|---|---|
| 稳定架构 / 部署 / ADR / requirements review | ✅ 必进 | `docs/architecture/`, `docs/operations/`, `docs/database-analysis/` |
| Sprint review (固定模板) | ✅ 必进 | `docs/database-analysis/sprint-<X.Y>-requirements-review.md` |
| 一致性审计 JSON / 中心库矩阵 JSON | ❌ 不进 | `audit/` (运行时生成) |
| 历史废弃文档 (仍可参考) | ⚠️ 评估 | 移到 `docs/archive/` (R.89 处理) |

---

## 5. 删除纪律 (R.89 入口)

清理仓库时, 删除源文件**必须**满足:

1. `rg` 在 `app/`, `components/`, `lib/`, `scripts/` 找不到任何 import 或 route 引用
2. `package.json` scripts 没有任何条目调用它
3. 没有 requirements review 文件以它为证据
4. 一个独立 PR 只做删除, commit message 含 "dead-code-removal:" 前缀

不满足的进 `docs/database-analysis/r89-dead-code-inventory.md`, action 标 `needs_owner_decision`。

---

## 6. 已实施状态 (本 Sprint)

| 项 | 状态 |
|---|---|
| `audit/*.json` 加入 `.gitignore` | ✅ (PR #6) |
| `audit/center-db-matrix.json` 脱钩 git tracking | ✅ (PR #6) |
| `.DS_Store` 本地清理 | ✅ (PR #6) |
| `docs/audit/consistency/consistency-*.json` 加入 ignore | ✅ (R.88 本 Sprint) |
| `docs/database-analysis/audit-r*.json` 加入 ignore | ✅ (R.88 本 Sprint) |

---

## 7. Reviewer 检查项

每个 PR:

- [ ] 没有 commit `.env.local` / 真实密码 / 真实 token
- [ ] 没有 commit `audit/*.json` / 一致性 JSON / 截图
- [ ] 没有 commit 整库 dump / `*.sql` 大文件 (DDL patch 除外)
- [ ] 删除文件时满足 §5 四条件
- [ ] 如涉及 schema 变更, 同 PR 有 `databases/sprint-X/init-docker.sh` 注册

