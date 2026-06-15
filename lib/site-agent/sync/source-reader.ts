import { Client } from "pg"
import {
  ALLOWED_PACKAGE_TABLES,
  type AllowedPackageTable,
} from "../../sync/package-schema"
import type { TaskWatermark } from "./types"

const ALLOWED_TABLE_SET = new Set<string>(ALLOWED_PACKAGE_TABLES)

function assertAllowedTable(
  tableName: string
): asserts tableName is AllowedPackageTable {
  if (!ALLOWED_TABLE_SET.has(tableName)) {
    throw new Error(`source table is not allowed: ${tableName}`)
  }
}

export class PgSiteSourceReader {
  readonly allowedTables = [...ALLOWED_PACKAGE_TABLES]
  private client: Client | null = null

  constructor(private readonly connectionString: string) {}

  async connect(): Promise<void> {
    if (this.client) return
    const client = new Client({
      connectionString: this.connectionString,
      connectionTimeoutMillis: 5_000,
    })
    await client.connect()
    this.client = client
  }

  async close(): Promise<void> {
    const client = this.client
    this.client = null
    if (client) await client.end()
  }

  async readSnapshot(
    tableName: AllowedPackageTable
  ): Promise<Record<string, unknown>[]> {
    assertAllowedTable(tableName)
    const result = await this.getClient().query<Record<string, unknown>>(
      `SELECT * FROM ${tableName}`
    )
    return result.rows
  }

  async readTaskChanges(
    watermark: TaskWatermark | null,
    overlapMs: number
  ): Promise<Record<string, unknown>[]> {
    if (!watermark) return this.readSnapshot("tbl_task")
    if (!Number.isInteger(overlapMs) || overlapMs < 0) {
      throw new Error("overlapMs must be a non-negative integer")
    }

    const overlapStart = watermark.maxUpdateDt
      ? new Date(
          new Date(watermark.maxUpdateDt).getTime() - overlapMs
        ).toISOString()
      : null
    const result = await this.getClient().query<Record<string, unknown>>(
      `SELECT *
       FROM tbl_task
       WHERE id > $1::bigint
          OR ($2::timestamptz IS NOT NULL AND update_dt >= $2::timestamptz)
       ORDER BY COALESCE(update_dt, create_dt), id`,
      [watermark.maxId, overlapStart]
    )
    return result.rows
  }

  private getClient(): Client {
    if (!this.client) {
      throw new Error("site source reader is not connected")
    }
    return this.client
  }
}
