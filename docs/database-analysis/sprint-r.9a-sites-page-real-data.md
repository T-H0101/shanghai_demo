# Sprint R.9A — /sites 页面真实化

> **日期**: 2026-06-11
> **范围**: 仅 /sites 页面从 mock 切换到 /api/sites, 不新增数据库表/API/页面
> **状态**: ✅ 完成 (22/22 sites e2e + 91/91 e2e:all + 13/13 baseline + 7/7 consistency)

---

## 1. 原 mock 问题 (R.8A-1 已识别)

### 1.1 硬编码 mock 站点
- `app/sites/page.tsx` L24 `import { sites as mockSites } from "@/lib/mock/sites"`
- 6 个 mock 站点 (上海/北京/广州/成都/南京/武汉), 全部假数据
- `useState<Site[]>(mockSites)` 直接灌入 state

### 1.2 全量 setTimeout 假操作
- `handleSync` (L54-64): 1.5s 后假装"全量同步成功"
- `handleToggleStatus` (L95-138): 假装"启用/禁用" + 2.5s 后"同步恢复"
- `handleCreateSite` (L140-168): 假装"注册新站点成功"
- `handleCheckConsistency` (L80-93): `mockSiteProvider.checkConsistency` 假报告
- `handleSSO` (L66-78): 1s 后"跳转成功"

### 1.3 硬编码 stat
- `siteStats.avgStorageUsed = 62` (L9 mock 文件)
- 4 个 StatCard 显示的"在线/离线/同步中"全部基于假数据

### 1.4 误导措辞 (R.1 §7 禁止)
- "同步成功" / "跳转成功" / "站点创建成功" / "已启用" / "已禁用"
- 全部为假 toast, 用户被严重误导

---

## 2. 真实接入方式

### 2.1 数据流

```
[unified_sites]  ──┐
                   ├──> GET /api/sites ──> app/sites/page.tsx
[unified_tasks]   ─┤                         (dataSource=derived/database/empty/error)
[unified_devices] ─┤
[unified_volumes] ─┤
[sync_package_log]┘
```

### 2.2 改造点 (app/sites/page.tsx)

| 原 | 现 |
|---|---|
| `import { sites as mockSites }` | 移除, 改 `fetch('/api/sites')` |
| `useState<Site[]>(mockSites)` | `useState<Site[]>([])` + `useEffect(loadSites)` |
| `handleSync` 假同步 | 改为 `loadSites()` 真实刷新 |
| `handleCreateSite` 假创建 | `handleUnsupported("注册新站点")` toast 提示 |
| `handleToggleStatus` 假切换 | Power 按钮 `disabled` + tooltip 提示 |
| `handleSSO` 假跳转 | SSO 按钮 `disabled` (REQ-2.1.2 blocked_by_auth) |
| `handleCheckConsistency` 假报告 | `fetch('/api/sync/consistency?siteCode=...')` R.7 真实 API |
| `mockSiteProvider` 引用 | 移除 |
| 硬编码 `siteStats` | 改为 `useMemo` 从 `sites` 派生统计 |

### 2.3 dataSource 显示

- `database` → 绿色 Badge `unified_sites` (数据库直读)
- `derived` → 琥珀色 Badge `由同步数据派生` + 标题旁标注 "(由同步数据派生，名称/IP/联系人暂缺)"
- `empty` → 灰色 Badge `暂无数据` + 空态提示
- `error` → 红色 Badge `加载失败` + 重试按钮
- `loading` → 灰色 Badge `加载中…`

### 2.4 derived 来源 (当前实际状态)

`unified_sites` 0 行 → 派生路径生效, 从以下表派生 source_site_id:
- `unified_tasks` (7 站点)
- `unified_devices` (按 source_site_id 聚合)
- `unified_volumes` (按 source_site_id 聚合)
- `sync_package_log` (按 site_code 聚合)

API 返回 7 个 derived 站点 (SH01/BJ02/PKG_TEST 等), IP/联系人/数据中心为 "—", 描述字段写入派生来源说明。

---

## 3. dataSource 显示结果 (实测)

| 维度 | 实测值 |
|---|---|
| `/api/sites` HTTP | 200 |
| `code` | 0 |
| `dataSource` | `derived` |
| `source` | `unified_tasks/unified_devices/unified_volumes/sync_package_log` |
| `meta.derivedFromTables` | 4 表 (含 sync_package_log) |
| `meta.requirement.id` | REQ-2.1.1 |
| `meta.requirement.status` | blocked_by_source_schema |
| `data[]` | 7 站点 (derived) |
| `data[].status` | `derived` (非 online/offline) |

---

## 4. 按钮禁用清单 (R.9A 强制)

| 按钮 | 原行为 | 现行为 | 文案 / Tooltip |
|---|---|---|---|
| 刷新 (原"全量同步") | 假同步 1.5s | 真实 `loadSites()` | "刷新" |
| 注册新站点 | 假创建 + setState 注入 | `disabled` + `handleUnsupported` toast | "站点登记功能未接入" |
| 启用/禁用 (Power) | 假切换 2.5s | `disabled` + `handleUnsupported` toast | "站点启用/禁用功能未接入" |
| SSO 跳转 | 假跳转 1s | `disabled` + `handleUnsupported` toast | "SSO 跳转功能未接入 (REQ-2.1.2 blocked_by_auth)" |
| 数据一致性校验 | `mockSiteProvider` 假报告 | 真实 `GET /api/sync/consistency?siteCode=...` | 真实报告 + 表差异详情 |

### 4.1 不允许 toast 误导
- ❌ "已暂停" / "暂停成功" (R.1 §7)
- ❌ "跳转成功"
- ❌ "同步成功"
- ❌ "站点创建成功"
- ❌ "已启用" / "已禁用"
- ✅ "功能未接入" + 详细说明

---

## 5. e2e:sites 结果

**22/22 ✅**

```
✅ 页面 /sites 200
✅ /api/sites 200
✅ dataSource 显式 (database/derived/empty/error, 不允许 mock)
✅ 禁止 mock 冒充 (R.4 修复): dataSource=derived ≠ mock
✅ 站点列表非空 (derived 至少 1 site): items=7
✅ source 显式 (unified_sites 或派生)
✅ derived 来自真实表
✅ R.9A: 页面不再 import mockSites
✅ R.9A: 页面不再 import mockSiteProvider
✅ R.9A: 页面不再硬编码 6 mock 站点名
✅ R.9A: 页面 fetch /api/sites
✅ R.9A: 页面渲染 dataSource 标识
✅ R.9A: '注册新站点' 按钮 disabled
✅ R.9A: '启用/禁用' (Power) 按钮 disabled
✅ R.9A: 'SSO' 按钮 disabled
✅ R.9A: 不含误导 toast/onClick 措辞
✅ R.9A: 页面有加载失败错误态
✅ R.9A: 页面有空数据态
✅ R.9A: 一致性校验调 /api/sync/consistency
✅ 7 个核心 API siteCode 联动: 7/7 200 OK
✅ 派生站点 siteCode 与 unified_tasks 真实数据重叠: overlap=5
✅ 页面 HTML 不再渲染 mock 6 站点全名
```

---

## 6. e2e:all 结果 (全量回归)

**91/91 ✅** (R.8A-1 时 78/78, R.9A 新增 13 个 sites 专项检查)

| 脚本 | 通过 | 失败 |
|---|---|---|
| Dashboard | 9 | 0 |
| Tasks | 11 | 0 |
| Sync | 17 | 0 |
| Control | 19 | 0 |
| **Sites (R.9A 增强)** | **22** | **0** |
| Search | 13 | 0 |
| **合计** | **91** | **0** |

---

## 7. requirements 完成率变化

- **总需求数**: 45
- **REQ-2.1.1 站点配置**: 状态不变 (`partial` + `blocked_by_source_schema`)
  - 实现层 (e2e 验证) 从 mock 转为 derived, 但需求层依旧缺源端 `tbl_site` 真实数据
- **统计**: 仍为 `partial` 13 / `complete` 9 / `blocked_by_*` 21 / `out_of_scope` 2

**不变化原因**: requirements 完成度是需求侧状态, R.9A 仅是实现层 (页面真实化) 的修复, 不改变 REQ-2.1.1 的源端 schema blocker。

---

## 8. 7 项验证清单

- [x] `pnpm exec tsc --noEmit` 0 错
- [x] `pnpm build` 成功
- [x] `pnpm smoke:sync` 通过
- [x] `pnpm check:sync-consistency -- --siteCode=SH01` 7/7 matched
- [x] `pnpm baseline:check` 13/13 通过
- [x] `pnpm e2e:sites` 22/22 通过
- [x] `pnpm e2e:all` 91/91 通过

---

## 9. 约束自检

- ✅ 不新增数据库表
- ✅ 不新增 API
- ✅ 不新增页面
- ✅ 不做站点 CRUD (按钮 disabled)
- ✅ 不接多站点
- ✅ 不写 secret / env
- ✅ 不接 source_restore 数据库

---

## 10. 提交信息

```
fix: connect sites page to real sites api
```
