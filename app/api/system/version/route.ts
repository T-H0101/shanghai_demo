/**
 * 系统版本与更新说明
 * GET /api/system/version
 *
 * 数据源: data/version-changelog.json（人工维护，后续版本在此追加）
 */

import { readFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export type VersionChangeType = "feature" | "fix" | "improve"

export interface VersionChange {
  type: VersionChangeType
  text: string
}

export interface VersionRelease {
  version: string
  date: string
  summary: string
  changes: VersionChange[]
}

export interface VersionChangelog {
  current: string
  summary: string
  releases: VersionRelease[]
}

const FALLBACK: VersionChangelog = {
  current: "1.0.0",
  summary: "统一管控平台初始版本。",
  releases: [
    {
      version: "1.0.0",
      date: "2026-04-15",
      summary: "项目初始版本，正式启用统一管控平台。",
      changes: [],
    },
  ],
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "version-changelog.json")
    const raw = await readFile(filePath, "utf8")
    const data = JSON.parse(raw) as VersionChangelog
    if (!data?.current || !Array.isArray(data.releases)) {
      throw new Error("invalid version-changelog.json shape")
    }
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ data: FALLBACK })
  }
}
