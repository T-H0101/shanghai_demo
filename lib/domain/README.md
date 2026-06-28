# lib/domain — 业务规则

> **职责**: 业务规则、状态机、事务边界。
> **禁止**: 依赖具体数据库驱动 (`pg` / `@opensearch-project/opensearch` / `axios` 等); 直接读 `process.env`; 直接连外部 HTTP / DB 端口。
> **允许依赖**: `lib/ports/*` (只通过 port 调用外部能力)、`lib/types/*`、纯 TS 工具库。

## 业务子域

| 子域 | 路径 | 职责 |
|---|---|---|
| `sync` | `lib/domain/sync/` | 同步包解析、字段映射、dispatcher 决策 |
| `search` | `lib/domain/search/` | 文件索引文档、索引作业、权限过滤 |
| `control` | `lib/domain/control/` | 控制命令状态机 (新建/暂停/恢复/重置/巡检/恢复) |
| `audit` | `lib/domain/audit/` | 审计事件归一化 |

## 当前状态

- 现状: 业务规则散落在 `lib/sync/*` + `app/api/*` route 中。
- 目标: 每个 Sprint 仅迁移被该 Sprint 触碰的子域; 不做大重构 (架构质量路线图 §6)。
- R.85 落地示例: `lib/domain/search/file-index-document.ts` (文件索引文档契约)。

## 写作规范

1. 文件命名: `<子域>/<业务对象>.ts`, 例 `lib/domain/sync/package-validator.ts`。
2. 导出: 仅导出纯函数、状态机、类型; 不导出 `Pool` / `Client` 实例。
3. 错误: 抛 `DomainError` (在 `lib/domain/errors.ts`), 由 API route 统一转换为 HTTP 响应。
4. 状态: 状态机用 `type XState = ...` + 显式 transition 函数, 禁止 `as any`。
