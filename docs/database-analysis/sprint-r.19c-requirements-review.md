# Sprint R.19C Requirements Strict Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `R.19C` |
| Sprint 标题 | Site Agent 混合同步、重试和离线补传 |
| 日期 | 2026-06-15 |
| 对应 requirement 节 | `requirements.md §1.2 / §2.3 / §6.1` |
| 关联文档 | `docs/superpowers/specs/2026-06-15-r19c-hybrid-site-agent-sync-design.md` |
| 总控负责人 | Codex |
| 验证人 | Codex 白盒自动化 |

## 1. Requirement IDs

| Req ID | 状态 |
|---|---|
| REQ-1.2.1 | `partial` |
| REQ-2.3.1 | `partial` |
| REQ-2.3.2 | `partial` |
| REQ-4.3.2 | `partial` |
| REQ-6.1.3 | `partial` |

## 2. Requirement 原始文本

> 数据一致性：核心元数据（设备、文件索引、权限）采用异步同步+定时校验机制，保证统一管控平台与各站点数据的最终一致性。

> 高可用：统一系统支持集群部署，站点断连后可离线操作，恢复连接后自动同步未上传数据，保障业务不中断。

> 同步数据需做增量过滤，仅同步变更数据，降低系统开销。

> 同步失败自动重试（可配置重试次数/间隔），重试失败触发告警，支持手动重试。

> 数据同步：单站点增量同步≤10秒，全量同步（百万级索引）≤30分钟，任务状态（刻录/回迁）同步≤5秒。

## 3. Implementation

- 新增 `lib/site-agent/sync/*`：白名单 reader、稳定哈希、package builder、HMAC transport、原子 state/spool、coordinator。
- 修改 `scripts/site-agent/run.ts`：5 秒任务同步、60 秒快照检测、`--once`、串行调度。
- 修改 heartbeat：从持久化状态读取 `lastSyncAt` 和 `spoolDepth`。
- 修复 `app/api/racks/[id]/route.ts`：多站点重复设备 ID 时按 `siteCode` 定位，避免详情读取其他站点。
- 复用现有 `POST /api/sync/package`、13 表 dispatcher、`sync_package_log`、`sync_table_log`。
- 未新增 API、页面或数据库表。

## 4. Backend Reality

真实白盒证据:

- `star_storage_db` 13 张允许小表 bootstrap 成功。
- 中心 package 状态 `success`，13/13 table log 成功。
- 第二轮无变化不创建 package。
- 真实 `tbl_task` 37 行通过 `syncMode=incremental` 推送。
- 中心不可达时 spool depth 为 1，state 不推进。
- 恢复后先 replay，spool depth 回到 0。
- 同 batch 重放返回 `duplicated`。
- 中心 `unified_tasks` 可查询 37 条对应站点任务，测试后清理。

本单元不是 mock、simulator 或 DRY_RUN。

## 5. UI Reality

本 Sprint 不修改页面或按钮。现有 Racks 详情事件测试覆盖 `siteCode` 查询，修复后详情返回 SH01 的 396 条 slots，设备 slots 端返回其中 96 条；本轮按用户要求不做浏览器审查。

## 6. Mock / Simulator / DRY_RUN / 真同步

| 类型 | 本 Sprint |
|---|---|
| Mock | 未使用 |
| Simulator | 未使用 |
| DRY_RUN | 未使用 |
| 真同步 | 完整测试站点 DB → Site Agent → HMAC API → dispatcher → 中心表 |

## 7. Missing Pieces

| Req ID | 缺失件 | 状态 |
|---|---|---|
| REQ-1.2.1 | 生产站点部署；控制生产链路 | `partial` |
| REQ-2.3.1 | 完整文件索引；角色/权限/部门关系 | `blocked_by_external_system` / `blocked_by_source_schema` |
| REQ-2.3.2 | 最终失败告警；页面触发 Agent 手动同步；设备实时延迟实测 | `partial` |
| REQ-4.3.2 | Auth/RBAC 站点权限过滤仍未接入 | `blocked_by_auth` |
| REQ-6.1.3 | 百万级全量性能；生产长期时延证据 | `partial` |

## 8. 源端 / 站点变更清单

- 生产站点安装 systemd Site Agent，配置 env key refs，不提交 secret。
- 提供角色、权限、部门关系的真实源 schema/数据。
- 完整文件索引需领导决定 ES/ClickHouse 数据面，禁止将 `tbl_file/tbl_folder` 全量灌入 PG17。
- 配置生产 TLS 和最终失败告警接收通道。

## 9. 前端变更披露

- 新增页面/组件：0。
- 修改按钮/交互：0；修复既有 Racks 详情 API 的 `siteCode` 查询行为。
- 删除按钮/交互：0。
- UI-only：0。
- 真实后端能力：Site Agent package push/retry/spool。
- simulator/DRY_RUN：0。
- requirements 外新增：0。

## 10. 验证

- `pnpm e2e:site-agent-sync-core`: 11/11。
- `pnpm e2e:site-agent-sync`: 13/13。
- `pnpm e2e:site-agent`: 17/17。
- `pnpm e2e:site-agent-client`: 7/7。
- `pnpm e2e:racks`: 24/24。
- `pnpm exec tsc --noEmit`: exit 0。
- `pnpm build`: exit 0。
- `pnpm smoke:sync`: pass。
- `pnpm check:sync-consistency -- --siteCode=SH01`: 7/7 matched。
- `pnpm baseline:check`: 13/13。
- `pnpm e2e:all`: exit 0，包含 Full Audit 99/99。

## 11. 完成率与 Verdict

- 本 Sprint 涉及 5 个 Req ID，全部保持 `partial`。
- 全局 `complete` 仍为 3，requirements 完成率仍为 `3/45 = 6.7%`。
- 不把同步链路完成等同 requirements 整体完成。
- Verdict: `pass`（R.19C 定义范围通过；上层 requirement 仍 partial）。
