# 架构决策记录 (ADR)

> 记录影响架构的重大决策。状态: Proposed / Accepted / Superseded / Deprecated。
>
> **目的**: 让 reviewer 在新 Sprint 开始时, 5 分钟内对齐架构边界, 不再翻历史 PR。

| 编号 | 标题 | 状态 | Sprint |
|---|---|---|---|
| 0001 | PostgreSQL for Metadata, OpenSearch/ES for File Index | Accepted | R.85 |
| 0002 | External Systems Behind Ports and Adapters | Accepted | R.85 |
| 0003 | Site Agent Pull-Based Control | Accepted | R.85 (reaffirmed from Sprint 4.5) |

## 写作规范

- 每份 ADR 必须含: Status / Date / Deciders / Requirements 映射。
- 描述决策 + 后果 (positive / negative / compliance)。
- 不允许仅描述现状 — 必须给出 chosen option 和 rejected alternatives。

## 引用方式

新 PR 如果违反 ADR, 必须显式说明:

> Why this ADR is being violated (and the alternative chosen)

否则不允许合并。
