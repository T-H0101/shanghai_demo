# Sprint R.51 — Security Closure

> Requirement IDs: `REQ-6.2.1`, `REQ-6.2.2`, `REQ-6.2.4`
> Date: 2026-06-20

---

## A. Requirement 对照

| Req ID | 原始文本 | Status |
|---|---|---|
| REQ-6.2.1 | 传输加密 (HMAC/JWT + TLS) | complete |
| REQ-6.2.2 | 存储加密 (密码不可逆, 无明文泄露) | complete |
| REQ-6.2.4 | 审计防篡改 (hash chain) | complete (R.41) |

## B. 安全测试结果 (13/13 passed)

| # | 测试项 | 预期 | 实际 | 结果 |
|---:|---|---|---|---|
| 1 | login HttpOnly cookie | HttpOnly | ✅ | pass |
| 2 | login SameSite | SameSite | ✅ | pass |
| 3 | unsigned site-control | 401 | 401 | pass |
| 4 | GET /api/tasks no auth | 401 | 401 | pass |
| 5 | GET /api/users no auth | 401 | 401 | pass |
| 6 | POST /api/control/commands no auth | 401 | 401 | pass |
| 7 | GET /api/tasks with auth | 200 | 200 | pass |
| 8 | auth/me no password_hash | absent | absent | pass |
| 9 | auth/me no scrypt | absent | absent | pass |
| 10 | auth/accounts no password_hash | absent | absent | pass |
| 11 | auth/accounts no scrypt | absent | absent | pass |
| 12 | system/health no DB password | absent | absent | pass |
| 13 | wrong password → 401 | 401 | 401 | pass |

## C. 安全机制证据

### REQ-6.2.1 传输安全

- **JWT (HS256)**: `odp_session` HttpOnly cookie, SameSite=Lax
- **HMAC-SHA256**: site-control endpoints 需要 HMAC 签名 (`verifySiteControlRequest`)
- **TLS**: 生产部署要求, 开发环境 HTTP (文档声明)
- **Auth middleware**: `requireSession` / `requirePermission` / `requireSiteAccess` 模式

### REQ-6.2.2 存储安全

- **密码**: scrypt hash (`scrypt$N=16384,r=8,p=1$...`), 不可逆
- **API 不泄露**: `auth/me`, `auth/accounts` 响应不含 `password_hash`
- **Health 不泄露**: `/api/system/health` 不含数据库密码
- **站点密钥**: `credential_key_ref` 引用, 非明文存储

### REQ-6.2.4 防篡改

- **Hash chain**: R.41 实现 (`/api/audit/verify` SHA-256 chain)
- **审计日志**: `audit_log` 表 JSONB before/after, actor, IP

## D. Verdict

**complete** — 13/13 安全测试通过, HMAC/JWT/scrypt/hash-chain 全部有真实实现证据。

---

Commit: `test(r51): security boundary e2e tests [REQ-6.2.1,REQ-6.2.2]`
