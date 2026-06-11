# Requirements-driven Completion Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 4 个独立的真实化需求单元，逐项验证、更新追踪、提交并推送。

**Architecture:** 使用中心库真实表与运行时健康接口构建只读视图；所有未接入写操作 fail-closed。API 返回显式 `source/dataSource/blocker`，前端不静默回退 mock。

**Tech Stack:** Next.js 16、React 19、TypeScript、PostgreSQL 17、tsx e2e。

---

### Task 1: R.10A 调度参数与多站点安全配置

**Files:**
- Create: `lib/sync/scheduler-args.ts`
- Create: `app/api/sync/config/route.ts`
- Modify: `scripts/scheduler/sync-scheduler.ts`
- Modify: `app/sync/page.tsx`
- Modify: `scripts/e2e/test-sync.ts`
- Modify: `scripts/e2e/test-scheduler.ts`
- Modify: traceability/status/review docs

- [ ] 写 scheduler 参数与安全配置 API 的失败测试。
- [ ] 运行目标测试，确认因功能缺失失败。
- [ ] 实现参数解析和只读安全配置 API。
- [ ] 在 `/sync` 展示配置来源、站点周期和凭据键引用。
- [ ] 运行目标测试与全量检查。
- [ ] 更新文档并提交 `feat(sync): expose safe multi-site config`。

### Task 2: R.10B Settings 真实只读化

**Files:**
- Modify: `app/settings/page.tsx`
- Create: `scripts/e2e/test-settings.ts`
- Modify: `package.json`
- Modify: traceability/status/review docs

- [ ] 写 `/settings` 无 mock、无假写操作、读取真实 API 的失败测试。
- [ ] 运行目标测试，确认失败。
- [ ] 将页面改为只读真实运行配置和健康状态。
- [ ] 加入 `e2e:settings` 和 `e2e:all`。
- [ ] 运行目标测试与全量检查。
- [ ] 更新文档并提交 `feat(settings): show verified runtime config`。

### Task 3: R.10C Users 真实只读化

**Files:**
- Modify: `app/api/users/route.ts`
- Modify: `app/users/page.tsx`
- Create: `scripts/e2e/test-users.ts`
- Modify: `package.json`
- Modify: traceability/status/review docs

- [ ] 写 users API 禁止 mock fallback、页面真实读取和 auth 阻塞测试。
- [ ] 运行目标测试，确认失败。
- [ ] API 改为 database/empty/error 三态。
- [ ] 页面改为真实只读列表，禁用所有 auth/RBAC 写操作。
- [ ] 加入 `e2e:users` 和 `e2e:all`。
- [ ] 运行目标测试与全量检查。
- [ ] 更新文档并提交 `feat(users): replace mock accounts with real read model`。

### Task 4: R.10D Racks API fail-closed

**Files:**
- Modify: `lib/api/api-providers.ts`
- Modify: `app/racks/page.tsx`
- Create: `scripts/e2e/test-racks.ts`
- Modify: `package.json`
- Modify: traceability/status/review docs

- [ ] 写 API 模式不允许 mock fallback 的失败测试。
- [ ] 运行目标测试，确认失败。
- [ ] Provider 和页面实现 database/empty/error 三态。
- [ ] 加入 `e2e:racks` 和 `e2e:all`。
- [ ] 运行目标测试与全量检查。
- [ ] 更新文档并提交 `fix(racks): fail closed without mock fallback`。
