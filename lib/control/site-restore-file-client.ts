/**
 * 总控 → 站点：按物理位置写入待回迁记录（仅 INSERT，不执行回迁）
 * POST /unified-restore-file（路径可用 SITE_RESTORE_FILE_PATH 覆盖）
 * 鉴权与任务控制 / 立即推送同源密钥。
 */

import type { PhysicalRestorePayload } from "@/lib/search/restore-physical"

export type SiteRestoreFileResult = {
  ok: boolean
  httpStatus: number
  code: number
  accepted: boolean
  reasonCode: string | null
  message: string
  restoreFileId: string | number | null
  raw: unknown
}

export type SiteRestoreFileCallInput = {
  baseUrl: string
  secret: string
  payload: PhysicalRestorePayload
  siteCode?: string | null
  timeoutMs?: number
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, "")
}

export function siteRestoreFilePath(env: NodeJS.ProcessEnv = process.env): string {
  const p = (env.SITE_RESTORE_FILE_PATH ?? "/unified-restore-file").trim()
  return p.startsWith("/") ? p : `/${p}`
}

export function resolveSiteRestoreFileSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const s =
    env.CENTER_CONTROL_SECRET?.trim() ||
    env.SITE_SYNC_TRIGGER_SECRET?.trim() ||
    env.SITE_SSO_SECRET?.trim() ||
    ""
  return s || null
}

export async function callSiteRestoreFile(
  input: SiteRestoreFileCallInput,
): Promise<SiteRestoreFileResult> {
  const base = trimSlash(input.baseUrl)
  const path = siteRestoreFilePath()
  const url = `${base}${path}`
  const timeoutMs = input.timeoutMs ?? 30_000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-unified-restore-file-secret": input.secret,
        "x-unified-sync-secret": input.secret,
        ...(input.siteCode ? { "x-site-code": input.siteCode } : {}),
      },
      body: JSON.stringify({
        ...input.payload,
        site_code: input.payload.site_code ?? input.siteCode ?? null,
        source: input.payload.source ?? "central-control",
      }),
      signal: controller.signal,
    })
    let raw: unknown = null
    try {
      raw = await res.json()
    } catch {
      raw = null
    }
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const code = typeof body.code === "number" ? body.code : res.ok ? 0 : -1
    const accepted = body.accepted === true || code === 0
    const idRaw = body.restoreFileId ?? body.id ?? body.restore_file_id ?? null
    return {
      ok: res.ok && accepted,
      httpStatus: res.status,
      code,
      accepted,
      reasonCode: (body.reasonCode as string) ?? (accepted ? null : "EXEC_FAILED"),
      message: typeof body.message === "string" ? body.message : res.statusText || "unknown",
      restoreFileId:
        typeof idRaw === "string" || typeof idRaw === "number" ? idRaw : null,
      raw,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      httpStatus: 0,
      code: -1,
      accepted: false,
      reasonCode: "NETWORK_ERROR",
      message,
      restoreFileId: null,
      raw: null,
    }
  } finally {
    clearTimeout(timer)
  }
}
