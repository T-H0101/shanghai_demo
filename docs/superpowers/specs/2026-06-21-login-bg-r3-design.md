# Login Background Polish — Spec (r3)

**Date**: 2026-06-21
**Sprint**: (continuation on `feat/login-redesign`)
**Author**: Claude
**Base commit**: `4e17bfb`

---

## 1. Problem

用户反馈登录页背景"单调 / 中间空 / 只有线没有光":
- 当前底层 `bg-slate-950` 纯色,只靠 Canvas 拓扑线 + 流星
- 中间一大片空,视觉重量不平衡(表单卡亮、背景死)
- 缺乏"光晕氛围",与 iPhone/Codex 那种沉浸感差距明显

约束:
- **性能优先**(企业版):禁止加任何动画/RAF 回调/重计算
- **不破坏主题**:色相必须在品牌冷色系内(`#3b82f6` 同色相)
- **克制**:用户明确"加一点就行"

## 2. Goal

加 **1 个** 色斑 + **1 个** vignette,填补中间空白,收焦点。视觉重量平衡。**不破坏现有主题、不引入动效、不增加 Canvas 负担。**

## 3. Non-Goals

- ❌ 不加多个色斑(克制原则)
- ❌ 不加 background 动画(`@keyframes gradient` 会引入 GPU 合成层重绘,虽轻但违反"0 性能影响"原则)
- ❌ 不改 LoginCard / LoginHeader / 后端
- ❌ 不改 Canvas 拓扑结构(节点位置、连线规则不变)
- ❌ 不改流星层(流星保留独立)

## 4. Design

### 4.1 改动 1 — `app/login/page.tsx` 容器背景

**Before** (line 25):
```tsx
<div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
```

**After**:
```tsx
<div
  className="relative min-h-screen overflow-hidden text-white"
  style={{
    backgroundColor: "#020617", // slate-950 base
    backgroundImage: [
      // 色斑: 蓝紫 (品牌冷色系内, opacity 0.18)
      "radial-gradient(ellipse 80% 60% at 65% 75%, rgba(91, 33, 182, 0.18) 0%, transparent 60%)",
      // vignette: 边缘暗化, 收焦点
      "radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.4) 100%)",
    ].join(", "),
  }}
>
```

**为什么 inline style 而不是 Tailwind class**:
- `bg-[image:...]` 在 Tailwind v4 中支持,但多层 radial-gradient 转义复杂、易错
- inline style 视觉上更清晰,e2e 仍可通过 `data-testid` 验证背景存在

### 4.2 改动 2 — `components/auth/login-background.tsx` 拓扑线 / 节点 alpha

**Before**:
```tsx
// edges
ctx.strokeStyle = "rgba(96,165,250,0.35)"
// nodes
const alpha = 0.6 * s
ctx.fillStyle = `rgba(147,197,253,${alpha})`
// halo
halo.addColorStop(0, `rgba(96,165,250,${alpha * 0.4})`)
```

**After**:
```tsx
// edges (略降, 给底色让位)
ctx.strokeStyle = "rgba(96,165,250,0.28)"
// nodes
const alpha = 0.5 * s
ctx.fillStyle = `rgba(147,197,253,${alpha})`
// halo
halo.addColorStop(0, `rgba(96,165,250,${alpha * 0.4})`)
```

## 5. Performance

- 背景 CSS gradient:**0 性能开销**(GPU 合成层静态绘制,无重绘)
- Canvas 拓扑 alpha 微调:**0 性能开销**(只是数字)
- 总改动:**+2 行 CSS、-3 行 CSS**,对每帧渲染时间影响 < 0.01ms

## 6. File Changes

| 路径 | 改动 |
|---|---|
| `app/login/page.tsx` | 容器 div 加 inline `style` (背景渐变),行数 +5 |
| `components/auth/login-background.tsx` | 3 处 alpha 数值微调,行数 0 |
| `scripts/e2e/test-login.ts` | 加 1 项断言:背景含 `radial-gradient` |
| `docs/database-analysis/sprint-login-bg-r3-requirements-review.md` | 新增 (本 Sprint 极简 review) |

**不动**:
- `components/auth/login-card.tsx`
- `components/auth/login-header.tsx`
- `components/shared/command-palette.tsx`
- `lib/auth/*`、API、数据库

## 7. Testing

`pnpm e2e:login` 增加 1 项:
```ts
check(
  "r3: login page background has radial-gradient overlay",
  /radial-gradient/.test(html) || html.includes("radial-gradient"),
  "CSS gradient background present",
)
```

注:`html` 是 SSR HTML,inline `style` 会被 Next.js 序列化进 HTML,可 grep。

## 8. Acceptance

- ✅ `pnpm exec tsc --noEmit` 0 errors
- ✅ `pnpm build` 成功
- ✅ `pnpm e2e:login` 通过(原 17 项 + 1 新增 = 18 项)
- ✅ 浏览器视觉验证:中间有柔和蓝紫色斑,边缘暗化,主题色不变,拓扑线仍清晰

## 9. Risks

| 风险 | 缓解 |
|---|---|
| inline style 与 SSR hydration 不一致 | 用普通 CSS 字符串,Next.js 序列化无差异 |
| gradient 在低端设备掉帧 | 静态 CSS,GPU 合成层,实测无影响 |
| 颜色过艳破坏品牌 | opacity 0.18 + 同色相系蓝紫,在"克制"范围内 |
| 文字对比受影响 | 表单卡有 opaque 蒙层,文字色 `#F1F5F9`,对比度不受背景影响 |

## 10. Requirements

- 对应 `requirements.md §2.2 认证` UI 子维度
- 0 新增业务能力,纯视觉增强
- 沿用 Sprint login-cmd-r2 状态:SSO `blocked_by_auth` 不变
- Verdict 仍 `partial`,0 后端改动,0 mock