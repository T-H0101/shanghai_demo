/**
 * Dashboard 事件测试 - Sprint R.5 占位
 *
 * 测试项 (待 R.5+ 实施):
 *   - 6 tile 真实性 (tasks / devices / volumes / users / packages / lastSync)
 *   - /api/dashboard/summary + /api/dashboard/recent-syncs + /api/alerts
 *   - siteCode 过滤
 *   - mock/fallback 检查
 *
 * R.5 占位: 详见 docs/database-analysis/frontend-event-test-standard.md
 */
var BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function test_dashboard_placeholder() {
  console.log("⚠️ R.5 占位 - Dashboard e2e 脚本待 R.5+ 实施")
  console.log(`   必测 10 项: 详见 frontend-event-test-standard.md §1.1`)
}

test_dashboard_placeholder().catch((err) => {
  console.error("❌ test failed:", err)
  process.exit(1)
})
