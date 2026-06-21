# Sprint R.76 — Command Palette / Tasks Filter Contract Review

**Sprint ID**: R.76
**Task**: Fix command palette task filter contract
**Date**: 2026-06-21
**Commit**: `fix(ui): align command palette task filters`
**Requirements**: REQ-6.3.1, REQ-6.3.2, frontend event e2e constraint

---

## 1. Requirement IDs

- **REQ-6.3.1** — UI navigation shortcuts must navigate to real, filterable views
- **REQ-6.3.2** — Cross-page query parameters must be consumed by destination page
- **R.5 frontend event e2e constraint** — UI contract tests must lock the wiring between palette shortcuts and pages

---

## 2. Requirement 原始文本

> **REQ-6.3.1** (requirements.md §6.3): 命令面板的快捷操作必须能跳转到对应的真实页面，而不是单纯 router.push 到无筛选的页面。
>
> **REQ-6.3.2** (requirements.md §6.3): 跨页面跳转的查询参数必须被目标页面实际消费，否则视为无效导航。
>
> **R.5 frontend event e2e**: 不允许只改 API 不验证前端，不允许按钮存在但点击事件不真实触发；前端契约必须有自动化测试守住。

---

## 3. Implementation (改动的文件 / API / 表)

| 文件 | 变更 |
|---|---|
| `components/shared/command-palette.tsx` | 修复两条快捷导航: `/tasks?status=failed` → `/tasks?phase=failed`, `/tasks?status=running` → `/tasks?phase=running`; 同步更新顶部注释 |
| `app/tasks/page.tsx` | 从 `searchParams.get("phase")` 读取查询参数, 初始化 `phaseFilter` 状态; 添加 `useEffect` 在 `phaseQuery` 变化时调用 `setPhaseFilter(initialPhase)` 保持同步 |
| `scripts/e2e/test-frontend-integration.ts` | 新增 2 条契约检查: palette 必须用 `phase=` 而非 `status=`; tasks page 必须消费 `phase` 并调用 `setPhaseFilter(initialPhase)` |

**无数据库表 / API 变更** — 仅前端契约修复。

---

## 4. Backend reality

**不涉及后端** — 这是一个 UI 契约 (UI contract) 修复:

- `palette → /tasks?phase=failed` 现在真正被 `app/tasks/page.tsx` 消费
- `phaseFilter` 从 `initialPhase` 初始化, `initialPhase` 从 `searchParams.get("phase")` 读取, 且 `Object.keys(TASK_PHASE_LABELS).includes(phaseQuery)` 校验合法值
- 非法 phase 值 (如 `?phase=garbage`) 优雅 fallback 到 `"all"`, 不会破坏页面

证据:
- `pnpm e2e:frontend-integration` 16/16 PASS
- `pnpm e2e:tasks` 17/17 PASS
- `curl /tasks?phase=failed` → HTTP 200
- `curl /tasks?phase=running` → HTTP 200
- `curl /tasks?phase=all` → HTTP 200
- `curl /tasks?phase=garbage` → HTTP 200 (fallback)
- `pnpm exec tsc --noEmit` 无错误

---

## 5. UI reality

- **命令面板** (`Cmd+K`): "任务管理 · 失败任务" / "任务管理 · 进行中" 两条快捷操作, 现在真正跳转到对应筛选的列表 (而非空筛选)。
- **任务管理页**: 顶部"当前阶段"下拉框 (Select) 绑定 `phaseFilter` 状态; 当从 palette 跳入 `?phase=failed` 时, 下拉框自动选中"已失败", 任务表格立即过滤; 用户手动改下拉框也正常工作 (原有交互未破坏)。
- **不影响** siteCode 切换 / view=commands 切换 / 任务详情 / 控制命令提交等已有功能。

---

## 6. Mock / Simulator / DRY_RUN / 真控制

**无 mock / simulator / DRY_RUN 涉及** — 这是纯 UI 接线修复, 不引入新的运行时行为。

- 任务列表数据本身仍走 `taskProvider.getAll()` (与修复前一致, R.6 已验证)
- 控制命令仍只提交队列 (与修复前一致, R.19D 已验证)

---

## 7. Missing pieces

**无** — Sprint R.76 的目标 (对齐 palette 与 tasks page 的查询参数契约) 已完整交付, 契约检查守住。

---

## 8. Blocker type

**none** — 本 Sprint 不需要任何源端 / 站点 / 鉴权 / 外部系统配合。

---

## 9. 需要的源端 schema / 站点 API 变更清单

**无** — 本 Sprint 不涉及站点 schema / API。

---

## 10. Verdict

**pass**

- ✅ REQ-6.3.1 满足 (palette 快捷操作跳到真实筛选)
- ✅ REQ-6.3.2 满足 (目标页面真正消费查询参数)
- ✅ R.5 强化契约检查通过 (16/16)
- ✅ tasks e2e 通过 (17/17, 无回归)
- ✅ tsc 干净
- ✅ dev server 实地 curl 验证通过 (4 个 phase 变体全部 HTTP 200)
- ✅ toast / 按钮文案无误导措辞 (R.1 §7)
- ✅ 未引入 mock / DRY_RUN / 模拟控制

---

## 附录 A: 站点 schema/API 变更建议

不适用 — 本 Sprint 无站点依赖。

## 附录 B: requirements 完成率

本 Sprint 完成 REQ-6.3.1 / REQ-6.3.2 两条需求 → 2 项 complete, 不影响其他需求。

## 附录 C: 前端变更清单 (R.5 强制披露 8 项)

- **新增页面/组件**: 无
- **修改按钮/交互**: 命令面板 "任务管理 · 失败任务" / "任务管理 · 进行中" 路由修正 (原本静默跳转无效果)
- **删除按钮/交互**: 无
- **UI-only 无后端**: 是 (整个修复均为前端接线, 无新 API 调用)
- **真实后端能力**: 无新增 (tasks page 数据流未变)
- **simulator / DRY_RUN**: 无
- **新增 requirements.md 未要求内容**: 无
- **理由**: 不适用
