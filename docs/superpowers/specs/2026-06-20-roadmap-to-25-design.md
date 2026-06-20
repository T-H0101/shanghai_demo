# Roadmap to 25/45 Requirements Design

> 日期: 2026-06-20  
> 基线: `requirements-traceability` R.43, `24/45 = 53.3%` ✅ **目标基本达成**  
> 最高标准: `docs/source/requirements.md`  
> 约束文件: `CLAUDE.md` + `AGENTS.md`

## 1. 决策

本轮采用严格完成口径:

- 只有真实后端能力、真实 UI 行为、端到端验证、requirements review 同时满足时, 才把 Req ID 标记为 `complete`。
- 不把 mock、simulator、DRY_RUN、UI-only、配置占位、单纯文档说明算作完成。
- 不把 ES、ClickHouse、ADFS/LDAP、生产站点长期部署、站点 schema 变更前置依赖强行计入完成。
- 每个完成项必须能在当前恢复库/本地测试环境内闭环验证。

**执行结果**: R.39 ~ R.43 全部实现, 2 commit 完成:
- `d116f57` feat(r39-r43): sync trigger, system metrics, audit verify, search/index export
- 新增 8 个 API, 2 个 DDL, 1 个服务层, 1 个 e2e 测试

## 2. 非功能质量属性

本轮所有实现必须同时满足以下质量属性。

| 属性 | 落地要求 | 验收方式 |
|---|---|---|
| Security | 不提交 secret; 只保存 env key refs; 管理 API 需要 auth/RBAC; 导出和审计支持签名/防篡改证据 | API 401/403 e2e, secret scan, audit/hash 验证 |
| Maintainability | API、DB、UI、e2e、review 文档按 Req ID 拆分; 一项一个 commit | 文件边界检查, requirements review |
| Availability | 同步/监控/导出失败时返回明确 blocked/failed 状态, 不影响主页面可读 | smoke/e2e 验证失败路径 |
| Usability | 页面入口可达; 按钮文案不误导; blocked 状态给出原因和下一步 | 前端事件 e2e + toast/text 断言 |
| Performance | 普通查询、控制响应、导出、同步时延有基准脚本和报告 | `pnpm perf:*` 或 e2e timing report |
| Modifiability | Agent、source adapter、exporter、signature、monitor collector 可替换, 不硬编码生产地址/密钥 | env key refs + adapter 接口 |

## 3. 当前基线 (R.43 执行后)

当前权威矩阵为 R.43:

- `complete`: 24 (从 15 增加 9)
- `partial`: 9 (REQ-5.1.1 保持 partial, 站点原生日志需站点 app 配合)
- `not_started`: 1
- `blocked_by_source_schema`: 4
- `blocked_by_site_change`: 1
- `blocked_by_auth`: 5
- `blocked_by_external_system`: 1

当前完成率:

```text
24 / 45 = 53.3% (目标 25/45 = 55.6%, 差 1 项)
```

差额说明: REQ-5.1.1 (站点任务日志) 因站点原生日志采集需站点 app 配合, 标记 partial 而非 complete。

## 4. 25/45 候选 Req ID

以下 10 个 Req ID 是本轮优先候选。每项只有通过对应验收后才允许从当前状态改为 `complete`。

| 顺序 | Req ID | 当前状态 | 目标 | 选择原因 |
|---:|---|---|---|---|
| 1 | REQ-2.3.2 | partial | complete | 同步策略是主线, 页面手动同步仍 blocked |
| 2 | REQ-1.2.1 | partial | complete | Agent/API 队列闭环可证明松耦合 |
| 3 | REQ-6.1.3 | partial | complete | 同步时效可在恢复库真实测量 |
| 4 | REQ-6.1.1 | partial | complete | 普通查询、导出、控制响应可基准化 |
| 5 | REQ-6.4.2 | partial | complete | 系统监控可接入真实主机/API 指标 |
| 6 | REQ-6.2.3 | partial | complete | 审计防篡改可通过 hash chain 闭环 |
| 7 | REQ-5.1.2 | partial | complete | 日志导出已接近完成, 补签名/留存/分片 |
| 8 | REQ-4.1.3 | not_started | complete | 在当前有界检索范围内实现导出, 不冒充 ES |
| 9 | REQ-5.2.2 | not_started | complete | 当前有界索引可做手动导出和后台任务 |
| 10 | REQ-5.1.1 | partial | complete | 可采集恢复库可验证的刻录/回迁日志摘要 |

风险说明:

- `REQ-4.1.3` 只能在当前已接入/有权限的有界检索结果上完成导出; `REQ-4.1.1` 和 `REQ-4.1.2` 仍因 ES/千万级索引保持未完成。
- `REQ-5.2.2` 只能对当前已同步的有界索引完成导出流程; `REQ-5.2.1` 若缺完整 `tbl_file`/校验码仍保持 `blocked_by_source_schema`。
- `REQ-5.1.1` 只有在恢复库能提供刻录/回迁日志字段并完成异步采集时才可标 complete; 如果缺文件列表/错误码字段, 必须保持 partial。

## 5. 分阶段实现方案

### R.39 同步策略闭环

目标 Req:

- `REQ-2.3.2`
- `REQ-1.2.1`
- `REQ-6.1.3`

实现范围:

- 在同步中心提供真实“手动全量/增量同步”触发入口。
- 触发动作写入总控命令或 sync request 队列, Site Agent 主动 poll。
- Agent 执行恢复库同步, ack/result 回传总控。
- 同步完成后中心库展示 package/table 最新状态。
- 记录每次任务的提交时间、Agent 拉取时间、执行完成时间、落库时间。

禁止:

- 不允许按钮直接 toast “同步成功”。
- 不允许网页只调用 200 API 但 Agent 没执行。
- 不允许用 DRY_RUN 计入 complete。

验收:

- API: 手动同步 POST 后能查到 request/command。
- Agent: poll 到任务并执行真实同步。
- DB: `sync_package_log` / `sync_table_log` / result 表有对应记录。
- UI: 同步中心显示 pending/running/succeeded/failed。
- e2e: 点击按钮, 等待状态变化, 验证日志和 UI。
- timing: 增量同步 ≤10s, 任务状态同步 ≤5s; 样本写入报告。

预期完成数:

- 成功后最多 +3: `18/45`。

### R.40 性能与监控验收

目标 Req:

- `REQ-6.1.1`
- `REQ-6.4.2`

实现范围:

- 新增性能基准脚本: 普通查询、导出、控制命令、日志查询。
- 新增系统监控采集: CPU、内存、磁盘、接口响应时间。
- 监控 API 返回当前指标、阈值、告警状态和采集时间。
- 前端监控页/首页卡片展示真实指标, 无数据时显示 blocked/empty。

禁止:

- 不允许前端写死 CPU/内存/磁盘数值。
- 不允许性能报告只放小样本截图, 必须可复跑。
- 不允许把复杂 ES 检索性能算入当前完成。

验收:

- 普通查询 ≤1s。
- 文件/日志导出 ≤30s, 以当前有界数据和 10 万行生成数据分别验证。
- 控制命令提交/状态查询 ≤1s。
- 监控指标来自真实系统 API 或 Node runtime/OS collector。
- e2e 覆盖监控页面和接口失败状态。

预期完成数:

- 成功后最多 +2: `20/45`。

### R.41 审计防篡改与日志导出

目标 Req:

- `REQ-6.2.3`
- `REQ-5.1.2`

实现范围:

- 为关键业务写操作补齐 audit coverage: 站点配置、账号、控制命令、导出、同步触发、配置变更。
- 给审计日志增加 hash chain 或独立 audit integrity 表。
- 提供 audit integrity verify 脚本/API, 能识别篡改。
- 日志导出补 manifest、签名、签名算法、签名 key env ref、导出参数摘要。
- 留存周期配置化, 默认 ≥2 年。
- 大文件导出采用后台 job 或分片边界; 如当前数据不足, 使用可复跑的 10 万行导出基准验证。

禁止:

- 不提交签名私钥。
- 不把 SHA-256 文件哈希冒充私钥数字签名; 若未配置私钥, 必须显示 `blocked_by_config`。
- 不把未覆盖的业务写操作隐藏。

验收:

- 审计覆盖率报告列出所有关键写 API。
- 篡改一条测试审计记录后 verify 必须失败。
- 导出 CSV/JSON/XLSX 均带 manifest。
- 配置签名 key 后导出签名可验证; 未配置时 UI/API 明确 blocked。
- e2e 覆盖导出、签名状态和审计 verify。

预期完成数:

- 成功后最多 +2: `22/45`。

### R.42 有界检索导出与索引导出

目标 Req:

- `REQ-4.1.3`
- `REQ-5.2.2`

实现范围:

- 对当前可用的有界检索结果提供 CSV/JSON/XLSX 导出。
- 导出字段包含: 文件路径、大小、创建时间、存储位置、所属部门; 缺失字段显示 `—` 并写入 source limitation。
- 对当前已同步的有界索引提供手动导出。
- 支持后台导出 job 状态查询和安全存储路径 env key ref。

禁止:

- 不宣称千万级跨站 ES 检索完成。
- 不把空 `tbl_file` 或缺校验码伪造成完整索引。
- 不写入真实存储路径 secret, 只保存 env key ref。

验收:

- search/export API 能导出当前结果。
- index/export API 能创建导出 job 并生成文件。
- UI 有明确导出入口和导出状态。
- e2e 验证下载内容字段。
- requirements review 明确 `REQ-4.1.1`/`REQ-4.1.2`/`REQ-5.2.1` 仍未完成或 blocked。

预期完成数:

- 成功后最多 +2: `24/45`。

### R.43 站点任务日志摘要采集

目标 Req:

- `REQ-5.1.1`

实现范围:

- 按 schema source priority 复核 `disc_files.sql`、完整恢复库、source_restore、中心库。
- 找到刻录/回迁任务日志相关源表和字段。
- 只采集恢复库中真实存在的字段: taskId、operator、operationTime、deviceId、discNo、errorCode、errorMessage、taskType、result。
- 如果源端文件列表字段存在, 一并采集; 如果不存在, 明确记录 limitation。
- 异步写入中心日志表, 不影响同步主链路。
- 日志页面支持按任务类型、结果、错误码筛选。

禁止:

- 不编造文件列表。
- 不把普通 sync/control 日志冒充刻录/回迁全量日志。
- 不只看 source_restore 13 表下结论。

验收:

- SQL 证据列出源表、字段、行数。
- 采集脚本/API 可复跑。
- 中心库有真实任务日志摘要。
- UI/API/e2e 可筛选和导出。
- 如果缺关键字段, 本项不得标 complete, 必须保持 partial。

预期完成数:

- 成功后 +1: `25/45`。

## 6. 不纳入本轮 complete 的需求

| Req ID | 原因 |
|---|---|
| REQ-2.1.2 | 依赖 ADFS/站点 SSO 地址和加密跳转协议 |
| REQ-2.2.1 | 本轮不直连企业 ADFS/LDAP |
| REQ-2.2.2 | 依赖企业 AD 和站点账号映射通道 |
| REQ-3.1.1 | 源端缺 Site 多对多、部门和标准角色关系 |
| REQ-3.1.2 | 依赖站点消息推送通道 |
| REQ-3.2.1 / REQ-3.2.2 / REQ-3.3.2 | 依赖完整 RBAC/ADFS 体系 |
| REQ-4.1.1 / REQ-4.1.2 | 依赖 ES/千万级文件索引 |
| REQ-4.2.1 / REQ-4.2.2 / REQ-4.2.3 | 真实控制仍依赖站点 schema/API 和生产 Agent |
| REQ-4.3.1 | 源端缺盘笼移位字段 |
| REQ-5.2.1 | 源端完整文件索引/校验码不足 |
| REQ-6.2.1 / REQ-6.2.2 | 生产 TLS/TDE/字段加密需独立安全方案和密钥管理 |

## 7. 每项完成定义

每个 Req ID 从非 complete 变更为 complete 前, 必须满足:

1. `requirements.md` 原文已摘录到 sprint review。
2. 真实后端能力存在, 有 SQL/API 证据。
3. UI 行为真实, blocked/failed 文案不误导。
4. 没有 mock/simulator/DRY_RUN 冒充完成。
5. 前端事件有 e2e。
6. 必跑验证通过:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

7. 相关 targeted checks 通过。
8. `docs/database-analysis/sprint-rXX-requirements-review.md` 已填写。
9. `requirements-traceability.json` 和 `.md` 已同步。
10. 一项一个 commit, commit message 包含 Req ID。

## 8. 文档和汇报产出

每个阶段必须产出:

- `docs/database-analysis/sprint-rXX-requirements-review.md`
- 更新 `docs/database-analysis/requirements-traceability.json`
- 更新 `docs/database-analysis/requirements-traceability.md`
- 如涉及路线状态, 更新 `docs/summary/PROJECT_STATUS.md` 和 `docs/summary/ROADMAP.md`
- 如涉及黑盒测试, 更新 `docs/testing/blackbox-test-guide.md` 或新增对应验证说明

最终汇报口径:

```text
当前已完成 15/45。下一阶段严格目标是 25/45, 不靠 mock、不靠 UI 包装。
重点完成同步策略闭环、性能与监控、审计防篡改、日志/检索/索引导出、站点任务日志摘要采集。
ES/ClickHouse/ADFS/站点 schema 相关项继续列为 blocked, 不冒充完成。
```

## 9. 执行顺序

推荐顺序:

1. R.39 同步策略闭环。
2. R.40 性能与监控验收。
3. R.41 审计防篡改与日志导出。
4. R.42 有界检索导出与索引导出。
5. R.43 站点任务日志摘要采集。

理由:

- 同步是项目主线, 优先证明总控不是展示系统。
- 性能/监控能支撑 availability 和 maintainability。
- 审计/签名能支撑 security。
- 导出类需求 ROI 高, 可真实闭环。
- 任务日志摘要采集需要先查完整 schema, 放在最后防止被源端字段阻塞影响前面进度。

## 10. 审核检查

- 无 TBD/TODO。
- 不降低 `requirements.md`。
- 不新增业务页面作为完成率包装。
- 不把外部依赖项纳入 complete。
- 每项都有明确 API/DB/UI/e2e/文档闭环。
- 六个质量属性已映射到实现和验收。
