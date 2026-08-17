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

/** 兼容旧 SlotStatus 映射（仅作 fallback） */
export function discTypeToLegacySlotStatus(
  discType: number | null | undefined
): "free" | "used" | "error" {
  if (discType === 4) return "error"
  if (discType === 0 || discType == null) return "free"
  return "used"
}
