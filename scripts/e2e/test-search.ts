/**
 * Search 事件测试 - Sprint R.5 占位
 *
 * 测试项 (待 R.5+ 实施):
 *   - /api/search 显式 not_implemented 路由 (R.4 修复)
 *   - UI blocker banner 显示 (R.4 修复)
 *   - ES/ClickHouse blocked_by_external_system
 *   - 必测 10 项 (frontend-event-test-standard.md §1.1)
 *
 * R.5 占位: 详见 docs/database-analysis/frontend-event-test-standard.md
 */
var BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function test_search_placeholder() {
  console.log("⚠️ R.5 占位 - Search e2e 脚本待 R.5+ 实施")
  console.log("   必测 10 项: 详见 frontend-event-test-standard.md §1.1")
}

test_search_placeholder().catch((err) => {
  console.error("❌ test failed:", err)
  process.exit(1)
})
