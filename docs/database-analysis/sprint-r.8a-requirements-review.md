# Sprint R.8A-1 — Requirements Review

> **Sprint**: R.8A-1 — R.8 Post-Review + 多站点架构文档确认
> **日期**: 2026-06-11
> **范围**: 低风险检查 + 文档收口

---

## 1. 修复结果

| 项 | 结果 |
|---|---|
| e2e:all | **78/78 ✅** (修复前 77/78) |
| control e2e fail 原因 | limit=20 全是 pending + centralQuery 查错 DB |
| 修复 | limit=200 + docker exec site_restore_full_postgres |

---

## 2. 多站点架构结论

- SH01 是单站点测试库 (170 表)
- 每站点应独立原数据库
- 总控通过 source_site_id 区分
- source_restore 只是测试源
- disc_files.sql 是结构基线

---

## 3. /sites 真实状态

- API: derived (正确)
- **页面: 仍用 mockSites** 🔴 (未修，R.8A-1 范围内不修)
- 下一 Sprint: /sites 页面改为读 /api/sites

---

## 4. Verdict

**pass** — R.8A-1 只做检查 + 文档 + e2e 修复，不新增功能。

---

## 5. 检查清单

- [x] e2e:all 78/78
- [x] 多站点架构结论文档化
- [x] /sites 当前状态检查 (不修)
- [x] site_registry 设计文档 (暂不落库)
- [x] 不新增功能/页面/表
