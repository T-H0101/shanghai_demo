/**
 * Install Site Agent env to /etc with CR/LF normalization.
 *
 * Usage (on site server):
 *   sudo ./node/node node_modules/tsx/dist/cli.mjs bs/install-site-agent-env.ts bs/unified-disc-site-agent.env
 *
 * Why TS instead of bash: CRLF in .sh breaks bash on Linux; tsx runs fine and we strip \r from env values.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const DEST = "/etc/unified-disc-site-agent.env"

function normalizeEnvText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n+$/g, "\n")
}

function main(): void {
  if (process.getuid?.() !== 0) {
    console.error("Run as root: sudo ./node/node node_modules/tsx/dist/cli.mjs bs/install-site-agent-env.ts <env-file>")
    process.exit(1)
  }

  const srcArg = process.argv[2] ?? "bs/unified-disc-site-agent.env"
  const src = resolve(process.cwd(), srcArg)

  if (!existsSync(src)) {
    console.error(`Source env not found: ${src}`)
    process.exit(1)
  }

  const raw = readFileSync(src, "utf8")
  const normalized = normalizeEnvText(raw)

  if (normalized.includes("\r")) {
    console.error("CR still present after normalize; aborting")
    process.exit(1)
  }

  writeFileSync(DEST, normalized, { encoding: "utf8", mode: 0o600 })

  console.log(`Installed: ${DEST} (mode 600, CR stripped from ${srcArg})`)
  console.log("Verify (line ends must show $ only, not ^M$):")
  for (const line of normalized.split("\n").slice(0, 3)) {
    if (line.length > 0) console.log(line.replace(/ /g, "·") + "$")
  }
}

main()
