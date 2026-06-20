# Sprint R.55 Requirements Review - Center-Owned Read Path and Dump Sync Baseline

> Date: 2026-06-20
> Status: foundation in place; ES/ClickHouse/cage-move/enterprise-auth still require external verification

---

## Requirement IDs

- REQ-1.2.1 (unified station access)
- REQ-2.3.1 (synchronization range)
- REQ-2.3.2 (sync strategy)
- REQ-2.3.3 (consistency check)
- REQ-4.1.1 (unified search)
- REQ-5.1.1 (log management)
- REQ-5.2.1 (index export)
- REQ-6.4.3 (observability)

## Architecture Decision (R.55 freeze)

The production read path is **site DB / restore DB -> dump or adapter -> center processing -> unified_* / ES / ClickHouse -> API -> UI**.

- Business pages must not directly read `site_restore_db`; restore/source DBs are synchronization sources only.
- Small tables sync into PG17 `unified_*` via pg_dump `table_backup.sql` ingestion.
- `tbl_file`/`tbl_folder` index data goes to ES/OpenSearch.
- Large logs go to ClickHouse.
- The center platform is the full product control surface: users create/control tasks in the center UI/API.
- Site Agent only acts as the station-side executor and must poll center commands.
- Completion requires a real station DB mutation plus center sync-back evidence.

## Backend Reality

| Component | Reality | Evidence |
|---|---|---|
| Dump parser | `lib/sync/dump/parser.ts` parses PostgreSQL `COPY ... FROM stdin;` blocks | test-sync-dump-parser.ts |
| Whitelist | `DUMP_ALLOWED_TABLES = [13 tables]`; `DUMP_FORBIDDEN_TABLES = [tbl_file, tbl_folder]` | lib/sync/dump/manifest.ts |
| Dump export | `scripts/sync/export-restore-dump.ts` runs `pg_dump --data-only --table public.X` | shell exec |
| Dump ingest | `lib/sync/dump/ingest.ts` parses + dispatches via existing package dispatcher | test-sync-dump-flow.ts |
| Hash/cipher policy | `HASH_OR_CIPHER_FIELDS` may sync as source ciphertext, never decoded or logged | manifest |
| Trigger metadata | `/api/sync/trigger` writes `protocol: "pg_dump_table_backup"` | trigger route |
| Site Agent test mode | `scripts/site-agent/run.ts -- --once` polls, dumps, ingests, acks | agent runner |

## UI Reality

- Racks/Search/Logs/Settings/Sites pages must display "数据源：总控库 unified_X" + optional "最近同步来源：SH01 restore 测试库" separately.
- Must NOT show "数据来自 site_restore_db" as if restore DB is the active product read store.

## Mock / Simulator / DRY_RUN

- No mock or DRY_RUN is counted as completion.
- JSON package ingestion via `app/api/sync/package` remains a compatibility test path, not the final production protocol.

## ES / ClickHouse / External Verifications Still Required

| Req | Required external evidence | Current state |
|---|---|---|
| REQ-4.1.2 search performance | ES/OpenSearch deployed, query latency < 1s | env absent, blocked_by_external_system |
| REQ-5.1.1 log management | ClickHouse deployed, large native task logs ingested | env absent, partial |
| REQ-4.3.1 cage move | Station tbl_cage_move_log or similar exists | not discovered in star_storage_db, blocked_by_source_schema |

## Strict vs Candidate Status

| Req | Strict | Candidate | Notes |
|---|---|---|---|
| REQ-2.3.1 | complete (R.55) | complete | dump writes small tables + ES/ClickHouse path |
| REQ-2.3.2 | complete (R.55) | complete | manual + hourly trigger + retry logs |
| REQ-2.3.3 | complete (R.43) | complete | consistency report + manual resolve |
| REQ-4.1.1 | partial | complete | unified search works; ES optional for performance |
| REQ-4.1.2 | blocked_by_external_system | complete only with ES | performance not verifiable without ES |
| REQ-5.1.1 | partial | complete with CH | log management works; large native logs need CH |
| REQ-5.2.1 | partial | complete | index export from center store works |
| REQ-6.4.3 | complete (R.49) | complete | observability covers monitoring + alerts |

## Verdict

**partial-pass**: R.55 baseline (dump sync, center-read rule, no direct restore DB reads, ES/ClickHouse boundary code) is in place. Strict upgrades to `complete` require ES/ClickHouse env + station move table evidence, which is out of current scope and must be recorded as blocked_by_external_system / blocked_by_source_schema.

---

Commit: `docs(r55): freeze center-read dump sync baseline`
