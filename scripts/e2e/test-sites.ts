/**
 * Sites 事件测试 - Sprint R.5 占位
 *
 * 测试项 (待 R.5+ 实施):
 *   - /api/sites 真实读 + 派生 fallback (R.4 修复)
 *   - siteCode 切换 (Header 联动 8 端点)
 *   - 必测 10 项 (frontend-event-test-standard.md §1.1)
 *
 * R.5 占位: 详见 docs/database-analysis/frontend-event-test-standard.md
 */
var BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function test_sites_placeholder() {
  console.log("⚠️ R.5 占位 - Sites e2e 脚本待 R.5+ 实施")
  console.log("   必测 10 项: 详见 frontend-event-test-standard.md §1.1")
}

test_sites_placeholder().catch((err) => {
  console.error("❌ test failed:", err)
  process.exit(1)
})
