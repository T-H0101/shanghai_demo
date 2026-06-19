# Auth Foundation Design

## Requirement scope

- `docs/source/requirements.md` section 2.2: ADFS/LDAP login, JWT token, login audit, failed login lockout.
- `docs/source/requirements.md` section 3.1: account status, role, department, site access.
- `docs/source/requirements.md` section 3.2 and 3.3: RBAC boundary, permission audit boundary.
- `docs/source/requirements.md` section 6.2: avoid unauthorized access.

## Decision

Implement the central platform auth foundation now. Do not claim enterprise ADFS/LDAP direct integration complete until real IdP connection details exist.

## Implementation boundary

- Real: server-side login API, HMAC-signed JWT session cookie, database-backed credentials, password hash verification with Node `crypto.scrypt`, login audit records, failed-login lockout, `/api/auth/me`, `/api/auth/logout`, client route guard using server session.
- Real: RBAC helper and role mapping from local auth user rows.
- Configured boundary: ADFS/OIDC/LDAP safe env key refs remain visible in settings.
- Not claimed complete: direct ADFS/LDAP federation, remote AD sync, station SSO encrypted jump, permission sync to station apps.

## Data model

Add center tables:

- `auth_accounts`: central auth identity linked to `unified_users` when available.
- `auth_login_audit`: login attempts, IP, user agent, site code, result, failure reason.
- `auth_role_permissions`: small RBAC permission catalog for platform enforcement.

No real secret values are committed. Seed only a local demo admin password hash for development/testing, documented as replaceable.

## Verification

- Add `scripts/e2e/test-auth.ts` and include it in `e2e:all`.
- Run required stack before commit:
  - `pnpm exec tsc --noEmit`
  - `pnpm build`
  - `pnpm smoke:sync`
  - `pnpm check:sync-consistency -- --siteCode=SH01`
  - `pnpm baseline:check`
  - `pnpm e2e:all`
