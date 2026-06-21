# Login + Command Palette Polish — Spec

**Date**: 2026-06-21
**Sprint**: (TBD — login-cmd-r2)
**Author**: Claude (brainstorming session, follow-up to Sprint login-redesign)
**Branch base**: `feat/login-redesign` (已存在,8 commits)
**Spec base**: `docs/superpowers/specs/2026-06-21-login-redesign-design.md`
**Strict review template**: `docs/database-analysis/requirements-strict-review-template.md`

---

## 1. Background

在 Sprint `login-redesign` 实施完成 (`feat/login-redesign` 分支) 后,用户复审时提出 3 项新变更:

1. **登录页**:Help 按钮和 Moon 主题切换按钮"没啥用,只是好看" — 删
2. **登录页**:背景加鼠标跟随流星 (轨迹 + 发射组合,克制版)
3. **命令面板 (⌘K)**:
   - 打开后用上下箭头切换,顺序与前端显示不一致
   - 鼠标 hover 流畅度差

---

## 2. Goals & Non-Goals

### Goals
- 删除 `LoginHeader` 的 Help 和 Moon 按钮,只保留 Logo
- `LoginBackground` Canvas 增加鼠标跟随流星效果
- 命令面板修 2 个 bug:
  - 箭头键导航顺序错乱 (与视觉显示不一致)
  - hover 流畅度差
- 更新 e2e 断言(删 Help/Moon 相关)
- 新增命令面板导航测试

### Non-Goals (YAGNI)
- ❌ 不重做命令面板整体视觉(只修 bug + memo)
- ❌ 不引入新依赖(继续用 lucide-react + 原生 Canvas)
- ❌ 不改命令面板打开/关闭逻辑(只改内部状态管理)
- ❌ 不改命令面板分组渲染顺序(只修 active 状态管理)
- ❌ 不动搜索业务页 `/app/search/page.tsx`(只命令面板)
- ❌ 不动其他页面(R.5 / R.6 等已锁定的范围)

---

## 3. Design — LoginHeader simplification

**Before** (current, in `feat/login-redesign`):
```tsx
<header>
  <Logo />
  <Help mailto /> + <Moon useTheme />
</header>
```

**After**:
```tsx
<header>
  <Logo />  // Disc + "光盘库管控平台"
</header>
```

**理由**:
- Help mailto:用户认为"没用,只是好看" — 删
- Moon:用户明确说"主题切换和不切换都一样" — 删
- Logo 保留:识别度需要

**影响**:
- `components/auth/login-header.tsx` 文件保留(主体不再含交互按钮),改为纯展示
- `scripts/e2e/test-login.ts` 删 3 项断言:Help mailto / Theme toggle / Globe NOT

---

## 4. Design — LoginBackground meteor effect

### 4.1 视觉规范

- **轨迹粒子拖尾**:鼠标移动时,记录最近 20 个点位
- **随机发射**:鼠标位置随机方向飞出流星,频率 1/秒,寿命 800ms
- **颜色**:蓝/青/白渐变,`rgba(59,130,246,*)` 主导
- **轨迹长度**:最多 20 段,每段 alpha 衰减 0.85^i

### 4.2 实现

扩展 `components/auth/login-background.tsx`,在同一 Canvas 上叠加流星层:

```ts
// 状态扩展
interface TrailPoint { x: number; y: number; t: number }
interface Meteor {
  x: number; y: number;       // 起始位置 (鼠标点)
  vx: number; vy: number;     // 速度向量
  age: number;                // ms
  lifeMs: number;             // 800
}

// RAF 主循环追加:
const onMouseMove = (e: MouseEvent) => {
  trail.push({ x: e.clientX, y: e.clientY, t: performance.now() })
  if (trail.length > 20) trail.shift()
  // 发射流星 (节流 1/秒)
  const now = performance.now()
  if (now - lastMeteorAt > 1000 && animate) {
    const angle = Math.random() * Math.PI * 2
    meteors.push({
      x: e.clientX, y: e.clientY,
      vx: Math.cos(angle) * 2,
      vy: Math.sin(angle) * 2,
      age: 0, lifeMs: 800,
    })
    lastMeteorAt = now
  }
}

// 绘制
ctx.save()
ctx.globalCompositeOperation = "lighter"
// 1. 拖尾
for (let i = 1; i < trail.length; i++) {
  const a = trail[i - 1]
  const b = trail[i]
  const alpha = (i / trail.length) * 0.6
  ctx.strokeStyle = `rgba(96,165,250,${alpha})`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}
// 2. 流星
for (let i = meteors.length - 1; i >= 0; i--) {
  const m = meteors[i]
  m.age += dt
  m.x += m.vx
  m.y += m.vy
  if (m.age > m.lifeMs) { meteors.splice(i, 1); continue }
  const progress = m.age / m.lifeMs
  const alpha = (1 - progress) * 0.9
  // 头部亮,拖尾渐暗
  ctx.strokeStyle = `rgba(34,211,238,${alpha})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(m.x, m.y)
  ctx.lineTo(m.x - m.vx * 8, m.y - m.vy * 8)
  ctx.stroke()
}
ctx.restore()
```

### 4.3 降级

| 触发 | 行为 |
|---|---|
| `prefers-reduced-motion: reduce` | 不启用流星层,只画拖尾静止版本 (1 个静态点) |
| `pointer: coarse` (触屏) | 完全不监听 mousemove |
| `document.hidden` | 不发射新流星,已存在的继续衰减 |

### 4.4 性能预算

- mousemove 节流:不节流,每事件 push 即可(20 点环形 buffer)
- 流星数量上限:同时存在 ≤ 5 个
- 流星绘制:简单 line/circle,无阴影/模糊

---

## 5. Design — Command palette bug fixes

### 5.1 Bug 分析

**Bug A — 箭头键顺序错乱**

源码 `components/shared/command-palette.tsx:212`:
```tsx
onMouseEnter={() => setActiveIndex(items.findIndex((x) => x.id === it.id))}
```

源码 line 161:
```tsx
const activeItemId = filtered[activeIndex]?.id
```

源码 line 142/145:
```tsx
setActiveIndex((i) => (i + 1) % filtered.length)
```

**根因**:
1. `activeIndex` 是**数字状态**
2. 渲染时按 group 分组 (`page → action → site`),DOM 顺序 ≠ `filtered` 数组顺序
3. 箭头键在 `filtered` 数组上 ±1 → 索引跳到 `filtered` 数组的下一项
4. 鼠标 hover 用 `items.findIndex(...)` — **当 query 不空时,`items` 和 `filtered` 长度/顺序不同**,导致 `activeIndex` 指向"items 数组的某个位置",但渲染按 filtered + group,id 匹配混乱

**修复**:用 **id 字符串** 替代 **index 数字**。id 是稳定唯一标识,与分组/filter 无关。

### 5.2 Bug B — hover 流畅度差

**根因**:
1. 每次 `onMouseEnter` 触发 `setActiveIndex` → React reconcile 整个列表
2. 列表项无 memo,每个 item 重渲染
3. 没有 GPU 加速

**修复**:
- 列表项提取为 `CommandItemRow` 子组件 + `React.memo`
- 父组件用 `useCallback` 缓存 hover handler
- hover 用 `bg-slate-100/80` + 短 transition (`transition-colors duration-100`)
- 给按钮加 `will-change: background-color`

### 5.3 实现

**Before** (state shape):
```tsx
const [activeIndex, setActiveIndex] = useState(0)
```

**After**:
```tsx
const [activeItemId, setActiveItemId] = useState<string | null>(null)

// 箭头键
const onKeyDown = (e) => {
  if (filtered.length === 0) return
  if (e.key === "ArrowDown") {
    e.preventDefault()
    setActiveItemId((cur) => {
      const idx = cur ? filtered.findIndex((x) => x.id === cur) : -1
      const next = filtered[(idx + 1 + filtered.length) % filtered.length]
      return next?.id ?? null
    })
  } else if (e.key === "ArrowUp") {
    e.preventDefault()
    setActiveItemId((cur) => {
      const idx = cur ? filtered.findIndex((x) => x.id === cur) : filtered.length
      const next = filtered[(idx - 1 + filtered.length) % filtered.length]
      return next?.id ?? null
    })
  } else if (e.key === "Enter") {
    e.preventDefault()
    const item = filtered.find((x) => x.id === activeItemId)
    if (item) handleSelect(item)
  }
}

// 重置 active
useEffect(() => {
  setActiveItemId(filtered[0]?.id ?? null)
}, [query, open])
```

**列表项提取**:
```tsx
const CommandItemRow = memo(function CommandItemRow({
  item, isActive, isCurrentSite, onSelect, onHover,
}: {
  item: CommandItem
  isActive: boolean
  isCurrentSite: boolean
  onSelect: (item: CommandItem) => void
  onHover: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHover(item.id)}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-left cursor-pointer",
        "transition-colors duration-100 will-change-[background-color]",
        isActive ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100/80",
      )}
      data-testid={`command-item-${item.id}`}
    >
      <it.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-500")} />
      <span className="flex-1">{item.label}</span>
      {item.hint && (
        <span className={cn("text-xs", isActive ? "text-blue-100" : "text-slate-400")}>
          {item.hint}
        </span>
      )}
      {isCurrentSite && item.group === "site" && (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      )}
    </button>
  )
})
```

**父组件**:
```tsx
const handleHover = useCallback((id: string) => setActiveItemId(id), [])
const handleSelectItem = useCallback((item: CommandItem) => handleSelect(item), [handleSelect])
```

---

## 6. File Changes

| 路径 | 改动 |
|---|---|
| `components/auth/login-header.tsx` | **重写** (删 Help + Moon,只保 Logo + 产品名) |
| `components/auth/login-background.tsx` | **扩展** (加流星层) |
| `components/shared/command-palette.tsx` | **修复** (id-based active + memo row) |
| `scripts/e2e/test-login.ts` | **更新** (删 3 项 Help/Moon/Globe 断言) |
| `scripts/e2e/test-command-center.ts` | **新增/更新** (加箭头键导航 + 流畅度检查) |
| `docs/database-analysis/sprint-login-cmd-r2-requirements-review.md` | **新增** |

**不动**:
- `app/login/page.tsx`
- `components/auth/login-card.tsx`
- `lib/auth/*`
- 数据库 schema

---

## 7. Testing

### Playwright / fetch e2e

**`scripts/e2e/test-login.ts`**(更新):
- 删 3 项:Help mailto present / Theme toggle present / Globe NOT
- 加 2 项:`data-testid="login-background"` 含流星层标记 / Logo 单元素

**`scripts/e2e/test-command-center.ts`**(新增,或追加):
- 触发 ⌘K 打开命令面板
- 输入 query "任务" → filtered 应只剩任务相关项
- ArrowDown 5 次 → active id 应等于 filtered[5].id(不是 items[5]!验证 bug A 修复)
- ArrowUp 1 次 → active id 等于 filtered[4].id
- mouseEnter 第三个 item → active id 立刻等于该 id(不绕 findIndex)
- 检查 React DevTools profiler:每次 hover 不应触发 CommandItemRow 重渲染(由 memo 保证)

### 质量门

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm e2e:login
pnpm e2e:command-center
pnpm smoke:sync
pnpm test:e2e:worker
```

---

## 8. Acceptance Criteria

- ✅ 登录页顶栏只有 Logo
- ✅ 登录页背景有鼠标流星 (拖尾 + 随机发射)
- ✅ 命令面板箭头键导航与视觉顺序一致
- ✅ 命令面板 hover 不卡顿
- ✅ 所有 e2e 通过
- ✅ tsc / build 无错

---

## 9. Risks

| 风险 | 缓解 |
|---|---|
| 流星层与命令面板 Dialog 动画抢主线程 | Dialog 打开时降级 Canvas 帧率(20fps → 10fps),或暂停流星发射 |
| 命令面板 memo 修漏导致仍卡顿 | React DevTools Profiler 验证一次 |
| 流星颜色与品牌色冲突 | 沿用 LoginBackground 已有的 `rgba(59,130,246,...)` 调色 |
| 鼠标频繁移动触发大量 mousemove | 环形 buffer 20 帧,不累积 |

---

## 10. Out of Scope

- 命令面板键盘快捷键自定义
- 命令面板模糊匹配算法升级(只 `.includes`,够用)
- 登录页其他视觉调整
- 移动端命令面板交互优化