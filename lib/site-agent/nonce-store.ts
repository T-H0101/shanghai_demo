import { transaction } from "@/lib/db"

export type ConsumeNonceResult =
  | { ok: true }
  | { ok: false; code: "UNKNOWN_SITE" | "REPLAYED_NONCE" }

export async function consumeSiteAgentNonce(
  siteCode: string,
  nonce: string
): Promise<ConsumeNonceResult> {
  return transaction(async (client) => {
    const siteResult = await client.query(
      "SELECT 1 FROM sync_sites WHERE site_code = $1",
      [siteCode]
    )
    if (siteResult.rowCount === 0) {
      return { ok: false, code: "UNKNOWN_SITE" as const }
    }

    await client.query("DELETE FROM site_agent_nonce WHERE expires_at < NOW()")
    const nonceResult = await client.query(
      `INSERT INTO site_agent_nonce(site_code, nonce, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
       ON CONFLICT DO NOTHING
       RETURNING nonce`,
      [siteCode, nonce]
    )
    if (nonceResult.rowCount === 0) {
      return { ok: false, code: "REPLAYED_NONCE" as const }
    }
    return { ok: true }
  })
}
