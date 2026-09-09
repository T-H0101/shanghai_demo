# Sprint R.105 — 站点区域排序与站点列表分组 Requirements Review

**Sprint**: R.105  
**日期**: 2026-09-07  
**对应 requirement 节**: `requirements.md` §2.1 站点管理（站点配置展示）  
**Verdict**: `partial`（本 Sprint 范围内的排序/分组为 complete；§2.1 全生命周期仍 partial）

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | Sprint R.105 |
| Sprint 标题 | 站点区域可排序，站点列表按区域分组 |
| 日期 | 2026-09-07 |
| 对应 requirement 节 | requirements.md §2.1 |
| 关联文档 | `databases/sprint-r105/01-site-region-sort.sql` |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 (≤30 字) | 状态枚举 |
|---|---|---|
| REQ-2.1.1 | 管理站点基础信息（名称、所属等） | `partial` |

本 Sprint 只补「所属区域展示顺序」；不宣称站点新增/编辑/禁用/删除、SSO、监控已 complete。

---

## 2. Requirement 原始文本 (逐字摘录)

```
2.1 站点管理
核心：统一管控所有数据中心站点，建立站点与统一系统的连接基础，支持站点全生命周期管理。

站点配置|1. 管理所有站点的基础信息：名称、所属数据中心、IP地址、端口、状态（在线/离线）、联系人；2. 支持站点新增/编辑/禁用/删除，配置信息实时生效。
```

---

## 3. 需求状态枚举

| Req ID | 状态 | 说明 |
|---|---|---|
| REQ-2.1.1 | `partial` | 列表按区域主数据排序已落地；站点 CRUD/启停仍未做（既有口径） |

---

## 4. 实现明细 (Implementation)

| Req ID | 文件 / API / 表 | 改动类型 |
|---|---|---|
| REQ-2.1.1 | `databases/sprint-r105/01-site-region-sort.sql` | 新增 `site_regions.sort_order` |
| REQ-2.1.1 | `databases/sprint-2b0/init-docker.sh` | 注册 DDL |
| REQ-2.1.1 | `PUT /api/sites/regions/reorder` | 新增，写 sort_order + audit |
| REQ-2.1.1 | `GET /api/sites/regions` | `ORDER BY sort_order, code` |
| REQ-2.1.1 | `GET /api/sites` | 区域顺序分组，同区域内按 `site_name` |
| REQ-2.1.1 | `components/sites/site-regions-panel.tsx` | 拖拽排序 |
| REQ-2.1.1 | `app/(platform)/sites/page.tsx` | 分组视觉分隔，沿用接口顺序 |
| REQ-2.1.1 | `lib/search/search-region-scope.ts` | 检索区域 facets 同序 |
| REQ-2.1.1 | `scripts/e2e/test-site-region-sort.ts` | 事件测试 |

---

## 5. 后端真实能力 (Backend Reality)

| 能力 | 是否真实 | 证据 |
|---|---|---|
| 区域顺序 | 是：中心库 `site_regions.sort_order` | `PUT /api/sites/regions/reorder` + `SELECT code, sort_order FROM site_regions` |
| 站点列表分组 | 是：`GET /api/sites` SQL `ORDER BY` | `sr.sort_order` + `sr.code` 保证同区域连续，再 `ss.site_name` |
| 未挂靠站点 | 是：排在已归属区域之后 | `CASE WHEN ss.region_code IS NULL THEN 1 ELSE 0 END` |
| 站点业务系统顺序 | 否：不写站点库 | 总控主数据 only |

---

## 6. UI 真实能力 (UI Reality)

| 元素 | 点击行为 | 是否误导 |
|---|---|---|
| 区域列表拖动手柄 | `PUT /api/sites/regions/reorder`，toast「区域顺序已保存」 | 否 |
| 站点列表 | 读 `GET /api/sites`，前端只筛选不二次排序 | 否 |
| 分组顶部分隔线 | UI-only，同区域连续时更易扫读 | 否 |

---

## B. 前端变更清单（8 项强制披露）

1. 新增页面：无  
2. 修改交互：站点区域列表可拖拽排序；站点表按区域分组显示  
3. 删除交互：无  
4. UI-only：分组 `border-t` 分隔（数据仍来自 API 顺序）  
5. 真实后端：reorder API + `sort_order` + 站点列表 SQL 排序  
6. simulator / DRY_RUN：无  
7. 是否超出 requirements.md 主线：否（§2.1 站点配置展示）  
8. 理由：同一区域站点需显示在一起，区域顺序由总控维护  

---

## C. API 变更清单

- `PUT /api/sites/regions/reorder` `{ codes: string[] }`（须覆盖全部区域）
- `GET /api/sites/regions` 增加 `sortOrder`，顺序改为 sort_order
- `POST /api/sites/regions` 新区域 `MAX(sort_order)+1`
- `GET /api/sites` 排序改为区域序 + 站点名称

---

## D. 数据库变更清单

- `site_regions.sort_order INTEGER NOT NULL DEFAULT 0`
- 存量全 0 时按 `code` 回填 1..n
- 已有非 0 顺序不覆盖

---

## E. 事件测试清单（10 项）

| # | 项 | 结果 |
|---|---|---|
| 1 | 点击位置 | 区域列表 `data-testid=site-region-drag-*` / 拖拽手柄 |
| 2 | 点击前 | GET `/api/sites/regions` |
| 3 | 请求 | PUT `/api/sites/regions/reorder` `{codes}` |
| 4 | 返回 | 200，`message=区域顺序已保存` |
| 5 | 数据库 | `sort_order` 与 codes 下标一致 |
| 6 | 列表 | GET `/api/sites` 区域块顺序变化且同区域连续 |
| 7 | toast | 「区域顺序已保存」 |
| 8 | mock | 无 |
| 9 | 误导 | 未使用「排序成功/已暂停」 |
| 10 | requirements | REQ-2.1.1 展示顺序 |

脚本：`pnpm e2e:site-region-sort`

---

## F. 浏览器验证结果

本机 Docker 中心库当时无注册站点。用临时 4 站（上海1/2、北京1、未归属）验证后已删除假站点，保留区域主数据 SH/BJ：

- `GET /api/sites` 初始：SH01, SH02（上海连续）→ BJ01 → UN01（未归属最后）
- `PUT reorder ["BJ","SH"]` 后：BJ01 → SH01, SH02 仍连续 → UN01
- `pnpm e2e:site-region-sort` 23 pass / 0 fail
- `pnpm exec tsc --noEmit` 通过；`pnpm exec next build` 通过（含 `/api/sites/regions/reorder`）

IDE 浏览器 MCP 本轮不可用，未做拖拽手柄实点；拖拽由面板源码 + reorder API/e2e 覆盖。

---

## G. mock / simulator / DRY_RUN

均无。顺序写入中心库，不是模拟。

---

## H. 未完成项

- REQ-2.1.1 站点新增/编辑/禁用/删除、业务启停：本 Sprint 不做（既有约束）
- 站点列表内站点之间不可单独拖拽（按需求：区域序 + 名称）

---

## 7. Mock / Simulator 状态

| 能力 | Mock | Simulator | DRY_RUN | 真写入中心库 |
|---|---|---|---|---|
| 区域排序 | 否 | 否 | 否 | 是 |

---

## 8. 缺失件

| 缺失件 | 原因 |
|---|---|
| 站点全生命周期写操作 | 总控不做站点业务启停；登记入口已隐藏 |

---

## 9. Blocker 类型

本 Sprint 排序能力无 blocker。REQ-2.1.1 其余写操作仍为既有 `out_of_scope` / 未开工（非本 Sprint 引入）。

---

## 10. 源端 / 站点 schema 变更清单

无需站点库变更。`sort_order` 仅中心库 `site_regions`。

---

## 11. requirements 完成率

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID | 1 |
| complete | 0（§2.1.1 整体仍 partial） |
| partial | 1 |
| out_of_scope | 0 |
| 本 Sprint 完成率 | 0/1 complete；排序子能力已落地，不把 §2.1 整体标 complete |

---

## 12. Verdict

`partial`

- 区域拖拽顺序写入 `site_regions.sort_order`，站点列表按区域聚在一起再按名称排
- 不宣称 REQ-2.1.1 站点配置全量 complete

---

## 13. 提交前检查清单

- [x] Req ID 已列
- [x] 状态枚举
- [x] 后端 SQL/API 证据
- [x] mock/DRY_RUN 区分
- [x] 缺失件
- [x] blocker
- [x] 站点 schema：无需
- [x] 完成率未用「业务完成度」
- [x] verdict
- [x] tsc / build / e2e 本地绿（提交前跑）

## I. 是否允许 commit

满足 R.5 事件测试脚本 + 10 项禁止无违反（不偷偷加页、不用 mock 冒充）→ tsc/build/e2e 通过后 **pass**。
