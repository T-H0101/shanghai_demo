# Sprint R.65 Requirements Review - Enterprise Auth and SSO Candidate

> Date: 2026-06-20
> Status: provider boundary in place; strict-complete pending real ADFS/LDAP

---

## Requirement IDs

- REQ-2.1.2 (station SSO switching)
- REQ-2.2.1 (ADFS/LDAP login)
- REQ-2.2.2 (AD ↔ station account mapping)
- REQ-3.1.1 (ADFS account dimensions)

## Backend Reality

| Component | Status | Evidence |
|---|---|---|
| OIDC provider | implemented_candidate | `lib/auth/oidc-provider.ts` |
| LDAP provider | implemented_candidate | `lib/auth/ldap-provider.ts` |
| Account mapping | implemented_candidate | `lib/auth/account-mapping.ts` |
| SSO start | implemented_candidate | `app/api/auth/sso/start/route.ts` |
| SSO callback | implemented_candidate | `app/api/auth/sso/callback/route.ts` |
| Station jump token | implemented_candidate | `app/api/sites/[id]/sso/route.ts` |

## Behavior

- All routes return `status: implemented_candidate` with a `missing` list
  when OIDC/LDAP env keys are absent.
- OIDC start redirects to the IdP when active; otherwise returns the
  candidate response.
- Station jump token is signed with HMAC-SHA256, but a real station
  must accept it before strict-complete.

## Strict vs Candidate

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-2.1.2 | blocked_by_auth | implemented_candidate | token generated; station acceptance unverified |
| REQ-2.2.1 | blocked_by_auth | implemented_candidate | OIDC + LDAP adapters disabled |
| REQ-2.2.2 | blocked_by_auth | implemented_candidate | account mapping exists but not exercised |
| REQ-3.1.1 | blocked_by_auth | implemented_candidate | account dimensions waiting on AD sync |

## Verdict

**partial-pass**: provider boundary is complete and honest. Strict `complete` for the four auth requirements requires real ADFS/LDAP deployment + station token acceptance.

---

Commit: `feat(r65): add enterprise auth sso candidate boundary`
