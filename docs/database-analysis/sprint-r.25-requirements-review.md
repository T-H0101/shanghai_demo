# Sprint R.25 Requirements Review

## 1. Requirement IDs

- REQ-4.2.4
- REQ-6.4.2

## 2. Requirement 原始文本

> 任务监控：需支持进度、状态、告警 push。

> 监控：CPU/内存/磁盘/接口。

## 3. Implementation

- `components/ui/global-control-ball.tsx`
  - 移除 mock 通知和硬编码系统状态。
  - 真实接入 health / db-health / alerts / control commands / sync site status。
  - 新增 blocker 视图。
- `scripts/e2e/test-floating-assistant.ts`
  - 新增白盒验证。
- `scripts/e2e/run-all.ts`
  - 纳入 `e2e:all`。
- `package.json`
  - 增加 `e2e:floating-assistant` 脚本。

## 4. Backend reality

- 未新增新 API。
- 仅复用既有真实 API：
  - `GET /api/system/health`
  - `GET /api/system/db-health`
  - `GET /api/alerts`
  - `GET /api/control/commands`
  - `GET /api/sync/sites/status`

## 5. UI reality

- 悬浮助手现在展示真实接口状态、真实告警、真实待执行命令和站点 Agent 状态。
- 不再显示假 CPU/内存百分比。
- 对缺失能力明确展示 blocker，不误导成功态。

## 6. Mock / Simulator / DRY_RUN / 真控制区分

- 本 Sprint 没有新增控制执行能力。
- 告警/命令/站点状态均来自真实中心库 API。
- CPU/内存/磁盘主机级指标仍未完成，不伪造。

## 7. Missing pieces

- 主机 CPU/内存/磁盘真实 runtime source
- 历史趋势与阈值告警
- 任务状态 <=10 秒同步证明
- 邮件/通知通道

## 8. Blocker type

- `partial`
- 主 blocker:
  - `blocked_by_external_system`
  - `blocked_by_site_change`

## 9. 需要的源端 schema / 站点 API 变更清单

- 无新增 schema 变更。
- 若要补全主机级指标，需要真实 runtime/monitoring source。

## 10. Verdict

- `partial`

## A. 前端变更清单

- 新增页面/组件：无
- 修改按钮/交互：悬浮助手通知面板改为真实告警；系统页改为真实状态摘要
- 删除按钮/交互：无
- UI-only：blocker 展示
- 真实后端能力：health/db-health/alerts/control/sync-sites-status
- simulator / DRY_RUN：无新增
- 是否新增 requirements.md 未要求内容：无

## B. API 变更清单

- 无新增 API

## C. 数据库变更清单

- 无 schema 变更

## D. 事件测试清单

- `pnpm e2e:floating-assistant`

## E. 浏览器/白盒验证结果

- `e2e:floating-assistant` 19/19

## F. mock/simulator/DRY_RUN 标记

- health / alerts / commands / site status：real
- host metrics：blocked / not_implemented

## G. 是否允许 commit

- 允许
- 条件：整套强校验通过后提交
