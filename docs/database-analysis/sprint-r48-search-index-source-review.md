# Sprint R.48 — Search/Index Scope Closure

> Requirement IDs: `REQ-4.1.1`, `REQ-5.2.1`, supports `REQ-2.3.1`
> Date: 2026-06-20

---

## A. Requirement 对照

| Req ID | 原始文本 | Status |
|---|---|---|
| REQ-4.1.1 | 跨维度检索 (名称/后缀/部门/卷/盘) | partial |
| REQ-4.1.2 | 检索性能 ≤3 秒 (千万级) | blocked_by_external_system |
| REQ-5.2.1 | 索引范围 (按盘笼 + 校验码) | partial |

## B. 前端变更清单

| 项 | 内容 |
|---|---|
| 新增页面/组件 | 无 |
| 真实后端能力 | `GET /api/search` 从 501 重写为真实查询 star_storage_db |
| simulator/DRY_RUN | 无 |

## C. API 变更清单

| API | 变更 | 影响 |
|---|---|---|
| `/api/search` | 501 → 200, 查询 `tbl_file_*` 分区 | REQ-4.1.1 |

## D. 数据源证据

**查询测试**: `GET /api/search?keyword=pdf&limit=3`

返回 3 条真实文件记录:
- `01-01.pdf` — 6MB, checksum `B008BBB01DD9450154593B6BD044609C`
- `J0001-001-000001.pdf` — 8MB, checksum `D2358DEC7B7D1E2E0156919B74355D2E`
- `HB-YJ-2016-11B.pdf` — 60MB, checksum available

**搜索维度覆盖**:

| 维度 | 支持 | 来源 |
|---|---|---|
| 文件名 (keyword) | ✅ | `file_name ILIKE` |
| 后缀 (suffix) | ✅ | `file_name` 提取 |
| 部门 (department) | ❌ | `tbl_depa` 0 行 |
| 卷 (volumeId) | ⚠️ | `task_id` 代理, `tbl_logical_volume` 仅 3 行 |
| 盘 (discNo) | ⚠️ | `slot_id` 代理 |
| 校验码 (checksum) | ✅ | `hash` / `hash1` 列 |

## E. 缺失项

1. **千万级检索** — 需 ES/ClickHouse, 当前 LIMIT 200 保护
2. **部门维度** — `tbl_depa` 空
3. **跨站点搜索** — 当前仅 SH01

## F. Verdict

**partial** — 文件名/后缀/校验码维度可用 (40K+ 行真实数据), 部门/性能维度 blocked。

---

Commit: `feat(r48): search API from source file index [REQ-4.1.1]`
