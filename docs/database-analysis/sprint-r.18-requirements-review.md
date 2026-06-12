# Sprint R.18 Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | R.18 |
| 标题 | 基线重构和 Site Agent 协议冻结 |
| 日期 | 2026-06-12 |
| Requirement | §1.2、§2.1、§2.3、§4.2、§6.2、§6.4 |
| 范围 | 文档、追踪矩阵、协议和验收基线；不改业务代码 |

## 1. Requirement IDs

| Req ID | 状态 |
|---|---|
| REQ-1.2.1 | partial |
| REQ-2.3.1 | partial |
| REQ-2.3.2 | partial |
| REQ-2.3.3 | partial |
| REQ-4.2.1 | partial |
| REQ-4.2.2 | partial |
| REQ-4.2.3 | partial |
| REQ-4.2.4 | partial |
| REQ-6.2.1 | partial |
| REQ-6.4.2 | partial |

## 2. Requirement 原文

> “统一管控平台与各站点管理系统通过API/消息队列交互，不侵入站点原有核心逻辑。”

> “同步各站点核心数据至统一系统，为后续跨站点检索、任务下发、盘笼移位提供数据支撑。”

> “实时同步：关键数据变更后立即同步；定时同步：非关键数据按周期同步；手动同步：支持管理员触发全量/增量同步。”

> “新建备份/恢复任务，任务暂停/重置/恢复等任务控制。”

## 3. Implementation

| 文件 | 作用 |
|---|---|
| `docs/summary/ROADMAP_R18_R25.md` | Agent 闭环路线 |
| `docs/source/site-agent-protocol-v1.md` | sync/control/heartbeat/HMAC 协议 |
| `docs/database-analysis/r18-requirement-table-integration-matrix.md` | requirement 接表分类 |
| `docs/database-analysis/r18-control-capability-matrix.md` | 控制动作能力矩阵 |
| `docs/database-analysis/requirements-traceability.json` | 45 项合法状态和真实度校准 |
| `docs/database-analysis/requirements-traceability.md` | 当前可读矩阵 |
| `docs/testing/site-agent-web-acceptance-guide.md` | 网页/API/DB 验收步骤 |
| `scripts/e2e/test-r16-postreview-truth-audit.ts` | 移除硬编码 13.3%，读取 R.18 当前口径 |

## 4. Backend Reality

- 当前同步 package、dispatcher、scheduler、consistency 为真实中心链路。
- exporter/scheduler 仍是仓库脚本，不是已部署站点 Agent。
- 控制 poll/ack/result API 存在，但生产 Agent 未部署。
- pause/resume 仅有测试站点 DB 写入证据。
- `tbl_file=4`、`tbl_folder=0`，不能证明完整文件同步。
- `tbl_role=4`、`tbl_fuc=53`，关系和部门表仍为空。

## 5. UI Reality

R.18 不修改页面和按钮。网页验收说明覆盖 `/sites`、`/sync`、`/tasks`、`/control`，实际 Agent 状态需 R.19 实现后验证。

## 6. Mock / Simulator / DRY_RUN / 真控制

| 类型 | 当前状态 |
|---|---|
| mock | 不计入任何 complete |
| simulator | 站点 exporter/worker 仍有模拟或测试属性 |
| DRY_RUN | 只能证明命令链路，不证明站点执行 |
| 真控制 | 生产 Agent 证据 0/6 |

## 7. Missing Pieces

- 独立可部署 Site Agent。
- Agent heartbeat、重试、离线 spool。
- Agent HTTP 控制执行和本地幂等。
- 完整文件索引 ES。
- 权限关系真实数据。
- reset/priority/inspect/recovery 官方 schema/API。

## 8. Blockers

| 缺失件 | 状态 |
|---|---|
| Agent 部署 | partial，R.19 开发 |
| 文件完整检索 | blocked_by_external_system |
| 权限写操作 | blocked_by_auth |
| priority/inspect/recovery | blocked_by_source_schema |
| 邮箱提醒 | blocked_by_external_system |

## 9. 站点变更建议

- 部署 Site Agent，使用环境变量注入站点 DB 和总控凭据。
- Agent 主动 push package、poll/ack/result，不开放总控到站点 DB。
- pause/resume 首期走本地 PostgreSQL adapter。
- 其余动作保持 unsupported，等待正式 schema/API。

## 10. 前端变更披露

- 新增页面/组件: 0。
- 修改按钮/交互: 0。
- 删除按钮/交互: 0。
- UI-only: 0。
- 新增真实后端能力: 0。
- simulator/DRY_RUN: 仅文档如实标记。
- requirements 外内容: Site Agent 为 §1.2、§2.3、§4.2 的实现载体。

## 11. 完成率

R.18 校准后:

```text
complete = 3
total = 45
requirements 完成率 = 3 / 45 = 6.7%
```

下降来自旧矩阵过度完成声明修正，不代表 R.18 删除了已有功能。

## 12. Verdict

`pass`，仅针对 R.18 的基线校准和协议冻结。

R.18 不宣称 Agent、同步四类、任务控制或生产部署完成。R.19 必须提供代码、API、数据库、e2e 和浏览器证据。
