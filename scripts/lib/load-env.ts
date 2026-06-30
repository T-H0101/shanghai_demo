/**
 * scripts/lib/load-env.ts
 * Load .env.local for standalone tsx scripts (Next.js auto-loads it for app code,
 * but tsx scripts need explicit loading).
 *
 * Priority: process.env (already set) > .env.local > .env
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {}
  const content = readFileSync(filePath, "utf8")
  const env: Record<string, string> = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // Don't override already-set env vars
    if (!(key in process.env)) {
      env[key] = value
    }
  }
  return env
}

export function loadEnv(): void {
  const root = process.cwd()
  const localEnv = parseEnvFile(join(root, ".env.local"))
  const baseEnv = parseEnvFile(join(root, ".env"))

  // .env.local takes precedence over .env, but process.env takes precedence over both
  const merged = { ...baseEnv, ...localEnv }
  for (const [key, value] of Object.entries(merged)) {
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}
