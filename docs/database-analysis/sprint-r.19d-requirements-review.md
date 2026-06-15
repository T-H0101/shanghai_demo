# Sprint R.19D Requirements Review

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint R.19D` |
| Sprint 标题 | 节点任务跳转与 Site Agent 暂停/继续闭环 |
| 日期 | 2026-06-15 |
| 对应 requirement 节 | `requirements.md §1.2 / §2.2 / §4.2 / §6.2` |
| 关联设计 | `docs/superpowers/specs/2026-06-15-r19d-node-jump-pause-resume-control-design.md` |
| 验证方式 | TypeScript、API、恢复库 SQL、中心库 SQL、Agent 进程、E2E |

## 1. Requirement IDs

| Req ID | 本 Sprint 状态 |
|---|---|
| REQ-1.2.1 松耦合 Agent | `partial` |
| REQ-2.2.1 ADFS/LDAP | `blocked_by_auth` |
| REQ-4.2.1 新建备份/恢复任务 | `partial` |
| REQ-4.2.2 暂停/重置/恢复/优先恢复 | `partial` |
| REQ-6.2.1 传输加密 | `partial` |

## 2. Requirement 原始文本

> 核心：实现统一任务管理（新建备份/恢复任务、任务暂停/重置 ）、任务查看、任务监控与提醒，提升任务管理效率。

> 1. 新建备份/恢复任务2.任务暂停/重置/恢复等任务控制

> 1.支持备份任务进行过程中后新建恢复任务2.支持优先执行恢复任务

> 单张光盘刻录过程中不能中断；任务过程中可优先执行恢复任务

## 3. Implementation

| 范围 | 实现 |
|---|---|
| 节点跳转 | `GET /api/site-navigation/task-create` + 环境键解析；未配置时 fail closed |
| 控制认证 | poll/ack/result 使用 HMAC-SHA256、时间窗、siteCode 校验、nonce 防重放 |
| 队列租约 | `FOR UPDATE SKIP LOCKED` 原子 claim；超时 pulled 可重新领取 |
| 站点执行 | 独立 Site Agent 使用 PostgreSQL adapter 事务修改恢复库 `tbl_task.status` |
| 暂停 | type 0/2/3 仅允许 19→20；type 1 仅允许 1/9→20 |
| 继续 | 仅允许 20；恢复本地持久化的暂停前状态，不猜测 0 |
| 耐久性 | execution/result/pause state 原子文件持久化；结果失败重传不重复执行 |
| 回读 | 控制成功后立即调用现有同步协调器，中心 `unified_tasks` 回读最终状态 |
| 审计 | 首次 final result 写 `audit_log`；幂等重传不重复写 |
| Auth 边界 | Settings 只显示配置状态和 secret 键引用，不实现 JWT/RBAC |

未新增数据库表。未修改站点 schema。未存储真实 secret。

## 4. Backend Reality

白盒 E2E 在 `star_storage_db` 插入专用任务并实际验证：

1. pause command 写入中心 `control_command`。
2. Site Agent 签名 poll 并 ACK。
3. PostgreSQL adapter 将源端状态 `19 → 20`。
4. 中心 command 状态为 `success`，`audit_log.dry_run=false`。
5. 立即同步后 `unified_tasks.status=paused`。
6. resume command 再次由 Agent 执行。
7. 源端状态恢复 `20 → 19`，不是硬编码 `0`。

该证据来自测试恢复库，不代表生产站点已经部署 Agent。

## 5. UI Reality

### 前端变更 8 项披露

| 项 | 结果 |
|---|---|
| 新增页面/组件 | 无新页面；Settings 增加 Auth 安全状态卡片 |
| 修改按钮/交互 | Tasks “新建任务”改为节点跳转；暂停/继续仅提交队列 |
| 删除按钮/交互 | 删除总控本地创建任务弹窗；删除前端 `/execute` 调用 |
| UI-only | Auth 卡片仅展示安全配置状态 |
| 真实后端能力 | pause/resume 有 Agent、SQL、result、audit、sync 证据 |
| simulator/DRY_RUN | 旧 worker/execute 路径仍存在兼容测试，但 Tasks UI 不再调用 |
| 需求外新增 | 无 |
| 误导检查 | toast 明确“等待站点 Agent 执行”；不乐观修改任务状态 |

新建任务按钮状态：

- 全站点：禁用，提示先选择站点。
- 已选站点但 URL 空：禁用，提示“节点任务创建地址未配置”。
- URL 配置后：新窗口打开节点创建地址。

## 6. 事件测试 10 项

| 检查项 | 证据 |
|---|---|
| 点击元素 | `task-create-at-node`、`task-row-pause`、`task-row-resume` |
| 点击前状态 | 真实 `unified_tasks`，无 mock fallback |
| API | navigation GET；control command POST；Agent poll/ack/result |
| API 返回 | 未配置导航 200/configured=false；命令 201；Agent API 200 |
| DB 变化 | 源端 19→20→19；中心 command/audit/unified_tasks 更新 |
| 页面刷新 | 不做乐观状态；等待同步回读 |
| toast | 明确“已提交到控制队列，等待站点 Agent 执行” |
| mock/fallback | 无 |
| 误导 | 无“暂停成功/已暂停”控制结果宣称 |
| requirement | 对应 REQ-4.2.1/REQ-4.2.2 |

## 7. Mock / Simulator / DRY_RUN / 真控制

| 能力 | Mock | Simulator | DRY_RUN | 真控制 |
|---|---:|---:|---:|---:|
| 节点跳转 | 否 | 否 | 否 | 配置后可跳转；当前 URL 未配置 |
| Agent pause | 否 | 否 | 否 | 恢复库验证通过 |
| Agent resume | 否 | 否 | 否 | 恢复库验证通过 |
| reset/priority/inspect/recovery | 否 | 旧兼容路径存在 | 旧 worker 可用 | 否 |

## 8. Missing Pieces

| Req ID | 缺失件 | 状态 |
|---|---|---|
| REQ-4.2.1 | 实际节点任务创建 URL 与节点页面验收 | `blocked_by_site_change` |
| REQ-4.2.2 | reset 官方状态语义 | `blocked_by_site_change` |
| REQ-4.2.2 | priority 字段和调度语义 | `blocked_by_source_schema` |
| REQ-4.2.3 | 巡检/恢复执行适配器 | `blocked_by_source_schema` |
| REQ-1.2.1 | 生产站点安装、长期运行和故障演练 | `blocked_by_site_change` |
| REQ-2.2.1 | 真 ADFS/LDAP/JWT/RBAC | `blocked_by_auth` |
| REQ-6.2.1 | TLS 部署、敏感字段加密和密钥轮换 | `partial` |

## 9. 站点/领导后续清单

1. 提供每站点任务创建 URL，配置 `SITE_NODE_TASK_CREATE_URL_<SITE_CODE>`。
2. 确认 reset 官方状态机和可中断边界。
3. 如需优先恢复，补 priority schema/API 和调度规则。
4. 在生产站点安装 Agent，完成账号权限、systemd、TLS 和故障恢复验收。
5. 提供 ADFS/LDAP/OIDC 参数后再开启 Auth 实现。

## 10. 完成率

- 全局 `complete` 仍为 3/45，requirements 完成率仍为 `6.7%`。
- REQ-4.2.2 父需求仍为 `partial`，因为 reset 和 priority 未完成。
- 本 Sprint 将 pause/resume 两个原子动作从测试执行器提升为真实 Site Agent 恢复库闭环。

## 11. Verdict

### `partial`

R.19D 对 pause/resume 子能力验收通过；对 §4.2 整体不能判 complete。节点任务创建地址、reset、priority、巡检、恢复和生产部署仍缺失。

## 12. 提交前检查

- [x] Req ID 和原文已列
- [x] 状态使用 8 选 1
- [x] 后端有 API/SQL/Agent 证据
- [x] UI 事件和措辞已审查
- [x] Mock/Simulator/DRY_RUN/真控制已区分
- [x] 缺失件和 blocker 未隐藏
- [x] PROJECT_STATUS/ROADMAP/traceability 已同步
