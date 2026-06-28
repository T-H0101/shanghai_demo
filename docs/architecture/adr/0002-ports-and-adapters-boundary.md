# ADR 0002: External Systems Behind Ports and Adapters

> Status: Accepted (R.85)
> Date: 2026-06-29
> Sprint: R.85 + R.86
> Deciders: platform
> Requirements: `requirements.md §6.4 可维护` / `§6.2 安全` / `§6.3 兼容`

## Context

中心服务当前依赖多个外部系统:

- PostgreSQL 17 (中心库, Docker 5432)
- OpenSearch/ES (大表文件索引, Docker 9200)
- Site Agent (站点数据库 + 凭据, 分布式)
- Credential Store (secret manager / env file)

如果让页面或 API route 直接调用这些外部系统 (拼 SQL、写 HTTP、写 env), 会造成:

- 僵化: 加 ES 版本切换要改 N 个页面。
- 脆弱: 凭据泄露在多处源码里。
- 粘滞: 新增搜索后端必须改业务逻辑。

## Decision

每个外部系统**必须**有:

1. **Domain rule** (在 `lib/domain/*`): 业务规则、状态机、事务边界。不允许 import 任何具体驱动 (`pg`, `@opensearch-project/opensearch`, `axios`, `node-fetch` 等)。
2. **Port** (在 `lib/ports/*`): TypeScript interface, 描述业务侧需要什么能力。**不允许**泄露具体协议、URL、字段名。
3. **Adapter** (在 `lib/adapters/*`): 具体实现 (PG / OpenSearch / Site Agent / Credential Store)。可以被换掉, 不影响 domain 和 API。

四个强制 port:

| Port | 接口语义 | 实现 |
|---|---|---|
| `SearchPort` | 文件搜索 query + hit | `lib/adapters/opensearch/file-search-adapter.ts` (R.85) |
| `SiteAgentPort` | sync package 推送 / control command poll-ack / file index batch | `lib/adapters/site-agent/*` (R.86+) |
| `CredentialStorePort` | 通过 `credential_ref` 读真实凭据 | `lib/adapters/credential-store/*` (R.88) |
| `AuditPort` | 写 audit_log + 读 audit 事件 | `lib/adapters/postgres/audit-adapter.ts` (R.87) |

## Consequences

### Positive

- API route 只调用 domain service; domain 只调用 port; port 由 adapter 实现 — 分层清晰。
- 单元测试可以 stub port, 不连真实 ES/PG。
- 切换 OpenSearch 版本或换 Elasticsearch 客户端时, 只改 adapter 文件。
- 凭据永远只在 adapter 层出现, 不进 domain / API / UI。
- 故障态 (ES 不可用 / 站点断连 / 凭据缺失) 在 adapter 层转换为 `blocked_by_external_system` 等结构化状态, domain 层用统一枚举处理。

### Negative

- 多了一层间接, 首次写代码比 "直连" 慢。
- 严禁 "为了快" 在 route 里写 SQL 或 HTTP 调用 — 这是 review 项。

### Compliance

- ✅ `lib/ports/search-port.ts` (R.85 创建)
- ✅ `lib/adapters/opensearch/file-search-adapter.ts` (R.85 创建)
- ✅ 严禁在 `app/api/*` route 文件里 `import { Client } from "@opensearch-project/opensearch"` 等。
- ✅ 严禁在 domain 文件里读 `process.env.SITE_DATABASE_URL`。

## Follow-ups

- R.85: 落地 `SearchPort` + OpenSearch adapter + 第一个 indexer。
- R.86: 落 `SiteAgentPort` + Site Agent adapter (控制命令和文件索引批量)。
- R.87: 落 `AuditPort` + adapter + 监控指标。
- R.88: 落 `CredentialStorePort` (对接站点接入 kit)。
