/**
 * audit_log 写入 helper.
 *
 * Sprint 4.8 - 总控审计日志
 *
 * 用途:
 *   - executor.ts 在执行完每个 commandType 后调用
 *   - 记录 before/after 快照, actor, dry_run 标志
 *
 * 设计:
 *   - 简单 INSERT, 不开事务 (audit 是 append-only, 失败不应阻塞主流程)
 *   - 失败仅 console.error, 不抛 (审计失败 ≠ 业务失败)
 */

import { query } from '@/lib/db/postgres'

export interface AuditEntry {
  commandNo?: string | null
  action: string
  targetTable: string
  targetId: string
  before?: unknown
  after?: unknown
  actor?: string | null
  actorIp?: string | null
  siteCode?: string | null
  dryRun?: boolean
  result: 'success' | 'failed'
  errorMessage?: string | null
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log
         (command_no, action, target_table, target_id,
          before_json, after_json, actor, actor_ip,
          site_code, dry_run, result, error_message)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12)`,
      [
        entry.commandNo ?? null,
        entry.action,
        entry.targetTable,
        entry.targetId,
        JSON.stringify(entry.before ?? null),
        JSON.stringify(entry.after ?? null),
        entry.actor ?? null,
        entry.actorIp ?? null,
        entry.siteCode ?? null,
        entry.dryRun ?? false,
        entry.result,
        entry.errorMessage ?? null,
      ]
    )
  } catch (err) {
    // 审计失败不抛, 仅日志. 业务已完成, 审计是 best-effort.
    console.error('[audit] failed to write audit_log:', err instanceof Error ? err.message : err)
  }
}
