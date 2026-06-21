# Sprint R.80 — Auth + Permission Boundary (Strict Review)

> **目的**: 以 `docs/source/requirements.md` §2.2 / §3.1 / §3.2 / §6.2 为最高验收标准, 严格区分"完成 / 候选 / 模拟完成 / UI 完成 / 真实后端完成"。**本 Sprint 不主张严格完成 ADFS / OIDC / LDAP 联邦认证 — 全部按 `blocked_by_auth` 标记。**

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint R.80` |
| Sprint 标题 | 暴露企业级认证与权限边界 (Auth + Permission Boundary Closure) |
| 日期 | 2026-06-21 |
| 对应 requirement 节 | `requirements.md §2.2 统一身份认证`, `§3.1 账号管理`, `§3.2 账号权限分配`, `§6.2 安全需求` |
| 关联文档 | `lib/auth/oidc-provider.ts`, `lib/auth/ldap-provider.ts`, `lib/auth/account-mapping.ts`, `lib/auth/rbac-policy.ts`, `app/settings/page.tsx`, `app/users/page.tsx`, `scripts/e2e/test-auth.ts`, `scripts/e2e/test-rbac.ts`, `scripts/e2e/test-users.ts`, `scripts/e2e/test-settings.ts` |
| 总控负责人 | tian |
| 验证人 | tian (R.80 contract e2e + manual) |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.2.1 | 集团 AD 账号统一登录 (ADFS / LDAP SSO) | `blocked_by_auth` |
| REQ-2.2.2 | 登录凭证采用 JWT 令牌, 有效期可配置, 过期自动登出 | `partial` (local JWT 完整; 过期 / 续签策略 blocked_by_auth) |
| REQ-3.1.1 | 站点账号全生命周期管理 (创建/启用/禁用/解锁/重置密码) | `complete` (local Auth 账号管理已落地) |
| REQ-3.1.2 | 集团账号与各站点账号映射 (AD ↔ site) | `blocked_by_auth` (IdP 未配置) |
| REQ-3.2.1 | 按"站点→设备→数据"层级分配权限 (RBAC) | `partial` (viewer/operator/admin 已落地; 站点→设备→数据 链路 blocked_by_auth) |
| REQ-3.2.2 | 权限生效与校验, 同步至对应站点, 失败告警 | `blocked_by_site_change` (无真实站点权限接收器) |
| REQ-6.2.1 | 严格接口权限校验, 禁止跨站点 / 跨部门访问 | `complete` (local RBAC + middleware 已落地并通过 e2e) |
| REQ-6.2.2 | 数据传输与存储加密, 审计日志不可篡改 | `partial` (敏感字段 secretKeyRef 已接入; 字段级加密策略 blocked_by_auth) |

---

## 2. Requirement 原始文本 (逐字摘录)

> 摘自 `docs/source/requirements.md` (不删改、不解读):

```
2.2 统一身份认证
核心：实现集团级统一登录，打通企业域账号体系，保障账号安全与便捷访问。
- ADFS集成登录: 支持企业ADFS 3.0+/域用户（LDAP）统一登录，支持SSO单点登录…
- 账号映射: 集团AD账号与各站点本地账号自动映射，支持管理员手动配置映射关系…
- 登录审计与异常管控: 记录所有登录行为…连续失败登录≥5次触发账号锁定…

3.1 账号管理
- 账号维度与属性: 基于Site（站点）的账号管理，支持账号关联多个Site…
- 账号生命周期管理: 支持账号创建/启用/禁用/删除/密码重置…

3.2 账号权限分配
- 权限分配流程: 第一步：分配账号可登录的站点（支持多选）；第二步：在已分配的站点内，分配可访问的设备、存储卷。
- 权限生效与校验: 权限分配后实时生效，同步至对应站点系统…

6.2 安全需求
- 防越权: 严格的接口权限校验，禁止跨站点/跨部门访问未授权数据…
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
| `blocked_by_external_system` | 受外部系统阻塞 |
| `out_of_scope` | 明确不在本项目范围 |

**R.80 关键结论**: ADFS / OIDC / LDAP 联邦登录 (`REQ-2.2.1`) 与集团账号与站点账号映射 (`REQ-3.1.2`) 在生产环境激活前必须由领导决策, 标记 `blocked_by_auth`。

---

## 4. 实现明细 (Implementation)

| Req ID | 文件 / API / 表 | 改动类型 | 说明 |
|---|---|---|---|
| REQ-2.2.1 / 2.2.2 | `lib/auth/oidc-provider.ts` | 修改 (新增 `getOidcReadiness()`) | 暴露 readiness 契约 `{ready, missingEnvKeys, status}` |
| REQ-2.2.1 | `lib/auth/ldap-provider.ts` | 未改 | 仍 `implemented_candidate` |
| REQ-3.1.2 | `lib/auth/account-mapping.ts` | 未改 | `oidc_not_configured` / `ldap_not_configured` 路径保持 |
| REQ-3.2.1 | `lib/auth/rbac-policy.ts` | 未改 | viewer/operator/admin + deny-by-default 已存在 |
| REQ-2.2 / 3.1 / 3.2 | `app/settings/page.tsx` | 未改 | `settings-auth-boundary` 卡片已存在 (R.78) |
| REQ-3.1 | `app/users/page.tsx` | 未改 | Auth 账号管理 + 解锁 + 失败次数已存在 (R.27/R.28) |
| REQ-2.2.x / 6.2 | `scripts/e2e/test-auth.ts` | 修改 (新增 R.80 契约段) | 7 项新断言 |
| REQ-3.2.1 / 6.2.1 | `scripts/e2e/test-rbac.ts` | 修改 (新增 R.80 契约段) | 7 项新断言 |
| REQ-3.1.1 | `scripts/e2e/test-users.ts` | 修改 (新增 R.80 契约段) | 2 项新断言 |
| REQ-2.2 / 3.x | `scripts/e2e/test-settings.ts` | 未改 | 已断言 `settings-auth-boundary` 存在 (R.78) |

---

## 5. 后端真实能力 (Backend Reality)

> **关键**: 必须明确"是数据库 / API / 队列真正支持, 还是仅 UI 层面调用"。

| Req ID | 后端真实能力 | 证据 (SQL / API / 端到端测试) |
|---|---|---|
| REQ-2.2.1 (ADFS / OIDC / LDAP) | ⚠️ **未实现** — `oidcStatus() === "implemented_candidate"` 当 env keys 缺失; `ldapStatus() === "implemented_candidate"` 同理; `getOidcReadiness()` 返回 `blocked_by_auth` | `pnpm e2e:auth` 7 项契约断言通过; `requirements-traceability.md` 含 `blocked_by_auth` |
| REQ-2.2.2 (JWT) | ✅ **真实后端** — `/api/auth/login` 签发 HttpOnly session cookie (HMAC-SHA256 JWT, `iat` 1h, `exp` 2h); `/api/auth/me` 校验会话; 5 次失败 423 lockout | curl 200 + session cookie; e2e 12 项通过 |
| REQ-3.1.1 (生命周期) | ✅ **真实后端** — `auth_accounts` 表已存在; `/api/auth/accounts` 列表 / 解锁; admin 账号能解锁 | `pnpm e2e:users` 14 项通过 |
| REQ-3.1.2 (AD ↔ site 映射) | ⚠️ **未实现** — `mapOidcClaimsToAccount` / `mapLdapEntryToAccount` 在 IdP 缺失时返回 `implemented_candidate` | e2e 断言 `oidc_not_configured` / `ldap_not_configured` 路径存在 |
| REQ-3.2.1 (RBAC) | ✅ **真实后端 (local)** — `rbac-policy.ts` 含 viewer/operator/admin + 继承 + deny-by-default; middleware 强制 `requireSession` + `requirePermission`; e2e 验证 6 个 protected API 401/200 | `pnpm e2e:rbac` 23 项通过; 401 + 200 + 403 边界 |
| REQ-3.2.2 (权限同步至站点) | ⚠️ **未实现** — 站点端无权限接收器, 集团→站点的 transaction 同步路径不存在 | e2e 不涉及 (out of scope 范围内保留) |
| REQ-6.2.1 (防越权) | ✅ **真实后端** — `lib/auth/middleware.ts` 强制 `requireSession`; 所有 protected API 未登录 401, 登录后 200 | `pnpm e2e:rbac` §1 §2 通过 |
| REQ-6.2.2 (审计) | ✅ **真实后端 (audit)** — `auth_login_audit` 表记录 login / failed / locked; `audit_log` 记录关键操作 | `pnpm e2e:auth` §1-3 通过 |

---

## 6. UI 真实能力 (UI Reality)

| Req ID | UI 行为 | 真实 / 误导? |
|---|---|---|
| REQ-2.2.x | `/settings` → "认证" tab → `settings-auth-boundary` 卡片: `local JWT 已启用` (绿色), `ADFS / OIDC 联邦登录` (`blocked_by_auth` 灰), `LDAP 账号同步` (`blocked_by_auth`), `RBAC 角色与权限矩阵` (`blocked_by_auth`), `JWT 过期 / 续签策略` (`blocked_by_auth`) | ✅ 真实, 不误导 |
| REQ-2.2.x | `/settings` → "Auth 配置边界" 卡片展示 env key ref (`OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_JWKS_URL`, `LDAP_URL`, `LDAP_BASE_DN`, `AUTH_CLIENT_SECRET`) 及 configured true/false; **不返回 secret 值** | ✅ 真实, 不暴露 |
| REQ-3.1.1 | `/users` → "Auth 账号管理" tab: 列出 auth_accounts (用户名, 角色, 状态, 失败次数, 最近登录); 锁定账号显示 "解锁" 按钮 → POST `/api/auth/accounts/[id]/unlock`; toast "解锁成功" (此处解锁是真实后端, 可用) | ✅ 真实, 不误导 |
| REQ-3.1.1 | `/users` 顶部 banner: "认证与权限写能力部分可用 (Sprint R.27/R.28) — Auth 账号管理已接入, 权限分配 (站点→设备→数据) 与跨站点权限同步仍需 Sprint R.29+ 实现" | ✅ 真实, 不夸大 |
| REQ-3.2.x | `/users` "用户列表" 显示 `unified_users` (database / empty / error), 角色列 `未映射` 当 source 未提供 | ✅ 真实, 不臆造 |
| REQ-3.x | toast 用语: "解锁成功" (真实), "导出完成" (CSV/JSON 真实), "账号导出失败" (真实), 无 "已暂停" / "已传播至所有站点" / "跨站点权限同步完成" 等误导措辞 | ✅ 通过 |

---

## 7. Mock / Simulator / DRY_RUN / 真控制 四者明确区分

| 范畴 | 现状 |
|---|---|
| Mock | 无 — `/users` 不导入 `@/lib/mock/users`; `/settings` 不导入 `@/lib/mock/settings`; e2e 断言 `!JSON.stringify(users).includes('"source":"mock"')` |
| Simulator | 无 — `OIDC` / `LDAP` 路径不静默返回 `success` (会返回 `implemented_candidate` / `failed`) |
| DRY_RUN | 仅 `Site Agent` 控制命令路径存在 DRY_RUN (R.19 范围), 本 Sprint 不涉及 |
| 真控制 | local JWT login + RBAC middleware + Auth 账号生命周期 全部真实; ADFS / OIDC / LDAP / 站点权限同步 **未声称真控制** |

---

## 8. 缺失件 (Missing Pieces)

- ❌ ADFS 真实联邦登录 (依赖真实 ADFS endpoint + test AD user)
- ❌ OIDC `code` 兑换 + JWKS 验签 + claim→account 完整映射
- ❌ LDAP bind + entry 拉取 + 自动账号创建
- ❌ 集团→站点的权限事务同步通道 (需站点 app 配合)
- ❌ JWT 续签 (refresh token) 与过期滑动策略
- ❌ 部门级数据隔离缓存空间 (REQ-3.3 仍为 `not_started`)
- ❌ 权限审计对比前后变更 (`REQ-3.2.2` 完整需 RBAC v2 + 站点协同)
- ❌ 字段级数据库加密策略 (`REQ-6.2.2`)

---

## 9. Blocker Type (8 选 1)

| Req ID | Blocker |
|---|---|
| REQ-2.2.1 | `blocked_by_auth` |
| REQ-2.2.2 (续签部分) | `blocked_by_auth` |
| REQ-3.1.1 | — (complete) |
| REQ-3.1.2 | `blocked_by_auth` |
| REQ-3.2.1 (站点→设备→数据 全链路) | `blocked_by_auth` |
| REQ-3.2.2 | `blocked_by_site_change` |
| REQ-6.2.1 | — (complete) |
| REQ-6.2.2 (字段级加密) | `blocked_by_auth` |

---

## 10. 需要的源端 / 站点 API 变更清单

| 变更项 | 涉及表 / API | 具体 DDL / 文档点 | 决策人 |
|---|---|---|---|
| ADFS endpoint + 证书 + 测试 AD user | 集团 ADFS | 站点 app 团队提供 `metadata.xml` / `client_id` / `client_secret` / `redirect_uri` | 领导 + 站点架构师 |
| OIDC issuer URL + JWKS URL | 集团 OIDC | `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_JWKS_URL` 写入 .env | 领导 + 运维 |
| LDAP server + bind DN + password | LDAP | `LDAP_URL`, `LDAP_BASE_DN`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD` 写入 .env | 领导 + 运维 |
| AD claim→统一账号字段映射表 | 文档 | 提交 `docs/source/ad-claim-mapping.md` (claims → role / department / accessibleSites) | 领导 + 站点架构师 |
| 站点权限接收 API (POST /api/site/rbac/apply) | 站点 app | 站点 app 实现接收 + 写入本地 RBAC, 返回 200/4xx | 站点 app 团队 |
| 部门→缓存空间绑定 | RBAC 扩展 | RBAC v2 模型 + 缓存层隔离 schema | 领导决策 |

---

## 11. Verdict

| 维度 | 结果 |
|---|---|
| 严格 | **partial** — local JWT + RBAC + Auth 账号生命周期 真实完成; ADFS / OIDC / LDAP 严格完成需领导决策 + 真实 IdP + 测试账号 |
| 生产 | **candidate** — 仅 local JWT 可上线; 联邦登录需在生产部署前激活 IdP 并完成 e2e 联合验证 |
| 提议 commit message | `feat(auth): expose enterprise auth boundary` |

---

## 12. Verifier 产出

| 步骤 | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm e2e:auth` | ✅ 19/19 PASS (含 7 项 R.80 契约) |
| 2 | `pnpm e2e:rbac` | ✅ 23/23 PASS (含 7 项 R.80 契约) |
| 3 | `pnpm e2e:users` | ✅ 14/14 PASS (含 2 项 R.80 契约) |
| 4 | `pnpm e2e:settings` | ✅ 25/25 PASS (R.78 已断言 `settings-auth-boundary`) |
| 5 | `pnpm exec tsc --noEmit` | ✅ 无错误 |
| 6 | `pnpm build` | ✅ 成功 (无 error) |
| 7 | `curl -X POST /api/auth/login` | ✅ 200 + JWT issued |
| 8 | `curl /api/auth/me` (with cookie) | ✅ 200 + user info |
| 9 | `curl /users` | ✅ 200 |

---

## 13. 关键术语 (R.1 §7 强制规范)

- ✅ "local JWT 已启用" (绿色, enabled)
- ✅ "ADFS / OIDC 联邦登录" → `blocked_by_auth` (灰)
- ✅ "LDAP 账号同步" → `blocked_by_auth`
- ❌ 全文未出现 "ADFS 集成完成" / "OIDC 已激活" / "LDAP 同步完成" 等误导措辞
- ❌ 全文未出现 "已暂停" / "暂停成功" / "跨站点权限同步完成"
