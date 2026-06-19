# Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock browser-only login with a real central-platform auth foundation.

**Architecture:** Add DB-backed auth accounts and login audit, server API routes for login/me/logout, HMAC JWT session cookie, and client guards/header that read `/api/auth/me`. ADFS/LDAP remains a safe adapter/config boundary until external IdP details are provided.

**Tech Stack:** Next.js route handlers, PostgreSQL 17, Node `crypto`, existing e2e tsx scripts.

---

### Task 1: Failing Auth E2E

**Files:**
- Create: `scripts/e2e/test-auth.ts`
- Modify: `package.json`
- Modify: `scripts/e2e/run-all.ts`

- [ ] Write a failing e2e that expects `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, failed-attempt lockout, and no mock auth copy in login/session source.
- [ ] Run `pnpm e2e:auth` and confirm it fails because auth APIs do not exist yet.

### Task 2: Auth Schema And Core

**Files:**
- Create: `databases/sprint-r.26/auth-foundation.sql`
- Create: `lib/auth/password.ts`
- Create: `lib/auth/jwt.ts`
- Create: `lib/auth/server.ts`
- Modify: `.env.example`

- [ ] Add DB tables for `auth_accounts`, `auth_login_audit`, and `auth_role_permissions`.
- [ ] Add password hash and JWT helpers using Node standard library only.
- [ ] Add server-side helpers for login audit, account lookup, lockout, cookie creation, and session parsing.

### Task 3: Auth API And Client Integration

**Files:**
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/me/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Modify: `app/login/page.tsx`
- Modify: `lib/auth/session.ts`
- Modify: `components/auth/route-guard.tsx`
- Modify: `components/layout/auth-guard.tsx`
- Modify: `components/dashboard/header.tsx`

- [ ] Replace local mock login with API login.
- [ ] Store no password or real secret on the client.
- [ ] Make guards and header read server session evidence.

### Task 4: Requirements Review And Verification

**Files:**
- Create: `docs/database-analysis/sprint-r.26-requirements-review.md`
- Modify: `docs/database-analysis/requirements-traceability.json`
- Modify: `docs/database-analysis/requirements-traceability.md`
- Modify: `docs/summary/PROJECT_STATUS.md`
- Modify: `docs/summary/ROADMAP.md`

- [ ] Mark auth requirements honestly: platform auth foundation partial/complete where full requirement is met, external IdP/SSO remains blocked by external system/config.
- [ ] Run the required checks and commit only if they pass.
