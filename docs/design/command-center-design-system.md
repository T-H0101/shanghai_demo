# Command Center Design System

> R.45 UI/UX consistency rules for 统一总控平台.

## Visual Direction

- Product type: enterprise SaaS operations dashboard.
- Style: data-dense dashboard.
- Primary color: navy/blue.
- Warning/accent color: amber, only for warning and primary operator attention.
- Surface: light neutral background, white cards, visible gray border.

## Rules

- No emoji icons; use existing SVG/Lucide icons.
- All clickable cards/buttons need `cursor-pointer`, hover feedback, and focus-visible ring.
- Async sections need loading skeleton or explicit loading state.
- Empty states must explain what is missing and what action is available.
- Blocked actions must be amber and must not look like success.
- Toasts must not say "成功" unless backend and final state prove success.
- Time format: `yyyy-MM-dd HH:mm:ss` or date-only `yyyy-MM-dd`.
- Tables must expose source/provenance where requirement truth depends on it.

## CSS Classes

| Class | Usage |
|---|---|
| `.app-page` | Page root wrapper (min-height, background) |
| `.app-card` | White card with border and subtle shadow |
| `.app-interactive` | Hover/focus feedback for clickable cards |
| `.app-focus` | Focus-visible ring for keyboard navigation |

## Tone Badges

| Tone | Class | Meaning |
|---|---|---|
| complete | `border-emerald-200 bg-emerald-50 text-emerald-800` | Real backend + UI verified |
| partial | `border-amber-200 bg-amber-50 text-amber-800` | Some capability missing |
| blocked | `border-slate-200 bg-slate-50 text-slate-700` | Blocked by source/auth/external |

No page may use green/success style for queued commands, DRY_RUN, blocked actions, or partial source data.
