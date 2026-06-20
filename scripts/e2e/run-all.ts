import { spawn, spawnSync, type ChildProcess } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const HEALTH_URL = `${BASE_URL}/api/system/health`

const scripts = [
  "e2e:dashboard",
  "e2e:tasks",
  "e2e:sync",
  "e2e:control",
  "e2e:sites",
  "e2e:search",
  "e2e:settings",
  "e2e:auth",
  "e2e:auth-audit",
  "e2e:rbac",
  "e2e:users",
  "e2e:racks",
  "e2e:volumes",
  "e2e:logs",
  "e2e:exports",
  "e2e:r16-control-loop",
  "e2e:r16-postreview",
  "e2e:site-agent",
  "e2e:site-agent-client",
  "e2e:site-agent-sync-core",
  "e2e:site-agent-sync",
  "e2e:site-agent-control-core",
  "e2e:site-agent-control",
  "e2e:task-navigation",
  "e2e:frontend-integration",
  "e2e:floating-assistant",
  "e2e:full-audit",
  "e2e:console-usability-lift",
  "e2e:header-ux-lift",
  "e2e:command-center",
  "e2e:compat",
  "e2e:concurrency",
  "e2e:task-monitor",
  "e2e:roadmap-25",
  "e2e:route-page-integration",
]

function loadEnvLocal() {
  const envPath = ".env.local"
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#") || !line.includes("=")) continue
    const idx = line.indexOf("=")
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (!key || process.env[key] !== undefined) continue
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

async function healthOk(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { cache: "no-store" })
    return res.ok
  } catch {
    return false
  }
}

function startDevServer(): ChildProcess {
  const env = { ...process.env }
  // Let Next.js load .env.local itself. A sourced shell can override DB URLs with
  // values intended for CLI scripts and make the dev server point at the wrong DB.
  delete env.DATABASE_URL
  delete env.SOURCE_DATABASE_URL
  delete env.SITE_DATABASE_URL

  const child = spawn("pnpm", ["dev"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout?.on("data", (buf) => process.stdout.write(`[dev] ${buf}`))
  child.stderr?.on("data", (buf) => process.stderr.write(`[dev] ${buf}`))
  return child
}

async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await healthOk()) return true
    await new Promise((resolve) => setTimeout(resolve, 750))
  }
  return false
}

async function main() {
  loadEnvLocal()
  console.log(`=== e2e:all preflight ===`)
  console.log(`BASE_URL=${BASE_URL}`)

  let dev: ChildProcess | null = null
  if (!(await healthOk())) {
    console.log("Dev server is not healthy; starting pnpm dev for e2e.")
    dev = startDevServer()
    const ready = await waitForHealth(45_000)
    if (!ready) {
      dev.kill("SIGTERM")
      throw new Error(`Dev server did not become healthy at ${HEALTH_URL}`)
    }
  } else {
    console.log("Existing dev server is healthy.")
  }

  const startedAt = Date.now()
  try {
    for (const script of scripts) {
      console.log(`\n=== ${script} ===`)
      const result = spawnSync("pnpm", [script], {
        stdio: "inherit",
        env: process.env,
      })
      if (result.status !== 0) {
        throw new Error(`${script} failed with exit code ${result.status}`)
      }
    }
    const seconds = Math.round((Date.now() - startedAt) / 1000)
    console.log(`\n=== e2e:all passed (${scripts.length} scripts, ${seconds}s) ===`)
  } finally {
    if (dev && !dev.killed) {
      dev.kill("SIGTERM")
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
