/**
 * 光盘库盘位展示：对齐业务系统 DgDetailDeviceCd.vue
 * disc_type: 0 无盘 / 1 未刻 / 2 满盘 / 3 未满 / 4 坏盘
 */

export type OpticalDiscType = 0 | 1 | 2 | 3 | 4

export const OPTICAL_DISC_TYPE_LABELS: Record<OpticalDiscType, string> = {
  0: "无盘",
  1: "未刻",
  2: "满盘",
  3: "未满",
  4: "坏盘",
}

/** 与业务 color0–color4 一致 */
export const OPTICAL_DISC_TYPE_COLORS: Record<
  OpticalDiscType,
  { bg: string; text: string; border: string; swatch: string }
> = {
  0: { bg: "bg-[#ccc]", text: "text-slate-700", border: "border-[#ccc]", swatch: "bg-[#ccc]" },
  1: {
    bg: "bg-[rgb(125,230,98)]",
    text: "text-slate-800",
    border: "border-[rgb(125,230,98)]",
    swatch: "bg-[rgb(125,230,98)]",
  },
  2: {
    bg: "bg-[rgb(40,141,247)]",
    text: "text-white",
    border: "border-[rgb(40,141,247)]",
    swatch: "bg-[rgb(40,141,247)]",
  },
  3: {
    bg: "bg-[rgb(40,141,247)]/60",
    text: "text-white",
    border: "border-[rgb(40,141,247)]/60",
    swatch: "bg-[rgb(40,141,247)]/60",
  },
  4: {
    bg: "bg-[rgb(236,35,35)]",
    text: "text-white",
    border: "border-[rgb(236,35,35)]",
    swatch: "bg-[rgb(236,35,35)]",
  },
}

export function normalizeOpticalDiscType(value: unknown): OpticalDiscType | null {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return null
  if (n === 0 || n === 1 || n === 2 || n === 3 || n === 4) return n
  return null
}

export function opticalDiscTypeLabel(discType: number | null | undefined): string | undefined {
  const normalized = normalizeOpticalDiscType(discType)
  return normalized === null ? undefined : OPTICAL_DISC_TYPE_LABELS[normalized]
}

/** slot_order / slot_index 在业务库为 0-based，展示序号 = order + 1 */
export function displaySlotIndex(order0Based: number | null | undefined): number {
  if (order0Based == null || !Number.isFinite(order0Based)) return 1
  return Math.max(1, Math.trunc(order0Based) + 1)
}

/**
 * 业务双面盘判断（对齐 MultimediumCentral volume_controller）：
 * - mag.disc_type == 8 → 双面
 * - 或 tbl_disc_type.disc_side == 2（unified_disc_types.disc_side）
 */
export function isDualSidedMagazine(input: {
  magDiscType?: number | null
  /** unified_disc_types.disc_side：1=单面，2=双面 */
  discTypeSide?: number | null
}): boolean {
  if (input.magDiscType === 8) return true
  if (input.discTypeSide === 2) return true
  return false
}

/** tbl_slots.disc_side：0=A，1=B → 后缀；单面返回空串 */
export function formatDiscSideSuffix(
  discSide: number | null | undefined,
  dualSided: boolean,
): string {
  if (!dualSided) return ""
  if (discSide == null || !Number.isFinite(Number(discSide))) return "A"
  return Number(discSide) > 0 ? "B" : "A"
}

/**
 * 盘位展示标签：单面 1/2/3/4；双面 1A/1B/2A/2B
 * （业务：`${slot_order+1}${disc_type==8 ? (disc_side==0?'A':'B') : ''}`）
 */
export function displaySlotLabel(
  order0Based: number | null | undefined,
  options?: {
    discSide?: number | null
    dualSided?: boolean
    magDiscType?: number | null
    discTypeSide?: number | null
  },
): string {
  const num = displaySlotIndex(order0Based)
  const dual =
    options?.dualSided ??
    isDualSidedMagazine({
      magDiscType: options?.magDiscType,
      discTypeSide: options?.discTypeSide,
    })
  return `${num}${formatDiscSideSuffix(options?.discSide, dual)}`
}

/** 兼容旧 SlotStatus 映射（仅作 fallback） */
export function discTypeToLegacySlotStatus(
  discType: number | null | undefined
): "free" | "used" | "error" {
  if (discType === 4) return "error"
  if (discType === 0 || discType == null) return "free"
  return "used"
}
