# R.11 Exports, Sync, Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for every unit and superpowers:verification-before-completion before each commit.

**Goal:** 完成设备导出、同步日志导出、每站点同步状态和 Settings 多站点只读集成，形成 4 个独立提交。

**Architecture:** API 直接查询 PostgreSQL 17 中心表，响应显式声明来源；前端只消费真实 API。导出在服务端生成，浏览器事件只负责下载，不拼接假数据。

**Tech Stack:** Next.js 16、React 19、TypeScript、PostgreSQL 17、tsx e2e、浏览器事件验收。

---

### Task 1: R.11A 设备真实导出

**Files:**
- Create: `app/api/racks/export/route.ts`
- Modify: `app/racks/page.tsx`
- Modify: `scripts/e2e/test-racks.ts`
- Create: `docs/database-analysis/sprint-r.11a-requirements-review.md`
- Modify: traceability/status/roadmap docs

- [x] 先在 `test-racks.ts` 增加导出 API、CSV 内容、摘要和前端事件失败测试。
- [x] 运行 `pnpm e2e:racks`，确认 RED。
- [x] 实现真实 CSV 导出 API 和 `/racks` 下载事件。
- [x] 运行 API、目标 e2e 和浏览器页面/事件约束验证。
- [x] 更新 requirements review 与追踪文档。
- [x] 运行全量检查，提交并推送。

### Task 2: R.11B 同步日志完整性摘要导出

**Files:**
- Create: `app/api/sync/export/route.ts`
- Modify: `app/sync/page.tsx`
- Modify: `scripts/e2e/test-sync.ts`
- Create: `docs/database-analysis/sprint-r.11b-requirements-review.md`
- Modify: traceability/status/roadmap docs

- [x] 先增加四类日志、CSV/JSON、站点过滤、摘要和前端事件失败测试。
- [x] 运行 `pnpm e2e:sync`，确认 RED。
- [x] 实现真实日志导出 API 和 `/sync` 下载事件。
- [x] 验证下载内容与中心库记录一致。
- [x] 更新 REQ-5.1.2 为诚实的 `partial`。
- [x] 运行全量检查，提交并推送。

### Task 3: R.11C 每站点最新同步状态

**Files:**
- Create: `app/api/sync/sites/status/route.ts`
- Modify: `app/sync/page.tsx`
- Modify: `scripts/e2e/test-sync.ts`
- Create: `docs/database-analysis/sprint-r.11c-requirements-review.md`
- Modify: traceability/status/roadmap docs

- [x] 先增加状态聚合 API、空状态和前端展示失败测试。
- [x] 运行 `pnpm e2e:sync`，确认 RED。
- [x] 实现基于 `sync_sites` 的 LATERAL 最新日志聚合。
- [x] 在 `/sync` 展示每站点 scheduler/package/consistency 状态。
- [x] 更新 REQ-2.3.3 的实际实现证据，保持 `partial`。
- [x] 运行全量检查，提交并推送。

### Task 4: R.11D Settings 站点与调度视图

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `scripts/e2e/test-settings.ts`
- Create: `docs/requirements-review/2026-06-11-r11d-settings-sites.md`
- Modify: traceability/status/roadmap docs

- [ ] 先增加 `/api/sites`、每站点状态和来源区分失败测试。
- [ ] 运行 `pnpm e2e:settings`，确认 RED。
- [ ] Settings 并行读取站点注册、同步配置和每站点最新状态。
- [ ] 展示来源、调度周期和最近状态，写操作继续 fail-closed。
- [ ] 更新 requirements review 与追踪文档。
- [ ] 运行全量检查，提交并推送。
