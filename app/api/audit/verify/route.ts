/**
 * GET /api/audit/verify - 审计日志完整性校验
 *
 * Sprint R.41 - REQ-6.2.3: 审计防篡改
 *
 * 使用 hash chain 验证审计日志完整性:
 *   hash(record) = SHA-256(id + action + target_table + target_id + before_json + after_json + prev_hash)
 *
 * 返回:
 *   - total: 审计记录总数
 *   - verified: 校验通过数
 *   - tampered: 篡改检测数
 *   - tamperedIds: 被篡改的记录 ID 列表
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db/postgres"
import { requireSession, requirePermission } from "@/lib/auth/middleware"
import { createHash } from "crypto"

interface AuditRow {
  id: string
  command_no: string | null
  action: string
  target_table: string
  target_id: string
  before_json: string | null
  after_json: string | null
  actor: string | null
  site_code: string | null
  dry_run: boolean
  result: string
  created_at: string
}

interface ChainRow {
  audit_log_id: string
  record_hash: string
  prev_hash: string
  chain_index: string
}

function computeHash(row: AuditRow, prevHash: string): string {
  const data = [
    row.id,
    row.command_no ?? "",
    row.action,
    row.target_table,
    row.target_id,
    row.before_json ?? "null",
    row.after_json ?? "null",
    row.actor ?? "",
    row.site_code ?? "",
    row.result,
    prevHash,
  ].join("|")
  return createHash("sha256").update(data).digest("hex")
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req)
    requirePermission(session, "audit:read")
  } catch (e) {
    if (e instanceof NextResponse) return e
  }

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 10000)
  const siteCode = url.searchParams.get("siteCode") ?? undefined

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS audit_hash_chain (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        audit_log_id UUID NOT NULL REFERENCES audit_log(id) ON DELETE CASCADE,
        record_hash TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        chain_index BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_hash_chain_audit_id
      ON audit_hash_chain(audit_log_id)
    `)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_audit_hash_chain_index
      ON audit_hash_chain(chain_index)
    `)

    const conditions: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (siteCode) {
      conditions.push(`site_code = $${idx}`); params.push(siteCode); idx++
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const result = await query<AuditRow>(
      `SELECT id::text, command_no, action, target_table, target_id,
              before_json::text, after_json::text, actor, site_code,
              dry_run, result, created_at::text
       FROM audit_log ${where}
       ORDER BY created_at ASC, id ASC
       LIMIT $${idx}`,
      [...params, limit],
    )

    const rows = result.rows
    let prevHash = "genesis"
    let verified = 0
    let tampered = 0
    const tamperedIds: string[] = []

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const expectedHash = computeHash(row, prevHash)
      const stored = await query<ChainRow>(
        `SELECT audit_log_id::text, record_hash, prev_hash, chain_index::text
         FROM audit_hash_chain
         WHERE audit_log_id = $1::uuid`,
        [row.id]
      )
      const chainRow = stored.rows[0]
      if (!chainRow) {
        await query(
          `INSERT INTO audit_hash_chain (audit_log_id, record_hash, prev_hash, chain_index)
           VALUES ($1::uuid, $2, $3, $4)
           ON CONFLICT (audit_log_id) DO NOTHING`,
          [row.id, expectedHash, prevHash, index]
        )
        verified++
      } else if (
        chainRow.record_hash === expectedHash &&
        chainRow.prev_hash === prevHash &&
        Number(chainRow.chain_index) === index
      ) {
        verified++
      } else {
        tampered++
        tamperedIds.push(row.id)
      }
      prevHash = expectedHash
    }

    return NextResponse.json({
      ok: true,
      data: {
        total: rows.length,
        verified,
        tampered,
        tamperedIds,
        chainHead: prevHash,
        algorithm: "SHA-256",
        note: "Hash chain persisted in audit_hash_chain; existing records are compared against stored hashes",
      },
      dataSource: "database",
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
