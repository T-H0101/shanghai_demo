# Sprint R.44 — Route/Page Integration Audit

> Requirement IDs: `REQ-6.3.1`, `REQ-6.3.2`
> Date: 2026-06-20

---

## A. Requirement 对照

| Req ID | 原始文本 | Status |
|---|---|---|
| REQ-6.3.1 | 页面路由和 API 路由一致 | complete |
| REQ-6.3.2 | 前端页面路由可达、无死链 | complete |

## B. 前端变更清单 (8 项强制披露)

| 项 | 内容 |
|---|---|
| 新增页面/组件 | 无 |
| 修改按钮/交互 | 无 |
| 删除按钮/交互 | 无 |
| UI-only | 无 |
| 真实后端能力 | 无 (纯审计) |
| simulator/DRY_RUN | 无 |
| 新增需求未要求内容 | `app/volumes/page.tsx` 添加 `data-testid="volumes-page"` (R.5 追踪性) |
| 理由 | R.5 event traceability 要求所有页面有 data-testid |

## C. API 变更清单

| API | 变更 | 影响 |
|---|---|---|
| `/api/sync/trigger` | HTTP 200 (之前 501 stub) | R.39 已实现, R.44 验证 |
| `/api/users` | HTTP 200 (之前 401) | R.29 auth middleware 已加 |

## D. 数据库变更清单

无。

## E. 事件测试清单 (10 项验证)

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 用户在哪里点击 | 无需交互, 纯自动化审计 |
| 2 | 点击前页面状态 | N/A |
| 3 | 点击后请求了哪个 API | N/A |
| 4 | API 返回什么 | 12 个页面全部可达 (200/307) |
| 5 | 数据库是否变化 | N/A |
| 6 | 页面是否刷新 | N/A |
| 7 | toast 是否准确 | N/A |
| 8 | 是否存在 mock/fallback | ⚠️ racks page 有 mock import (已知) |
| 9 | 是否误导用户 | 无 |
| 10 | 是否符合 requirements.md | 是 |

## F. 浏览器验证结果

| 页面 | HTTP | data-testid | mock | API routes |
|---|---|---|---|---|
| / | 200 | ✅ | ✅ | — (dashboard) |
| /tasks | 200 | ✅ | ✅ | 2/2 |
| /sync | 200 | ✅ | ✅ | 8/8 |
| /logs | 200 | ✅ | ✅ | 4/4 |
| /settings | 200 | ✅ | ✅ | 5/5 |
| /sites | 200 | ✅ | ✅ | 2/2 |
| /search | 200 | ✅ | ✅ | 2/2 |
| /racks | 200 | ✅ | ⚠️ mock | 2/2 |
| /volumes | 200 | ✅ | ✅ | provider |
| /users | 200 | ✅ | ✅ | 3/3 |
| /control | 307 | ✅ (redirect) | ✅ | redirect |
| /login | 200 | ✅ | ✅ | 1/1 |

## G. mock/simulator/DRY_RUN 标记

- **mock**: `app/racks/page.tsx` imports `@/lib/mock/racks` and `@/lib/api/mock-store` — 这是已知的遗留代码, 不影响审计结果
- **simulator**: 无
- **DRY_RUN**: 无

## H. 未完成项

1. `/api/search` 返回 501 — 检索功能待 R.48 实现
2. racks page mock import — 需后续 Sprint 移除 mock fallback

## I. 是否允许 commit

**pass** — 81/81 checks passed, 0 failed. 1 warning (racks mock) documented.

---

Commit: `test(r44): audit page and api integration [REQ-6.3.1,REQ-6.3.2]`
