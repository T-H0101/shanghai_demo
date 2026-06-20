# Sprint UI Cleanup Requirements Review

## Requirement IDs

- REQ-4.2.1: 任务新建
- REQ-4.2.2: 任务暂停/恢复/控制
- REQ-4.3.1: 盘笼/盘架管理
- REQ-5.1.1: 日志与控制记录
- REQ-6.3.1: 前端兼容性与可用性
- REQ-6.4.2: 可维护性

## Requirement 原始文本

摘录自 `docs/source/requirements.md`:

- 任务管理要求支持任务新建、暂停、恢复、重置、巡检、恢复任务等控制能力。
- 盘笼/设备管理要求统一查看光盘库硬件节点、盘笼、盘位、光盘状态。
- 日志要求记录系统操作、同步、任务和审计行为。
- 非功能要求保证兼容性、可维护性和可用性。

## Implementation

- `app/tasks/page.tsx`: 移除旧“节点新建任务”入口，改为总控新建任务弹窗，提交 `POST /api/tasks/create`。
- `app/racks/page.tsx`: 修正存储浏览/数据恢复 blocked 文案，不再暗示跳转站点节点。
- `components/shared/first-run-coach.tsx`: 增加“全部不再显示”引导控制，避免首访引导重复干扰。
- `app/api/site-navigation/task-create/route.ts`, `lib/site-navigation/task-create.ts`, `scripts/e2e/test-task-navigation.ts`: 删除旧站点节点跳转实现。
- `README.md`: 更新当前真实架构、运行方式、验证命令和汇报口径。
- `docs/superpowers/plans/2026-06-20-command-center-ui-optimization.md`: 新增后续 UI/UX 优化计划。

## Backend Reality

- 总控新建任务调用 `POST /api/tasks/create`，后端写入 `control_command`，由 Site Agent 拉取后写站点库。
- 本 Sprint 不直接写 `unified_tasks`，不宣称“站点任务已创建成功”。
- 删除旧 `site-navigation/task-create` 后，任务创建不再依赖站点跳转 URL。

## UI Reality

- Tasks 页面按钮文案为“总控新建任务”。
- 提交成功文案为“任务创建命令已提交”，并说明等待站点 Agent 执行。
- Racks 存储浏览/恢复未接入时显示 blocked 原因，不使用 mock 文件树或假恢复成功。
- First-run guide 覆盖主页面，并支持用户一键关闭全部引导。

## Mock / Simulator / DRY_RUN / 真控制

- Mock: 本 Sprint 不新增 mock。
- Simulator: 不新增 simulator。
- DRY_RUN: 不把 DRY_RUN 结果计入 complete。
- 真控制: 只有 Site Agent 执行并回写站点库后才可宣称真控制完成。

## Missing Pieces

- 生产 Site Agent 部署验收。
- ES/ClickHouse 生产环境配置与索引/日志写入验证。
- ADFS/LDAP/企业 SSO 参数与测试账号。

## Blocker Type

- REQ-4.2.1: `partial`，本地 Agent 闭环通过；生产 strict complete 仍需站点部署验收。
- REQ-4.3.1: `blocked_by_source_schema`，盘笼移动源端 schema 仍需确认。
- REQ-5.1.1: `partial`，ClickHouse 未配置时使用中心 PG/blocked 边界。

## 需要的源端 schema / 站点 API 变更清单

- 生产 Site Agent 需要可访问中心 `/api/site-control/commands` 与 result 回写接口。
- 恢复任务需要站点恢复协议和文件索引关联字段验证。
- 盘笼移动需要站点侧移动登记表或等价控制表。

## Verdict

pass for UI cleanup, documentation, and wording alignment. No requirement is upgraded solely because of UI changes.
