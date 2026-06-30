/**
 * lib/jobs/file-index-job-state.ts
 * R.86 — file_index_jobs status state machine (domain rule)
 *
 * 集中定义 6 态机的合法转换与守卫规则, 任何 indexer / 调度器代码都必须
 * 引用这里, 不允许散落字符串。
 *
 * 6 态:
 *   pending      未启动
 *   running      正在执行 (worker 持有行级锁)
 *   succeeded    本次执行完成
 *   failed       本次失败, 等待 retry
 *   dead_letter  超过 max_retries, 需人工介入
 *   tombstoned   源表下线 / R.89 弃用, 停止再跑
 *
 * 转换规则:
 *
 *   pending -> running          (worker 抢锁)
 *   pending -> tombstoned       (R.89 inventory 标记源表下线)
 *
 *   running -> succeeded       (扫描/索引成功)
 *   running -> failed          (单次执行失败)
 *   running -> dead_letter     (致命错误, e.g. SQL 不可恢复)
 *
 *   failed -> running          (retry 触发)
 *   failed -> dead_letter      (retry_count >= max_retries)
 *
 *   succeeded -> running       (下一次调度触发)
 *   succeeded -> tombstoned    (源表下线)
 *
 *   dead_letter -> pending     (人工解锁, 重置 retry_count=0)
 *   dead_letter -> tombstoned  (确认不再跑)
 *
 *   tombstoned 是终态, 不允许任何转换出去。
 */

export const FILE_INDEX_JOB_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
  "dead_letter",
  "tombstoned",
] as const

export type FileIndexJobStatus = (typeof FILE_INDEX_JOB_STATUSES)[number]

/**
 * 允许的 watermark 增量键列名。
 * 与 databases/sprint-r86/01-file-index-jobs.sql §10 约束保持一致。
 */
export const FILE_INDEX_WATERMARK_COLUMNS = [
  "id",
  "create_date",
  "updated_at",
  "insert_time",
] as const

export type FileIndexWatermarkColumn =
  (typeof FILE_INDEX_WATERMARK_COLUMNS)[number]

const TERMINAL: ReadonlySet<FileIndexJobStatus> = new Set(["tombstoned"])

const TRANSITIONS: Readonly<Record<FileIndexJobStatus, ReadonlySet<FileIndexJobStatus>>> = {
  pending: new Set(["running", "tombstoned"]),
  running: new Set(["succeeded", "failed", "dead_letter"]),
  succeeded: new Set(["running", "tombstoned"]),
  failed: new Set(["running", "dead_letter"]),
  dead_letter: new Set(["pending", "tombstoned"]),
  tombstoned: new Set([]),
}

/**
 * 守卫: 给定 from -> to 是否合法
 */
export function canTransition(
  from: FileIndexJobStatus,
  to: FileIndexJobStatus
): boolean {
  if (TERMINAL.has(from)) return false
  return TRANSITIONS[from].has(to)
}

/**
 * 决策: 失败后是 retry 还是 dead_letter
 * 规则: retry_count + 1 >= max_retries 则进死信, 否则保留 failed 等待重试
 */
export function decideAfterFailure(
  retryCount: number,
  maxRetries: number
): FileIndexJobStatus {
  if (retryCount + 1 >= maxRetries) {
    return "dead_letter"
  }
  return "failed"
}