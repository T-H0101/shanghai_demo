import assert from "node:assert/strict"
import { resolveTaskCreateNavigation } from "../../lib/site-navigation/task-create"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"

async function main() {
  assert.deepEqual(resolveTaskCreateNavigation("SH01", {}), {
    siteCode: "SH01",
    envKeyRef: "SITE_NODE_TASK_CREATE_URL_SH01",
    configured: false,
    url: null,
    reason: "node_task_create_url_not_configured",
  })

  assert.equal(
    resolveTaskCreateNavigation("SH01", {
      SITE_NODE_TASK_CREATE_URL_SH01: "https://sh01.internal/tasks/create",
    }).url,
    "https://sh01.internal/tasks/create"
  )

  assert.throws(
    () =>
      resolveTaskCreateNavigation("SH01", {
        SITE_NODE_TASK_CREATE_URL_SH01: "javascript:alert(1)",
      }),
    /http or https/
  )
  assert.throws(() => resolveTaskCreateNavigation("../SH01", {}), /invalid siteCode/)

  const response = await fetch(
    `${BASE_URL}/api/site-navigation/task-create?siteCode=SH01`
  )
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.code, 0)
  assert.equal(body.data.configured, false)
  assert.equal(body.data.url, null)
  assert.equal(body.data.envKeyRef, "SITE_NODE_TASK_CREATE_URL_SH01")

  console.log("R.19D task navigation: PASS")
}

main().catch((error) => {
  console.error("R.19D task navigation: FAIL", error)
  process.exit(1)
})
