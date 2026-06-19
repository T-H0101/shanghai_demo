# Sprint R.26 Requirements Review - Auth Foundation

## A. Requirement IDs

- REQ-2.2.1 ADFS 3.0+ / LDAP 集成登录
- REQ-2.2.3 登录审计与异常管控
- REQ-6.2.2 存储加密
- REQ-6.2.3 操作审计
- REQ-6.2.4 防越权

## B. Requirement 原始文本

REQ-2.2.1: "支持企业ADFS 3.0+/域用户（LDAP）统一登录，支持SSO单点登录，实现集团账号一次登录、多系统访问。登录凭证采用JWT令牌，有效期可配置（默认2小时），令牌过期自动登出。"

REQ-2.2.3: "记录所有登录行为（账号、登录时间、IP、登录站点、登录状态），审计日志保留≥1年；连续失败登录≥5次触发账号锁定（可配置阈值），支持管理员解锁。锁定策略支持按账号/IP维度配置，审计日志支持按条件检索/导出。"

REQ-6.2.2: "存储加密（不可逆 + 分区隔离）。"

REQ-6.2.3: "操作审计（不可篡改）。"

REQ-6.2.4: "防越权（跨站/跨部门）。"

## C. Implementation

Files:

- `databases/sprint-r.26/auth-foundation.sql`
- `app/api/auth/login/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/logout/route.ts`
- `lib/auth/server.ts`
- `lib/auth/jwt.ts`
- `lib/auth/password.ts`
- `lib/auth/session.ts`
- `lib/types/auth.ts`
- `app/login/page.tsx`
- `components/auth/route-guard.tsx`
- `components/layout/auth-guard.tsx`
- `components/dashboard/header.tsx`
- `scripts/e2e/test-auth.ts`
- `package.json`
- `scripts/e2e/run-all.ts`
- `.env.example`

## D. Backend Reality

Real:

- `auth_accounts` stores platform auth accounts and scrypt password hashes.
- `auth_login_audit` stores success/failed/locked/logout login events.
- `auth_role_permissions` stores platform RBAC permission catalog.
- `POST /api/auth/login` validates password, writes audit, sets HttpOnly `odp_session` JWT cookie.
- `GET /api/auth/me` validates server-side session and returns user plus permissions.
- `POST /api/auth/logout` clears cookie and writes logout audit.
- Five recent failed attempts trigger lockout.

Not real yet:

- No direct enterprise ADFS/LDAP bind or OIDC redirect flow.
- No station SSO encrypted jump.
- No permission sync to station apps.
- No login-audit search/export UI or admin unlock UI.

## E. UI Reality

- `/login` no longer imports `@/lib/mock/auth`.
- Login form calls `/api/auth/login`.
- Header reads `/api/auth/me` through `lib/auth/session.ts`.
- Route guards validate server session through `/api/auth/me`.
- UI copy says enterprise ADFS/LDAP is a replaceable boundary, not complete.

## F. Mock / Simulator / DRY_RUN

- Mock login removed from the active login path.
- No DRY_RUN or simulator is counted as auth completion.
- ADFS/LDAP direct integration remains not complete.

## G. Missing Pieces

- Enterprise ADFS/LDAP parameters and provider adapter.
- Station SSO token acceptance.
- Account mapping from enterprise IdP attributes.
- Login audit management UI, search/export, and admin unlock.
- Business API permission middleware and cross-site/cross-department filtering.
- Storage encryption/partition isolation beyond password hashing.

## H. Blocker Type

- REQ-2.2.1: `partial`, blocker `blocked_by_external_system` for enterprise IdP.
- REQ-2.2.3: `partial`, no longer `blocked_by_auth`.
- REQ-6.2.2: `partial`.
- REQ-6.2.3: `partial`.
- REQ-6.2.4: `partial`.

## I. Verification

Targeted:

- `pnpm e2e:auth` passed.
- `pnpm exec tsc --noEmit` passed after integration.

Full required stack is recorded in final verification after this review.

## J. Verdict

`partial`.

R.26 completes the platform-local auth foundation but does not complete full ADFS/LDAP SSO or full RBAC enforcement across every business API.
