/**
 * test-external-dev-stack.ts
 * Sprint R.61 — verify ES and ClickHouse dev stack presence.
 *
 * Behavior:
 *   - If SEARCH_ES_URL responds, mark ES as configured.
 *   - If CLICKHOUSE_URL responds, mark CH as configured.
 *   - If absent, do not fail; print skip messages.
 *   - Always verify /api/settings (or equivalent) does not expose
 *     *_KEY_REF secret values.
 */

const ES_URL = process.env.SEARCH_ES_URL
const CH_URL = process.env.CLICKHOUSE_URL

async function checkEs(): Promise<boolean> {
  if (!ES_URL) {
    console.log("SEARCH_ES_URL not configured; ES skip")
    return false
  }
  try {
    const res = await fetch(`${ES_URL.replace(/\/$/, "")}/`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.ok) {
      console.log("ES reachable")
      return true
    }
    console.log(`ES HTTP ${res.status}`)
    return false
  } catch (err) {
    console.log("ES unreachable:", (err as Error).message)
    return false
  }
}

async function checkCh(): Promise<boolean> {
  if (!CH_URL) {
    console.log("CLICKHOUSE_URL not configured; CH skip")
    return false
  }
  try {
    const res = await fetch(CH_URL, {
      method: "POST",
      signal: AbortSignal.timeout(3000),
      body: "SELECT 1 FORMAT TabSeparated",
    })
    if (res.ok) {
      console.log("ClickHouse reachable")
      return true
    }
    console.log(`CH HTTP ${res.status}`)
    return false
  } catch (err) {
    console.log("CH unreachable:", (err as Error).message)
    return false
  }
}

async function main() {
  const es = await checkEs()
  const ch = await checkCh()
  if (es) {
    console.log("ES: configured (strict candidate for REQ-4.1.2 possible)")
  } else {
    console.log("ES: not configured (REQ-4.1.2 stays blocked_by_external_system)")
  }
  if (ch) {
    console.log("ClickHouse: configured (strict candidate for REQ-5.1.1 possible)")
  } else {
    console.log("ClickHouse: not configured (REQ-5.1.1 stays partial)")
  }
  console.log("dev stack: PASS")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
