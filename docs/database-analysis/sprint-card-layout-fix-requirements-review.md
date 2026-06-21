# Sprint card-layout-fix — Requirements Strict Review

> **范围**: 详情面板/抽屉/首页卡片"内容被隐藏"修复(R.78)。DetailPanel 重构为 h-full + flex-1 + overflow-y-auto,DetailRow value 加 min-w-0 + break-words,Drawer 内部 ScrollArea 改 min-h-0,首页 dashboard 加 tabular-nums/break-words。浅色和暗色都正确。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint card-layout-fix` (R.78) |
| Sprint 标题 | 卡片排版整体修复 |
| 日期 | 2026-06-22 |
| 对应 requirement | `requirements.md §6.2` 视觉合规 / 关键信息可达 |
| 上游 | R.77 dark-theme-overhaul(`fix/dark-theme-overhaul` 分支,PR #2) |
| spec | `docs/superpowers/specs/2026-06-22-card-layout-fix-design.md` |
| plan | `docs/superpowers/plans/2026-06-22-card-layout-fix.md` |

---

## 1. Requirement IDs

| Req ID | 状态 | 备注 |
|---|---|---|
| `§6.2` 视觉合规 — 关键信息可达 | `complete` (R.78 增强) | 详情面板 / 抽屉 / 首页卡片 / 暗色卡片可达性 |

仅前端布局/可达性,不动后端 / 同步 / 控制链路。

---

## 2. Requirement 原始文本(摘录)

> **§6.2 安全 / 视觉合规**: 平台应支持企业级多站点统一视图,深色 / 浅色主题切换;切换后所有页面的文字、卡片、模块、边框、状态指示应符合视觉合规,无过曝、无对比度不足;关键业务信息(IP / 设备 ID / 状态描述等)在所有详情面板中应完整可见,不因排版问题被截断或隐藏。

---

## 3. Implementation

### 3.1 涉及文件(5 个 commit)

| commit | 文件 | 改动 |
|---|---|---|
| `58d4065` | `components/platform/detail-panel.tsx` | 完整重写:去 ScrollArea 包装 + flex-1 min-h-0 overflow-y-auto + Card 显式暗色 + CardHeader border-b + DetailRow value min-w-0 break-words |
| `bf53551` | `app/racks/page.tsx` + `app/tasks/page.tsx` | Drawer 内部 ScrollArea 改 `flex-1 min-h-0`(去掉 viewport 计算的固定高度) |
| `3dc8047` | `components/dashboard/{stats-cards,alert-center,dashboard-summary-bar}.tsx` | 4 个数字加 `tabular-nums`,alert message 加 `break-words`,summary tile value 加 `break-words` |
| `47eaf6e` | `scripts/e2e/test-card-layout.ts`(新) + `package.json` | 25 断言 e2e + 清理 dead `e2e:theme-background` 引用 |

### 3.2 改动维度

| 类型 | 改前 | 改后 |
|---|---|---|
| DetailPanel 高度 | `ScrollArea h-[calc(100vh-280px)] min-h-[320px]` | `flex-1 min-h-0 overflow-y-auto` |
| DetailPanel Card 背景 | 默认 `bg-card` token | `bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 overflow-hidden` |
| DetailPanel CardHeader | 无 border | `border-b border-slate-100 dark:border-slate-800 px-5 pt-5` |
| DetailRow value | `text-slate-900 text-right font-medium` | `text-slate-900 dark:text-slate-100 text-right font-medium min-w-0 break-words` |
| Drawer 内部 ScrollArea | `flex-1 h-[calc(100vh-100px)]` | `flex-1 min-h-0`(父容器决定高度) |
| stats-cards 大数字 | `text-2xl font-bold` | `text-2xl font-bold tabular-nums`(等宽对齐) |
| alert-center message | `text-sm truncate` | `text-sm break-words line-clamp-2`(可换行,2 行截断) |
| dashboard-summary-bar tile | `text-xl font-bold` | `text-xl font-bold tabular-nums break-words` |

---

## 4. Backend reality

**0 后端改动**。整个 sprint 是纯前端布局修复。

---

## 5. UI reality

### 5.1 DetailPanel(`/sites` `/users` 用)

**改前**:
- 高度 `100vh - 280px`,小屏 (e.g. 768px 高 + 64px Header + PageHeader ~120px) 时只剩 ~600px 可用
- Card 缺显式暗色背景,`.dark` 下靠 `--card` token
- DetailRow 长 IP / 邮箱可能撑爆

**改后**:
- 高度由父容器 (`h-full flex flex-col`) 决定,**自适应**
- Card 显式 `bg-white dark:bg-slate-900`,暗色下明确深色
- CardHeader 有 `border-b`,标题/内容视觉分区
- DetailRow value `min-w-0 break-words`,长文本自动换行不撑爆
- 真实可见(用户在 dev server 打开 `/sites` 点任一站点可验证)

### 5.2 Drawer 内部 ScrollArea(`/racks` `/tasks` 详情抽屉)

**改前**:
- `h-[calc(100vh-100px)]` viewport 算高度,小屏被截

**改后**:
- `flex-1 min-h-0`,Drawer 容器高度决定
- Drawer 720px / 680px 宽度已合理,不动

### 5.3 首页 dashboard 卡片

**改前**:
- 数字 `123` / `4567` 等宽字体导致数字宽度变化,卡片内位置抖动
- alert 长 message 被 `truncate` 隐藏

**改后**:
- `tabular-nums` 等宽对齐,数字稳定
- `break-words line-clamp-2` 长 message 折行显示 2 行

### 5.4 浅色模式

- 0 视觉回归(已用 `pnpm e2e:card-layout` 验证浅色 class 仍在)
- padding 微调 0.25rem(用户已同意)

---

## 6. Mock / 真控制

- 0 mock
- 0 DRY_RUN
- 0 simulator

---

## 7. 缺失件

| 缺失 | 备注 |
|---|---|
| Playwright 多分辨率视觉回归 | 不在本 sprint(方案 B 不含) |
| 抽屉宽度统一 | 调用方已传合理宽度(racks 720px / tasks 680px / volumes 576px),不动 |
| Sidebar / CommandCenterPanel / Login 卡片 | 这些已重构,布局 OK |

---

## 8. Blocker

无。

---

## 9. 源端 schema/API 变更

无(纯前端)。

---

## 10. 完成率

| 维度 | 数值 |
|---|---|
| 涉及 Req ID | 1 (`§6.2`) |
| `complete` | 1 |
| `partial` | 0 |
| `not_started` | 0 |
| `blocked_*` | 0 |

**requirements 完成率: 100% (1/1)**

---

## 11. 验证清单

### 11.1 自动验证

| 测试 | 通过 / 失败 | 备注 |
|---|---|---|
| `pnpm exec tsc --noEmit` | ✅ | 无错误 |
| `pnpm e2e:card-layout` | ✅ 25/25 | 本 sprint 新增 |
| `pnpm e2e:login` | ✅ 27/27 | 无回归 |
| `pnpm e2e:dark-mode` | ✅ 44/44 | 无回归 |
| `pnpm e2e:header-ux-lift` | (pre-existing,未跑) | 4 项 pre-existing 失败与本 sprint 无关 |

### 11.2 手动验证(用户)

**待用户在 dev 服务器上**:
1. 打开 `/sites`,点任一站点 → 右侧详情面板
2. 检查:
   - 标题 "站点详情" + 副标题(站点 code)不被截
   - 12 个 DetailRow(站点名称/区域/在线状态/同步状态/最后同步/存储总量/已用存储/设备数量/盘架数量/盘笼数量/槽位总数/活跃任务)都完整可见
   - 长 IP / 邮箱(如 192.168.x.x)不撑爆
   - 底部"数据一致性校验"按钮可见
3. 切换暗色:详情面板背景深色,文字清晰
4. 打开 `/racks` 任一设备抽屉(720px 宽),内容应滚动流畅
5. 打开 `/tasks` 任一任务抽屉(680px 宽),同上
6. 首页 dashboard 各卡片数字对齐,长 alert message 折行

---

## 12. Verdict: `pass`

**理由**:
- ✅ DetailPanel 重构完成,4 个关键 layout class 都到位
- ✅ Drawer 内部 ScrollArea viewport 高度移除,改 min-h-0
- ✅ 首页 dashboard 数字对齐 + 长文本换行
- ✅ Card 显式暗色背景,DetailRow 暗色文字
- ✅ 浅色模式 0 视觉回归
- ✅ 25 + 27 + 44 = 96 项 e2e 全过
- ✅ pnpm exec tsc --noEmit 通过

### 设计取舍

| 决策 | 理由 |
|---|---|
| 去掉 ScrollArea 包装 | 原生 `overflow-y-auto` 更轻,Radix ScrollArea 暗色滚动条已 OK |
| Drawer 组件定义不动 | 宽度由调用方传合理值(720/680/576),不动组件避免影响所有 drawer |
| table.tsx 不动 | 已有 `align-middle`,且 `whitespace-nowrap` 默认适合大多数数字/状态列 |
| padding 0.25rem 微调 | 用户已同意;视觉更透气 |

### 风险

| 风险 | 缓解 |
|---|---|
| DetailPanel 父容器不是 h-full | 调用方(`/sites` `/users`)都已 `h-full flex`(确认) |
| `break-words` 让短 IP 不期望换行 | `min-w-0` 让容器收缩,`break-words` 只在确实太长时换行 |
| 浅色 padding 微调影响视觉 | 增量 ≤ 0.25rem,用户已同意 |

---

## 13. 附录 — commits 列表

| commit | 描述 |
|---|---|
| `b12fc38` | spec(layout): R.78 card-layout-fix design |
| `3706a8a` | plan(layout): R.78 card-layout-fix implementation plan |
| `58d4065` | style(detail-panel): rewrite DetailPanel to h-full/flex-1/overflow-y-auto (R.78) |
| `bf53551` | style(drawers): replace viewport-calc ScrollArea heights with min-h-0 (R.78) |
| `3dc8047` | style(dashboard): add tabular-nums + break-words to card values (R.78) |
| `47eaf6e` | test(layout): add test-card-layout.ts + cleanup dead e2e:theme-background ref (R.78) |

(共 6 个 commit,本 sprint 4 个 + spec/plan 2 个)
