# 设备展示竖切跑通计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先跑通一个可演示、可刷新保持、可后续替换后端的数据闭环页面，优先选择现有 `/racks` 作为“设备/盘架展示”竖切。

**Architecture:** 不新增路由、不改 UI 风格。页面层只调用 provider，provider 层负责 mock 数据、localStorage 持久化、模拟延迟和后续真实后端替换边界。

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Tailwind CSS v4, Radix UI, localStorage, mock-provider 架构

---

## 结论

领导说的“先跑通一个页面如设备展示”，优先级应覆盖原来的 `/tasks`、`/users` P0 排序。当前建议：

| 优先级 | 范围 | 说明 |
|--------|------|------|
| P0 | `/racks` 设备/盘架展示竖切 | 先证明数据展示、操作、持久化、刷新恢复、构建验证完整闭环 |
| P1 | `/tasks`、`/users` | 操作密集，等 P0 模式稳定后复制 provider 接入方式 |
| P2 | `/sites`、Dashboard | 依赖全局统计和多模块联动，适合第二批 |
| P3 | `/logs`、`/search`、`/settings` | 查询/配置为主，最后收敛 |

“跑通”不要理解成静态前端 demo。按交付标准应包含：

- 页面可访问，列表、详情、统计、操作按钮可用。
- 数据从 provider 读，不直接 import mock 常量作为业务源。
- 操作通过 provider 写入，并同步 localStorage。
- 刷新后新增/变更状态仍保留。
- `pnpm lint`、`pnpm build` 通过。
- 本地浏览器验证 `/racks`，保留截图证据。

## Phase 0: 范围锁定

### Task 0.1: 确认 P0 页面边界

**Files:**
- Read: `app/racks/page.tsx`
- Read: `lib/api/providers.ts`
- Read: `lib/api/mock-providers.ts`
- Read: `lib/types/rack.ts`
- Read: `lib/mock/racks.ts`

- [ ] 确认 `/racks` 仍作为 P0 页面，不新增 `/devices`。
- [ ] 保留现有“盘架列表 + 盘位可视化 + 移位历史 + 导出 + 同步”界面。
- [ ] 将页面文案中的“盘架/盘位”视为当前设备展示口径，明天看完现有系统后再决定是否抽象独立设备模型。

**验收:** 不出现新路由，不重做 UI，不改 mock 数据结构。

### Task 0.2: 明确 localStorage 方案

**结论:** Phase 1 可行，但只作为 mock 后端替身，不作为真实状态管理方案。

**约束:**
- localStorage 只能在浏览器端访问，provider 必须 `typeof window !== "undefined"` 防护。
- provider 不要在模块加载时直接读 localStorage，避免 Next.js 服务端/构建阶段报错。
- 写入后派发自定义事件，让页面能在 provider 内部异步更新后刷新状态。
- localStorage key 加版本号，避免旧数据污染新结构。

建议 key：

```ts
const STORAGE_KEYS = {
  racks: "odlm:v1:racks",
  sites: "odlm:v1:sites",
  tasks: "odlm:v1:tasks",
  users: "odlm:v1:users",
  settings: "odlm:v1:settings",
} as const
```

---

## Phase 1: Provider 基础设施

### Task 1.1: 新增 mock storage 工具

**Files:**
- Create: `lib/api/mock-store.ts`
- Modify: `lib/api/mock-providers.ts`

- [ ] 创建 `lib/api/mock-store.ts`，只放通用读写、深拷贝和事件通知。

```ts
export const MOCK_STORE_EVENT = "odlm:mock-store-updated"

export function readMockStore<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return structuredClone(fallback)
  const raw = window.localStorage.getItem(key)
  if (!raw) return structuredClone(fallback)
  try {
    return JSON.parse(raw) as T
  } catch {
    window.localStorage.removeItem(key)
    return structuredClone(fallback)
  }
}

export function writeMockStore<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent(MOCK_STORE_EVENT, { detail: { key } }))
}
```

- [ ] 在 `lib/api/mock-providers.ts` 引入该工具。
- [ ] 不把 `loadFromStorage()` 暴露给页面，页面只调用 provider。

**验收:** `rg "localStorage" app/racks/page.tsx` 无结果。

### Task 1.2: 补齐 RackProvider 的可演示写入能力

**Files:**
- Modify: `lib/api/providers.ts`
- Modify: `lib/api/mock-providers.ts`

- [ ] 保留 `getAll()`、`getById()`、`getStats()`、`registerTransfer()`。
- [ ] 给 `RackProvider` 增加 `syncRacks(): Promise<Rack[]>`，用于页面“同步”按钮。
- [ ] `mockRackProvider.getAll()` 从 `odlm:v1:racks` 读取，fallback 为 `lib/mock/racks.ts`。
- [ ] `registerTransfer()` 必须更新目标 rack 的 `transferHistory`、`status`、`lastSyncAt` 并写入 localStorage。
- [ ] `registerTransfer()` 内部可用 `setTimeout` 模拟 `pending -> in_transit -> completed`，每次状态变化都写入 localStorage 并触发事件。
- [ ] `syncRacks()` 更新所有 rack 的 `lastSyncAt`，写入 localStorage 后返回最新数组。

**关键要求:** provider 返回/保存的 `TransferRecord` 使用 `lib/types/rack.ts` 中的字段：`fromSite`、`toSite`、`requestedAt`、`status: "pending" | "in_transit" | "completed" | "cancelled"`。

**验收:** 刷新页面后移位历史仍存在；同步时间刷新后仍保留。

---

## Phase 2: `/racks` 页面接入 provider

### Task 2.1: 页面初始化改为 provider 读取

**Files:**
- Modify: `app/racks/page.tsx`

- [ ] 引入 `useEffect`。
- [ ] 引入 `rackProvider` 和 `MOCK_STORE_EVENT`。
- [ ] `rackList` 初始值改为 `[]`，`selected` 初始值改为 `null`。
- [ ] 页面加载时调用 `rackProvider.getAll()` 填充列表。
- [ ] 监听 `MOCK_STORE_EVENT`，当 key 为 `odlm:v1:racks` 时重新调用 `rackProvider.getAll()`。
- [ ] 当列表刷新后，如果当前 `selected` 仍存在，更新为最新对象；否则选中第一条。

**验收:** 首次进入 `/racks` 无空引用报错，列表和详情正常显示。

### Task 2.2: 移位登记改为 provider 写入

**Files:**
- Modify: `app/racks/page.tsx`

- [ ] `handleTransfer()` 保留现有必填校验和 toast。
- [ ] 删除页面内直接 `setRackList(prev => ...)` 的业务写入逻辑。
- [ ] 调用 `rackProvider.registerTransfer()`。
- [ ] provider 写入后重新读取 `rackProvider.getAll()`。
- [ ] 保留三段式 toast，但状态来源以 provider 刷新结果为准。

**验收:**
- 提交移位登记后，详情页“移位历史”出现新记录。
- 1.2 秒左右变为“移位中”，3.2 秒左右变为“已完成”。
- 刷新页面后记录和新站点保留。

### Task 2.3: 同步按钮改为 provider 写入

**Files:**
- Modify: `app/racks/page.tsx`

- [ ] 给页面增加 `syncing` 状态。
- [ ] 点击同步按钮时调用 `rackProvider.syncRacks()`。
- [ ] 同步成功后刷新列表并 toast。
- [ ] 同步失败时 toast destructive。

**验收:** 点击同步后所有行 `lastSyncAt` 更新；刷新后时间保持。

### Task 2.4: 导出保持前端能力，但数据源改为 provider 状态

**Files:**
- Modify: `app/racks/page.tsx`

- [ ] `handleExport()` 继续用当前 `rackList` 生成文件，不新增后端导出接口。
- [ ] 导出内容包含 `rackId`、`siteName`、`siteCode`、`datacenter`、`cages`、`usedSlots`、`totalSlots`、`usagePercent`、`status`、`lastSyncAt`。

**验收:** 导出文件内容与页面当前列表一致。

---

## Phase 3: 文档和后端边界

### Task 3.1: 更新后端接入清单

**Files:**
- Modify: `docs/后端接入清单.md`

- [ ] 在盘架/设备模块标注 `/racks` 已完成 provider 接入。
- [ ] 写清后续真实后端替换点：`GET /api/racks`、`POST /api/racks/{id}/transfer`、`POST /api/racks/sync`。
- [ ] 标注当前 localStorage 只是演示持久化，不是生产存储。

### Task 3.2: 记录执行说明

**Files:**
- Modify: `docs/5.19更新文档.md` 或现有进度文档

- [ ] 记录“设备展示竖切跑通”范围。
- [ ] 记录明天看现有系统后需要补充字段映射：设备编号、设备状态、盘笼/槽位、站点、同步时间、操作日志。

---

## Phase 4: 验证

### Task 4.1: 静态检查和构建

**Commands:**

```bash
pnpm lint
pnpm build
```

**Expected:**
- `pnpm lint` 无报错。
- `pnpm build` 成功。

### Task 4.2: 浏览器验收

**Commands:**

```bash
pnpm dev
```

访问 `http://localhost:3000/racks`，执行：

- [ ] 页面加载无控制台报错。
- [ ] 列表、统计卡、详情、盘位可视化正常。
- [ ] 点击“同步”，列表时间更新，刷新后保持。
- [ ] 选择一条盘架，提交移位登记，历史记录出现。
- [ ] 等待移位状态完成，刷新后仍保留。
- [ ] 导出文件可生成。

### Task 4.3: 截图证据

**Files:**
- Create or update: `docs/screenshots/racks-provider-runable.png`（如项目已有截图目录则复用）

- [ ] 截图包含列表、详情、移位历史或同步后的时间。
- [ ] 在最终交付说明中写明验证命令和截图路径。

---

## Agent 使用计划

执行顺序按 agency-agents 能力拆分，避免同一文件多人同时改：

| 阶段 | Agent | 来源文件 | 职责 |
|------|-------|----------|------|
| 需求校准 | product-manager | `/Users/tian/Desktop/agency/agency-agents/product/product-manager.md` | 确认“跑通”定义、P0 范围、明天系统展示后需补字段 |
| 前端实现 | frontend-developer | `/Users/tian/Desktop/agency/agency-agents/engineering/engineering-frontend-developer.md` | 修改 provider、`/racks` 页面、localStorage 持久化 |
| 文档更新 | technical-writer | `/Users/tian/Desktop/agency/agency-agents/engineering/engineering-technical-writer.md` | 更新后端接入清单和进度文档 |
| 代码审查 | code-reviewer | `/Users/tian/Desktop/agency/agency-agents/engineering/engineering-code-reviewer.md` | 检查类型、状态流、未破坏 UI、无真实后端接入 |
| 测试分析 | test-results-analyzer | `/Users/tian/Desktop/agency/agency-agents/testing/testing-test-results-analyzer.md` | 分析 `pnpm lint`、`pnpm build` 输出 |
| 体验验收 | reality-checker | `/Users/tian/Desktop/agency/agency-agents/testing/testing-reality-checker.md` | 按验收清单确认页面真的可操作 |
| 证据收集 | evidence-collector | `/Users/tian/Desktop/agency/agency-agents/testing/testing-evidence-collector.md` | 采集 `/racks` 截图和简短证据说明 |

推荐调度：

```ts
Agent({
  subagent_type: "product-manager",
  prompt: "基于 docs/superpowers/plans/2026-05-20-all-pages-runable.md，确认 P0 只做 /racks 设备/盘架展示竖切；输出不超过 10 条验收口径，不改代码。"
})

Agent({
  subagent_type: "frontend-developer",
  prompt: "按 docs/superpowers/plans/2026-05-20-all-pages-runable.md 的 Phase 1-2 实现 /racks provider 接入。只改 lib/api/mock-store.ts、lib/api/providers.ts、lib/api/mock-providers.ts、app/racks/page.tsx；不要改 UI 风格，不新增路由，不接真实后端。"
})

Agent({
  subagent_type: "technical-writer",
  prompt: "按 docs/superpowers/plans/2026-05-20-all-pages-runable.md 的 Phase 3 更新 docs/后端接入清单.md 和进度文档；说明 localStorage 是 mock 演示持久化，真实后端待明天系统展示后映射字段。"
})

Agent({
  subagent_type: "code-reviewer",
  prompt: "审查 /racks provider 接入改动，重点检查：页面是否仍直接写 mock 状态、provider 是否浏览器安全、TransferRecord 类型是否一致、localStorage key 是否版本化、是否违反禁止重构 UI/接真实后端。"
})

Agent({
  subagent_type: "test-results-analyzer",
  prompt: "运行 pnpm lint 和 pnpm build，分析失败原因并给出最小修复建议；不要扩大重构范围。"
})

Agent({
  subagent_type: "reality-checker",
  prompt: "启动 pnpm dev 后验收 http://localhost:3000/racks：加载、同步、移位登记、刷新保持、导出。输出通过/失败清单和复现步骤。"
})

Agent({
  subagent_type: "evidence-collector",
  prompt: "在 /racks 通过验收后截图，保存到 docs/screenshots/racks-provider-runable.png，并记录截图覆盖的状态。"
})
```

---

## 暂缓事项

- 暂不批量改 `/tasks`、`/users`、`/sites`、Dashboard，避免一个页面没跑通前扩散问题。
- 暂不新增设备模型和 `/devices` 路由，等明天现有系统展示后再决定。
- 暂不接真实后端；本轮只把 provider 边界做实，方便后续替换。
