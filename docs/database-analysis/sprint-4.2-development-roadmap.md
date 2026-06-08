# Sprint 4.2-D — 下一阶段开发路线图 (4.3 ~ 4.8 + 后续)

> **状态**: ✅ 完成 (设计稿, 不写代码)
> 制定时间: 2026-06-08
> 领导口径: 每小时同步, DB-Sync 模式, 严格按 requirements.md
> 关联: Sprint 4.0/4.1/4.2-A/4.2-C

---

## 1. 路线总览

| Sprint | 主题 | 独立可做? | 估时 | 阻塞 |
|---|---|---|---|---|
| **4.3** | 站点范围与备份恢复文档收口 | ✅ 100% | 0.5d | 0 |
| **4.4** | 每小时同步调度器/cron 方案 | ⚠️ 80% | 2d | 0 (设计稿完成, 部署需生产) |
| **4.5** | 控制队列表结构 + 写/读 API | ✅ 100% | 3d | 0 (站点 pull 需站点配合) |
| **4.6** | TaskControlProvider 抽象 + 9 thin API | ✅ 100% | 2d | 0 |
| **4.7** | SSO 跳转入口占位 | ✅ 100% | 1d | 0 (跳转 URL 配置需站点配合) |
| **4.8** | 巡检/恢复/优先控制方案 (方案 2 落地) | ⚠️ 60% | 4d | 站点需开发 pull-control |
| **后续 5.x** | ADFS/JWT/RBAC/审计 (解锁 CLAUDE.md 后) | ❌ | 18d | 需 Auth 解锁 |
| **后续 6.x** | 真实源端接入 + 性能/安全/可维护 | ⚠️ 50% | 15-20d | 需站点真实 push + 生产环境 |

**总计可独立做**: 4.3 + 4.5 + 4.6 + 4.7 = **6.5 人天**
**总计含站点**: 4.4 + 4.8 = **+ 6 人天** (站点同步开发)
**总计含解锁**: + 5.x = **+ 24 人天**

---

## 2. Sprint 4.3 — 站点范围与备份恢复文档收口

| 项 | 说明 |
|---|---|
| **目标** | 收口 Sprint 4.2-A 发现的真相, 写入正式文档, 让新人/客户/上级能快速理解 |
| **独立完成?** | ✅ 是 |
| **风险** | 低 (文档工作) |
| **工期** | 0.5d |

**交付**:
- `docs/source/site-backup-recovery-guide.md` — 站点 PG 备份恢复指南 (Mac/Docker 模拟)
- `docs/source/source-restore-vs-star-storage-db.md` — source_restore 与 star_storage_db 对照
- 更新 `README.md` 顶部加"源端数据范围" 说明
- 更新 `CLAUDE.md` 加"13 张白名单 ≠ 源端全集" 警告

**关键内容**:
- 170 张源端表 / 13 张白名单 / 比例 7.6%
- star_storage_db 启动流程 (Mac/Docker)
- 单站点 vs 多站点判定 (待领导确认)
- 数据真实性分级 (A/B/C)

---

## 3. Sprint 4.4 — 每小时同步调度器/cron 方案

| 项 | 说明 |
|---|---|
| **目标** | 把当前手动 `pnpm export-and-push` 升级为每小时自动, 含生产部署方案 |
| **独立完成?** | ⚠️ 设计稿 100%, 部署需生产环境 |
| **风险** | 中 (cron 错时可能数据重复, 需幂等) |
| **工期** | 2d |

**交付**:
- `scripts/scheduler/hourly-sync.ts` — 总控侧的"被动接收" 不变, 站点侧需 cron
- `docs/operations/hourly-sync-deployment.md` — Linux cron / systemd timer / k8s CronJob 三种方案
- `scripts/sync-consistency-check.ts` — 总控侧每天 1 次对账, 写 `unified_sync_diff_log`
- 幂等性测试: 同一 batchId 推送 2 次, 应只算 1 次 (`findPackageByBatch` 已做)

**Mac/Docker 开发环境如何模拟**:
```bash
# 启一个 loop, 每 5 分钟跑一次 (开发用, 不是 1h)
while true; do pnpm export-and-push SH01; sleep 300; done

# 或用 launchd (Mac)
~/Library/LaunchAgents/com.unified.hourly-sync.plist
```

---

## 4. Sprint 4.5 — 控制队列表结构 + 写/读 API

| 项 | 说明 |
|---|---|
| **目标** | 实现 Sprint 4.2-C 方案 2 的骨架: `unified_control_command` 表 + 总控写 API + 站点读 API |
| **独立完成?** | ✅ 是 (写 API 100% 项目内, 站点读需站点配合) |
| **风险** | 中 (新表 + 新 API, 需考虑并发) |
| **工期** | 3d |

**交付**:
- SQL: `databases/sprint-4.5/unified-control-command.sql` (13 字段)
- `app/api/control/commands/route.ts` — POST 写 / GET 读 (HMAC)
- `app/api/control/ack/route.ts` — 站点 ack 反馈
- `lib/control/command-queue.ts` — 命令队列封装
- 集成到 `app/control-center/page.tsx` (新页面, 控制命令列表 + 状态)
- 前端按钮接入: Tasks 详情页加"暂停" "恢复" "重置" 按钮, 点击 → POST command
- 写同步包日志: `unified_control_command` 的 status 变化写 `sync_table_log`

**字段 (沿用 Sprint 4.1 设计)**:
```sql
CREATE TABLE unified_control_command (
  id BIGSERIAL PRIMARY KEY,
  site_code VARCHAR(32) NOT NULL,
  action VARCHAR(32) NOT NULL,
  target_type VARCHAR(16) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(16) DEFAULT 'pending',
  created_by VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  result JSONB,
  error_code VARCHAR(32),
  error_message TEXT,
  trace_id VARCHAR(64),
  ack_required BOOLEAN DEFAULT FALSE
);
```

**总控侧 API**:
| 端点 | 方法 | 用途 |
|---|---|---|
| `/api/control/commands` | POST | 用户/系统写控制命令 (内部 API, Auth 必填) |
| `/api/control/commands` | GET | 站点轮询 (HMAC) |
| `/api/control/ack` | POST | 站点反馈结果 (HMAC) |
| `/api/control/commands/[id]` | GET | 单条状态查询 |

---

## 5. Sprint 4.6 — TaskControlProvider 抽象 + 9 thin API

| 项 | 说明 |
|---|---|
| **目标** | 把 Sprint 4.1 设计的 TaskControlProvider interface 落地, 9 个 thin API 转发 |
| **独立完成?** | ✅ 是 |
| **风险** | 低 (thin wrapper) |
| **工期** | 2d |

**交付**:
- `lib/task/control-provider.ts` — interface (Sprint 4.1 已设计)
- `lib/task/mock-control-provider.ts` — Mock 实现 (前端 mock 模式)
- `lib/task/api-control-provider.ts` — API 实现 (调总控 /api/control/*)
- `lib/task/index.ts` — Provider 工厂 (按 isApiMode 切换)
- 9 个 thin API endpoint (Sprint 4.1 §8.2):
  - `POST /api/control/tasks` (create)
  - `POST /api/control/tasks/[id]/pause` (pause)
  - `POST /api/control/tasks/[id]/resume` (resume)
  - `POST /api/control/tasks/[id]/reset` (reset)
  - `POST /api/control/tasks/[id]/prioritize` (prioritize)
  - `POST /api/control/inspect` (inspect)
  - `POST /api/control/notify/[taskId]/ack` (ack)
  - `GET /api/control/tasks/[id]/history` (history)
  - `WS /api/control/events` (push)
- 集成到 Tasks 页面: 替换现有 mock 按钮 → 调真实 API
- 集成到 Volumes/Racks 详情页 (巡检入口)

---

## 6. Sprint 4.7 — SSO 跳转入口占位

| 项 | 说明 |
|---|---|
| **目标** | 实现 Sprint 4.2-C 方案 1 骨架: 总控每个设备/任务/卷详情页加"在站点管理" 跳转链接 |
| **独立完成?** | ✅ 是 (URL 配置需站点配合) |
| **风险** | 低 (纯前端跳转) |
| **工期** | 1d |

**交付**:
- `lib/site/site-urls.ts` — 站点 URL 配置 (从环境变量读)
- `components/site-jump-button.tsx` — 跳转按钮 (按 siteCode + action 拼 URL)
- 集成: Tasks/Racks/Volumes/Sites 详情页加跳转按钮
- 文档: `docs/operations/site-jump-urls.md` — 站点需提供 URL 模板

**示例**:
```typescript
// lib/site/site-urls.ts
export const SITE_URLS: Record<string, string> = {
  SH01: process.env.SITE_URL_SH01 ?? "https://sh01.star.example.com",
  BJ02: process.env.SITE_URL_BJ02 ?? "https://bj02.star.example.com",
  TEST_CLEAN: process.env.SITE_URL_TEST_CLEAN ?? "http://localhost:8080",
}

export function buildSiteJumpUrl(siteCode: string, action: string, params: Record<string, string> = {}) {
  const base = SITE_URLS[siteCode]
  if (!base) return null
  const url = new URL(`/actions/${action}`, base)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  url.searchParams.set("return", `${window.location.origin}/tasks/${params.taskId ?? ""}`)
  return url.toString()
}
```

**降级**: URL 未配置时按钮 disabled, 显示 tooltip "请联系运维配置 SITE_URL_* 环境变量"

---

## 7. Sprint 4.8 — 巡检/恢复/优先控制方案 (方案 2 落地)

| 项 | 说明 |
|---|---|
| **目标** | 把 Sprint 4.5 + 4.6 组合, 实现 REQ-029 (巡检) + REQ-027 优先 + REQ-027 完成通知 |
| **独立完成?** | ⚠️ 60% (总控可独立, 站点需开发 pull-control 脚本) |
| **风险** | 中-高 (跨系统异步, 状态追踪复杂) |
| **工期** | 4d (2d 总控 + 2d 站点配合) |

**总控侧交付** (2d):
- 巡检命令写入 (control_command.action = 'inspect')
- 巡检结果展示页 (`/inspect/[id]/page.tsx`)
- 优先恢复命令 (control_command.payload.priority)
- 任务完成/失败通知 (走 SMTP, 不依赖站点)
- 巡检历史查询 API

**站点侧需配合** (2d):
- `scripts/pull-control-commands.ts` (Sprint 4.2-C §3.3 已设计)
- 巡检执行: 抽盘 + SM3/MD5 哈希 (依赖源端 verify_result 列, **可能需源端补 schema**)
- 通知脚本: 站点主动 SMTP 推送完成/失败 (或总控侧 SMTP)

---

## 8. 后续 5.x — ADFS/JWT/RBAC (解锁 CLAUDE.md 后)

| Sprint | 主题 | 估时 | 阻塞 |
|---|---|---|---|
| **5.1** | ADFS / LDAP 集成登录 | 5d | 解锁 CLAUDE.md |
| **5.2** | JWT 令牌 (2h 有效期) | 4d | 5.1 |
| **5.3** | 账号生命周期 (创建/启用/禁用/删除) | 3d | 5.1+5.2 |
| **5.4** | RBAC 权限分配 + dept/role 字段 | 5d | 源端补字段 + 5.1 |
| **5.5** | 权限审计 (操作/变更, 1 年) | 3d | 5.1+5.2+5.4 |
| **5.6** | 登录审计 + 失败锁定 (≥5 次) | 4d | 5.1+5.2 |
| **5.7** | 部门管理 (集团/部门/站点三级) | 5d | 5.1+5.4 |
| **5.8** | SSO 跳转真接入 (替换 4.7 占位) | 3d | 5.1+5.2 |

**总计 32 人天**, 完全解锁需上级调整 CLAUDE.md。

---

## 9. 后续 6.x — 真实源端接入 + 生产化

| Sprint | 主题 | 估时 | 阻塞 |
|---|---|---|---|
| **6.1** | 真实站点 push 接入 (替代 export-package 模拟) | 站点负责 | 站点侧开发 |
| **6.2** | HTTPS + 反向代理 (Caddy/Nginx) | 0.5d | 0 |
| **6.3** | 生产 secret 管理 (Vault/K8s Secret) | 1d | 0 |
| **6.4** | 多实例部署 (Next.js cluster) | 2d | 0 |
| **6.5** | PG17 主从 + 备份策略 | 3d | 0 |
| **6.6** | 监控告警 (Grafana) | 2d | 0 |
| **6.7** | 日志聚合 (Loki/ELK) | 2d | 0 |
| **6.8** | CI/CD (GitHub Actions) | 1d | 0 |
| **6.9** | 多站点部署 (N 库 N 实例 + site 路由) | 5d | 站点真接入 + 6.5 |
| **6.10** | 性能测试 + 调优 (千万级 file-index) | 5d | 6.5+6.9 |

**总计 21.5 人天**, 6.1 需站点侧。

---

## 10. 风险与依赖图

```
4.3 (文档) ──────────────────────────────────────────┐
                                                    │
4.4 (cron) ─────→  站点侧部署 ─────→ 4.8 (巡检)     │
   │                                    │           │
   │                                    │           │
4.5 (control_queue) ──→ 4.6 (Provider) ──→ 4.8 ────┤
   │                                    │           │
4.7 (SSO 占位) ─────────────────────────→ 5.8 ────┤
                                                    │
5.x (Auth) ──→ 6.x (生产) ─────────────────────────┘
```

**关键路径**:
- **项目自主**: 4.3 → 4.5 → 4.6 → 4.7 (1 周 6.5d)
- **含站点**: + 4.4 (cron) + 4.8 (巡检) (2 周 12.5d)
- **含解锁**: + 5.x (4 周 32d)
- **含生产**: + 6.x (4 周 21.5d)

**总跨度**: 项目自主 1 周 → 全部解锁+生产 4 个月。

---

## 11. 关键决策

1. **先做 4.3 + 4.5 + 4.6 + 4.7** (1 周, 全独立) — 把方案 1+2 骨架立起来
2. **4.4 等生产部署时做** (设计稿先有)
3. **4.8 等站点开发 pull-control** (站点侧同步)
4. **5.x 等上级解锁 CLAUDE.md** (不主动催)
5. **6.x 等真实生产部署** (有客户时启动)

**短期推荐 (本周可做)**:
- 4.3 文档 (0.5d)
- 4.5 control_command 表 + 写/读 API (3d)
- 4.6 TaskControlProvider + 9 thin API (2d)
- 4.7 SSO 跳转占位 (1d)
- **合计 6.5d, 项目 100% 独立, 无外部依赖**
