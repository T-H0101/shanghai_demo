# Sprint R.99 Requirements Review — ADFS OIDC 单边能力

> **目的**: 以 `docs/source/requirements.md` §2.2 为最高验收标准。本 Sprint **不主张** ADFS 联邦登录严格 complete — 药明 Client ID/Secret 申请中。

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint R.99` |
| Sprint 标题 | ADFS/OIDC 授权码链路与账号映射（无 Secret 也可落地的总控侧） |
| 日期 | 2026-08-24 |
| 对应 requirement 节 | `requirements.md` §2.2 / §2.1.2 |
| 关联文档 | `docs/source/ad-claim-mapping.md`；药明 `ADFS4.docx` |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.2.1 | ADFS 3.0+/LDAP 统一登录 + JWT | `partial` |
| REQ-2.2.2 | AD 账号与站点账号映射 | `partial` |
| REQ-2.2.3 | 登录审计与失败锁定 | `partial` |
| REQ-2.1.2 | 站点切换 SSO 免登 | `partial` |

---

## 2. Requirement 原始文本 (逐字摘录)

```
ADFS集成登录|支持企业ADFS 3.0+/域用户（LDAP）统一登录，支持SSO单点登录，实现集团账号一次登录、多系统访问。|登录凭证采用JWT令牌，有效期可配置（默认2小时），令牌过期自动登出。
账号映射|集团AD账号与各站点本地账号自动映射，支持管理员手动配置映射关系，确保账号权限在各站点同步生效。|映射关系存储在统一系统PG数据库，定时同步至各站点，同步失败触发告警。
登录审计与异常管控|1. 记录所有登录行为（账号、登录时间、IP、登录站点、登录状态），审计日志保留≥1年；2. 连续失败登录≥5次触发账号锁定（可配置阈值），支持管理员解锁。
站点切换|1. 统一系统内支持一键切换至指定站点的本地管理系统（SSO免登），无需重复登录
```

---

## 3. 需求状态枚举

见 §1。不能标 complete：无药明测试账号走通 stsdev。

---

## 4. 实现明细 (Implementation)

| Req ID | 文件 / API / 表 | 改动类型 |
|---|---|---|
| REQ-2.2.1 | `lib/auth/oidc-provider.ts` | 修改：ADFS `/oauth2/authorize|token`、换 token、JWKS 验签 |
| REQ-2.2.1 | `lib/http/public-origin.ts` | 新增：对外 Origin 单一来源（禁止 listen `0.0.0.0`） |
| REQ-2.2.1 | `app/api/auth/sso/start/route.ts` | 修改：未配置 302 `{PUBLIC_APP_URL}/login?sso=not_configured` |
| REQ-2.2.1 | `app/api/auth/sso/callback/route.ts` | 修改：真兑换；失败回登录页，不发 cookie |
| REQ-2.2.1 | `app/api/auth/logout/route.ts` | 修改：返回 ADFS logoutUrl |
| REQ-2.2.1 | `components/auth/login-card.tsx` | 修改：企业 AD 登录按钮 |
| REQ-2.2.2 | `auth_accounts` 员工号/邮箱 | 修改：开户/编辑可写；AD JIT 回写 |
| REQ-2.2.2 | `auth_site_user_mappings` | 新增表；按 `auth_account_id` 映射 |
| REQ-2.2.2 | `/api/auth/account-mappings` | CRUD：必填用户名，绑定账号 |
| REQ-2.2.2 | `components/users/account-mapping-panel.tsx` | 「站点账号映射」 |
| REQ-2.1.2 | `app/api/sites/[id]/sso/route.ts` | 修改：ticket username 走映射 |
| REQ-2.2.3 | `auth_login_audit.provider` | 修改：可写 `adfs` |

---

## 5. 后端真实能力 (Backend Reality)

| Req ID | 后端真实能力 | 证据 |
|---|---|---|
| REQ-2.2.1 | 代码路径真实；无 Client 时 **不发会话** | `pnpm e2e:adfs-oidc`：start 302 `sso=not_configured` |
| REQ-2.2.2 | 映射写入中心库；按当前账号解析站点用户名；**不推送站点** | POST username + `resolveSiteLocalUsername` |
| REQ-2.2.3 | ADFS 失败写入 audit `provider=adfs` | callback 未配置走 `recordAdfsLoginFailure` |
| REQ-2.1.2 | ticket 仍签发；username 可来自映射 | `resolveSiteLocalUsername` |

---

## 6. UI 真实能力 (UI Reality)

| Req ID | UI 元素 | 真实点击行为 | 是否误导用户? |
|---|---|---|---|
| REQ-2.2.1 | `login-adfs-start` | 浏览器打开 `/api/auth/sso/start` | 未配置回 `{PUBLIC_APP_URL}/login` 提示，Location 不含 `0.0.0.0` |
| REQ-2.2.2 | 新增映射 | POST 中心库 | 文案写明不推送站点 |

---

## 7. Mock / Simulator / DRY_RUN / 真控制

| 项 | 状态 |
|---|---|
| Mock 登录 | 无 |
| 真 ADFS 登录 | 未启用（缺 Client ID/Secret） |
| 映射 CRUD | 真写 PG |
| 映射同步站点 | 未做（`blocked_by_site_change`） |

---

## 8. 缺失件 (Missing Pieces)

| Req ID | 缺失件 | 原因 |
|---|---|---|
| REQ-2.2.1 | stsdev 真域账号走通 | 申请中，无 Client Identifier/Secret |
| REQ-2.2.1 | Claim 字段名最终确认 | 药明文档未写 JWT key |
| REQ-2.2.2 | 定时同步站点 + 失败告警 | 无站点接收 API |
| REQ-2.2.3 | IP 维度锁定；审计 1 年自动保留任务 | 本 Sprint 未做 |

---

## 9. Blocker 类型

| 缺失件 | Blocker Type | 解除条件 |
|---|---|---|
| 真域账号登录 | `blocked_by_auth` / `blocked_by_external_system` | 药明发放 Test Client ID/Secret + 测试账号 |
| 映射下发站点 | `blocked_by_site_change` | 站点接收映射 API |

---

## 10. 需要的源端 / 站点 API 变更清单

| 变更项 | 涉及表 / API | 具体文档点 | 决策人 |
|---|---|---|---|
| ADFS Application Group | 集团 ADFS | Client ID/Secret、登记 `https://<总控>:30000/api/auth/sso/callback` | 药明 ADFS 团队 |
| Claim 字段名 | id_token | 员工号/邮箱对应 JWT key | 药明 ADFS |
| 站点映射接收 | 站点 app | 无则继续只用 ticket username | 站点 |

---

## 11. Verdict

**partial** — 总控单边授权码链路与映射 CRUD 真实落地；无 Secret 不能宣称 ADFS 集成完成。

---

## 12. R.5 前端变更清单

- 新增：`AccountMappingPanel`（站点账号映射）；登录页「企业 AD 登录」；Auth 开户员工号/邮箱
- 修改：logout 可跳 ADFS logout
- 删除：无
- UI-only：无（按钮均有 API）
- 真实后端：映射 CRUD、start/callback
- DRY_RUN：无
- 需求外页面：无

## 13. 事件测试

`scripts/e2e/test-adfs-oidc.ts`、`test-login.ts`、`test-users.ts`、`test-auth.ts`

## 14. 是否允许 commit

满足：未配置不假装成功；映射不宣称同步站点；有 e2e。允许在 tsc/build/e2e 通过后提交。
