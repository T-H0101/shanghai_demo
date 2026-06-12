import { execFileSync, execSync } from "node:child_process"
import { readFileSync } from "node:fs"

const SITE = "SH01"
const AGENT_ID = "e2e-site-agent-client"
const AGENT_VERSION = "r19b-e2e"
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

async function main() {
  console.log("=== R.19B standalone Site Agent client e2e ===\n")

  if (!process.env.SITE_DATABASE_URL) {
    throw new Error("SITE_DATABASE_URL is required")
  }
  if (!SECRET) {
    throw new Error("SITE_AGENT_SECRET or SYNC_PACKAGE_SECRET is required")
  }

  const output = execFileSync(
    "pnpm",
    ["agent:site", "--", "--once"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SITE_CODE: SITE,
        SITE_AGENT_ID: AGENT_ID,
        SITE_AGENT_VERSION: AGENT_VERSION,
        PLATFORM_URL: process.env.BASE_URL ?? "http://localhost:3000",
        SITE_AGENT_HEARTBEAT_INTERVAL_MS: "300000",
      },
      encoding: "utf8",
      timeout: 30_000,
    }
  )

  check("agent process exits successfully", output.includes('"event":"heartbeat_recorded"'), "heartbeat_recorded")
  check(
    "agent logs safe env key refs",
    output.includes('"siteDatabaseUrlKeyRef":"SITE_DATABASE_URL"') &&
      output.includes('"agentSecretKeyRef":"SITE_AGENT_SECRET"'),
    "env refs present"
  )
  check(
    "agent logs exclude secret value",
    !output.includes(SECRET),
    "secret not printed"
  )
  check(
    "agent does not claim control capability",
    output.includes('"task_pause":{"supported":false') &&
      output.includes('"task_resume":{"supported":false'),
    "control remains unsupported"
  )

  const dbRow = execSync(
    `docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -tA -c "SELECT site_code || '|' || agent_id || '|' || agent_version || '|' || database_reachable FROM site_agent_runtime WHERE site_code='${SITE}';"`,
    { encoding: "utf8" }
  ).trim()
  check(
    "standalone agent heartbeat persisted",
    dbRow === `${SITE}|${AGENT_ID}|${AGENT_VERSION}|true`,
    dbRow || "missing"
  )

  const service = readFileSync(
    "deploy/site-agent/unified-disc-site-agent.service",
    "utf8"
  )
  const envExample = readFileSync(
    "deploy/site-agent/site-agent.env.example",
    "utf8"
  )
  check(
    "systemd service restarts independent agent",
    service.includes("EnvironmentFile=/etc/unified-disc-site-agent.env") &&
      service.includes("ExecStart=/usr/bin/pnpm agent:site") &&
      service.includes("Restart=always"),
    "environment file + restart policy"
  )
  check(
    "deployment template contains no secret values",
    envExample.includes("SITE_DATABASE_URL=") &&
      envExample.includes("SITE_AGENT_SECRET=") &&
      !envExample.match(/postgres(ql)?:\/\/.+:.+@/) &&
      !envExample.match(/SITE_AGENT_SECRET=.+/),
    "blank secret fields"
  )

  console.log(`\n=== R.19B Site Agent client: ${pass} pass, ${fail} fail ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("❌ R.19B e2e crashed:", error)
  process.exit(1)
})
