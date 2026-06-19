# Sprint R.24 Requirements Review

## 1. Requirement IDs

- REQ-5.1.2

## 2. Requirement 原始文本

> 日志导出：1. 支持按任务ID/时间范围/站点/结果状态/任务类型（刻录/回迁）筛选导出；2. 导出格式：Excel/CSV/JSON，支持大文件分片导出；3. 导出文件需包含数字签名，防止篡改。

## 3. Implementation

- `lib/export/xlsx.ts`
  - 新增真实 XLSX 生成，输出 OOXML 二进制。
- `lib/export/manifest.ts`
  - 增加 `signature` 元数据边界。
- `app/api/logs/export/route.ts`
  - `format=xlsx` 走真实导出并写 `audit_log`。
- `scripts/e2e/test-exports.ts`
  - logs xlsx 从 501 改为 200 验证，其余端点继续显式 501。
- `scripts/e2e/test-logs.ts`
  - 新增 `/api/logs/export` xlsx 和 signature manifest 校验。
- `pnpm-workspace.yaml`
  - 修复 `sharp` build approval 占位值。
- `.env.example`
  - 新增 `EXPORT_SIGNING_KEY_REF` 占位。

## 4. Backend reality

- `GET /api/logs/export?format=xlsx` 返回真实 Excel 文件。
- `content-type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`。
- `x-manifest` 可解码到 `signature` 元数据。
- 成功导出写入 `audit_log action='export'`。

## 5. UI reality

- `/logs` 页面既有 Excel 按钮现在对应真实后端能力。
- 当前没有“数字签名验证成功”之类误导措辞。

## 6. Mock / Simulator / DRY_RUN / 真控制区分

- 本 Sprint 与控制无关。
- XLSX 是真实文件导出，不是 mock，不是 simulator。
- `signature` 目前只是元数据边界，不是真实证书签名。

## 7. Missing pieces

- 真实证书/私钥数字签名
- 大文件分片/异步导出
- 默认 ≥2 年留存策略证据
- 刻录/回迁全量业务日志字段尚未全部接入中心库

## 8. Blocker type

- `partial`
- 主 blocker: `blocked_by_external_system`

## 9. 需要的源端 schema / 站点 API 变更清单

- 无新增站点 schema 变更。
- 如需满足“数字签名完成”，需要独立密钥托管或签名服务，不能把私钥落进仓库。

## 10. Verdict

- `partial`

## A. 前端变更清单

- 新增页面/组件：无
- 修改按钮/交互：无新增按钮，仅既有 `/logs` XLSX 按钮改为真实后端能力
- 删除按钮/交互：无
- UI-only：无
- 真实后端能力：`/api/logs/export?format=xlsx`
- simulator / DRY_RUN：无
- 是否新增 requirements.md 未要求内容：无

## B. API 变更清单

- `GET /api/logs/export`
  - 新增 `format=xlsx` 真实导出路径

## C. 数据库变更清单

- 无 schema 变更
- 导出成功继续写既有 `audit_log`

## D. 事件测试清单

- `pnpm e2e:exports`
- `pnpm e2e:logs`

## E. 浏览器/白盒验证结果

- 白盒验证通过：
  - `e2e:exports` 175/175
  - `e2e:logs` 43/43

## F. mock/simulator/DRY_RUN 标记

- XLSX：real
- signature：partial / blocked_by_config

## G. 是否允许 commit

- 允许
- 条件：补齐本单元 full verification 后提交
