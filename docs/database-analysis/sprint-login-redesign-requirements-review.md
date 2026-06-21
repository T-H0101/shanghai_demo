# Sprint login-redesign — Requirements Strict Review

> 本文档依据 `docs/database-analysis/requirements-strict-review-template.md` 强制产出。
> 本 Sprint 范围:登录页 UI/UX 美化(纯前端重写),不对应任何新增业务能力。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint login-redesign` |
| Sprint 标题 | 登录页 UI/UX 重写(品牌化、玻璃拟态、Canvas 背景、删除死按钮) |
| 日期 | 2026-06-21 |
| 对应 requirement 节 | `requirements.md §2.2 统一身份认证` (登录入口呈现 UI) |
| 关联文档 | `docs/superpowers/specs/2026-06-21-login-redesign-design.md`、`docs/superpowers/plans/2026-06-21-login-redesign.md` |
| 总控负责人 | (TBD) |
| 验证人 | (TBD) |

---

## 1. Requirement IDs 列表

> 本 Sprint **不引入新业务能力**, 仅对 §2.2 的 UI 呈现层重写。下表列出触及的所有条目。

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.2.1 | ADFS/LDAP 集成登录 (SSO 单点登录) | `blocked_by_auth` (本次未触及, 维持上一 Sprint 状态) |
| REQ-2.2.2 | 集团 AD ↔ 站点本地账号自动映射 | `blocked_by_auth` (同上) |
| REQ-2.2.3 | 登录审计与异常管控 (≥5 次锁定) | `partial` (前端锁定 UI 已就位, 后端锁定逻辑 Sprint 4.5 已完成) |
| REQ-2.2.UI | 登录入口呈现 (UI/UX) — **本 Sprint 主对象** | `partial` (UI 重写完成, 待 Sprint 5.x SSO 解锁后再次完整) |

> 注: requirements.md 中 §2.2 未拆原子 ID, "REQ-2.2.UI" 为本 review 内部编号, 用于追踪 UI 重写项。

---

## 2. Requirement 原始文本 (逐字摘录)

```
§2.2 统一身份认证
核心: 实现集团级统一登录, 打通企业域账号体系, 保障账号安全与便捷访问。

ADFS集成登录: 支持企业 ADFS 3.0+/域用户 (LDAP) 统一登录, 支持 SSO 单点登录,
实现集团账号一次登录、多系统访问。
技术约束: 登录凭证采用 JWT 令牌, 有效期可配置 (默认 2 小时), 令牌过期自动登出。

账号映射: 集团 AD 账号与各站点本地账号自动映射, 支持管理员手动配置映射关系,
确保账号权限在各站点同步生效。

登录审计与异常管控:
  1. 记录所有登录行为 (账号、登录时间、IP、登录站点、登录状态), 审计日志保留 ≥1 年;
  2. 连续失败登录 ≥5 次触发账号锁定 (可配置阈值), 支持管理员解锁。
```

---

## 3. 需求状态枚举 (8 选 1)

| Req ID | 状态 | 解释 |
|---|---|---|
| REQ-2.2.1 (ADFS/SSO) | `blocked_by_auth` | Sprint 5.x 解锁, 现状不变 (UI 死按钮已删, 不再误导) |
| REQ-2.2.2 (账号映射) | `blocked_by_auth` | 同上 |
| REQ-2.2.3 (审计与锁定) | `partial` | 前端:表单校验 + 423 锁定提示 UI 完成; 后端:Sprint 4.5 已实装 |
| REQ-2.2.UI (入口呈现) | `partial` | 本 Sprint:UI 重写 100% 完成 (UI 层面 complete); 整体仍 partial 因 SSO 待 5.x |

---

## 4. 实现明细 (Implementation)

| Req ID | 文件 / API / 表 | 改动类型 | commit hash |
|---|---|---|---|
| REQ-2.2.UI | `components/auth/login-background.tsx` | **新增** (Canvas 数据中心拓扑背景) | `7dc35ab` |
| REQ-2.2.UI | `components/auth/login-header.tsx` | **新增** (顶栏 + useTheme + mailto) | `161dacd` |
| REQ-2.2.UI | `components/auth/login-card.tsx` | **新增** (玻璃表单卡 + 移除死按钮) | `d651c32` |
| REQ-2.2.UI | `app/login/page.tsx` | **重写** (417 → 89 行, 编排 3 组件) | `955af3d` |
| REQ-2.2.UI | `scripts/e2e/test-login.ts` | **新增** (17 项断言) | `773b7c6` |
| REQ-2.2.UI | `scripts/e2e/test-login.ts` (DOM order fix) | 修复 | `36ea9d3` |
| REQ-2.2.UI | `package.json` | 注册 `e2e:login` | `1577a51` |
| REQ-2.2.UI | `scripts/e2e/run-all.ts` | 注册 `e2e:login` | `1577a51` |
| REQ-2.2.3 | `components/auth/login-card.tsx` | 保留原 handleSubmit + 423 锁定分支 (未改逻辑) | — |
| REQ-2.2.1/2 | — | **未触及**, 状态保持 `blocked_by_auth` | — |

**未触及**:
- `lib/auth/*`、`app/api/auth/login`、`components/ui/*`、`theme-provider.tsx`
- 数据库 schema、API 路由、session 机制、RBAC

---

## 5. 后端真实能力 (Backend Reality)

| Req ID | 后端真实能力 | 证据 |
|---|---|---|
| REQ-2.2.1 (ADFS/SSO) | ❌ 无 — `app/api/auth/sso/*` 路由存在但未接入真实 provider | 文件存在但 `.env.local` 缺 ADFS metadata |
| REQ-2.2.2 (账号映射) | ❌ 无 — `account-mapping.ts` 存在但仅 stub | `lib/auth/account-mapping.ts` 不含真实 AD 同步 |
| REQ-2.2.3 (审计与锁定) | ✅ 真实后端 — Sprint 4.5 已完成 `tbl_login_audit` + JWT 黑名单 + 423 锁定 | `pnpm test:e2e:worker` 输出可见 `audit_log 1915 | 2026-06-21 11:53:54` 真实入库 |
| REQ-2.2.UI (入口呈现) | ✅ 真实 — 表单 POST `/api/auth/login` (未改), 走原链路 | `pnpm e2e:login` 17/17 通过, 含 account/password autoComplete / data-testid 完整性 |

**关键**: 本 Sprint 0 改后端, 后端能力状态与上一 Sprint 完全一致。

---

## 6. UI 真实能力 (UI Reality)

| 元素 | 真实行为 | 是否误导用户? |
|---|---|---|
| 域名账号输入框 | React state 同步, blur 时校验空值 | ✅ 不误导 |
| 站点 Badge 区 | `hasEnteredAccount` 为 true 时显示 | ✅ 不误导 |
| 站点 Select | 账号为空时 disabled, 占位"先输入账号" | ✅ 不误导 |
| 密码输入框 | 走原校验逻辑 | ✅ 不误导 |
| 错误提示 (`setError`) | 红色红框红字, role="alert" | ✅ 不误导 |
| 锁定提示 (`isLocked`) | 琥珀色框, 文字"账户已临时锁定, 请30秒后再试" | ✅ 不误导 (与后端 423 一致) |
| 提交按钮 | 加载态 `<Loader2 spin />` + 文字"正在认证..." | ✅ 不误导 |
| **旧 SSO 死按钮** | **已删除** (本 Sprint) | ✅ 不再误导 |
| **旧 Globe 演示按钮** | **已删除** (本 Sprint) | ✅ |
| Help 链接 | 真实 mailto: `platform-admin@company.com` | ✅ |
| Moon 主题切换 | 真实 `setTheme("light"/"dark")` (next-themes) | ✅ |

**禁止项遵守**:
- ❌ 旧"已暂停"按钮文案 → 已删
- ❌ toast"成功"措辞 → 本页无 toast, 用 `role="alert"` 错误条
- ❌ UI 显示假 SSO 状态 → federation 已精简到 2 项真实能力 (JWT 会话 / 登录审计)

---

## 7. Mock / Simulator / DRY_RUN / 真控制 区分

| 能力 | 模式 | 证据 |
|---|---|---|
| 登录提交 | **真控制** | POST `/api/auth/login` 真实路由, 走 JWT 签发 + audit 写入 |
| 锁定提示 | **真控制** | 后端 423 → 前端 isLocked + 错误条 |
| SSO | **无** (旧为假按钮, 本 Sprint 删除) | UI 无此能力 |
| 主题切换 | **真控制** | next-themes localStorage 持久化 + DOM `class` 切换 |
| Help | **真** | mailto: scheme 触发邮件客户端 |
| Canvas 背景 | **真** | 浏览器原生 Canvas 2D, RAF 循环 |

**白话**: 本 Sprint 0 mock / 0 simulator / 0 DRY_RUN。所有 UI 元素都有真实后端或真实浏览器能力支撑。

---

## 8. 缺失件 (Missing Pieces)

| Req ID | 缺失件 | 原因 | Blocker |
|---|---|---|---|
| REQ-2.2.1 (ADFS/SSO) | 真实 SSO provider 接入 | 缺 ADFS metadata + 测试账号 + 站点 token 接收端点 | `blocked_by_auth` (CLAUDE.md 禁) |
| REQ-2.2.2 (账号映射) | 集团 AD ↔ 站点同步 | 缺 AD 系统接入 | `blocked_by_auth` |
| REQ-2.2.UI (深浅主题 CSS) | 全站 dark mode CSS 完整适配 | `styles/dark.css` 已存在, 但只有少数组件显式响应 `dark:` 类; 登录页深色为主, 已 OK | YAGNI (本次仅登录页) |

**重要**: 本 Sprint **未引入新缺失件**, 仅清理了 3 处占位 UI(SSO 死按钮 / Globe / ADFS 占位状态点)。

---

## 9. Blocker 类型 (8 选 1)

| 缺失件 | Blocker Type | 解除条件 |
|---|---|---|
| 真实 SSO 接入 | `blocked_by_auth` | Sprint 5.x 解锁 + ADFS metadata 就绪 + 测试账号 |
| 真实账号映射 | `blocked_by_auth` | 同上 |

---

## 10. 需要的源端 / 站点 schema/API 变更清单

> 本 Sprint 不涉及新增需求, 故无新变更清单。

| 变更项 | 涉及表 / API | 备注 |
|---|---|---|
| — | — | (沿用 Sprint 4.8.2-R 附录 A) |

---

## 11. 是否影响 requirements 完成率

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID 数 | 4 (REQ-2.2.1 / 2.2.2 / 2.2.3 / 2.2.UI) |
| `complete` | 0 |
| `partial` | 2 (REQ-2.2.3 / REQ-2.2.UI) |
| `not_started` | 0 |
| `blocked_*` | 2 (REQ-2.2.1 / REQ-2.2.2) |
| `out_of_scope` | 0 |
| **本 Sprint 完成率** | 0 / (4 - 0) = **0%** (注: UI 重写不计 complete, 因 SSO 仍未解锁) |
| **全局完成率 (累计)** | (沿用上一 Sprint, 未变) |

**禁止项遵守**:
- ❌ 不用"业务完成度 85%" 措辞
- ✅ 用"requirements 完成度"明确公式

**说明**: 完成率为 0 看似矛盾, 实因:
- 本 Sprint 是 UI 重写, 不新增 complete
- 但**未引入回归**(blocked 项维持 blocked, partial 项维持 partial)
- UI 层面 (REQ-2.2.UI) 在 UI 子维度 = 100% 完成, 但因 SSO 整体未达, 故整体 partial

---

## 12. 最终判决 (Verdict)

### Verdict: `partial`

**理由**:
- ✅ UI 重写 100% 完成 (背景 / 顶栏 / 表单卡 / page 编排)
- ✅ 17 项 e2e 断言全部通过
- ✅ `pnpm exec tsc --noEmit` / `pnpm build` / `pnpm smoke:sync` / `pnpm test:e2e:worker` 全部成功
- ✅ 移除 3 处占位 UI (SSO 死按钮 / Globe / ADFS federation 占位), 不再误导用户
- ✅ Help 接真实 mailto, Moon 接真实主题切换, 0 mock / 0 DRY_RUN
- ⚠️ **核心限制保持**: SSO 仍 `blocked_by_auth`, 沿用 Sprint 5.x 解锁路径
- ⚠️ **未触及**: 后端 / 数据库 / RBAC, 与 CLAUDE.md "不做登录权限系统" 一致

**领导决策项**:
- A. Sprint 5.x 解锁 SSO → REQ-2.2.1 / 2.2.2 状态变更, LoginCard 需补 ADFS 入口
- B. 维持当前方案 (登录页 UI 已产品化, 等 SSO 解锁再补) → 本 Sprint 已达标

**不允许措辞**:
- ❌ "登录页已完美" → ✅ "登录页 UI 重写完成, SSO 仍待 Sprint 5.x"
- ❌ "需求完成度 100%" → ✅ "REQ-2.2.UI UI 子维度 100%, 整体 §2.2 仍 partial"

---

## 13. 提交前检查清单

- [x] §1 所有 Req ID 已列
- [x] §3 每个 Req ID 打了 1 个状态标签
- [x] §5 后端真实能力每个 Req ID 都有 SQL / API 证据 (或显式标"无")
- [x] §7 明确 mock / simulator / DRY_RUN / 真控制 4 者区别
- [x] §8 缺失件不隐藏
- [x] §9 blocker 类型 8 选 1
- [x] §10 站点 schema/API 变更清单 — 本 Sprint 无新增
- [x] §11 requirements 完成率已计算
- [x] §12 verdict 给出 (`partial`)
- [x] 文件命名 `sprint-login-redesign-requirements-review.md` 放在 `docs/database-analysis/`
- [ ] PROJECT_STATUS.md / ROADMAP.md 同步更新 (本次 UI-only 重写, 由领导决定是否更新)
- [ ] 链接到本模板的 commit / PR 描述 (本次为分支 `feat/login-redesign`, 待合并)

---

## 附录 A: 本 Sprint 删除的占位 UI (追溯)

| 旧 UI | 位置 | 移除原因 |
|---|---|---|
| `<Button disabled>企业 SSO 待接入</Button>` | `app/login/page.tsx:386-397` (旧) | CLAUDE.md §三 禁止"展示完成冒充管控完成"; CLAUDE.md 注明 SSO 待 Sprint 5.x |
| `<span ... bg-slate-600 /> ADFS/LDAP 预留` | `federationStatus` 数组 | 同上 |
| `<button aria-label="语言">Globe</button>` | 顶栏工具区 | 源代码注释"演示 UI, 无真实功能"; 违反 CLAUDE.md §六 |
| `<button aria-label="帮助">HelpCircle</button>` | 顶栏工具区 | 同上 (已替换为真实 mailto) |
| `<button aria-label="主题">Moon</button>` | 顶栏工具区 | 同上 (已替换为 next-themes 真实切换) |
| 3 个 capability GlassPanel | `app/login/page.tsx:211-232` (旧) | 用户决定"只保留品牌区" |

## 附录 B: 保留的"待接入"文本 (避免误删)

底部三行文字**保留**(用户明确要求),作为对未来的提示:

```
当前认证: 本地 JWT
企业 ADFS/LDAP: 待接入, 缺少 provider metadata 与测试账号
站点 SSO: 待 ADFS/LDAP 与站点 token 接收端点确认
```

底部 federation 状态条**精简到 2 项**(从原 3 项去掉 ADFS 占位):
- JWT 会话 (绿点, 真)
- 登录审计 (绿点, 真)