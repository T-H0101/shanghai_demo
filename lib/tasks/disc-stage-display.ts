/**
 * tbl_disc.stage → 中文（站点业务库约定）
 * 0 开始刻录 / 1 刻录完成 / 2 开始校验 / 3 开始3重校验 /
 * 4 已经成功校验过 / 5 已经校验过但失败
 */

export const DISC_STAGE_LABELS: Record<number, string> = {
  0: '开始刻录',
  1: '刻录完成',
  2: '开始校验',
  3: '开始3重校验',
  4: '已经成功校验过',
  5: '已经校验过但失败',
}

/** 格式化盘 stage / currentPhase 展示；未知数字保留原值 */
export function formatDiscStageLabel(
  stage: string | number | null | undefined
): string {
  if (stage == null || stage === '') return '—'
  const n = typeof stage === 'number' ? stage : Number(String(stage).trim())
  if (!Number.isFinite(n)) return String(stage)
  return DISC_STAGE_LABELS[n] ?? String(n)
}
