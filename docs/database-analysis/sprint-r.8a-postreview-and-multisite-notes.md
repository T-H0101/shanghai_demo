# Sprint R.8A-1 — Post-Review 与多站点架构文档确认

> **日期**: 2026-06-11
> **范围**: 低风险检查 + 文档收口，不新增功能/页面/表

---

## 1. R.8 遗留 e2e 修复

### 失败原因

| # | 用例 | 失败原因 | 修复 |
|---|---|---|---|
| 1 | "状态机 8 态: observed=pending" | limit=20 只看最近 20 条全是 pending | 改 limit=200，观察到 5 种状态 |
| 2 | "DRY_RUN: tbl_task.id=1 查询失败" | 用 centralQuery (unified user) 查 tbl_task，但 tbl_task 在 star_storage_db (5434) | 改用 `docker exec site_restore_full_postgres psql -U starxdb` |

### 修复后结果

**78/78 全过 ✅**

| 脚本 | 结果 |
|---|---|
| Dashboard | 9/9 |
| Tasks | 11/11 |
| Sync | 17/17 |
| Control | **19/19** (修复前 18/19) |
| Sites | 9/9 |
| Search | 13/13 |

---

## 2. 多站点架构确认

### 2.1 当前事实

| 维度 | 事实 |
|---|---|
| SH01 测试站点 | 单站点完整库 `star_storage_db` (170 表, 5434 端口) |
| source_restore | 13 张 partial 表，不代表完整站点库 |
| disc_files.sql | 字段/表结构静态基线 (147 张表) |
| 统一站点识别 | 通过 `source_site_id` / `siteCode` 区分 |
| 当前已登记站点 | unified_tasks 有 7 个 siteCode (SH01/BJ02/PKG_TEST 等) |
| sync_package_log | 11 个站点有同步记录 |

### 2.2 架构结论

1. **每个站点应保留独立原数据库** — 不混合进同一个 source_restore
2. **总控中心库通过 `source_site_id` / `siteCode` 区分站点** — 已实现 (Sprint 2F.4)
3. **source_restore 只是当前测试同步源** — 不代表多站点架构
4. **disc_files.sql 是字段结构基线** — 参照 CLAUDE.md 附录 C
5. **star_storage_db 是当前测试站点完整运行库** — 不是所有站点共享

### 2.3 下一步需要

- **站点登记表** (`site_registry` / `unified_site_registry`) — 设计但暂不落库
- 每个站点独立 `SOURCE_DATABASE_URL` + `SYNC_PACKAGE_SECRET`
- 总控站点管理页面真实化 (当前是 mock)

---

## 3. /sites 当前真实状态

### 3.1 API 层

| 维度 | 当前状态 |
|---|---|
| `/api/sites` 返回 | `dataSource: derived` (R.4 修复后正确) |
| 数据来源 | `unified_tasks/unified_devices/unified_volumes/sync_package_log` 派生 |
| 站点数 | 7 (从中心库表 source_site_id 派生) |
| mock | **已修复，不返回 mock** |

### 3.2 页面层

| 维度 | 当前状态 | 问题 |
|---|---|---|
| `/sites` 页面 | **仍用 `mockSites`** (L24 `import { sites as mockSites }`) | 🔴 **页面没用 /api/sites!** |
| 站点列表 | `useState<Site[]>(mockSites)` (L34) | 硬编码 6 站点 (上海/北京/广州/成都/南京/武汉) |
| 站点详情 | `mockSiteProvider.checkConsistency` (L84) | mock 函数 |
| siteCode selector | Header 组件 useSite() | 从 siteContext 读，非 /api/sites |

### 3.3 站点管理能力缺口

| 能力 | 当前状态 | 缺什么 |
|---|---|---|
| 站点列表 | API: derived 7 站点 / 页面: mock 6 站点 | 页面需改为读 /api/sites |
| 站点详情 | mock | 需真实 API |
| 站点新增/编辑 | 无 | 需 site_registry 表 + API |
| 站点删除 | 无 | 需确认是否允许 |
| 站点启用/禁用 | 无 | 需 site_registry.enabled |
| 站点同步状态 | 派生 (unified_tasks count) | 需 site_registry.last_sync_status |
| 站点健康状态 | 无 | 需 site_registry.health_status |

### 3.4 下一 Sprint 建议

**Sprint R.9: 站点登记表 + /sites 页面真实化**
- 落库 `unified_site_registry` 表
- /sites 页面改为读 /api/sites (derived)
- 后续再加 site_registry CRUD

---

## 4. site_registry 设计（暂不落库）

| 字段 | 类型 | 说明 |
|---|---|---|
| site_code | VARCHAR(50) PK | 站点代码 (SH01/BJ02) |
| site_name | VARCHAR(100) | 站点名称 |
| display_name | VARCHAR(100) | 显示名 |
| source_type | VARCHAR(20) | standalone / shared / cloud |
| source_database_url_ref | VARCHAR(200) | env key ref (e.g. SOURCE_DATABASE_URL_SH01) |
| sync_secret_ref | VARCHAR(200) | env key ref (e.g. SYNC_SECRET_SH01) |
| enabled | BOOLEAN | 是否启用 |
| sync_interval_seconds | INT | 同步间隔 (默认 3600) |
| last_sync_at | TIMESTAMPTZ | 最近同步时间 |
| last_sync_status | VARCHAR(20) | success/failed/never |
| last_consistency_status | VARCHAR(20) | matched/mismatched/never |
| health_status | VARCHAR(20) | healthy/degraded/unknown |
| description | TEXT | 描述 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

**安全约束**：
- 禁止明文保存数据库密码
- 禁止明文保存 secret
- 配置里只保存 env key/ref
- 真实 secret 只能在 .env.local 或部署环境

---

## 5. 约束自检

- ✅ 不新增业务页面
- ✅ 不新增无关功能
- ✅ 不改同步协议
- ✅ 不接 tbl_file/tbl_folder
- ✅ 不把源库 tbl_site 当总控站点表
- ✅ 不把 derived sites 当完整站点管理能力
