import { createHash, createHmac, randomBytes } from "node:crypto"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const SITE = process.env.SITE_CODE ?? "SH01"
const SECRET = process.env.SITE_AGENT_SECRET ?? process.env.SYNC_PACKAGE_SECRET

let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail: string) {
  if (ok) {
    pass++
    console.log(`  ✅ ${name}: ${detail}`)
  } else {
    fail++
    console.log(`  ❌ ${name}: ${detail}`)
  }
}

function signedHeaders(
  rawBody: string,
  nonce = randomBytes(8).toString("hex"),
  timestamp = String(Date.now()),
  siteCode = SITE
) {
  if (!SECRET) throw new Error("SITE_AGENT_SECRET or SYNC_PACKAGE_SECRET is required")
  const path = "/api/site-agent/heartbeat"
  const bodyHash = createHash("sha256").update(rawBody).digest("hex")
  const signingString = [siteCode, timestamp, nonce, "POST", path, bodyHash].join("\n")
  const signature = createHmac("sha256", SECRET).update(signingString).digest("hex")
  return {
    "content-type": "application/json",
    "x-site-code": siteCode,
    "x-agent-timestamp": timestamp,
    "x-agent-nonce": nonce,
    "x-agent-signature": signature,
  }
}

async function main() {
  console.log("=== R.19A Site Agent heartbeat e2e ===\n")

  const { getSiteAgentConfigView } = await import("../../lib/site-agent/config")
  const configView = getSiteAgentConfigView()
  const configJson = JSON.stringify(configView).toLowerCase()
  check(
    "agent config exposes env refs only",
    configView.siteDatabaseUrlKeyRef === "SITE_DATABASE_URL" &&
      configView.agentSecretKeyRef === "SITE_AGENT_SECRET" &&
      !configJson.includes(process.env.SITE_AGENT_SECRET?.toLowerCase() ?? "__missing__"),
    `${configView.siteDatabaseUrlKeyRef}/${configView.agentSecretKeyRef}`
  )

  const body = {
    siteCode: SITE,
    agentId: "e2e-agent-sh01",
    agentVersion: "r19a-e2e",
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    reportedAt: new Date().toISOString(),
    databaseReachable: true,
    lastSyncAt: null,
    lastControlAt: null,
    spoolDepth: 0,
    capabilities: {
      task_pause: { supported: true, adapter: "postgres", evidence: "tbl_task.status=20" },
      task_resume: { supported: true, adapter: "postgres", evidence: "tbl_task.status=0" },
      task_reset: { supported: false, blocker: "official_semantics_missing" },
    },
  }
  const rawBody = JSON.stringify(body)

  const unsigned = await fetch(`${BASE}/api/site-agent/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody,
  })
  check("unsigned heartbeat rejected", unsigned.status === 401, `HTTP ${unsigned.status}`)

  const expired = await fetch(`${BASE}/api/site-agent/heartbeat`, {
    method: "POST",
    headers: signedHeaders(
      rawBody,
      randomBytes(8).toString("hex"),
      String(Date.now() - 10 * 60_000)
    ),
    body: rawBody,
  })
  check("expired heartbeat rejected", expired.status === 401, `HTTP ${expired.status}`)

  const tamperedHeaders = signedHeaders(rawBody)
  tamperedHeaders["x-agent-signature"] = "0".repeat(64)
  const tampered = await fetch(`${BASE}/api/site-agent/heartbeat`, {
    method: "POST",
    headers: tamperedHeaders,
    body: rawBody,
  })
  check("tampered signature rejected", tampered.status === 401, `HTTP ${tampered.status}`)

  const unsafeRawBody = JSON.stringify({
    ...body,
    agentVersion: "unsafe-payload",
    capabilities: { task_pause: { supported: true, secretValue: "must-not-store" } },
  })
  const unsafe = await fetch(`${BASE}/api/site-agent/heartbeat`, {
    method: "POST",
    headers: signedHeaders(unsafeRawBody),
    body: unsafeRawBody,
  })
  check("secret-like capability rejected", unsafe.status === 400, `HTTP ${unsafe.status}`)

  const unknownSiteCode = "R19_UNKNOWN"
  execSync(
    `docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "DELETE FROM site_agent_nonce WHERE site_code='${unknownSiteCode}'; DELETE FROM site_agent_runtime WHERE site_code='${unknownSiteCode}';"`,
    { stdio: "ignore" }
  )
  const unknownSiteBody = JSON.stringify({ ...body, siteCode: unknownSiteCode })
  const unknownSite = await fetch(`${BASE}/api/site-agent/heartbeat`, {
    method: "POST",
    headers: signedHeaders(
      unknownSiteBody,
      randomBytes(8).toString("hex"),
      String(Date.now()),
      unknownSiteCode
    ),
    body: unknownSiteBody,
  })
  check("unregistered site rejected", unknownSite.status === 404, `HTTP ${unknownSite.status}`)
  const unknownRows = execSync(
    `docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -tA -c "SELECT COUNT(*) FROM site_agent_runtime WHERE site_code='${unknownSiteCode}';"`,
    { encoding: "utf8" }
  ).trim()
  check("unregistered site leaves no runtime row", unknownRows === "0", `rows=${unknownRows}`)

  const nonce = randomBytes(8).toString("hex")
  const headers = signedHeaders(rawBody, nonce)
  const signed = await fetch(`${BASE}/api/site-agent/heartbeat`, {
    method: "POST",
    headers,
    body: rawBody,
  })
  const signedJson = await signed.json().catch(() => ({}))
  check("signed heartbeat accepted", signed.status === 200, `HTTP ${signed.status}`)
  check("response identifies database source", signedJson.dataSource === "site_agent_runtime", `source=${signedJson.dataSource}`)

  const replay = await fetch(`${BASE}/api/site-agent/heartbeat`, {
    method: "POST",
    headers,
    body: rawBody,
  })
  check("replayed nonce rejected", replay.status === 409, `HTTP ${replay.status}`)

  const dbRow = execSync(
    `docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -tA -c "SELECT site_code || '|' || agent_id || '|' || agent_version || '|' || database_reachable || '|' || spool_depth FROM site_agent_runtime WHERE site_code='${SITE}';"`,
    { encoding: "utf8" }
  ).trim()
  check("heartbeat persisted", dbRow === `${SITE}|e2e-agent-sh01|r19a-e2e|true|0`, dbRow || "missing")

  const secretScan = execSync(
    `docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -tA -c "SELECT COALESCE(runtime_json::text,'') FROM site_agent_runtime WHERE site_code='${SITE}';"`,
    { encoding: "utf8" }
  ).toLowerCase()
  check(
    "runtime row excludes secrets",
    !secretScan.includes("password") && !secretScan.includes("database_url") && !secretScan.includes("secret"),
    "no secret fields"
  )

  const statusRes = await fetch(`${BASE}/api/sync/sites/status`)
  const statusJson = await statusRes.json()
  const site = statusJson?.data?.items?.find((item: { siteCode: string }) => item.siteCode === SITE)
  check("site status exposes agent runtime", site?.agentStatus === "online", `agentStatus=${site?.agentStatus}`)
  check("site status exposes safe agent version", site?.agentVersion === "r19a-e2e", `version=${site?.agentVersion}`)
  check("site status exposes database reachability", site?.agentDatabaseReachable === true, `reachable=${site?.agentDatabaseReachable}`)
  const unregistered = statusJson?.data?.items?.find(
    (item: { siteCode: string; agentStatus: string }) =>
      item.siteCode !== SITE && item.agentStatus === "not_registered"
  )
  check("site without heartbeat is not fake-online", Boolean(unregistered), unregistered?.siteCode ?? "missing")

  const syncPage = readFileSync("app/sync/page.tsx", "utf8")
  check(
    "sync center renders agent runtime",
    syncPage.includes('data-testid={`site-agent-status-${item.siteCode}`}') &&
      syncPage.includes("item.agentVersion"),
    "site-agent-status selector + version"
  )

  console.log(`\n=== R.19A Site Agent heartbeat: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("❌ R.19A e2e crashed:", error)
  process.exit(1)
})
