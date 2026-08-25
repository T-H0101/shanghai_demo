/**
 * 盘笼 RFID 归一化与正/反序变体（与站点 Central 回迁校验一致：大写 hex 字节对倒序）
 */

export function normalizeMagazineRfid(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase()
}

/** 偶数长度 hex 按字节对倒序；非 hex 或奇数长度原样返回 */
export function reverseMagazineRfidHexPairs(rfid: string): string {
  const normalized = normalizeMagazineRfid(rfid)
  if (!normalized || normalized.length % 2 !== 0) return normalized
  if (!/^[0-9A-F]+$/.test(normalized)) return normalized
  const pairs: string[] = []
  for (let i = 0; i < normalized.length; i += 2) {
    pairs.push(normalized.slice(i, i + 2))
  }
  return pairs.reverse().join("")
}

/** 用于等值匹配：正序 + 字节对倒序（去重） */
export function magazineRfidVariants(value: string | null | undefined): string[] {
  const primary = normalizeMagazineRfid(value)
  if (!primary) return []
  const reversed = reverseMagazineRfidHexPairs(primary)
  return reversed && reversed !== primary ? [primary, reversed] : [primary]
}

export function magazineRfidsMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = new Set(magazineRfidVariants(a))
  if (!left.size) return false
  return magazineRfidVariants(b).some((v) => left.has(v))
}
