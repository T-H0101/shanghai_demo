# Sprint R.64 Requirements Review - Cage Move Registration

> Date: 2026-06-20
> Status: command + center log complete; station write requires real move table

---

## Requirement IDs

- REQ-4.3.1 (cage move)

## Backend Reality

| Component | Status | Evidence |
|---|---|---|
| Cage-move service | complete | `lib/control/cage-move.ts` |
| API route | complete | `app/api/racks/cage-move/route.ts` |
| command_type | complete | `cage_move_register` added to COMMAND_TYPES |
| target_type | complete | `cage` added to TARGET_TYPES |
| Center log | complete (when table exists) | `unified_cage_move_log` row OR candidate marker |
| Station write | blocked_by_source_schema | No `tbl_cage_move_log` / `tbl_magazine_move_log` / `tbl_disc_lib_move_log` in star_storage_db or source_restore |

## Behavior

- Always writes a center `unified_cage_move_log` row (if table exists) or a candidate marker.
- Detects station move log table:
  - tbl_cage_move_log
  - tbl_magazine_move_log
  - tbl_disc_lib_move_log
- If none exists, returns `status: blocked_by_source_schema` and explicit blocker.

## Strict vs Candidate

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-4.3.1 (cage move) | blocked_by_source_schema | implemented_candidate | station move table missing |

## Verdict

**partial-pass**: command flow is complete and the response is honest about the missing station table. Strict `complete` requires the site ops team to add one of the candidate tables to the station schema.

---

Commit: `feat(r64): register cage moves from center`
