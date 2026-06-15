import { createHash } from "node:crypto"

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return value.toString("base64")
  if (typeof value === "bigint") return value.toString()
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)])
    )
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value))
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function hashRecords(records: Record<string, unknown>[]): string {
  const rows = records.map(stableStringify).sort()
  return sha256(JSON.stringify(rows))
}
