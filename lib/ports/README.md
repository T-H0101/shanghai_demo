# lib/ports — 外部能力抽象接口

> **职责**: TypeScript interface, 描述业务侧需要什么能力。
> **禁止**: 泄露具体协议 (HTTP/PG/ES 字段名); 包含任何 `process.env`; 实现逻辑。
> **允许**: 接口签名、JSDoc、输入输出类型。

## 强制 port 列表 (来自 ADR 0002)

| Port | 路径 | 用途 |
|---|---|---|
| `SearchPort` | `lib/ports/search-port.ts` | 文件搜索 query + hit (R.85) |
| `SiteAgentPort` | `lib/ports/site-agent-port.ts` | sync package 推送 / control command 拉取 / file index batch (R.86+) |
| `CredentialStorePort` | `lib/ports/credential-store-port.ts` | 通过 `credential_ref` 读真实凭据 (R.88) |
| `AuditPort` | `lib/ports/audit-port.ts` | 写 audit_log + 读 audit 事件 (R.87) |

## 当前状态

- 现状: 端口契约尚未存在; R.85 落地第一个 `SearchPort`。
- 目标: 后续 Sprint 每个 port 由对应 adapter 实现, 测试可 stub。
- R.85 落地示例: `lib/ports/search-port.ts`。

## 写作规范

1. 文件命名: `<能力>-port.ts`, 例 `search-port.ts`。
2. 导出: 仅 `interface` + `type`。
3. 错误: port 方法签名返回 `Promise<Result<T, PortError>>`, 不抛业务异常。
4. 输入输出: 所有 id 用 `string` (统一 ID 策略见 `docs/architecture/id-strategy.md`)。
5. 不允许 port 方法带 `dbPool` / `client` / `axiosInstance` 参数。
