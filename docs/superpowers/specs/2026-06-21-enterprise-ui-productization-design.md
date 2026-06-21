# Enterprise UI Productization Design

> Date: 2026-06-21  
> Scope: Visual and UX productization for the unified disc-library control platform.  
> Source of truth: `docs/source/requirements.md`, `CLAUDE.md`, `AGENTS.md`, and current code.

## Objective

Make the platform look and behave like a real enterprise control product, not an AI-generated demo, while preserving strict requirements truthfulness.

The rollout order is:

1. **A. Fast visual refresh**: remove user-visible demo/AI/development traces and redesign login, settings, command palette, and shared primitives.
2. **B. Enterprise productization**: clarify read-only/editable/blocked states, permissions, site context, and real API boundaries.
3. **C. Requirements evidence closure**: connect page capabilities to strict requirement evidence, blockers, and completion status.

## Design System Direction

Using `ui-ux-pro-max`, the selected direction is:

- Pattern: **Enterprise Gateway**
- Style: **Minimalism / Swiss Style**
- Product type: enterprise SaaS operations dashboard
- Tone: professional, trustworthy, data-dense, calm
- Primary visual language: light enterprise console
- Login and command surfaces: restrained Apple-like glass layer

The generated design system recommended indigo/emerald. The project already has a navy/blue/amber enterprise system, so implementation should merge the recommendation into existing tokens rather than replacing the product identity.

## Visual Rules

### Color

- Primary: navy / blue / indigo for navigation, active states, and primary actions.
- Accent: amber only for warning, partial, blocked, or operator attention.
- Success: emerald only for proven backend success, not queued commands.
- Background: light slate / neutral gray for business pages.
- Surface: white cards with visible gray borders.
- Text: slate-900 or equivalent for body text; muted text must remain readable.

### Glass Treatment

Use glass sparingly:

- Login hero panel and login card.
- Command Center hero region.
- Command palette overlay.
- Key status cards where depth helps hierarchy.

Do not glassify:

- Tables.
- Dense settings lists.
- Audit logs.
- Long forms.

Glass implementation should use high-opacity surfaces in light mode, visible borders, and blur. Avoid low-contrast `bg-white/10` style on light backgrounds.

### Motion

Motion should feel polished but restrained:

- Standard hover: `150-250ms`.
- Diagonal light sweep hover: `500-700ms`, used only on key cards, command items, and primary CTA.
- Capsule tab switch: active pill slides between options instead of only changing color.
- Do not use layout-shifting scale transforms.
- Respect `prefers-reduced-motion`.

### Icons

- Use Lucide or existing SVG icons only.
- No emoji UI icons.
- Icon size should be consistent: normally `h-4 w-4` for inline, `h-5 w-5` for cards, `h-6 w-6` for hero.

## Page-Level Design

### Login Page

Current issues:

- User-visible text says “演示环境”.
- Local development account is visible on the page.
- Site list is static and only shows `SH01`.
- Page has a good base layout but still feels like a demo.

Target design:

- Left side: dark brand glass panel with product positioning and real capability summary.
- Right side: light or frosted login card with concise form labels.
- Footer: enterprise auth status in production wording:
  - `当前认证方式：本地 JWT`
  - `企业 SSO：待接入`
  - `登录审计：已启用`
- Remove visible development account text.
- Keep auth truthfulness: do not imply ADFS/LDAP is complete.
- Keep form validation clear and accessible.

### Settings Page

Current issues:

- It is honest but reads like an implementation note.
- “当前页面只读” is accurate but too blunt as a product experience.
- Several cards expose internal wording rather than operational state.

Target design:

- Header summary strip:
  - current auth mode
  - center DB health
  - configured site count
  - external dependency state
- Settings segmented navigation:
  - Overview
  - Site Registry
  - Sync Strategy
  - Auth & Security
  - External Systems
  - Quality Gate
- Each section must show:
  - data source
  - capability state: editable / read-only / blocked
  - reason if blocked
  - required condition to unlock
- Read-only is acceptable, but it must look intentional:
  - show disabled controls with reason
  - show “配置由环境变量/运维密钥管理” rather than “not_implemented” as the main user-facing phrase
  - keep exact blocker labels available in badges or detail rows

### Command Palette

Current issues:

- Uses a custom input/dropdown instead of a real command component pattern.
- Includes shortcut actions whose destination state may not match the UI.
- Example: selecting “任务管理 · 失败任务” can navigate to a URL that the page does not fully consume.
- Highlight behavior and visual trailing feel unpleasant.
- Site options are currently hardcoded.

Target design:

- Use a proper command-list mental model:
  - Pages
  - Site Switch
  - Filters
  - Actions
- Remove or disable any shortcut whose URL/query is not consumed by the target page.
- If an item filters a page, the target page must read that query and show the matching filter state.
- Active item should use a capsule or soft selection block, not a harsh full-width smear.
- Add diagonal light sweep only on active/hover command rows.
- Site switch must eventually use center registry, not hardcoded candidates.

### Comments And Visible Copy

This project may keep useful engineering comments. The first visual refresh only removes user-visible traces:

- Remove “演示环境” from production-facing UI.
- Remove “本地开发账号：admin / admin” from login UI.
- Remove prose that reads like a code comment.
- Keep blocked/partial/strict labels where they support requirements truthfulness.
- Keep operator-facing explanations short and action-oriented.

## Permissions UX

Current route guards only enforce logged-in vs not logged-in. Future productization must distinguish:

- unauthenticated
- authenticated but lacking page permission
- authenticated with read-only permission
- authenticated with write permission

Until full RBAC is verified, pages should show safe read-only or blocked states. They must not hide missing permission enforcement behind good-looking UI.

## Requirements Truthfulness

No UI refresh may change completion claims. The following wording rules remain mandatory:

- Queued command: “已提交到控制队列，等待站点 Agent 执行”.
- Blocked external dependency: show `blocked_by_external_system`.
- Blocked auth dependency: show `blocked_by_auth`.
- Partial source data: show `partial` or explicit data source.
- Never show green success for queued, blocked, DRY_RUN, or candidate-only capabilities.

## Accessibility

From `ui-ux-pro-max` UX guidance:

- Keyboard navigation must match visual order.
- Every input needs a real label.
- Focus states must be visible.
- Command palette must avoid keyboard traps.
- Add or preserve skip-to-content behavior where navigation becomes heavy.
- Respect reduced motion.

## Testing Expectations

Every UI change must include event-level or source-level e2e coverage as required by `AGENTS.md`.

Minimum tests for implementation:

- `pnpm e2e:auth` or login-specific test for login redesign.
- `pnpm e2e:settings` for settings sections and blocked/read-only states.
- `pnpm e2e:frontend-integration` for command palette route consistency.
- `pnpm e2e:header-ux-lift` for shared UI, hover/focus/guide contracts.
- `pnpm exec tsc --noEmit`
- `pnpm build`

Full commit verification must still run the required checks from `AGENTS.md`.

## Rollout Plan Summary

### Phase A: Fast Visual Refresh

- Redesign login visual hierarchy.
- Remove visible demo/development copy.
- Add glass card primitives and diagonal hover utility.
- Introduce capsule segmented control primitive.
- Improve command palette active and hover visuals.
- Improve settings overview visual hierarchy without adding fake write actions.

### Phase B: Productization

- Replace hardcoded site candidates with center registry.
- Add settings sections for read-only/editable/blocked states.
- Align command palette filters with actual page state.
- Add permission-aware empty/blocked states.
- Remove silent mock fallback from API mode.

### Phase C: Requirements Evidence

- Add requirement evidence widgets only where they help operators and reviewers.
- Update strict/candidate completion display from source documents or API, not hardcoded literals.
- Recalculate matrix after verification.

## Open Decisions

These are intentionally deferred to implementation planning:

- Whether to create a reusable `GlassPanel` component or use Tailwind utility classes directly.
- Whether command palette should adopt `cmdk`/shadcn Command or remain custom but fixed.
- Whether settings page should use tabs, sidebar sections, or accordion on mobile.

## Approval State

User-approved direction:

- Execute in order: A first, B second, C last.
- Clean user-visible AI/demo/development traces first.
- Apply `ui-ux-pro-max` design.
- Make it more polished with Apple-like glass, diagonal light hover, and capsule sliding transitions.
