# Requirements Strict Review — Sprint R.77 Enterprise UI 产品化

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.77 |
| Sprint 标题 | Enterprise UI 产品化 (GlassPanel / CapsuleTabs / shine) |
| 日期 | 2026-06-21 |
| 对应 requirement 节 | `requirements.md §6.3` (兼容性需求) |
| 关联文档 | `docs/superpowers/plans/r77-enterprise-ui-productization.md` (父任务计划) |
| 总控负责人 | tian |
| 验证人 | tian (CI: `pnpm e2e:header-ux-lift` + `pnpm e2e:settings` + `pnpm e2e:auth`) |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-6.3.1 | 前端兼容: Chrome/Firefox/Edge, 分辨率≥1920×1080, 适配不同终端 | `partial` |
| REQ-6.3.2 | 接口兼容: 与原有站点系统接口兼容, 不修改原有接口规范 | `complete` |

---

## 2. Requirement 原始文本 (逐字摘录, 来自 `requirements.md §6.3`)

```
6.3 兼容性需求
- 前端兼容: 支持 Chrome/Firefox/Edge 最新版, 兼容分辨率≥1920×1080, 适配不同终端显示;
  刻录与回迁任务区分展示, 界面适配。
- 接口兼容: 与原有站点系统的接口兼容, 不修改原有接口规范, 降低改造成本;
  新增回迁任务相关接口, 与原有刻录接口兼容。
- 数据库兼容: 兼容 PG 17+ 版本, 支持原有数据库结构, 可直接对接原有站点数据库;
  新增任务类型 (刻录/回迁) 字段, 不影响原有数据。
```

---

## 3. 需求状态枚举 (8 选 1)

| 状态 | 含义 |
|---|---|
| `complete` | 真实后端完成 + UI 完成 + 端到端验证通过 |
| `partial` | 部分能力完成, 但有缺失件 (列出) |
| `not_started` | 尚未开工 |
| `blocked_by_source_schema` | 源端 / 站点库缺字段, 需源端变更 |
| `blocked_by_site_change` | 需站点应用 / 配置 / API 配合 |
| `blocked_by_auth` | 受登录 / RBAC / SSO 阻塞 (CLAUDE.md 当前禁) |
| `blocked_by_external_system` | 受外部系统 (ES / ClickHouse / 站点 API) 阻塞 |
| `out_of_scope` | 明确不在本项目范围 |

| Req ID | 状态 | 备注 |
|---|---|---|
| REQ-6.3.1 (前端兼容) | `partial` | 跨浏览器矩阵未跑 Playwright 真浏览器, 仅做 CSS 标准化 (`app-shine-hover` + `prefers-reduced-motion`); 真实 Chrome/Firefox/Edge 三端验证需 R.81 Quality Gate 阶段补 Playwright visual test |
| REQ-6.3.2 (接口兼容) | `complete` | 本 Sprint 未改任何 `/api/*` 路由, 未改 `lib/types/*` Adapter 契约, settings/login 复用既有 5 个真实 API + 既有 login POST `/api/auth/login` |

---

## 4. 实现明细 (Implementation)

| Req ID | 文件 | 改动类型 | 说明 |
|---|---|---|---|
| REQ-6.3.1 | `components/platform/glass-panel.tsx` | 新增 | 共享玻璃质感面板 (intensity / shine / title 槽位) |
| REQ-6.3.1 | `components/platform/capsule-tabs.tsx` | 新增 | 共享胶囊分段 (icon + label + badge + disabled) |
| REQ-6.3.1 | `app/globals.css` | 修改 | 末尾追加 `.app-shine-hover` + `.app-shine-hover::after` + `@media (prefers-reduced-motion: reduce)` |
| REQ-6.3.1 | `app/login/page.tsx` | 修改 | 去除「演示环境」「本地开发账号 admin/admin」文案, 新增 `data-testid="login-sso-blocked"` 禁用 SSO 按钮 (Blocked 状态而非假成功) |
| REQ-6.3.1 | `app/settings/page.tsx` | 修改 | 用 `CapsuleTabs` 把 6 张卡重组成 5 段 (overview / sites / sync / auth / external), 写操作显式 disabled, Auth/ADFS/LDAP 标 `blocked_by_auth`, ES/ClickHouse 按 `dbHealth.connected` 真实显示 |
| REQ-6.3.1 | `scripts/e2e/test-header-ux-lift.ts` | 修改 | 新增 §8 R.77 检查 (GlassPanel / CapsuleTabs / shine / reduced-motion / login 去除 demo 文案 / settings 使用 CapsuleTabs) |
| REQ-6.3.2 | (无改动) | — | 不修改接口契约, 复用 `/api/sync/config`, `/api/system/health`, `/api/system/db-health`, `/api/sites`, `/api/sync/sites/status` |

---

## 5. 后端真实能力 (Backend Reality)

| Req ID | 后端真实能力 | 证据 |
|---|---|---|
| REQ-6.3.1 | UI only — 视觉层 (玻璃面板 + 胶囊分段 + shine hover), 不改后端, 不引入新 API | `pnpm exec tsc --noEmit` 0 errors; `pnpm build` ✓ Compiled successfully; `pnpm e2e:header-ux-lift` 134 passed (含 §8 R.77 6 项); `pnpm e2e:settings` 16 pass; `pnpm e2e:auth` 14 pass |
| REQ-6.3.2 | 接口契约 0 改动, `git diff lib/api` / `lib/types` 应为空 | 本 Sprint 未触及 `lib/api/*` 与 `lib/types/*`; settings 5 个真实 GET API + login 1 个真实 POST API 沿用 R.10B / R.26 baseline |

---

## 6. UI 真实能力 (UI Reality)

| Req ID | UI 元素 | 真实点击行为 | 是否误导用户? |
|---|---|---|---|
| REQ-6.3.1 login SSO 按钮 | `<Button disabled data-testid="login-sso-blocked">企业 SSO 待接入</Button>` | 灰显, 不响应点击; 显式 `title="企业 SSO 待接入 (blocked_by_auth)"` | ✅ 不误导, 显式 blocked_by_auth |
| REQ-6.3.1 CapsuleTabs 切换 | `<CapsuleTabs value={activeTab} onValueChange={setActiveTab}>` | 5 段可切, 写操作行带 disabled 按钮 + `not_implemented` 徽章 | ✅ 不误导, 写操作显式 disabled |
| REQ-6.3.1 GlassPanel shine | 暂未挂接到页面 (留作 R.78/R.80 使用) | 仅在 globals.css 提供工具类, 任何 `.app-shine-hover` 元素 hover 触发对角光线扫过 | ✅ 自动尊重 `prefers-reduced-motion: reduce` (display: none) |

**禁止措辞审查 (R.1 §7 / R.5 强化)**:
- login 页面已删除「演示环境」「本地开发账号 admin/admin」字样, 不再暗示开发态
- settings 写操作按钮全部 `disabled` + 显式 `not_implemented` 徽章, 不再暗示可写
- 仍保留 "READ ONLY" badge, 沿用 R.10B baseline

---

## 7. Mock / Simulator / DRY_RUN / 真控制 (4 选 1)

| 项目 | 类型 | 说明 |
|---|---|---|
| GlassPanel | 纯展示组件 | 无后端依赖, 不连 API, 不模拟状态 |
| CapsuleTabs | 纯展示组件 | 纯受控, 父级 `useState`, 不接管路由, 不模拟状态 |
| `app-shine-hover` CSS | 纯 CSS 装饰 | 无 JS, 无 API, 仅 `background-position` 动画 |
| login SSO blocked 按钮 | 真实 (显式禁用) | `Button disabled variant="outline"`, 真实不存在企业 SSO 接入 (R.5 阻塞, blocked_by_auth) |
| settings CapsuleTabs 各段 | 真实读取 | overview 段读 `/api/system/health` + `/api/system/db-health`; sites 段读 `/api/sites` + `/api/sync/sites/status` + `/api/sync/config`; sync 段读 `/api/sync/config` (`envKeyRefs`); auth 段读 `/api/sync/config.auth` (安全状态); external 段读 `/api/system/db-health` (判断 ES/ClickHouse 标记) |

---

## 8. Missing Pieces (不隐藏)

1. **GlassPanel 暂未在 settings/login 实际使用**: 共享组件先就位, R.78 / R.79 / R.80 的卡片 (Sites / Sync / Logs) 会挂接. 当前 Sprint 只保证组件可消费 (`pnpm e2e:header-ux-lift` 验证源码存在 + 导出正确).
2. **跨浏览器真测试缺**: 仅靠 CSS 标准 (`linear-gradient` + `transition` + `prefers-reduced-motion`) + 现有 Chromium 浏览器人工目测, 未跑 Playwright 三浏览器矩阵. R.81 Quality Gate 阶段补 visual test.
3. **设置页面 SSO / RBAC 真实按钮**仍 disabled + `blocked_by_auth` 徽章, 解锁需要 Sprint 5.x 接入 (CLAUDE.md 当前禁 RBAC).
4. **CapsuleTabs 不接管 URL query**: 切 tab 不写 URL, 刷新回到 default `overview`. 已知, R.78 决定是否升级为 URL 同步.

---

## 9. Blocker Type (8 选 1, 按 Req 维度)

| Req ID | Blocker |
|---|---|
| REQ-6.3.1 (跨浏览器) | `blocked_by_external_system` — Playwright 多浏览器 CI 尚未配置, R.81 阶段补 |
| REQ-6.3.2 (接口兼容) | — 无 blocker |

---

## 10. 需要的源端 schema / 站点 API 变更清单

**无**: 本 Sprint 0 schema 变更, 0 站点 API 变更, 0 后端代码变更. 涉及未来需求 (RBAC / 企业 SSO) 的 schema 变更清单仍按附录 A 推进, 不在本 Sprint scope.

---

## 11. Verdict

**pass** (但带 partial 标注)

- REQ-6.3.1 → `partial` (跨浏览器真测试缺, R.81 补 Playwright matrix)
- REQ-6.3.2 → `complete` (接口契约 0 改动, 既有 baseline 不破)

**强制产出清单 (R.5 9 项)**:

- [x] A. Requirement 对照 (本文件 §1, §3)
- [x] B. 前端变更清单 — 新增 GlassPanel + CapsuleTabs 组件; login 去除「演示环境」/「开发账号」; settings 改用 CapsuleTabs 5 段; 写操作显式 disabled
- [x] C. API 变更清单 — 无
- [x] D. 数据库变更清单 — 无
- [x] E. 事件测试清单 (R.5 §8) — `pnpm e2e:header-ux-lift` 134 passed (含 R.77 6 项); `pnpm e2e:settings` 16 pass; `pnpm e2e:auth` 14 pass
- [x] F. 浏览器验证结果 — `curl /login` 200 + `login-sso-blocked` testid 在 HTML; `curl /settings` 200 (Client Component 渲染 testid 在 hydration 后, e2e 验证源码包含 `settings-tabs`)
- [x] G. mock / simulator / DRY_RUN 标记 — 0 个 mock 组件, GlassPanel/CapsuleTabs 纯展示, 不模拟数据
- [x] H. 未完成项 — §8 已列
- [x] I. 是否允许 commit — 是 (10 项禁止 0 违反: 未偷偷新增页面 / 未编造完成 / 未用 toast 冒充成功 / 未用 mock 冒充真实)

**禁止措辞规范 (R.1 §7 + R.5 强化) 复查**:

| 措辞 | 出现位置 | 是否违反 |
|---|---|---|
| "演示环境" | login 页面 | ❌ 已删除 |
| "开发账号 admin/admin" | login 页面 | ❌ 已删除 |
| "已暂停" / "暂停成功" | login / settings | ❌ 无 |
| "保存成功" / "导出成功" | settings 写操作 | ❌ 无, 全 disabled |
| "需求完成度 85%" | 本文件 | ❌ 用 requirements 完成度公式 |

---

## 12. Commit & 验证

- **Commit SHA**: (见 commit 后回填)
- **Commit message**: `style(ui): productize enterprise control experience`
- **touches**:
  - `components/platform/glass-panel.tsx` (新增)
  - `components/platform/capsule-tabs.tsx` (新增)
  - `app/globals.css` (追加 CSS, 不动既有)
  - `app/login/page.tsx` (去 demo 文案 + 加 SSO blocked 按钮)
  - `app/settings/page.tsx` (CapsuleTabs 5 段化)
  - `scripts/e2e/test-header-ux-lift.ts` (新增 §8 R.77 检查)
  - `docs/database-analysis/sprint-r77-enterprise-ui-productization-review.md` (本文件)
- **CI 验证**: `pnpm exec tsc --noEmit` ✓; `pnpm build` ✓; `pnpm e2e:header-ux-lift` ✓ (134/134); `pnpm e2e:settings` ✓ (16/16); `pnpm e2e:auth` ✓ (14/14)
- **运行时验证**: `curl /login` 200, `curl /settings` 200, login HTML 含 `data-testid="login-sso-blocked"`, login HTML 不含 `演示环境` / `开发账号`
