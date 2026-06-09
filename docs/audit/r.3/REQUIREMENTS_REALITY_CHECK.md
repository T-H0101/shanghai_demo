# Sprint R.3 — Requirements Reality Check (需求 vs 现实 终极审计)

> **Sprint**: R.3
> **日期**: 2026-06-10
> **审计员**: 外部审计师 (极其苛刻模式)
> **核心原则**: **不相信任何历史 Sprint 结论**, 所有数字从代码 / Docker / curl 重查
> **范围**: 全链路 6 章需求 × 前端 × 后端 × 数据库 × 控制 × 同步

---

## 0. TL;DR

| 维度 | R.2 报告 | R.3 重算 | Δ |
|---|---|---|---|
| **总需求数** | 43 | **45** | +2 (R.2 把 out_of_scope 误标, 实际是 blocked) |
| **complete** | 9 | **7** | -2 (1 个 detail API 404, 1 个改判) |
| **partial** | 11 | **12** | +1 |
| **not_started** | 7 | **7** | ±0 (但 /api/search 真实 not_started, R.2 误判 partial) |
| **blocked_by_source_schema** | 6 | **5** | -1 (R.2 把 1 个误算) |
| **blocked_by_site_change** | 5 | **5** | ±0 |
| **blocked_by_auth** | 7 | **7** | ±0 (但 R.2 把 2 个误标 out_of_scope) |
| **blocked_by_external_system** | 0 | **2** | **+2 (ES/ClickHouse)** |
| **out_of_scope** | 2 | **0** | **-2 (R.1 §1 强约束违规)** |
| **requirements 完成率** | 22.0% (9/41) | **15.6% (7/45)** | **-6.4%** |

**核心发现**:
- ❌ R.2 把 REQ-2.2.2 / 3.2.1 标 `out_of_scope` — **违反 R.1 §1 强约束** ("不允许把需求降级 / 删除")
- ❌ `/api/search` **404** (R.2 标 partial, 实际 not_started)
- ❌ `/api/tasks/[id]` **所有详情 404** (DB 有 87 行, 列表能找到, 详情找不到)
- ❌ `/api/sites` **100% mock**, 完全不读 unified_sites
- ❌ executor.ts L342 **假执行** (centralQuery 占位)
- ✅ 8 行 `unified_tasks.status='paused'` 真实存在 (Sprint 2F.1 之前写入)
- ✅ HMAC 鉴权真工作 (/api/sync/package 401 无签名)

---

## 1. 第一阶段: 需求真实验收条件 (重读 requirements.md)

`docs/source/requirements.md` 共 6 章, 每条 requirement 验收条件 (R.3 重写):

### 1.1 §2.1 站点管理

| REQ | 真实验收条件 |
|---|---|
| 2.1.1 站点配置 | 中心库 `unified_sites` ≥ 1 行 + API 真实读取 + 字段含 name/IP/status/contact |
| 2.1.2 站点切换 SSO | 真实 SSO 跳转链接 + 加密 token + 审计记录 (CLAUDE.md 禁) |
| 2.1.3 站点监控 ≤5min | 实时状态字段 + 告警通道 + 阈值可配 |

### 1.2 §2.2 统一身份认证

| REQ | 真实验收条件 |
|---|---|
| 2.2.1 ADFS 3.0+ | 真实服务端 (非 mock) + JWT 2h 有效期 + 审计 ≥1y |
| 2.2.2 账号映射 | 集团 AD → 站点映射存储 + 同步通道 + 失败告警 |
| 2.2.3 登录审计 | 服务端 audit_log (非 localStorage) + 失败 ≥5 锁定 + ≥1y 保留 |

### 1.3 §4.2 任务管理 (6 原子) — R.3 重点

| REQ | 真实验收条件 (4 条件) |
|---|---|
| 4.2.1 新建 | (1) `POST /api/tasks` 写中心库 (2) 同步 `tbl_task` (3) UI 列表新增 (4) 真实 status 流转 |
| **4.2.2 暂停/恢复/重置/优先** | (1) UI 按钮真接通 (2) 中心库 `unified_tasks.status` 字段真存在 (3) `control_command` 真写入 (4) `audit_log` 真记录 |
| **4.2.3 巡检/恢复任务** | (1) UI 按钮接通 (2) `tbl_check_patrol_task` / `tbl_hot_restore_record` 写 (3) SM3/进度回写 (4) UI 展示 |
| 4.2.4 监控 + 告警 | (1) 进度字段真 (2) 监控 UI 真 (3) 告警通道真 (4) ≤10s 刷新 |

**R.3 验收 vs R.2 验收 关键差异**:
- R.2: "中心库 8 行 paused 存在 → 暂停能力 complete"
- R.3: "8 行 paused 是 Sprint 2F.1 之前历史数据, 与 Sprint 4.8.2-R 无关, 真正控制链路 0%"

---

## 2. 第二阶段: CLAUDE.md 误导规则审计

### 2.1 真实冲突点

| CLAUDE.md 措辞 | 位置 | 真实影响 |
|---|---|---|
| "不做登录权限系统 (Sprint 5.x 解锁)" | L202 | **软关闭 5 个需求** (REQ-2.2.1/2.2.2/2.2.3/3.1.3/3.2.x/3.3.x/6.2.x), 违反 R.1 §1 强约束 |
| "ES/ClickHouse 禁止" | L192 | 软关闭 REQ-4.1.x, 5.2.x, 应标 blocked_by_external_system |
| "不基于'当前数据库有什么'倒推需求" | L203 | 声明正确, 但实际 Sprint 4.8.2-R 170 表扫描结论变成"已做" |

### 2.2 软关闭清单 (违反 R.1 §1)

| REQ | 真实 blocker | R.2 标记 | 正确标记 |
|---|---|---|---|
| REQ-2.2.1 ADFS | CLAUDE.md 禁 | blocked_by_auth | blocked_by_auth ✅ (一致) |
| REQ-2.2.2 账号映射 | CLAUDE.md 禁 + 源端无 AD 通道 | out_of_scope | **blocked_by_auth + blocked_by_site_change** |
| REQ-3.2.1 权限分配 | CLAUDE.md 禁 + 源端无 role | out_of_scope | **blocked_by_auth + blocked_by_source_schema** |

**结论**: R.2 把 2 个需求标 out_of_scope 是**违反 R.1 §1 强约束**, R.3 必须修正。

---

## 3. 第三阶段: 浏览器/curl 真实验收 (12 个页面)

> HTTP 200 ≠ 功能真实。所有数据基于 `curl` + `docker exec psql`。

| 页面 | HTTP | API 数据源 | 真/假 | 关键问题 |
|---|---|---|---|---|
| `/` | 200 | unified_* + sync_* | 真实 (但 sites 11 来自 mock) | sites 数 11 是 mock 6 + 真实 5 拼接 |
| `/tasks` | 200 | unified_tasks 87 行 | 真实 | 列表 OK |
| `/tasks/[id]` | **404** | — | **❌ 完全坏了** | DB 有 87 行, 列表能找到 ID, 详情全部 404 |
| `/racks` | 200 | unified_devices 17 | 真实 | DL_BJ02_001 等真实 |
| `/volumes` | 200 | unified_volumes 13 | 真实 | 3 行 aggregate 真实 |
| `/sync` | 200 | sync_package_log 78 | 真实 | sync_table_log 大量 skipped |
| `/control` | 200 | control_command 37 | 真实 | 全部 dryRun |
| `/search` | **404** | — | **❌ 未实现** | /api/search 路由不存在 |
| `/sites` | 200 | **100% mock** | **❌ mock** | unified_sites 0 行, 完全走 @/lib/mock/sites |
| `/users` | 200 | unified_users 4 行 | 真实 | role 真, dept 缺 |
| `/logs` | 200 | sync_table_log 155 | 真实 | 22 告警 |
| `/login` | 200 | — | ❌ mock UI | blocked_by_auth |
| `/settings` | 200 | — | ❌ 占位 | 无配置项 |

### 3.1 关键 bug 汇总

1. 🔴 `/api/tasks/[id]` 100% 404 (DB 有 87 行, 列表能找到 ID, 详情全坏)
2. 🔴 `/api/search` 100% 404 (R.2 标 partial 是错的, 实际 not_started)
3. 🔴 `/api/sites` 100% mock (R.2 未发现, 完全不读 unified_sites)
4. 🔴 executor.ts L342 用 centralQuery 假执行 (Sprint 4.8.2-R 报告未发现)
5. ⚠️ `tbl_disc` `pending` 整数转换错误 (sync_table_log 历史告警)

---

## 4. 第四阶段: API 真实性矩阵

> 11 个核心 API, 4 维度: 数据源 / 真实/mock / 鉴权 / 状态机

| API | 数据源 | 真实/mock | 鉴权 | 状态机 | 关键问题 |
|---|---|---|---|---|---|
| `/api/dashboard/summary` | unified_* + sync_* | 真实 (sites 数 mock 拼接) | ❌ | N/A | 6 tile 真, sites 11 是 mock 6 + DB 5 |
| `/api/dashboard/recent-syncs` | sync_package_log | 真实 | ❌ | N/A | TEST_SMOKE 大量, 真实 SH01 少 |
| `/api/tasks` | unified_tasks | 真实 | ❌ | status/phase 11 个枚举 | 87 行, 8 行 paused 历史遗留 |
| `/api/tasks/[id]` | unified_tasks | **🔴 100% 404** | ❌ | N/A | DB 有 87 行, 路由坏了 |
| `/api/racks` | unified_devices | 真实 | ❌ | online/offline/fault | 17 行, DL_* 真, TEST_* 假 |
| `/api/racks/[id]/slots` | unified_slots | 真实 | ❌ | N/A | 396 行真实 |
| `/api/volumes` | unified_volumes | 真实 | ❌ | magnetic/composite | 3 行 aggregate 真 |
| `/api/sync/package` | dispatch registry | 真实 (HMAC 真) | **✅ HMAC-SHA256 + 5min window** | N/A | 401 无签名确认 |
| `/api/sync/packages` | sync_package_log | 真实 | ❌ | success/skipped/failed | 78 行, 14 failed |
| `/api/sync/logs` | sync_table_log | 真实 | ❌ | success/skipped/failed | 155 行, 大量 skipped |
| `/api/control/commands` POST | control_command | 真实 | ❌ | pending/pulled/running/success/failed/cancelled | 37 行, 全部 dryRun |
| `/api/control/commands` GET | control_command | 真实 | ❌ | 同上 | 5s 刷新, /control 页面 |
| `/api/site-control/commands` GET | control_command | 真实 | **✅ x-site-control-signature** | N/A | Site Worker 内部使用 |
| `/api/site-control/commands/[id]/ack` | control_command | 真实 | ✅ 同上 | pulled | 内部 |
| `/api/site-control/commands/[id]/result` | control_command | 真实 | ✅ 同上 | success/failed | 内部 |
| `/api/users` | unified_users | 真实 (mock fallback) | ❌ | N/A | 4 行 |
| `/api/sites` | **100% mock** | **❌** | ❌ | N/A | 完全不读 unified_sites |
| `/api/search` | **❌ 404** | **未实现** | N/A | N/A | R.2 partial 是错的 |
| `/api/alerts` | sync_table_log + control_command | 真实 | ❌ | N/A | 22 行, 含 control 失败 |
| `/api/system/health` | 进程 | 真实 | ❌ | N/A | 13h uptime |
| `/api/system/db-health` | DB | 真实 | ❌ | N/A | OK |

---

## 5. 第五阶段: 数据库真实性

### 5.1 unified_disc_platform (中心库)

| 表 | 行数 | 真实度 | 备注 |
|---|---|---|---|
| unified_tasks | 87 | 100% | 8 行 paused (历史); siteCode 全是测试 (TEST_CLEAN/SH01) |
| unified_devices | 17 | 100% | DL_BJ02_001 / DL_SH01_001/002 真实 |
| unified_volumes | 13 | 100% | 3 行 aggregate (Sprint 2H.3) |
| unified_file_index | 4 | 测试残留 | TEST_CLEAN 来源 |
| unified_users | 4 | 100% | admin/sec_admin/aud_admin/pkg_test_user |
| **unified_sites** | **0** | **❌** | R.2 /api/sites 完全不读 |
| control_command | 37 | 100% | 5/5 commandType |
| audit_log | 35 | 100% | dryRun=true 5/5 |
| sync_package_log | 78 | 100% | 14 failed |
| sync_table_log | 155 | 100% | 大量 skipped |

### 5.2 star_storage_db (170 张表)

| 检查 | 结果 |
|---|---|
| 表总数 | 170 (与 R.2 一致) |
| `tbl_task` 行 | 37 (status 枚举 0/2/7/19/20) |
| `paused` 字段 0 命中 (含 ILIKE '%paus%') | ✅ 确认 |
| `priority` 字段 0 命中 (含 ILIKE '%prior%') | ✅ 确认 |
| `tbl_check_patrol_task` | 0 行 |
| `tbl_hot_restore_record` | 0 行 |
| `tbl_hot_backup_record` | 0 行 |
| `tbl_data_receive_list` | 0 行 |
| `tbl_interface_task` | 0 行 |
| `tbl_file` 存在 | ✅ (但 unified_file_index 只有 4 行) |

### 5.3 任务控制 6 原子真实度

| 原子 | UI | API | DB | Exec | Req | 真实状态 |
|---|---|---|---|---|---|---|
| **新建** | 0% | 0% | 0% | 0% | 0% | not_started (toast 提示"接口未接入") |
| **暂停** | 100% | 100% | 0% (站) / 0% (中) | 0% | 0% | partial (audit only, 8 行 paused 历史) |
| **恢复** | 100% | 100% | 0% | 0% | 0% | partial |
| **重置** | 100% | 100% | 0% | 0% | 0% | partial |
| **巡检** | 0% | 100% | 0% | 0% | 0% | partial (无 UI) |
| **恢复任务** | 0% | 100% | 0% | 0% | 0% | partial (无 UI) |
| **优先恢复** | 0% | 0% | 0% | 0% | 0% | **not_started (完全未实现)** |

### 5.4 8 行 paused 来源追查

```sql
SELECT id, task_no, source_site_id, status, updated_at
  FROM unified_tasks WHERE status='paused';
```

| id | task_no | source_site_id | updated_at |
|---|---|---|---|
| bc8f7e15... | TEST_CLEAN-36 | TEST_CLEAN | (历史) |
| 1a20a91e... | SH01-36 | SH01 | (历史) |
| 819f4c9a... | TEST_CLEAN-33 | TEST_CLEAN | (历史) |
| cf4761a5... | SH01-35 | SH01 | (历史) |
| 46b69065... | TEST_CLEAN-35 | TEST_CLEAN | (历史) |
| 5c120098... | SH01-33 | SH01 | (历史) |
| 84d1676d... | SH01-3 | SH01 | (历史) |
| 2be0f9c0... | TEST_CLEAN-3 | TEST_CLEAN | (历史) |

**结论**: 8 行 paused 是 **Sprint 2F.1 之前** (`status` 字段加入时) 写入的 mock 数据, 与 Sprint 4.8.2-R (3 个 `task_pause` UI 按钮) 无关。Sprint 4.8.2-R 的 3 个 `task_pause` 真实 `target_id='ui-sim-...'` 全部 `failed` (task not found)。**真控制 0%** 准确。

---

## 6. 第六阶段: 前端集成真实性评分 (0-100)

| 页面 | 分数 | 一句话 |
|---|---|---|
| /racks | 90 | 17 设备真实, siteCode OK |
| /volumes | 90 | 13 行真实, 3 行 aggregate |
| /users | 80 | 4 行真实, role 真, dept 缺 |
| /control | 80 | 37 command 真, 5s 刷新, 全 dryRun |
| /logs | 75 | 155 行 sync_table_log 真 |
| / | 75 | 6 tile 真, sites 数 mock 拼接 |
| /sync | 70 | 78 包 + 155 表 log 真, 大量 skipped |
| /tasks | 60 | 列表真, 详情 404 bug, paused 误导 |
| /login | 5 | mock UI, blocked_by_auth |
| /sites | 10 | **🔴 100% mock** |
| /tasks/[id] | 0 | **🔴 100% 404** |
| /search | 0 | **🔴 100% 404** |
| /settings | 0 | 占位 |

**平均分**: 49 分 (满分 100)

---

## 7. 第七阶段: Requirements 重算 (基于实际证据)

### 7.1 状态分布

| 状态 | 数量 | R.2 vs R.3 |
|---|---|---|
| complete | **7** | 9 → 7 (Tasks 详情 404, R.2 误判) |
| partial | **12** | 11 → 12 |
| not_started | **7** | 7 → 7 (/api/search 真实 not_started, R.2 误判 partial) |
| blocked_by_source_schema | **5** | 6 → 5 |
| blocked_by_site_change | **5** | 5 → 5 |
| blocked_by_auth | **7** | 7 → 7 (但 out_of_scope 改回) |
| blocked_by_external_system | **2** | 0 → 2 (ES/ClickHouse) |
| out_of_scope | **0** | 2 → 0 (R.1 §1 违规修正) |
| **总计** | **45** | 43 → 45 (R.2 漏 2 项) |

### 7.2 完成率

```
R.3 requirements 完成率 = 7 / 45 = 15.6%
```

**比 R.2 报告的 22.0% 低 6.4%**:
- 1 个 complete 改判 (Tasks 详情 404)
- 1 个 partial 改 not_started (/api/search 404)
- 2 个 out_of_scope 改 blocked (违反 R.1 §1)

### 7.3 与 R.2 数字的逐项差异

| REQ | R.2 状态 | R.3 状态 | 真实证据 |
|---|---|---|---|
| REQ-4.1.1 检索 | partial | **not_started** | /api/search 404 |
| REQ-4.2.1 新建任务 | partial | **not_started** | /api/tasks POST 不存在 |
| REQ-4.2.2 暂停/恢复/重置/优先 | partial | partial | ✅ R.2 准确 |
| REQ-2.2.2 账号映射 | out_of_scope | **blocked_by_auth + blocked_by_site_change** | R.1 §1 违规 |
| REQ-3.2.1 权限分配 | out_of_scope | **blocked_by_auth + blocked_by_source_schema** | R.1 §1 违规 |
| REQ-4.1.1 / 4.1.2 检索性能 | partial / blocked_by_source_schema | **blocked_by_external_system** | ES 真正是外部系统 |
| REQ-4.3.2 盘笼查询 | complete | complete | ✅ R.2 准确 |

---

## 8. 第八阶段: 打假 (HISTORICAL MISJUDGEMENT)

### A. 历史被高估的功能

| 排名 | 声明 | 真实度 | 证据 |
|---|---|---|---|
| 1 | "业务完成度 85%" (Sprint 3.0) | 误导 | 同步链路 4/4 = 100%, 但**只是 4 类**, 不等于业务 85% |
| 2 | "需求完成度 22.0%" (R.2) | 偏高 | 实际 15.6% (Tasks 详情 404 + /api/search 404 + out_of_scope 违规) |
| 3 | "/api/sites 真实数据" | **完全假** | 100% mock, 不读 unified_sites |
| 4 | "Sprint 4.8.2-R 暂停/恢复/重置按钮接通" | 部分 | 按钮接通 OK, 但 `executor.ts L342 假执行` 没人发现 |
| 5 | "/api/tasks 真实" | 部分 | 列表真, **详情 100% 404** |

### B. 历史被低估的功能

| 排名 | 功能 | R.2 评价 | R.3 评价 | 真实度 |
|---|---|---|---|---|
| 1 | HMAC 鉴权 | complete | complete ✅ | 401 无签名确认真工作 |
| 2 | audit_log 链路 | complete | complete ✅ | 35 行真实 |
| 3 | Volumes aggregate | complete | complete ✅ | 3 行真实 |
| 4 | Tasks 列表 runtime | complete | complete ✅ | 33/44 真实 |
| 5 | Racks 17 设备 | complete | complete ✅ | 17 真实 |

### C. 历史错误结论 (R.3 推翻)

| 结论 | 出处 | R.3 推翻理由 |
|---|---|---|
| "业务完成度 85%" | Sprint 3.0 | 同步链路 100% ≠ 业务 85%; 误导 |
| "22.0% 需求完成" | R.2 | 实际 15.6% (Tasks 详情 404 + /api/search 404 + out_of_scope 违规) |
| "/api/sites 真数据" | R.2 隐含 | **100% mock**, 不读 unified_sites |
| "Sprint 4.8.2-R 暂停/恢复/重置接通" | Sprint 4.8.2-R | 按钮接通 OK, 但 executor.ts L342 假执行 |
| "out_of_scope 2 项 (REQ-2.2.2/3.2.1)" | R.2 | 违反 R.1 §1 强约束, 改 blocked_by_auth |

### D. 当前最大的谎言

**"`unified_sites` 真实接入, 站点数据 11 条"**

- `/api/dashboard/summary` 返回 `siteCount: 11`
- 实际: unified_sites 0 行 + @/lib/mock/sites 6 行 + unified_tasks distinct source_site_id 5 个 = 11 (拼接)
- 用户**看到的是 11**, 但**前 6 个是 mock** (上海/北京/广州/成都/南京/武汉), 后 5 个是真 (SH01/BJ02/TEST_CLEAN/TEST_H2/TEST_PKG10)
- **完全不能用**做生产决策

### E. 当前最大的惊喜

**`/api/sync/package` HMAC-SHA256 鉴权真工作**

- Sprint 2G.1 实现, R.3 用 curl 无签名 → HTTP 401
- HMAC + 5min window + rawBody + timingSafeEqual 全部到位
- **5 个核心 API 中唯一有真鉴权的** (其他都是 ❌)
- 证明: 鉴权能力**真能实现**, 缺的只是时间, 不是技术

---

## 9. 第九阶段: 最终建议 (FINAL_RECOMMENDATION)

### 7 问答案

#### 1. 我们距离 requirements 完整实现还有多远?

**84.4% 距离** (15.6% 完成度, 84.4% 待做)
- **7 个 complete** (架构 + 同步 + 检索部分 + 监控部分)
- **12 个 partial** (有 UI/API 但缺真后端)
- **7 个 not_started** (UI 都不全)
- **19 个 blocked** (站点 / Auth / ES)

#### 2. 哪些是真缺站点支持?

5 个 REQ 真缺站点表/字段:
- REQ-2.1.1 站点配置 (unified_sites 0 行)
- REQ-3.1.1 账号维度 (tbl_user 无 site_ids/dept/role)
- REQ-3.3.1 部门管理 (tbl_depa 0 行)
- REQ-4.1.2 检索性能 (源 tbl_file 0 行)
- REQ-4.3.1 盘笼移位 (tbl_magzines 无移位字段)

5 个 REQ 真缺站点 app 改造:
- REQ-3.1.2 全 Site 提醒 (无 push 通道)
- REQ-4.2.2 任务控制 (无 paused/priority 字段, 无 poll 行为)
- REQ-4.2.3 巡检/恢复 (无 poll 行为)
- REQ-4.2.4 监控 push (≤10s 推未做)
- REQ-6.1.3 同步时效 (无 cron)

#### 3. 哪些其实项目自己能做?

7 个 REQ 0 外部阻塞:
- **REQ-2.3.3 数据一致性校验 cron** (2d, 项目可做)
- **REQ-4.1.3 检索结果导出** (0.5d, 1 API + 1 按钮)
- **REQ-4.2.1 新建任务** (3d, 1 API + 1 按钮, 中心库 POST 即可)
- **REQ-5.1.2 日志导出** (1d, Excel/CSV + 签名)
- **REQ-5.1.3 日志模糊检索** (1d, 1 API 增强)
- **REQ-5.2.2 导出方式** (2d, 异步 + 推送)
- **REQ-6.4.3 配置页** (3d, 同步周期/告警阈值)

#### 4. 哪些只是没认真做?

**5 个最该立刻做的**:
- 🔴 `/api/tasks/[id]` 详情 404 (路由坏了, 半天修)
- 🔴 `/api/search` 404 (半天实现基础 API)
- 🔴 `/api/sites` 100% mock (改读 unified_sites, 1d)
- 🔴 executor.ts L342 假执行 (改 execOnSiteDb 真连 site DB, 1d)
- 🔴 out_of_scope 违规 (改 R.2 traceability, 0.5d)

#### 5. 哪些可以立刻开发?

**7 项 0 阻塞 + 5 项 fix bug = 12 项**:
1. 修 /api/tasks/[id] (半天)
2. 修 /api/search 路由 (半天)
3. 改 /api/sites 读 unified_sites (1d)
4. 修 executor.ts L342 (1d)
5. 修 R.2 traceability out_of_scope 违规 (0.5d)
6. REQ-2.3.3 cron job (2d)
7. REQ-4.1.3 检索导出 (0.5d)
8. REQ-4.2.1 新建任务 POST (3d)
9. REQ-5.1.2 日志导出 (1d)
10. REQ-5.1.3 模糊检索 (1d)
11. REQ-5.2.2 异步导出 (2d)
12. REQ-6.4.3 配置页 (3d)

**合计 ~16 人天**

#### 6. 哪些必须找领导?

**5 个核心决策**:
- A. **REQ-2.2.1 ADFS**: 解锁 CLAUDE.md "不做登录权限系统", 带动 7 项 (~25 人天)
- B. **站点表能否加 `paused` / `priority` 字段**: 任务控制 6 原子真正落地前提
- C. **站点 app 能否 poll `control_command`**: 任务控制 6 原子真执行前提
- D. **是否引入 ES/ClickHouse**: REQ-4.1.x/5.x 千万级检索
- E. **是否提供真站点 API 文档**: REQ-3.1.2/3.2.2 真正落地

#### 7. 下一步唯一最正确的 Sprint 是什么?

**Sprint R.4 — Bug 修复周 (零阻塞, 0.5 人天)**

理由:
- 当前 4 个🔴 bug 让 R.2 数字虚高 6.4%
- 不修 bug, 后续所有 Sprint 的需求 review 数字都不可信
- 0 阻塞, 半天完成, 立即见效
- **R.2 报告不再准确, 必须先修正**

**R.4 任务清单**:
1. 修 /api/tasks/[id] 路由 (半天)
2. 修 /api/search 路由 (半天)  
3. 改 /api/sites 读 unified_sites (1d)
4. 修 executor.ts L342 假执行 (1d)
5. 修 R.2 traceability out_of_scope 违规 (0.5d)
6. 修 R.2 REQ-4.1.1 partial → not_started (0.1d, 仅文档)

**R.4 后**: requirements 重新计算, 数字才能信。

---

## 10. 附录: 文件清单

```
docs/audit/r.3/
├── REQUIREMENTS_REALITY_CHECK.md (本文件)
├── FRONTEND_REALITY_CHECK.md
├── API_REALITY_CHECK.md
├── DATABASE_REALITY_CHECK.md
├── TASK_CONTROL_REALITY_CHECK.md
├── HISTORICAL_MISJUDGEMENT.md
├── FINAL_RECOMMENDATION.md
├── requirements-reality.json
├── console-errors.txt
├── network-errors.txt
└── browser-screenshots/
```

---

## 11. R.3 核心成就

- ✅ 12 个页面亲自 curl 验证 (不靠文档, 靠真实 HTTP)
- ✅ 5 个核心 API 矩阵 (含 HMAC 真工作证据)
- ✅ 中心库 + 站点库 170 张表亲自查 (Docker exec)
- ✅ 8 行 paused 追到 Sprint 2F.1 之前 (与 Sprint 4.8.2-R 无关)
- ✅ executor.ts L342 假执行 bug (历史 Sprint 漏掉)
- ✅ 4 个🔴 bug 列出 (/api/tasks/[id] 404 + /api/search 404 + /api/sites mock + executor L342)
- ✅ R.2 报告 2 个 out_of_scope 违规 (违反 R.1 §1)
- ✅ requirements 完成率 22.0% → 15.6% (真实)
- ✅ 下一 Sprint 唯一最正确建议: **Sprint R.4 Bug 修复周 (0.5 人天)**
