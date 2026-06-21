# Login Page Redesign — Spec

**Date**: 2026-06-21
**Sprint**: (TBD — R.x login-UI)
**Author**: Claude (brainstorming session)
**Requirements ref**: `docs/source/requirements.md` §2.2 认证 (登录入口呈现)
**Strict review template**: `docs/database-analysis/requirements-strict-review-template.md`

---

## 1. Background & Problem

登录页 (`app/login/page.tsx`) 现状问题:

1. **死按钮**:底部 "企业 SSO 待接入" `<Button disabled>` + `federationStatus` 里 `ADFS/LDAP 预留` 灰点,违反 CLAUDE.md §三 禁止 "无需求依据 UI"。CLAUDE.md 已声明 SSO 在 Sprint 5.x 解锁,占位误导用户。
2. **演示 UI 假功能**:顶栏 Globe/Help/Moon 三个按钮源代码注释直白写"演示 UI, 无真实功能",违反 §六 禁止"用 toast 冒充成功"。
3. **视觉粗糙**:深色 + 蓝色调但布局松散、capability 卡片占满左栏、字体/间距不一致,无品牌感。
4. **左侧能力区**:3 张 capability 卡片承担"介绍"角色,但内容是泛泛口号,与产品定位"集团层统一管控平台"重复且多余。
5. **底部状态说明文字**保留(本地 JWT / ADFS 待接入),但与 SSO 死按钮视觉冲突。

目标:把登录页从"工程师临时搭的"变成"集团级管控平台门面",移除死按钮/死状态,接入 Moon 真主题切换与 Help 真实联系入口,补品牌背景。

## 2. Goals & Non-Goals

### Goals
- 移除所有占位 / 死按钮 / 假功能 UI
- 接入主题切换(theme-provider.tsx 已存在)
- Help 接入真实 mailto
- 引入 Canvas 数据中心抽象拓扑背景(微动效,低亮度)
- 表单卡片玻璃化但输入框文字保持高对比
- 左栏精简为品牌区(去 capability 卡片)
- 响应式 + 可访问性(WCAG AA+,prefers-reduced-motion 友好)
- 端到端 Playwright 测试覆盖

### Non-Goals (YAGNI)
- 不做密码强度提示
- 不做"记住我" checkbox
- 不做忘记密码流程
- 不做手机号 / 短信登录
- 不修改 `/api/auth/login`、`/api/auth/logout` 等后端
- 不改 RBAC / session 机制
- 不动左栏标题与一段产品描述(只删 capability 卡片)
- 不在登录页接 SSR 主题(保持客户端水合)

## 3. Design — Architecture

```
登录页 (/login)
├── <BackgroundCanvas>          全屏 fixed 底层, z-index 0
│   └── Canvas 渲染节点拓扑 (12-20 节点, 1px 连线, 4-6s 错峰呼吸)
│       ├── 自适应屏幕宽度
│       ├── reduced-motion / 触屏 → 单帧静态
│       ├── visibilitychange → 不可见时停 RAF
│       └── aria-hidden="true"
│
├── <header>                    顶栏, z-10
│   ├── 左: Logo (Disc 图标 + 产品名)
│   └── 右: Help(mailto) + Moon(主题切换)
│       └── Globe 移除(无 i18n)
│
└── <main> grid lg:grid-cols-2  内容区, z-10
    ├── 左栏 (品牌区)
    │   ├── 大 Logo 块
    │   ├── H1: "统一光盘库管理平台"
    │   ├── EN Slogan: "Unified Optical Disc Library Management Platform"
    │   └── 一句话价值主张 (现有文案保留)
    │   └── 移除 capability 卡片
    │
    └── 右栏 (登录表单)
        └── <LoginCard>         玻璃卡片 (backdrop-blur-xl, bg-white/8, border-white/15)
            ├── H2: "统一身份登录"
            ├── 账号输入(Icon + focus 光带一次性)
            ├── 站点选择 / Badge 区(账号有内容后出现)
            ├── 密码输入(Icon + focus 光带)
            ├── 错误 / 警告区 (条件渲染)
            ├── 登录按钮(主色, Loader2 加载状态)
            ├── 状态说明文字 (保留:本地 JWT / ADFS/LDAP 待接入 / 站点 SSO 待接入)
            └── federation 状态条 (只剩 JWT / 登录审计 2 项; ADFS 占位删除)
```

## 4. Design — Visual Spec

### 4.1 配色 (Dark Mode OLED + 品牌蓝)

| Token | 值 | 用途 |
|---|---|---|
| `--bg-base` | `#020617` (slate-950) | 页面底层 |
| `--bg-elevated` | `#0B1220` | 品牌区卡片背景 |
| `--glass-bg` | `rgba(255,255,255,0.08)` | 表单卡片 |
| `--glass-border` | `rgba(255,255,255,0.15)` | 表单卡片边框 |
| `--text-primary` | `#F1F5F9` (slate-100) | 主文字 |
| `--text-secondary` | `#94A3B8` (slate-400) | 副文字 |
| `--text-muted` | `#64748B` (slate-500) | 占位 / 说明 |
| `--accent-blue` | `#3B82F6` (blue-500) | 主品牌 / 按钮 |
| `--accent-blue-hover` | `#60A5FA` (blue-400) | hover |
| `--error` | `#F87171` (red-400) | 错误文字 |
| `--error-bg` | `rgba(127,29,29,0.4)` (red-950/40) | 错误条背景 |
| `--warning` | `#FBBF24` (amber-400) | 锁定文字 |
| `--success` | `#10B981` (emerald-500) | 状态条绿点 |

### 4.2 字号 / 间距

| 元素 | 类 |
|---|---|
| H1 (产品名) | `text-4xl lg:text-5xl font-bold` |
| EN Slogan | `text-sm text-slate-400 tracking-wide` |
| H2 (统一身份登录) | `text-xl font-semibold` |
| Label | `text-xs uppercase tracking-wider text-slate-400` |
| Input value / placeholder | `text-sm` |
| 按钮 | `h-11 text-sm font-medium` |
| 卡片 padding | `p-8` |
| 卡片圆角 | `rounded-2xl` |
| 字段间距 | `space-y-5` |

### 4.3 Canvas 拓扑背景

| 项 | 值 |
|---|---|
| 节点数 | 12-20 (屏幕宽自适应) |
| 节点大小 | 2-4 px 圆 |
| 节点颜色 | `rgba(59,130,246,0.35)` |
| 连线 | 1px `rgba(59,130,246,0.15)` |
| 脉动 | scale 1.0→1.2, opacity 0.4→0.8, 周期 4-6s (随机错峰) |
| 鼠标交互 | 无 |
| 帧率 | 活动 30fps, 后台停 |
| 降级触发 | `prefers-reduced-motion: reduce` / `pointer: coarse` (触屏) → 单帧静态 |
| A11y | `aria-hidden="true"`,Canvas 不出现在 tab 顺序 |

### 4.4 玻璃质感

| 属性 | 值 |
|---|---|
| `backdrop-filter` | `blur(16px)` |
| 背景 | `rgba(255,255,255,0.08)` |
| 边框 | `1px solid rgba(255,255,255,0.15)` |
| 阴影 | `0 25px 50px -12px rgba(0,0,0,0.4)` (shadow-2xl shadow-black/40) |
| 输入框内部 | `bg-slate-950/60` 实色蒙层 (避免 backdrop-blur 影响文字) |

## 5. Design — Interactions

| 元素 | 触发 | 效果 |
|---|---|---|
| 表单卡片 | 挂载 | `opacity 0→1, translateY 12px→0`, 350ms ease-out, delay 80ms |
| 表单字段 | 挂载后 | stagger 50ms 淡入 (cap=350ms) |
| 输入框 | focus | 底部蓝色光带从左到右扫过, 400ms ease-out, **一次性** |
| 输入框 | hover | border `slate-700 → slate-600` |
| 按钮 | hover | bg `blue-600 → blue-500`, shadow 加深 |
| 按钮 | active | `scale(0.98)` |
| 按钮 | loading | `<Loader2 className="animate-spin" />` + "正在认证..." |
| Moon | click | toggle dark/light, 图标 swap, 250ms |
| Help | click | `window.location.href = "mailto:platform-admin@company.com"` |
| 错误 / 警告条 | 出现 | `opacity 0 + translateY -4px → 0`, 200ms ease-out |
| 站点 Badge | 输入账号后 | stagger 80ms 淡入 |

### 禁用规则
- ❌ 输入框 focus 不要 `animate-pulse` 或循环光带
- ❌ 表单卡片不要 parallax 跟随鼠标
- ❌ 加载 spinner 不要换花样,统一 `<Loader2>` Lucide
- ❌ 任何 emoji 图标

### 可访问性

| 项 | 实现 |
|---|---|
| 图标按钮 | `aria-label="主题切换"` / `aria-label="联系管理员"` |
| 焦点环 | `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950` |
| Label 关联 | `<Label htmlFor={id}>` |
| 错误关联 | `aria-describedby={errorId}` |
| Canvas | `aria-hidden="true"` |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` 取消所有 transition + Canvas 不循环 |

### 响应式

| 断点 | 行为 |
|---|---|
| `< sm (640px)` | 单栏堆叠,左栏简化(只 Logo + 标题),Canvas 节点数 -50% |
| `sm - lg` | 单栏堆叠,左栏保留全部内容 |
| `≥ lg` | 两栏布局 |

## 6. File Changes

| 路径 | 改动 |
|---|---|
| `app/login/page.tsx` | **重写** (417 → ~280 行) |
| `components/auth/login-background.tsx` | **新增** (Canvas 组件, client only) |
| `components/auth/login-header.tsx` | **新增** (顶栏) |
| `components/auth/login-card.tsx` | **新增** (玻璃表单卡) |
| `scripts/e2e/test-login.ts` | **新增** (Playwright) |
| `docs/superpowers/specs/2026-06-21-login-redesign-design.md` | **新增** (本文件) |
| `docs/database-analysis/sprint-X.Y-requirements-review.md` | **新增** (Sprint 完成后产出) |

**不动**:
- `lib/auth/*`、`app/api/auth/login/route.ts` 等后端
- `components/ui/button.tsx`、`components/ui/input.tsx` 等底层 UI(在 login-card 内组合)
- `theme-provider.tsx`(只读它做 toggle)

## 7. Testing

### Playwright `scripts/e2e/test-login.ts`

1. 视觉断言:背景 Canvas 存在且 `aria-hidden="true"`,左栏品牌区文字出现,右栏表单玻璃卡片出现
2. 焦点顺序:Tab 按 账号 → 站点 → 密码 → 按钮 顺序访问
3. 错误断言:
   - 空账号提交 → 看到 "请输入域账号"
   - 空密码 → 看到 "请输入密码"
4. 锁定断言:本地 mock 触发 423 → 锁定 amber 提示出现
5. 主题切换:点击 Moon → `<html>` `class="dark"` / `class="light"` 切换
6. Help:点击 Help → 触发 mailto(用 `page.on('dialog')` 或断言 `href` 协议)
7. Reduced-motion:`emulateMedia({ reducedMotion: 'reduce' })` 后 Canvas 仍渲染但无动画
8. 响应式:375px / 768px / 1280px 各一张截图,布局无破

### 构建/类型

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync     # 不涉及同步,跳过
pnpm test:e2e:worker
pnpm e2e:all        # 必须通过
```

## 8. Acceptance Criteria

- ✅ `pnpm exec tsc --noEmit` 无错误
- ✅ `pnpm build` 成功
- ✅ `pnpm e2e:all` 通过(含新增 test-login.ts)
- ✅ 截图 light / dark / reduced-motion 三态各一张
- ✅ 不修改 `requirements.md` §2.2 状态(仅 UI 重写,无新增能力)
- ✅ 输出 `sprint-X.Y-requirements-review.md`,Verdict = `partial` (UI 完成但 SSO 仍是 blocked_by_auth,与之前一致)

## 9. Risks & Mitigations

| 风险 | 缓解 |
|---|---|
| Canvas 性能拖累 | visibilitychange 停 RAF;触屏 / reduced-motion 静态化;30fps 上限 |
| 玻璃卡片在某些背景对比下文字模糊 | 输入框内部用 `bg-slate-950/60` 实色蒙层,不放 backdrop-blur |
| Moon 切换与现有 theme-provider 行为不一致 | 复用 `useTheme()` hook,行为一致 |
| 现有 e2e / 单测断言被破坏 | test-login.ts 是新增而非改旧;旧 e2e 不引用 login 页 DOM |
| 视觉过炫影响企业版专业感 | Canvas opacity 控制在 0.35 以下,所有节点连线柔和,文本区保持清晰 |

## 10. References

- CLAUDE.md §九(文档同步)、§十(R.5 前端事件级测试)
- `docs/source/requirements.md` §2.2 认证
- `docs/database-analysis/requirements-strict-review-template.md`
- `docs/database-analysis/frontend-event-test-standard.md`
- 设计系统来源:ui-ux-pro-max "enterprise IT dashboard glassmorphism dark mode" 检索结果