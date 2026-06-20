# Sprint R.59 Requirements Review - Auth Boundary and Honest SSO Reporting

> Date: 2026-06-20
> Status: UI wording updated; enterprise auth candidate modules in R.65

---

## Requirement IDs

- REQ-2.1.2 (station SSO switching)
- REQ-2.2.1 (ADFS/LDAP login)
- REQ-2.2.2 (AD ↔ station account mapping)
- REQ-3.1.1 (ADFS account dimensions)

## UI Wording Update (R.59)

- `app/login/page.tsx` now displays:
  - 当前认证：本地 JWT
  - 企业 ADFS/LDAP：待接入，缺少 provider metadata 与测试账号
  - 站点 SSO：待 ADFS/LDAP 与站点 token 接收端点确认
  - 本地开发账号：admin / admin

- `app/sites/page.tsx` SSO button remains disabled with title
  "SSO 跳转功能未接入 (REQ-2.1.2 blocked_by_auth)".
- `app/settings/page.tsx` exposes OIDC / LDAP env key refs only
  (no secret values), labels any missing key as
  "blocked_by_auth".

## Strict vs Candidate

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-2.1.2 | blocked_by_auth | implemented_candidate (R.65) | station token acceptance requires real station |
| REQ-2.2.1 | blocked_by_auth | implemented_candidate (R.65) | OIDC/LDAP adapters disabled |
| REQ-2.2.2 | blocked_by_auth | implemented_candidate (R.65) | account mapping disabled |
| REQ-3.1.1 | blocked_by_auth | implemented_candidate (R.65) | account dimensions waiting on AD sync |

## Verdict

**partial-pass**: UI is now honest. Enterprise ADFS/LDAP/SSO requirements remain blocked_by_auth at the strict level; they move to `implemented_candidate` only after R.15 module is wired.

---

Commit: `docs(auth): clarify local jwt and adfs boundary`
