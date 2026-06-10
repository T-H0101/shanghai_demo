# scripts/e2e/ — Frontend Event E2E 测试目录 (R.5 占位)

> **Sprint**: R.5 落地 (2026-06-10)
> **依据**: `docs/database-analysis/frontend-event-test-standard.md`
> **状态**: ⚠️ R.5 仅占位, **R.5 不实现具体脚本** (避免范围蔓延)
> **后续**: 任何 Sprint 涉及前端/事件时, 必须按缺口清单实现对应脚本

---

## 0. 当前 R.5 占位文件

| 文件 | 状态 | 落地 Sprint |
|---|---|---|
| `test-dashboard.ts` | ⚠️ 占位 | R.5+ (1d) |
| `test-tasks.ts` | ⚠️ 占位 | R.5+ (2d) |
| `test-sync.ts` | ⚠️ 占位 | R.5+ (1d) |
| `test-control.ts` | ⚠️ 占位 | R.5+ (1.5d) |
| `test-sites.ts` | ⚠️ 占位 | R.5+ (1d) |
| `test-search.ts` | ⚠️ 占位 | R.5+ (0.5d) |

**合计 ~10 人天**, 0 阻塞, 全部可自主推进。

---

## 1. 后续 Sprint 实施顺序 (建议)

| 优先级 | Sprint | 任务 |
|---|---|---|
| P0 | 涉及前端按钮的下一个 Sprint | 实施 `test-tasks.ts` + `test-control.ts` (核心 2 项) |
| P1 | 涉及 Dashboard 优化时 | 实施 `test-dashboard.ts` |
| P1 | 涉及同步链路修复时 | 实施 `test-sync.ts` |
| P2 | 涉及站点切换优化时 | 实施 `test-sites.ts` |
| P2 | 涉及搜索功能时 | 实施 `test-search.ts` |
| P3 | R.6+ | 引入 Playwright 浏览器截图 |

---

## 2. 占位脚本模板

```ts
// scripts/e2e/test-<page>.ts
/**
 * <Page> 事件测试 - Sprint R.X 落地
 *
 * 测试项:
 *   - 必测 10 项 (frontend-event-test-standard.md §1.1)
 *   - 数据源: 真实 DB (unified_*) + docker exec psql 验证
 *   - 不 mock, 不 fallback (R.1 §7)
 *
 * R.5 占位: 后续 Sprint 按需实现
 */
import { strict as assert } from "node:assert"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"

async function test_placeholder() {
  console.log("⚠️ Sprint R.5 占位 - 后续 Sprint 涉及此页面时实施")
  console.log(`   必测 10 项: 详见 frontend-event-test-standard.md §1.1`)
  console.log(`   触发条件: ${BASE} dev server 已启动`)
}

test_placeholder().catch((err) => {
  console.error("❌ test failed:", err)
  process.exit(1)
})
```

---

## 3. package.json scripts 占位 (R.5 已加)

```json
{
  "scripts": {
    "e2e:dashboard": "tsx scripts/e2e/test-dashboard.ts",
    "e2e:tasks": "tsx scripts/e2e/test-tasks.ts",
    "e2e:sync": "tsx scripts/e2e/test-sync.ts",
    "e2e:control": "tsx scripts/e2e/test-control.ts",
    "e2e:sites": "tsx scripts/e2e/test-sites.ts",
    "e2e:search": "tsx scripts/e2e/test-search.ts",
    "e2e:all": "pnpm e2e:dashboard && pnpm e2e:tasks && pnpm e2e:sync && pnpm e2e:control && pnpm e2e:sites && pnpm e2e:search"
  }
}
```

**R.5 占位**: scripts 已加, 实际脚本待后续 Sprint。

---

## 4. 与 R.4 e2e:worker 区别

| 维度 | R.4 e2e:worker | R.5+ scripts/e2e/* |
|---|---|---|
| 范围 | Site Worker DRY_RUN 链路 | 前端 + API + DB 端到端 |
| 触发器 | `pnpm test:e2e:worker` (bash) | `pnpm e2e:<page>` (tsx) |
| 浏览器 | ❌ 无 | R.6+ Playwright |
| 失败处理 | bash `set -e` | tsx `process.exit(1)` |
| 适配场景 | 控制命令链路 (R.4 已验) | 6 类前端事件 (R.5 待补) |

---

## 5. 强制规范 (后续 Sprint)

后续任何 Sprint 涉及前端/事件时:

1. **复制占位模板** → 实施具体测试
2. **接入 `pnpm e2e:<page>`** → 写 README 加一行
3. **CLAUDE.md §10 强约束自检** → 9 项 (A-I) 必填
4. **CI 集成 (R.6+ 考虑)** → 失败不允许 merge

---

## 6. 总结

- ✅ 6 个占位脚本模板已建 (R.5)
- ✅ package.json scripts 占位已加 (R.5)
- ✅ 与 R.4 e2e:worker 互补 (链路 vs 端到端)
- ✅ 缺口清单明确, 后续 Sprint 按需实施
- ⚠️ R.5 范围严格: 0 业务代码, 仅占位
