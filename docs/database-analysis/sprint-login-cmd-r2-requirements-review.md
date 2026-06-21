# Sprint login-cmd-r2 — Requirements Strict Review

> 依据 `docs/database-analysis/requirements-strict-review-template.md` 强制产出。
> 本 Sprint 范围:登录页 UI 二次迭代(删 2 按钮 + 流星)+ 命令面板 2 bug 修复(箭头顺序 + hover 流畅度)。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint login-cmd-r2` |
| Sprint 标题 | 登录页精简 + 流星 + 命令面板 bug 修复 |
| 日期 | 2026-06-21 |
| 对应 requirement 节 | `requirements.md §2.2 统一身份认证` (UI);命令面板 ⌘K 交互 |
| 关联文档 | `docs/superpowers/specs/2026-06-21-login-cmd-r2-design.md`、`docs/superpowers/plans/2026-06-21-login-cmd-r2.md` |
| 上游 Sprint | `Sprint login-redesign` (`feat/login-redesign` 分支,8 commits) |
| 总控负责人 | (TBD) |
| 验证人 | (TBD) |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 | 备注 |
|---|---|---|---|
| REQ-2.2.1 | ADFS/LDAP 集成登录 (SSO 单点登录) | `blocked_by_auth` | r2 未触及,沿用 Sprint login-redesign 状态 |
| REQ-2.2.2 | 集团 AD ↔ 站点本地账号自动映射 | `blocked_by_auth` | 同上 |
| REQ-2.2.3 | 登录审计与异常管控 (≥5 次锁定) | `partial` | r2 未触及 |
| REQ-2.2.UI | 登录入口呈现 (UI/UX) | `partial` | **r2 增强**: 删 2 演示按钮 + 鼠标流星特效 |
| REQ-CMD.1 | 命令面板 ⌘K 唤起 | `complete` | r2 验证未破坏 |
| REQ-CMD.2 | 命令面板键盘导航 (↑↓) | `complete` | **r2 修复**: id-based 替代 index-based |
| REQ-CMD.3 | 命令面板 hover 流畅度 | `complete` | **r2 修复**: React.memo + useCallback + will-change |

> 注: REQ-CMD.* 为本 review 内部编号,用于追踪命令面板交互质量。

---

## 2. Requirement 原始文本 (逐字摘录)

```
(来自 requirements.md §2.2)
统一身份认证 - 核心: 实现集团级统一登录, 打通企业域账号体系, 保障账号安全与便捷访问。

ADFS集成登录: 支持企业 ADFS 3.0+/域用户 (LDAP) 统一登录, 支持 SSO 单点登录。

(命令面板 ⌘K 来自项目内部约定, 不在 requirements.md 直接条款内,
但属于 Sprint UI-2026-06 交付范围, R.69 / R.6 阶段引入)
```

---

## 3. 需求状态枚举 (8 选 1)

| Req ID | 状态 | 解释 |
|---|---|---|
| REQ-2.2.1 (ADFS/SSO) | `blocked_by_auth` | r2 未触及 |
| REQ-2.2.2 (账号映射) | `blocked_by_auth` | r2 未触及 |
| REQ-2.2.3 (审计与锁定) | `partial` | r2 未触及,前端锁定 UI 已就位 |
| REQ-2.2.UI (入口呈现) | `partial` | r2: 删演示按钮 (用户: 没用), 加流星 (美感增强) |
| REQ-CMD.1 (⌘K 唤起) | `complete` | r2 验证保留 |
| REQ-CMD.2 (键盘导航) | `complete` | r2: Bug A 修复 |
| REQ-CMD.3 (hover 流畅) | `complete` | r2: Bug B 修复 |

---

## 4. 实现明细 (Implementation)

| Req ID | 文件 / API / 表 | 改动类型 | commit hash |
|---|---|---|---|
| REQ-2.2.UI | `components/auth/login-header.tsx` | **重写** (删 Help + Moon, 仅 Logo) | `83a031b` |
| REQ-2.2.UI | `components/auth/login-background.tsx` | **扩展** (加流星层: trail + emission) | `af956a2` |
| REQ-CMD.2/3 | `components/shared/command-palette.tsx` | **重写** (id-based active + CommandItemRow memo) | `27d85b9` |
| REQ-CMD.2/3 | `components/shared/command-palette.tsx` | 注释清理 (移除 activeIndex 字样) | `633f40f` |
| REQ-2.2.UI | `scripts/e2e/test-login.ts` | **更新** (3 项改写: 删 Help/Moon 断言) | `8a2c6b0` |
| REQ-CMD.2/3 | `scripts/e2e/test-command-palette.ts` | **新增** (15 项 source-level 断言) | `633f40f` |
| REQ-CMD.2/3 | `package.json` | 注册 `e2e:command-palette` | `633f40f` |
| REQ-CMD.2/3 | `scripts/e2e/run-all.ts` | 注册 `e2e:command-palette` | `633f40f` |

**未触及**:
- `app/login/page.tsx`、`components/auth/login-card.tsx`、`lib/auth/*`
- 数据库 schema、API 路由、session 机制、RBAC
- 命令面板功能(items / grouping / Cmd+K 监听) — 仅优化状态管理

---

## 5. 后端真实能力 (Backend Reality)

| Req ID | 后端真实能力 | 证据 |
|---|---|---|
| REQ-2.2.1/2 | ❌ 无 — 沿用 login-redesign 状态 | 文件存在但未接入真实 provider |
| REQ-2.2.3 | ✅ Sprint 4.5 已完成 | `pnpm test:e2e:worker` 上一 Sprint 已验证 |
| REQ-2.2.UI | ✅ 真 — 表单 POST `/api/auth/login` 未改 | `pnpm e2e:login` 17/17 |
| REQ-CMD.* | ✅ 真 — 命令面板是纯客户端状态, 无后端依赖 | `pnpm e2e:command-palette` 15/15 |

**关键**: 本 Sprint 0 改后端, 所有能力 0 回归。

---

## 6. UI 真实能力 (UI Reality)

| 元素 | 真实行为 | 是否误导用户? |
|---|---|---|
| 登录页顶栏 | **仅 Logo + 产品名**(Help/Moon 已删) | ✅ 不误导 (删除即避免"演示按钮"误导) |
| 登录页背景流星 | **真** Canvas 流星层, 鼠标移动触发拖尾 + 随机发射 | ✅ 不误导 (纯视觉, 0 业务含义) |
| 命令面板 ↑↓ | **真** 基于 `filtered.findIndex` + `activeItemId` 切换 | ✅ 修 Bug A, 顺序与视觉一致 |
| 命令面板 hover | **真** React.memo 列表项 + useCallback | ✅ 修 Bug B, 不再触发整列表 reconcile |
| 命令面板 ⌘K | 保留 — `metaKey || ctrlKey + k` 全局监听 | ✅ 不破坏 |
| 命令面板 ESC / Enter | 保留 — 关闭 / 选择 | ✅ 不破坏 |
| 命令面板数据源 | **真** `useSiteSites` (Sprint R.69 中心注册表) | ✅ 不破坏 |

**禁止项遵守**:
- ❌ 旧"已暂停"按钮文案 → 已删
- ❌ 流星"看起来像登录状态" → 不可能,纯视觉
- ❌ 用 mock 冒充真实 → 0 mock

---

## 7. Mock / Simulator / DRY_RUN / 真控制 区分

| 能力 | 模式 | 证据 |
|---|---|---|
| 登录提交 | **真控制** | 未改, 沿用 Sprint login-redesign |
| 命令面板 items | **真** | `useSiteSites` 读中心注册表 (Sprint R.69) |
| 命令面板导航 | **真** | id-based 状态 + React 渲染 |
| 流星层 | **真** | Canvas 2D, RAF, 真实浏览器交互 |
| 主题切换 | **删除** (本 Sprint 删 Moon 按钮) | — |

**白话**: 0 mock / 0 simulator / 0 DRY_RUN。所有 UI 元素都有真实浏览器或真实后端能力支撑。

---

## 8. 缺失件 (Missing Pieces)

| Req ID | 缺失件 | 原因 | Blocker |
|---|---|---|---|
| REQ-2.2.1 (ADFS/SSO) | 真实 SSO 接入 | 缺 ADFS metadata + 测试账号 + 站点 token 接收端点 | `blocked_by_auth` |
| REQ-2.2.2 (账号映射) | 集团 AD ↔ 站点同步 | 缺 AD 系统接入 | `blocked_by_auth` |
| REQ-CMD.4 (Playwright 集成) | 命令面板运行时交互 e2e | 当前项目 e2e 不启用 Playwright, 仅 source-level 断言 | YAGNI (后续 Sprint 评估) |

**重要**: 本 Sprint **未引入新缺失件**。

---

## 9. Blocker 类型 (8 选 1)

| 缺失件 | Blocker Type | 解除条件 |
|---|---|---|
| 真实 SSO 接入 | `blocked_by_auth` | Sprint 5.x 解锁 + ADFS metadata 就绪 |
| 真实账号映射 | `blocked_by_auth` | 同上 |

---

## 10. 需要的源端 / 站点 schema/API 变更清单

| 变更项 | 涉及表 / API | 备注 |
|---|---|---|
| — | — | (沿用 Sprint 4.8.2-R 附录 A + login-redesign review, 无新增) |

---

## 11. 是否影响 requirements 完成率

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID 数 | 7 (REQ-2.2.1/2/3/UI + REQ-CMD.1/2/3) |
| `complete` | 3 (CMD.1/2/3, 本 Sprint 完成) |
| `partial` | 2 (REQ-2.2.UI / REQ-2.2.3) |
| `not_started` | 0 |
| `blocked_*` | 2 (REQ-2.2.1/2) |
| `out_of_scope` | 0 |
| **本 Sprint 完成率** | 3 / (7 - 0) = **42.9%** (注: 修复 3 项 CMD + 1 项 UI 增强, UI 仍因 SSO 未达 complete) |

**禁止项遵守**:
- ❌ 不用"业务完成度 85%"
- ✅ 用"requirements 完成度"明确公式

---

## 12. 最终判决 (Verdict)

### Verdict: `partial`

**理由**:
- ✅ 删除 Help + Moon 2 个无功能按钮(用户认为"只是好看,没用")
- ✅ 登录页背景加入鼠标流星(轨迹 + 发射组合, 克制版)
- ✅ 命令面板箭头键顺序错乱修复(id-based active state)
- ✅ 命令面板 hover 卡顿修复(React.memo + useCallback + will-change)
- ✅ 17 项 e2e:login + 15 项 e2e:command-palette 全部通过
- ✅ `pnpm exec tsc --noEmit` / `pnpm build` / `pnpm smoke:sync` 全部成功
- ✅ 0 后端改动 / 0 引入新 mock / 0 回归
- ⚠️ **核心限制保持**: SSO 仍 `blocked_by_auth`, 沿用 Sprint 5.x 解锁路径
- ⚠️ **未触及**: 后端 / 数据库 / RBAC, 与 CLAUDE.md "不做登录权限系统" 一致

**美学方向**: iPhone / Codex 液态玻璃 — 多层 backdrop-blur + 极轻边框 + 单一品牌 accent + 大圆角。流星拖尾不是炫技,而是给"集团管控平台"赋予"数据中心星辰"的诗意,与品牌"光盘库"的存储意象呼应。

**领导决策项**:
- A. 合并 `feat/login-redesign` → main (8 + 6 = 14 commits)
- B. 保留分支待 Sprint 5.x SSO 解锁后一起合并
- C. 部分 cherry-pick (仅 bug 修复, 不合 UI 改动)

**不允许措辞**:
- ❌ "登录页已完美" → ✅ "登录页 UI r2 增强完成, SSO 仍待 Sprint 5.x"
- ❌ "命令面板 bug 全部修复" → ✅ "Bug A/B 已修复, 通过 15 项 source-level 断言; 运行时交互需 Playwright 验证"
- ❌ "需求完成度 100%" → ✅ "REQ-CMD.* 子维度 100%, 整体 §2.2 仍 partial"

---

## 13. 提交前检查清单

- [x] §1 所有 Req ID 已列
- [x] §3 每个 Req ID 打了 1 个状态标签
- [x] §5 后端真实能力每个 Req ID 都有证据
- [x] §7 明确 mock / simulator / DRY_RUN / 真控制 4 者区别
- [x] §8 缺失件不隐藏
- [x] §9 blocker 类型 8 选 1
- [x] §10 站点 schema/API 变更清单 — 本 Sprint 无新增
- [x] §11 requirements 完成率已计算
- [x] §12 verdict 给出 (`partial`)
- [x] 文件命名 `sprint-login-cmd-r2-requirements-review.md` 放在 `docs/database-analysis/`
- [ ] PROJECT_STATUS.md / ROADMAP.md 同步更新 (本次 UI/UX 增强, 由领导决定是否更新)
- [ ] 链接到本模板的 commit / PR 描述 (分支 `feat/login-redesign` 待合并)

---

## 附录 A: 本 Sprint 命令面板 Bug 修复详解

### Bug A — 箭头键顺序错乱

**根因** (源码旧版):
```tsx
// 状态: 数字
const [activeIndex, setActiveIndex] = useState(0)

// 渲染: 按 group 分组 → DOM 顺序 ≠ filtered 数组顺序
const grouped = { page: [], action: [], site: [] }
for (const it of filtered) grouped[it.group].push(it)
// 渲染按 grouped[page] → grouped[action] → grouped[site]

// 鼠标 hover 用 items.findIndex (不是 filtered)
onMouseEnter={() => setActiveIndex(items.findIndex((x) => x.id === it.id))}
```

**冲突点**:
1. 渲染按分组顺序, 但 `activeIndex` 是 `filtered` 数组的扁平 index
2. 鼠标 hover 用 `items.findIndex` 而 `activeItemId = filtered[activeIndex]?.id` — **当 query 不空时, items 和 filtered 长度/顺序不同**,hover 设的 activeIndex 指向错误 id

**修复** (新):
```tsx
const [activeItemId, setActiveItemId] = useState<string | null>(null)

onMouseEnter={() => onHover(item.id)}  // 直接传 id
// handleHover = useCallback((id) => setActiveItemId(id))

// 箭头键: 基于 filtered, ±1 切换 id
setActiveItemId((cur) => {
  const idx = cur ? filtered.findIndex((x) => x.id === cur) : -1
  return filtered[(idx + 1 + filtered.length) % filtered.length]?.id ?? null
})
```

**为什么修复有效**:
- id 是稳定唯一标识, 不受分组渲染影响
- `filtered.findIndex` 在 `filtered` 上查找, 与渲染数组一致
- `activeItemId` 直接用于渲染判断, 0 错位可能

### Bug B — hover 卡顿

**根因** (源码旧版):
- 列表项在 `<div className="px-2 pb-1">` 内 inline 渲染, 无 memo
- 每次 `onMouseEnter` 触发 `setActiveIndex` → React reconcile 整个列表 (12+ 项)
- 没有 GPU 加速提示
- hover transition 无显式 duration, 默认可能 0ms 或很长

**修复** (新):
```tsx
const CommandItemRow = memo(function CommandItemRow({ item, isActive, isCurrentSite, onSelect, onHover }) {
  // ...
  className={cn(
    "transition-colors duration-100 will-change-[background-color]",
    isActive ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100/80",
  )}
})

// 父组件
const handleSelect = useCallback((item) => handleSelectImpl(item), [])
const handleHover = useCallback((id) => setActiveItemId(id), [])
```

**为什么修复有效**:
- `memo` 让列表项只在 props 变化时重渲染, 单个 hover 不影响其他项
- `useCallback` 避免每次 render 创建新函数引用, memo 才能生效
- `will-change-[background-color]` 提示 GPU 提前提升合成层, hover 切换走 GPU 不触发 layout
- `duration-100` 显式短过渡, 避免系统默认

### e2e 覆盖

`scripts/e2e/test-command-palette.ts` 共 15 项断言:
- 6 项验证 Bug A 修复 (activeIndex 移除 / activeItemId 存在 / filtered.findIndex / items.findIndex 移除 / mouseEnter 直传 id / query 变化重置)
- 4 项验证 Bug B 修复 (memo / useCallback / will-change / duration-100)
- 4 项验证保留 (⌘K / ESC / Enter / useSiteSites 数据源)
- 1 项验证 home 可达

---

## 附录 B: 本 Sprint 删除的 UI

| 旧 UI | 位置 | 移除原因 |
|---|---|---|
| `<a data-testid="login-help" mailto>` | LoginHeader | 用户: "没啥用, 只是好看" |
| `<button data-testid="login-theme-toggle">` | LoginHeader | 用户: "切换不切换都一样" |

## 附录 C: 本 Sprint 新增的 UI

| 新 UI | 位置 | 说明 |
|---|---|---|
| 鼠标轨迹拖尾 (20 点环形 buffer) | LoginBackground Canvas | 蓝/青渐变, `lighter` 叠加 |
| 随机流星发射 (1/秒, 寿命 800ms) | 同上 | 从鼠标位置向随机方向飞出 |
| `activeItemId` 状态 | CommandPalette | 替代 activeIndex 数字状态 |
| `CommandItemRow` memo 子组件 | 同上 | 替代 inline 渲染 |

## 附录 D: 美学决策

| 项 | 选择 | 理由 |
|---|---|---|
| 主色 | `blue-600/blue-400/cyan-400` 渐变 | 品牌色 + 数据中心科技感 |
| 玻璃质感 | `bg-white/8` + `backdrop-blur-xl` + `border-white/15` | iPhone/Codex 范式 |
| 圆角 | `rounded-2xl` (16px) | 大圆角, 现代感 |
| 流星颜色 | `rgba(96,165,250,*)` 拖尾 + `rgba(34,211,238,*)` 头部 | 蓝→青渐变, 区分两层 |
| 字体 | 系统默认 + `font-mono` 用于 kbd | 避免引入新字体 (性能 + 一致性) |
| 流星数量 | 同屏 ≤ 5 个 | "克制版" — 不抢主视觉 |