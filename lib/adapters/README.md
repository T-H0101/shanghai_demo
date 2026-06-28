# lib/adapters — 外部能力具体实现

> **职责**: 实现 port interface; 持有连接池 / 客户端 / 凭据。
> **禁止**: 业务规则 (不应有 if/else 业务逻辑); 在 route 文件直接 import (route 只能调 domain → port → adapter)。
> **允许**: 引入 `pg` / `@opensearch-project/opensearch` / `axios` 等驱动; 读 `process.env`; 实现错误转换 (`PortError`)。

## 强制目录

| 子目录 | 实现目标 | Sprint |
|---|---|---|
| `lib/adapters/postgres/` | PG17 中心库 + 站点库适配 | 持续 |
| `lib/adapters/opensearch/` | OpenSearch/ES 大表文件索引 | R.85 |
| `lib/adapters/site-agent/` | 站点 Agent 客户端 (sync package 推送 / control command 拉取) | R.86+ |
| `lib/adapters/credential-store/` | 凭据查找 (env / secret manager) | R.88 |

## 当前状态

- 现状: 业务逻辑和驱动代码混在 `lib/sync/*` + `app/api/*`。
- 目标: 每个 Sprint 只迁移被该 Sprint 触碰的适配器, 不做大重构。
- R.85 落地示例: `lib/adapters/opensearch/file-search-adapter.ts` (SearchPort 实现)。

## 写作规范

1. 文件命名: `<能力>-adapter.ts`, 例 `file-search-adapter.ts`。
2. 命名空间: 一个 port 一个 adapter 文件, 内部可用多个 class。
3. 工厂: 导出 `createXAdapter(env): XPort` 工厂函数, 由 `app/api/*` 在启动时调用一次, 注入到 domain。
4. 错误转换: 驱动层错误 (PG / ES / HTTP) 必须转换为 port 层的 `PortError` 枚举。
5. 凭据: 只在 adapter 文件中读 `process.env.*`; domain / port / API route 严禁读。
