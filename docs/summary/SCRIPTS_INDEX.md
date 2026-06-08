# Scripts Index

> **生成时间**: 2026-06-08
> **来源**: Sprint 4.6A 代码库清理审计
> **范围**: `scripts/` 目录所有脚本 (39 个 .ts/.py 文件)

## 1. 分类总览

| 分类 | 数量 | 命名约定 | 处置策略 |
|---|---|---|---|
| **A. production / dev (必保留)** | 11 | 业务命名 (`import-*` / `export-*` / `push-*` / `smoke-*` / `analyze_disc_schema`) | 保留, 不动 |
| **B. smoke / test (可保留)** | 4 | `test-*` / `smoke-*` | 保留, 用于 CI 回归 |
| **C. audit 一次性 (建议归档)** | 23 | `sprint-*` (短命脚本, 完成使命) | **保留路径**, 加 `archive-` 前缀 + 文档说明 |
| **D. obsolete (可删)** | 1 | `analyze_disc_schema.py` (.py 混进 tsx 项目, 已无意义) | **保留但加备注** (低风险原则, 不删) |

> **低风险原则**: Sprint 4.6A 不删除任何文件, 避免破坏 git 历史/CI/历史引用。
> 若需归档, 未来 Sprint 走 `scripts/archive/` 子目录。

## 2. 详细分类表

### A. production / dev (必保留) — 11 个

| 脚本 | package.json 引用 | 用途 |
|---|---|---|
| `import-from-source.ts` | `import:tasks` / `import:devices` / `import:discs` / `import:volumes` / `import:hard-disks` / `import:all` | 真实 source_restore 数据导入 (Sprint 2B.12+) |
| `import-file-index.ts` | `import:file-index` | file-index 增量导入 (Sprint 2C.19) |
| `import-user-site-platforms.ts` | `import:users` / `import:sites` / `import:platforms` / `import:user-site-platforms` | tbl_user/tbl_site/tbl_platform 导入 (Sprint 2E.2) |
| `import-aggregates.ts` | `import:aggregates` / `import:aggregates:all` | 3 张占位表聚合器 (Sprint 2H.3) |
| `export-package.ts` | `export:package` | 站点包导出 (Sprint 2H.1) |
| `push-package.ts` | `push:package` | 站点包推送 (Sprint 2H.1) |
| `export-and-push.ts` | `export-and-push` | 端到端导出+推送 (Sprint 2H.1) |
| `smoke-sync.ts` | `smoke:sync` | 同步链路 smoke 测试 (Sprint 2D.5, Sprint 2G.1 加 HMAC) |
| `analyze_disc_schema.py` | (无) | tbl_disc schema 分析 (历史遗留, 已被 import-from-source 替代) |

### B. smoke / test (可保留, 适合 CI) — 4 个

| 脚本 | package.json 引用 | 用途 |
|---|---|---|
| `test-package-log.ts` | `test:package-log` | sync_package_log 单表写入测试 |
| `test-sync-package.ts` | (无) | /api/sync/package 端到端 (Sprint 2D.2 早期版本) |
| `test-sync-package-10.ts` | (无) | /api/sync/package 10 表扩展测试 (Sprint 2D.3) |

### C. audit 一次性 (建议归档) — 23 个 sprint-* 脚本

> **特征**: 文件名带 `sprint-XY-` 前缀, 是某个 Sprint 当时的诊断/核对脚本, 已完成使命。
> 保留可读, 但新人不应再使用。

| Sprint | 脚本数 | 列表 |
|---|---|---|
| Sprint 2F.2A | 3 | `sprint-2f2a-list-tables.ts` / `sprint-2f2a-profile-task-items.ts` / `sprint-2f2a-verify-table-existence.ts` |
| Sprint 2F.3 | 1 | `sprint-2f3-verify-sh01.ts` |
| Sprint 2G.2 | 2 | `sprint-2g2-baseline.ts` / `sprint-2g2-reconcile.ts` |
| Sprint 2G.3 | 4 | `sprint-2g3-scan.ts` / `sprint-2g3-profile.ts` / `sprint-2g3-deepdive.ts` / `sprint-2g3-status-detail.ts` |
| Sprint 2H.1 | 1 | `sprint-2h1-verify-logs.ts` |
| Sprint 2H.1R | 4 | `sprint-2h1r-coverage.ts` / `sprint-2h1r-deep.ts` / `sprint-2h1r-schema.ts` / `sprint-2h1r-sh01-truth.ts` |
| Sprint 2H.2 | 5 | `sprint-2h2-schema-check.ts` / `sprint-2h2-hd-ctr.ts` / `sprint-2h2-hd-disc-check.ts` / `sprint-2h2-sh01-truth.ts` / `sprint-2h2-single-table.ts` |
| Sprint 2H.3 | 3 | `sprint-2h3-e2e-push.ts` / `sprint-2h3-inspect-volume-slot.ts` / `sprint-2h3-verify-truth.ts` |
| Sprint 2H.6 | 1 | `sprint-2h6-inserted-updated.ts` |
| Sprint 2H.7 | 1 | `sprint-2h7-coverage-full.ts` |

**Sprint 4.6A 处置**: **保留路径不动**, 在每个脚本头注释加 `@archive` 标记 + 引用对应 sprint 文档。

### D. obsolete (可删, 低风险) — 1 个

| 脚本 | 原因 |
|---|---|
| `analyze_disc_schema.py` | Python 脚本混进 pnpm + tsx 项目, 已被 `import-from-source.ts` 完全替代 |

**Sprint 4.6A 处置**: **不删** (CLAUDE.md 不删大量文件), 文档标注"可删, 待 Sprint 4.7 决定"。

## 3. 与 package.json 引用对照

| package.json script | 指向 | 分类 |
|---|---|---|
| `import:*` (6 个) | `scripts/import-*.ts` | A |
| `import:user-site-platforms` | `scripts/import-user-site-platforms.ts` | A |
| `import:aggregates` | `scripts/import-aggregates.ts` | A |
| `test:package-log` | `scripts/test-package-log.ts` | B |
| `smoke:sync` | `scripts/smoke-sync.ts` | A |
| `export:package` / `push:package` / `export-and-push` | `scripts/export-package.ts` / `push-package.ts` / `export-and-push.ts` | A |

**结论**: 11 个 package.json 引用全部指向 A 类脚本, **无指向 C 类 sprint-* 脚本**。C 类可放心归档, 不影响 npm scripts。

## 4. 风险评估

| 风险 | 严重度 | 说明 |
|---|---|---|
| C 类脚本占用 git 空间 | 低 | 23 个文件, ~85KB, 对仓库无负担 |
| D 类 `analyze_disc_schema.py` | 低 | 命名迷惑 (python 在 tsx 项目), 但无引用 |
| 未来 CI 误用 C 类脚本 | 中 | 必须加 `@archive` 头注释 |
| 脚本命名不一致 | 中 | import:* 用冒号, sprint-* 用连字符, 不统一 |

## 5. 下一步建议 (Sprint 4.7+)

- [ ] 在每个 sprint-* 脚本头加 `/** @archive - see docs/.../sprint-X.Y.md */`
- [ ] 把 D 类 `analyze_disc_schema.py` 移到 `scripts/archive/` (CLAUDE.md 允许后)
- [ ] package.json 脚本命名统一: `import:*` → `import-<entity>` (去掉冒号)
- [ ] 把 sprint-* 脚本统一移到 `scripts/archive/sprint-*` (CLAUDE.md 允许后)
