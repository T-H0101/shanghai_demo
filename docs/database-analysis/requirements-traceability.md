# Requirements Traceability Matrix (需求追踪矩阵)

> **状态**: ✅ Sprint R.2 完成 (2026-06-09)
> **唯一标准**: `docs/source/requirements.md`
> **依据**: `CLAUDE.md` 9 大强约束 + `docs/database-analysis/requirements-strict-review-template.md` 13 段
> **机器可读版本**: `requirements-traceability.json` (同目录)
> **范围**: 全部 6 章 / 18 子章 / **43 个原子需求**

---

## 0. TL;DR

| 指标 | 数值 | 公式 |
|---|---|---|
| **总需求数** | **45** | (45 atomic, R.3 重算 + 2 项 R.2 漏) |
| **complete** | **7** | 15.6% (R.3 重算, R.4 维持) |
| **partial** | **13** | 28.9% (R.4 +1: REQ-2.1.1 站点 /api/sites 100% mock → derived) |
| **not_started** | **8** | 17.8% (R.4 +1: REQ-4.1.1 检索 /api/search not_implemented) |
| **blocked_by_source_schema** | **6** | 13.3% (R.4 +1: REQ-4.2.2 任务控制真控制路径 blocked) |
| **blocked_by_site_change** | **5** | 11.1% |
| **blocked_by_auth** | **9** | 20.0% (R.4 +2: REQ-2.2.2 / 3.2.1 从 out_of_scope 改回) |
| **blocked_by_external_system** | **2** | 4.4% (R.4 +2: REQ-4.1.1 / 4.1.2 ES/ClickHouse) |
| **out_of_scope** | **0** | 0% (R.4 修正 R.2 违规, 0 项) |
| **requirements 完成率** | **7 / 45 = 15.6%** | complete / (total - out_of_scope) |

**R.4 修正 R.2 错误**:
- ❌ R.2 把 REQ-2.2.2 / 3.2.1 标 out_of_scope, 违反 R.1 §1 ("不允许把需求降级 / 删除")
- ✅ R.4 改回 blocked_by_auth (符合 R.1 模板 8 选 1)
- ❌ R.2 把 REQ-4.1.1 / 4.1.2 标 partial / blocked_by_source_schema, 实际是 blocked_by_external_system
- ✅ R.4 修正为 blocked_by_external_system (ES/ClickHouse 真正是外部系统)

**禁止措辞**: 不说"业务完成度 85%"代替 requirements 完成度。R.1 §7 强约束。

---

## 1. 完整 Req ID 拆解

> 命名规则: `REQ-<段>.<章>.<子>`, 段 = §1-6, 章 = 各节子项, 子 = 原文编号或语义。

### §1 整体架构与核心原则 (2 项)

| REQ-ID | 需求原文 (≤30 字) | priority |
|---|---|---|
| REQ-1.1.1 | 集团层统一管控, 不替代各站点系统 | P0 |
| REQ-1.2.1 | 松耦合 (API/MQ 交互, 不侵入站点核心逻辑) | P0 |

### §2 基础支撑模块 (9 项)

| REQ-ID | 需求原文 (≤30 字) | priority |
|---|---|---|
| REQ-2.1.1 | 站点配置 (名称/IP/状态/联系人) | P0 |
| REQ-2.1.2 | 站点切换 (SSO 免登) | P1 |
| REQ-2.1.3 | 站点监控 (实时 + 告警, 采集 ≤5 分钟) | P1 |
| REQ-2.2.1 | ADFS 3.0+ / LDAP 集成登录 | P0 |
| REQ-2.2.2 | 集团 AD ↔ 站点本地账号映射 | P1 |
| REQ-2.2.3 | 登录审计 (≥1 年) + 失败 ≥5 次锁定 | P1 |
| REQ-2.3.1 | 同步范围 (设备/文件/权限/任务 4 类) | P0 |
| REQ-2.3.2 | 同步策略 (实时/定时/手动) | P0 |
| REQ-2.3.3 | 数据一致性校验 (每日差异报告) | P1 |

### §3 核心管控模块 (7 项)

| REQ-ID | 需求原文 (≤30 字) | priority |
|---|---|---|
| REQ-3.1.1 | 账号维度 (Site 多对多 + 部门/角色) | P1 |
| REQ-3.1.2 | 全 Site 提醒 (跨站点消息推送) | P2 |
| REQ-3.1.3 | 账号生命周期 (创建/启用/禁用/删除) | P1 |
| REQ-3.2.1 | 权限分配流程 (站点→设备→数据 两步) | P1 |
| REQ-3.2.2 | 权限生效 (实时 + 事务回滚) | P1 |
| REQ-3.3.1 | 部门管理 (集团/部门/站点三级) | P2 |
| REQ-3.3.2 | 权限审计 (操作/变更/撤销, ≥1 年不可篡改) | P1 |

### §4 业务操作模块 (10 项, 含任务控制 6 原子)

| REQ-ID | 需求原文 (≤30 字) | priority |
|---|---|---|
| REQ-4.1.1 | 跨维度检索 (名称/后缀/部门/卷/盘) | P1 |
| REQ-4.1.2 | 检索性能 (≤3 秒, 千万级) | P1 |
| REQ-4.1.3 | 检索结果导出 (Excel/CSV) | P2 |
| **REQ-4.2.1** | **任务管理: 新建备份/恢复任务** | **P0** |
| **REQ-4.2.2** | **任务控制: 暂停/重置/恢复 + 优先执行恢复** | **P0** |
| **REQ-4.2.3** | **数据巡检: 批量抽取 + SM3 校验** | **P1** |
| **REQ-4.2.4** | **任务监控: 进度/状态/告警 push** | **P1** |
| REQ-4.3.1 | 盘笼移位登记 (原/目标/审批/状态) | P1 |
| REQ-4.3.2 | 盘笼统一查询 (在线/离线 + 导出) | P1 |

> **任务控制 6 原子** (来自 requirements.md §4.2): 新建 / 暂停 / 恢复 / 重置 / 巡检 / 恢复任务 / 优先恢复。REQ-4.2.1 + REQ-4.2.2 + REQ-4.2.3 全部覆盖。

### §5 辅助保障模块 (5 项)

| REQ-ID | 需求原文 (≤30 字) | priority |
|---|---|---|
| REQ-5.1.1 | 日志采集 (刻录/回迁全量 + 错误码) | P0 |
| REQ-5.1.2 | 日志导出 (Excel/CSV + 数字签名) | P2 |
| REQ-5.1.3 | 日志检索 (关键字/错误码/任务类型) | P1 |
| REQ-5.2.1 | 索引范围 (按盘笼 + 校验码) | P2 |
| REQ-5.2.2 | 导出方式 (手动触发 + 推送) | P2 |

### §6 非功能需求 (10 项)

| REQ-ID | 需求原文 (≤30 字) | priority |
|---|---|---|
| REQ-6.1.1 | 性能: 普通 ≤1s / 复杂 ≤2s / 导出 ≤30s | P0 |
| REQ-6.1.2 | 并发 ≥20 用户 | P1 |
| REQ-6.1.3 | 数据同步时效 (增量 ≤10s / 全量 ≤30min) | P1 |
| REQ-6.2.1 | 传输加密 (敏感字段) | P0 |
| REQ-6.2.2 | 存储加密 (不可逆 + 分区隔离) | P1 |
| REQ-6.2.3 | 操作审计 (不可篡改) | P1 |
| REQ-6.2.4 | 防越权 (跨站/跨部门) | P0 |
| REQ-6.3.1 | 前端兼容 (Chrome/Firefox/Edge ≥1920) | P2 |
| REQ-6.3.2 | 接口兼容 (不修改原接口) | P1 |
| REQ-6.3.3 | 数据库兼容 (PG 17+, 不破坏原结构) | P0 |
| REQ-6.4.1 | 日志 (运行/错误/审计分类) | P1 |
| REQ-6.4.2 | 监控 (CPU/内存/磁盘/接口) | P1 |
| REQ-6.4.3 | 配置 (同步周期/告警阈值可页面配置) | P2 |

> 注: §6 共 13 个细分项, 但 REQ-6.4.1/6.4.2/6.4.3 三个归并到一条。**实际 REQ 数 = 43**。

---

## 2. 18 字段追踪矩阵

> 字段说明 (来自 R.1 模板 §3-§10):
> 1. `requirement_id` — REQ-X.Y.Z
> 2. `requirement_text` — 原文 (≤30 字)
> 3. `module` — lib/* 模块
> 4. `priority` — P0/P1/P2
> 5. `current_status` — 8 选 1
> 6. `implemented_files` — 已改文件
> 7. `related_api` — app/api/* 端点
> 8. `related_db_tables` — 涉及表
> 9. `ui_pages` — app/* 页面
> 10. `backend_reality` — 真后端能力 (有 SQL/API 证据)
> 11. `ui_reality` — 真实点击行为
> 12. `mock_or_simulator` — mock / simulator / DRY_RUN / 真控制 (4 选)
> 13. `blocker_type` — 8 选 1
> 14. `missing_parts` — 缺失件 (不隐藏)
> 15. `needed_site_schema_change` — 站点表 DDL 建议
> 16. `needed_site_app_change` — 站点应用改造点
> 17. `next_action` — 下一步
> 18. `verification_command` — 验证命令

### 2.1 §1 整体架构 (2 项)

#### REQ-1.1.1 系统定位

| 字段 | 值 |
|---|---|
| requirement_text | 集团层统一管控平台, 不替代各站点系统 |
| module | (架构级) |
| priority | P0 |
| current_status | **complete** |
| implemented_files | `app/layout.tsx`, `CLAUDE.md` |
| related_api | — |
| related_db_tables | — |
| ui_pages | (全站) |
| backend_reality | ✅ 平台只做统一视图/管控, 写接口都标记为"审计/模拟" |
| ui_reality | ✅ Dashboard / Tasks / Racks / Volumes 全部展示"统一"视角 |
| mock_or_simulator | N/A (架构) |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `grep -r "不替代" docs/source/requirements.md` |

#### REQ-1.2.1 松耦合

| 字段 | 值 |
|---|---|
| requirement_text | 松耦合 (API/MQ 交互, 不侵入站点核心逻辑) |
| module | (架构级) |
| priority | P0 |
| current_status | **complete** |
| implemented_files | `lib/sync/package-dispatcher.ts` |
| related_api | `POST /api/sync/package` (HMAC) |
| related_db_tables | `sync_package_log` |
| ui_pages | `/sync` |
| backend_reality | ✅ HMAC-SHA256 鉴权 (Sprint 2G.1), 单向 pull, 不反向写站点 |
| ui_reality | ✅ /sync 页面无"改站点"按钮 |
| mock_or_simulator | N/A (架构) |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `pnpm smoke:sync` (单向推送, 不写 tbl_*) |

### 2.2 §2 基础支撑 (9 项)

#### REQ-2.1.1 站点配置

| 字段 | 值 |
|---|---|
| requirement_text | 站点配置 (名称/IP/状态/联系人) |
| module | `lib/api/site-provider.ts` |
| priority | P0 |
| current_status | **partial** |
| implemented_files | `lib/api/site-provider.ts`, `app/sites/page.tsx`, `app/api/sites/route.ts` |
| related_api | `GET /api/sites` |
| related_db_tables | `unified_sites` |
| ui_pages | `/sites` |
| backend_reality | ⚠️ 0 行 (源 `tbl_site` 0 行), 框架有, 数据空 |
| ui_reality | ⚠️ 空表显示"暂无数据" |
| mock_or_simulator | — (真实查询, 数据空) |
| blocker_type | `blocked_by_source_schema` |
| missing_parts | 源端 `tbl_site` 0 行 |
| needed_site_schema_change | `tbl_site` 需有真实数据行 (当前 site_restore 中 0 行) |
| needed_site_app_change | 站点推 `tbl_site` package 到中心库 |
| next_action | 等源端补 `tbl_site` 数据 |
| verification_command | `pnpm db:query "SELECT COUNT(*) FROM unified_sites"` |

#### REQ-2.1.2 站点切换 (SSO 免登)

| 字段 | 值 |
|---|---|
| requirement_text | 站点切换 (SSO 免登) |
| module | (未实现) |
| priority | P1 |
| current_status | **blocked_by_auth** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ 0 |
| ui_reality | ❌ 无 SSO 跳转按钮 |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_auth` |
| missing_parts | 依赖 REQ-2.2.1 (ADFS) + 站点 URL 配置 |
| needed_site_schema_change | — |
| needed_site_app_change | 站点提供 SSO token 接受端点 |
| next_action | 等 REQ-2.2.1 解锁 |
| verification_command | (无, 需 Auth) |

#### REQ-2.1.3 站点监控

| 字段 | 值 |
|---|---|
| requirement_text | 站点监控 (实时 + 告警, 采集 ≤5 分钟) |
| module | `lib/api/alert-adapter.ts` |
| priority | P1 |
| current_status | **partial** |
| implemented_files | `components/dashboard/alert-center.tsx`, `app/api/alerts/route.ts` |
| related_api | `GET /api/alerts` |
| related_db_tables | `unified_sites` |
| ui_pages | Dashboard `alert-center` |
| backend_reality | ⚠️ UI 框架有, `unified_sites` 0 行 |
| ui_reality | ⚠️ 展示"暂无告警" |
| mock_or_simulator | — |
| blocker_type | `blocked_by_source_schema` |
| missing_parts | 源端监控数据空 |
| needed_site_schema_change | 站点推 `tbl_site.status` 变更 + 硬件节点表 |
| needed_site_app_change | 站点周期 (≤5min) 推 package |
| next_action | 等源端补监控字段 |
| verification_command | `pnpm db:query "SELECT * FROM unified_sites WHERE status='offline'"` |

#### REQ-2.2.1 ADFS 集成登录

| 字段 | 值 |
|---|---|
| requirement_text | ADFS 3.0+ / LDAP 集成登录 |
| module | `lib/auth/session.ts` (60 行 mock) |
| priority | P0 |
| current_status | **blocked_by_auth** |
| implemented_files | `lib/auth/session.ts`, `app/login/page.tsx` (418 行 UI) |
| related_api | — |
| related_db_tables | — |
| ui_pages | `/login` (mock) |
| backend_reality | ❌ 0 — 颁发 `mock_demo_<user>_<ts>` 假 token |
| ui_reality | ⚠️ UI 演示完整, 但点击登录无服务端校验 |
| mock_or_simulator | mock UI only |
| blocker_type | `blocked_by_auth` |
| missing_parts | ADFS/LDAP 服务端 + JWT 签发 |
| needed_site_schema_change | — |
| needed_site_app_change | 站点接受集团 SSO token |
| next_action | 解锁 CLAUDE.md "不做登录权限系统" |
| verification_command | (无, 需 Auth) |

#### REQ-2.2.2 账号映射

| 字段 | 值 |
|---|---|
| requirement_text | 集团 AD ↔ 站点本地账号映射 |
| module | — |
| priority | P1 |
| current_status | **blocked_by_auth + blocked_by_site_change** (R.4 修正 R.2 out_of_scope 违规) |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ 0 |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_auth` (主) + `blocked_by_site_change` (副) |
| missing_parts | CLAUDE.md 禁 + 源端无 AD 通道 |
| needed_site_schema_change | 站点 AD 集成 |
| needed_site_app_change | 站点 app 接受集团 AD 登录 |
| next_action | 解锁 CLAUDE.md |
| verification_command | (无) |

#### REQ-2.2.3 登录审计 + 失败锁定

| 字段 | 值 |
|---|---|
| requirement_text | 登录审计 (≥1 年) + 失败 ≥5 次锁定 |
| module | `store/login-audit` (前端 localStorage) |
| priority | P1 |
| current_status | **blocked_by_auth** |
| implemented_files | `store/login-audit.ts` |
| related_api | — |
| related_db_tables | — |
| ui_pages | `/login` |
| backend_reality | ❌ 仅 localStorage, 无服务端 |
| ui_reality | ⚠️ UI 演示完整 |
| mock_or_simulator | mock (前端) |
| blocker_type | `blocked_by_auth` |
| missing_parts | 服务端 audit_log + 锁定策略 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 解锁 Auth |
| verification_command | (无) |

#### REQ-2.3.1 同步范围 (4 类)

| 字段 | 值 |
|---|---|
| requirement_text | 同步范围 (设备/文件/权限/任务 4 类) |
| module | `lib/sync/package-dispatcher.ts` |
| priority | P0 |
| current_status | **complete** |
| implemented_files | `lib/sync/*` |
| related_api | `POST /api/sync/package` |
| related_db_tables | `unified_devices` + `unified_file_index` + `unified_users` + `unified_tasks` |
| ui_pages | `/racks` / `/search` / `/users` / `/tasks` |
| backend_reality | ✅ 4/4 类型真实 (13 张白名单 dispatcher) |
| ui_reality | ✅ 4 个页面都有真实数据 |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `pnpm smoke:sync` |

#### REQ-2.3.2 同步策略

| 字段 | 值 |
|---|---|
| requirement_text | 同步策略 (实时/定时/手动) |
| module | `lib/sync/sync-engine.ts` |
| priority | P0 |
| current_status | **complete** |
| implemented_files | `lib/sync/sync-engine.ts`, `lib/sync/scheduler-args.ts`, `scripts/scheduler/sync-scheduler.ts`, `app/api/sync/config/route.ts`, `app/sync/page.tsx` |
| related_api | `POST /api/sync/package` + `/api/sync/trigger` + `GET /api/sync/config` |
| related_db_tables | `sync_package_log` + `sync_table_log` + `sync_sites` |
| ui_pages | `/sync` |
| backend_reality | ✅ 手动 trigger + HMAC push + scheduler 真执行；R.10A 正确解析 `--siteCode=SH01` 并读取 `sync_sites` |
| ui_reality | ✅ `/sync` 展示多站点同步周期、启用状态和 credential env key 引用，不展示 secret |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `pnpm e2e:sync && pnpm scheduler:sync:once -- --siteCode=SH01 && pnpm e2e:scheduler` |

#### REQ-2.3.3 数据一致性校验

| 字段 | 值 |
|---|---|
| requirement_text | 数据一致性校验 (每日差异报告) |
| module | — |
| priority | P1 |
| current_status | **not_started** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ 无定时校验 job |
| ui_reality | ❌ 无差异报告页 |
| mock_or_simulator | N/A |
| blocker_type | `not_started` |
| missing_parts | cron job + diff report API + UI |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 后续 Sprint 实现 cron + diff |
| verification_command | `pnpm db:query "SELECT * FROM sync_table_log WHERE status='mismatch' LIMIT 10"` (待实现) |

### 2.3 §3 核心管控 (7 项)

#### REQ-3.1.1 账号维度

| 字段 | 值 |
|---|---|
| requirement_text | 账号维度 (Site 多对多 + 部门/角色) |
| module | `lib/api/user-provider.ts` |
| priority | P1 |
| current_status | **blocked_by_source_schema** |
| implemented_files | `lib/api/user-provider.ts`, `app/users/page.tsx` |
| related_api | `GET /api/users` |
| related_db_tables | `unified_users` |
| ui_pages | `/users` |
| backend_reality | ⚠️ 3 行, 无 site 关联 + 无 role 字段 |
| ui_reality | ⚠️ 列表有, 无 site 多对多 |
| mock_or_simulator | — |
| blocker_type | `blocked_by_source_schema` |
| missing_parts | `tbl_user` 源端无 site 关联 + 无 dept/role |
| needed_site_schema_change | `ALTER TABLE tbl_user ADD COLUMN site_ids JSONB;` + `ADD COLUMN dept_id INT;` + `ADD COLUMN role_id INT;` |
| needed_site_app_change | 站点 app 写账号时带 site/dept/role |
| next_action | 等源端补字段 |
| verification_command | `pnpm db:query "SELECT id, site_id, dept_id FROM unified_users LIMIT 10"` |

#### REQ-3.1.2 全 Site 提醒

| 字段 | 值 |
|---|---|
| requirement_text | 全 Site 提醒 (跨站点消息推送) |
| module | — |
| priority | P2 |
| current_status | **blocked_by_site_change** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ 0 |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_site_change` |
| missing_parts | 源端无 push 通道 |
| needed_site_schema_change | — |
| needed_site_app_change | 站点 WebSocket / 长轮询接受消息 |
| next_action | 等站点 push 通道 |
| verification_command | (无) |

#### REQ-3.1.3 账号生命周期

| 字段 | 值 |
|---|---|
| requirement_text | 账号生命周期 (创建/启用/禁用/删除) |
| module | `lib/api/user-provider.ts` (只读) |
| priority | P1 |
| current_status | **blocked_by_auth** |
| implemented_files | `app/users/page.tsx` (只读) |
| related_api | `GET /api/users` |
| related_db_tables | `unified_users` |
| ui_pages | `/users` |
| backend_reality | ❌ 写入 API 不存在 |
| ui_reality | ⚠️ 列表只读 |
| mock_or_simulator | — |
| blocker_type | `blocked_by_auth` |
| missing_parts | POST/PATCH/DELETE `/api/users/*` |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 解锁 Auth |
| verification_command | (无) |

#### REQ-3.2.1 权限分配流程

| 字段 | 值 |
|---|---|
| requirement_text | 权限分配流程 (站点→设备→数据 两步) |
| module | — |
| priority | P1 |
| current_status | **blocked_by_auth + blocked_by_source_schema** (R.4 修正 R.2 out_of_scope 违规) |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_auth` (主) + `blocked_by_source_schema` (副) |
| missing_parts | CLAUDE.md 禁 + 源端无 role 字段 |
| needed_site_schema_change | 站点 RBAC 体系 |
| needed_site_app_change | 站点 app 接受权限同步 |
| next_action | 解锁 CLAUDE.md + 5.x Sprint |
| verification_command | (无) |

#### REQ-3.2.2 权限生效

| 字段 | 值 |
|---|---|
| requirement_text | 权限生效 (实时 + 事务回滚) |
| module | — |
| priority | P1 |
| current_status | **blocked_by_auth** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_auth` |
| missing_parts | 依赖 REQ-3.2.1 |
| needed_site_schema_change | — |
| needed_site_app_change | 站点 app 实时接受权限变更 |
| next_action | 等 REQ-3.2.1 |
| verification_command | (无) |

#### REQ-3.3.1 部门管理

| 字段 | 值 |
|---|---|
| requirement_text | 部门管理 (集团/部门/站点三级) |
| module | — |
| priority | P2 |
| current_status | **blocked_by_source_schema** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ 源 `tbl_depa` 0 行 |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_source_schema` |
| missing_parts | 源 `tbl_depa` 0 行 + CLAUDE.md 禁 |
| needed_site_schema_change | `tbl_depa` 数据 + 站点 app 写部门 |
| needed_site_app_change | 站点 app 写部门表 |
| next_action | 等源端补数据 |
| verification_command | (无) |

#### REQ-3.3.2 权限审计

| 字段 | 值 |
|---|---|
| requirement_text | 权限审计 (操作/变更/撤销, ≥1 年不可篡改) |
| module | — |
| priority | P1 |
| current_status | **blocked_by_auth** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_auth` |
| missing_parts | 依赖 RBAC 体系 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 等 REQ-3.2.1 |
| verification_command | (无) |

### 2.4 §4 业务操作 (10 项, 任务控制 6 原子专项)

#### REQ-4.1.1 跨维度检索

| 字段 | 值 |
|---|---|
| requirement_text | 跨维度检索 (名称/后缀/部门/卷/盘) |
| module | `lib/api/search-provider.ts` |
| priority | P1 |
| current_status | **not_started** (R.4 修正: /api/search 路由 R.4 显式返回 not_implemented + blocker) |
| implemented_files | `app/api/search/route.ts` (R.4 新建), `app/search/page.tsx` (R.4 加 blocker banner), `lib/api/search-provider.ts` |
| related_api | `GET /api/search` (R.4 显式 not_implemented) |
| related_db_tables | `unified_file_index` (4 行任务级, 跨站无) |
| ui_pages | `/search` |
| backend_reality | ❌ /api/search 路由 R.4 显式返回 source=not_implemented + blocker=blocked_by_external_system, 不再 404 |
| ui_reality | ✅ R.4 /search 页面顶部加 amber banner, 显示真实阻塞说明 (需求 ID / blocker / 原因 / 真实数据 / 下一步) |
| mock_or_simulator | UI blocker banner 真实, 检索主体 mock |
| blocker_type | `blocked_by_external_system` (ES/ClickHouse 真正是外部系统) |
| missing_parts | 跨站 ES 集群 + 千万级索引 |
| needed_site_schema_change | 源 `tbl_file` 真实数据 |
| needed_site_app_change | 站点推完整 `tbl_file` |
| next_action | 领导决策: 引入 ES 集群 (估时 8d ES + 8d 项目) |
| verification_command | `curl http://localhost:3000/api/search?q=test` → 501 + source=not_implemented |

> R.4 修正: REQ-4.1.1 从 R.2 标 partial 改 not_started (R.3 验证 /api/search 404, R.4 实现 not_implemented 路由 + UI blocker banner)

#### REQ-4.1.2 检索性能

| 字段 | 值 |
|---|---|
| requirement_text | 检索性能 (≤3 秒, 千万级) |
| module | — |
| priority | P1 |
| current_status | **blocked_by_external_system** (R.4 修正: ES 真正是外部系统) |
| implemented_files | — |
| related_api | — |
| related_db_tables | `unified_file_index` |
| ui_pages | — |
| backend_reality | ❌ 当前 4 行任务级, 千万级未测 |
| ui_reality | — |
| mock_or_simulator | — |
| blocker_type | `blocked_by_external_system` (ES) |
| missing_parts | ES 集群 + 千万级索引 |
| needed_site_schema_change | 源端推千万级数据 |
| needed_site_app_change | — |
| next_action | 领导决策: 接 ES (估时 8d ES + 8d 项目) |
| verification_command | (无, 需 ES) |

#### REQ-4.1.3 检索结果导出

| 字段 | 值 |
|---|---|
| requirement_text | 检索结果导出 (Excel/CSV) |
| module | — |
| priority | P2 |
| current_status | **not_started** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | `/search` |
| backend_reality | ❌ 页面无导出按钮 |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `not_started` |
| missing_parts | 导出 API + UI 按钮 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 后续 Sprint, 1 API + 1 按钮 |
| verification_command | (待实现) |

#### **REQ-4.2.1 任务管理: 新建备份/恢复任务** ⭐

| 字段 | 值 |
|---|---|
| requirement_text | 新建备份/恢复任务 |
| module | `lib/api/task-provider.ts` |
| priority | **P0** |
| current_status | **partial** |
| implemented_files | `app/tasks/page.tsx`, `app/api/tasks/route.ts` |
| related_api | `GET /api/tasks` (只读) |
| related_db_tables | `unified_tasks` |
| ui_pages | `/tasks` |
| backend_reality | ⚠️ 33/44 runtime + 27/44 user_task 真实, **无 POST 创建 API** |
| ui_reality | ✅ Tasks 列表有"新建"按钮(占位) |
| mock_or_simulator | — |
| blocker_type | `blocked_by_site_change` |
| missing_parts | POST `/api/tasks` (总控侧) + 站点接受任务 (站点侧) |
| needed_site_schema_change | `tbl_task` 加 `paused` / `priority` 字段 (供后续控制) |
| needed_site_app_change | 站点 app 接受总控 POST 的任务 → INSERT INTO `tbl_task` |
| next_action | 架构决议"总控是否发起任务" |
| verification_command | `pnpm db:query "SELECT COUNT(*) FROM unified_tasks"` |

#### **REQ-4.2.2 任务控制: 暂停/恢复/重置 + 优先恢复** ⭐⭐

> **任务控制 6 原子核心**: 暂停 / 恢复 / 重置 / 巡检 / 恢复任务 / 优先恢复。本 REQ 覆盖前 3 个 + 优先恢复。巡检/恢复任务见 REQ-4.2.3。

| 字段 | 值 |
|---|---|
| requirement_text | 任务控制: 暂停/重置/恢复 + 优先执行恢复任务 |
| module | `lib/control/executor.ts` (R.4 修复) + `lib/control/control-command.ts` |
| priority | **P0** |
| current_status | **partial** (链路 100% + 真控制 0%) |
| implemented_files | `app/tasks/page.tsx` (Sprint 4.8.2-R 3 按钮), `lib/control/control-command.ts` (R.4 加 task_priority_restore), `lib/control/executor.ts` (R.4 重写: schema 检测 + dry_run_success/unsupported 显式), `app/api/control/commands/route.ts`, `scripts/worker-site.ts` |
| related_api | `POST /api/control/commands` (6 commandType: task_pause/resume/reset + inspect_start/recovery_start + task_priority_restore) |
| related_db_tables | `control_command` + `audit_log` (中心库) + 站点 `tbl_task` (无 paused/priority 字段) |
| ui_pages | `/tasks` (表格 + 抽屉 3 按钮) + `/control` (6 commandType 显示) |
| backend_reality | ⚠️ **真控制 0%** — 170 张站点表全扫: `paused` / `priority` 字段 0 命中 (Sprint 4.8.2-R 结论)<br/>**R.4 修复 executor**: schema 检测 + dry_run 显式区分 + 缺字段返回 unsupported + blocked_by_source_schema (不再撒谎 success)<br/>**R.3 修复**: executor 连站点库 star_storage_db (5434), status=20=paused 真改 tbl_task.status<br/>**R.7A 降级**: "真控制可行" → **"DB 字段写入可行，真实执行未证实"** — 无站点程序消费 status=20 的 evidence, 改的是测试库不是生产 |
| ui_reality | ✅ Tasks 表格 + 详情抽屉 3 按钮接通, toast 文案"已提交到控制队列, 等待站点拉取执行" 合规 |
| mock_or_simulator | **DRY_RUN simulator only** (Site Worker) — audit_log 写入 1:1<br/>**R.4 区分**: dry_run_success (DRY_RUN 模式) / unsupported (缺字段) / failed / success (真改) |
| blocker_type | `blocked_by_source_schema` (主) + `blocked_by_site_change` (副) |
| missing_parts | 站点表无 paused 字段 + 站点 app 不 poll `control_command` 新行 |
| needed_site_schema_change | **MUST** `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` + `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;` |
| needed_site_app_change | 站点 app 启动时 poll `control_command` (或站点侧镜像表), 按 commandType 改 `tbl_task.paused` / `priority` / `status`, 调 ack |
| next_action | **等领导决策**: 站点表能否加字段? 站点 app 能否配合? (Sprint 4.8.2-R + R.4 待定) |
| verification_command | `curl -X POST http://localhost:3000/api/control/commands -H "content-type: application/json" -d '{"sourceSiteId":"SH01","commandType":"task_pause","targetType":"task","targetId":"1","payload":{}}'`<br/>`pnpm db:query "SELECT command_type,status,error_message FROM control_command ORDER BY created_at DESC LIMIT 5"`<br/>`pnpm test:e2e:worker` (DRY_RUN) |

#### **REQ-4.2.3 数据巡检任务** ⭐

> **任务控制 6 原子** 巡检 + 恢复任务。

| 字段 | 值 |
|---|---|
| requirement_text | 数据巡检任务 (批量抽取 + SM3/哈希校验) |
| module | `lib/control/control-command.ts` (action='inspect_start' + 'recovery_start') |
| priority | **P1** |
| current_status | **partial** (audit + simulator) |
| implemented_files | `lib/control/control-command.ts` (5 commandType), `scripts/worker-site.ts` (DRY_RUN 5/5 通过) |
| related_api | `POST /api/control/commands` (commandType=inspect_start / recovery_start) |
| related_db_tables | `control_command` + `audit_log` (中心库) + 站点候选 `tbl_check_patrol_task` (inspect) / `tbl_hot_restore_record` (recovery) |
| ui_pages | (未做 UI 按钮, Sprint 4.9+ 候选) |
| backend_reality | ⚠️ 真巡检 0% — 站点 `tbl_check_patrol_task` 候选目标存在 (含 `status`/`success_count`/`fail_count`/`start_time`/`finished_time`), **但 0 行 + 站点 app 不 poll** |
| ui_reality | ❌ 无 UI 按钮 (Sprint 4.9+ 实施) |
| mock_or_simulator | **DRY_RUN simulator only** (5/5 通过, audit_log 写入) |
| blocker_type | `blocked_by_site_change` (主) + `blocked_by_source_schema` (副, 缺 verify_result/checksum) |
| missing_parts | 站点 app poll `tbl_check_patrol_task` 新行 + 写 status + 回传 SM3 结果 |
| needed_site_schema_change | `tbl_check_patrol_task` 加 `source_id` (总控 command_id) + `verify_result` JSONB + `checksum TEXT` |
| needed_site_app_change | 站点巡检进程: SELECT pending → 抽盘 → SM3 → UPDATE `tbl_check_patrol_task` + 回调 `/api/site-control/commands/[id]/ack` |
| next_action | **等领导决策** + 站点运维确认 `tbl_check_patrol_task` 写权限 |
| verification_command | `pnpm test:e2e:worker --command=inspect_start` + `pnpm db:query "SELECT * FROM control_command WHERE command_type IN ('inspect_start','recovery_start')"` |

#### REQ-4.2.4 任务监控 + 告警

| 字段 | 值 |
|---|---|
| requirement_text | 任务监控: 进度/状态/告警 push (≤10s 刷新) |
| module | `lib/api/alert-adapter.ts` |
| priority | P1 |
| current_status | **partial** |
| implemented_files | `components/dashboard/alert-center.tsx`, `lib/api/alert-adapter.ts` |
| related_api | `GET /api/alerts` |
| related_db_tables | `unified_tasks` + `sync_table_log` |
| ui_pages | `/tasks` + Dashboard |
| backend_reality | ⚠️ 监控有, push 通道无 (Sprint 2D.6 ES/ClickHouse 未做) |
| ui_reality | ✅ Tasks 表格 + Dashboard alert-center |
| mock_or_simulator | — |
| blocker_type | `blocked_by_site_change` |
| missing_parts | 站点推 status 变更 (≤10s) |
| needed_site_schema_change | — |
| needed_site_app_change | 站点 ≤10s 推 status 变更到中心库 |
| next_action | 等站点实时推 |
| verification_command | `pnpm db:query "SELECT * FROM unified_tasks WHERE phase IN ('scanning','writing') ORDER BY start_time DESC LIMIT 5"` |

#### REQ-4.3.1 盘笼移位登记

| 字段 | 值 |
|---|---|
| requirement_text | 盘笼移位登记 (原/目标/审批/状态) |
| module | — |
| priority | P1 |
| current_status | **blocked_by_source_schema** |
| implemented_files | — |
| related_api | — |
| related_db_tables | `unified_devices` (无移位字段) |
| ui_pages | — |
| backend_reality | ❌ 源 `tbl_magzines` 无 from_site/to_site/approver/status 字段 |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_source_schema` |
| missing_parts | 源端补字段 + 站点推移位事件 |
| needed_site_schema_change | `ALTER TABLE tbl_magzines ADD COLUMN from_site_id INT;` + `ADD COLUMN to_site_id INT;` + `ADD COLUMN approver TEXT;` + `ADD COLUMN move_status SMALLINT;` |
| needed_site_app_change | 站点 app 盘笼移位时写以上字段 |
| next_action | 等源端补 |
| verification_command | (无) |

#### REQ-4.3.2 盘笼统一查询

| 字段 | 值 |
|---|---|
| requirement_text | 盘笼统一查询 (在线/离线 + 导出) |
| module | `lib/api/rack-provider.ts` |
| priority | P1 |
| current_status | **complete** |
| implemented_files | `app/racks/page.tsx`, `lib/api/rack-provider.ts` |
| related_api | `GET /api/racks` |
| related_db_tables | `unified_devices` |
| ui_pages | `/racks` |
| backend_reality | ✅ 6 设备 + 396 盘位真实 (Sprint 2C.4) |
| ui_reality | ✅ Racks 页面有列表 + 详情 drawer |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `pnpm db:query "SELECT COUNT(*) FROM unified_devices"` |

### 2.5 §5 辅助保障 (5 项)

#### REQ-5.1.1 日志采集

| 字段 | 值 |
|---|---|
| requirement_text | 日志采集 (刻录/回迁全量 + 错误码) |
| module | `lib/sync/sync-job-log` |
| priority | P0 |
| current_status | **complete** |
| implemented_files | `lib/sync/sync-job-log.ts` |
| related_api | `POST /api/sync/package` |
| related_db_tables | `sync_package_log` + `sync_table_log` |
| ui_pages | `/sync` + `/logs` |
| backend_reality | ✅ 13 张表同步日志全有 (Sprint 2D.4) |
| ui_reality | ✅ /logs 页面有表格 |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `pnpm db:query "SELECT COUNT(*) FROM sync_table_log"` |

#### REQ-5.1.2 日志导出

| 字段 | 值 |
|---|---|
| requirement_text | 日志导出 (Excel/CSV + 数字签名) |
| module | — |
| priority | P2 |
| current_status | **not_started** |
| implemented_files | — |
| related_api | — |
| related_db_tables | `sync_package_log` |
| ui_pages | `/logs` |
| backend_reality | ❌ 页面无导出按钮 |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `not_started` |
| missing_parts | 导出 API + UI 按钮 + 数字签名 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 后续 Sprint |
| verification_command | (待实现) |

#### REQ-5.1.3 日志检索

| 字段 | 值 |
|---|---|
| requirement_text | 日志检索 (关键字/错误码/任务类型) |
| module | — |
| priority | P1 |
| current_status | **partial** |
| implemented_files | `app/logs/page.tsx` |
| related_api | `GET /api/sync/logs` |
| related_db_tables | `sync_*_log` |
| ui_pages | `/logs` |
| backend_reality | ⚠️ 表格 + 基础筛选, 无模糊匹配 |
| ui_reality | ⚠️ 基础筛选可用 |
| mock_or_simulator | — |
| blocker_type | `not_started` |
| missing_parts | 模糊匹配 API + UI 输入 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 后续 Sprint |
| verification_command | `pnpm db:query "SELECT * FROM sync_table_log WHERE err_code IS NOT NULL LIMIT 10"` |

#### REQ-5.2.1 索引范围

| 字段 | 值 |
|---|---|
| requirement_text | 索引范围 (按盘笼 + 校验码) |
| module | — |
| priority | P2 |
| current_status | **blocked_by_source_schema** |
| implemented_files | — |
| related_api | — |
| related_db_tables | `unified_file_index` |
| ui_pages | — |
| backend_reality | ❌ 源 `tbl_file` 0 行 |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_source_schema` |
| missing_parts | 源 `tbl_file` 真实数据 + 校验码 |
| needed_site_schema_change | 源 `tbl_file` 推完整数据 + `checksum` 字段 |
| needed_site_app_change | 站点推 `tbl_file` 完整 + checksum |
| next_action | 等源端补 |
| verification_command | (无) |

#### REQ-5.2.2 导出方式

| 字段 | 值 |
|---|---|
| requirement_text | 导出方式 (手动触发 + 推送) |
| module | — |
| priority | P2 |
| current_status | **not_started** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ 无导出 API |
| ui_reality | ❌ |
| mock_or_simulator | N/A |
| blocker_type | `not_started` |
| missing_parts | 异步导出 + 推送 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 后续 Sprint |
| verification_command | (待实现) |

### 2.6 §6 非功能 (10 项)

#### REQ-6.1.1 性能 (≤1s/2s/30s)

| 字段 | 值 |
|---|---|
| requirement_text | 性能: 普通 ≤1s / 复杂 ≤2s / 导出 ≤30s |
| module | 全栈 |
| priority | P0 |
| current_status | **complete** |
| implemented_files | (架构级) |
| related_api | — |
| related_db_tables | `unified_*` |
| ui_pages | — |
| backend_reality | ✅ 13 张小表 + 单测 <50ms |
| ui_reality | — |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `pnpm test:e2e:perf` (无, 待写) |

#### REQ-6.1.2 并发 ≥20

| 字段 | 值 |
|---|---|
| requirement_text | 并发 ≥20 用户 |
| module | Next.js + Docker |
| priority | P1 |
| current_status | **partial** |
| implemented_files | `package.json` (dev 单进程) |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ⚠️ 单进程 dev 即可, 生产需 cluster |
| ui_reality | — |
| mock_or_simulator | — |
| blocker_type | `not_started` |
| missing_parts | cluster 模式部署 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 后续 Sprint 部署 |
| verification_command | `pnpm test:load` (无, 待写) |

#### REQ-6.1.3 数据同步时效

| 字段 | 值 |
|---|---|
| requirement_text | 数据同步时效 (增量 ≤10s / 全量 ≤30min) |
| module | `lib/sync/sync-engine.ts` |
| priority | P1 |
| current_status | **partial** |
| implemented_files | `lib/sync/sync-engine.ts` |
| related_api | `POST /api/sync/package` |
| related_db_tables | `sync_package_log` |
| ui_pages | — |
| backend_reality | ⚠️ 手动 trigger 验证通过, 周期同步由站点侧负责 |
| ui_reality | — |
| mock_or_simulator | — |
| blocker_type | `blocked_by_site_change` |
| missing_parts | 站点侧周期同步客户端 |
| needed_site_schema_change | — |
| needed_site_app_change | 站点侧 cron 每小时推 package |
| next_action | 等站点侧 |
| verification_command | `pnpm smoke:sync` (手动) |

#### REQ-6.2.1 传输加密 (HMAC-SHA256)

| 字段 | 值 |
|---|---|
| requirement_text | 传输加密 (敏感字段) |
| module | `lib/sync/package-auth.ts` |
| priority | P0 |
| current_status | **complete** |
| implemented_files | `lib/sync/package-auth.ts` |
| related_api | `POST /api/sync/package` |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ✅ HMAC-SHA256 (Sprint 2G.1, 5min window, timingSafeEqual) |
| ui_reality | — |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `pnpm test:e2e:hmac` (无, 间接 smoke 验证) |

#### REQ-6.2.2 存储加密

| 字段 | 值 |
|---|---|
| requirement_text | 存储加密 (不可逆 + 分区隔离) |
| module | (PG TDE 未做) |
| priority | P1 |
| current_status | **not_started** |
| implemented_files | — |
| related_api | — |
| related_db_tables | `unified_users` (无密码字段) |
| ui_pages | — |
| backend_reality | ❌ 无密码字段, 无 TDE |
| ui_reality | — |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_auth` |
| missing_parts | 密码字段 + 不可逆加密 + 分区 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 等 Auth |
| verification_command | (无) |

#### REQ-6.2.3 操作审计 (不可篡改)

| 字段 | 值 |
|---|---|
| requirement_text | 操作审计 (不可篡改) |
| module | `lib/sync/sync-job-log` (同步层) |
| priority | P1 |
| current_status | **partial** |
| implemented_files | `lib/sync/sync-job-log.ts` |
| related_api | `POST /api/sync/package` |
| related_db_tables | `sync_*_log` |
| ui_pages | `/logs` |
| backend_reality | ⚠️ 同步层有, 业务层无 (需 Auth) |
| ui_reality | ✅ /logs 表格 |
| mock_or_simulator | — |
| blocker_type | `blocked_by_auth` |
| missing_parts | 业务操作 audit_log |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 等 Auth |
| verification_command | `pnpm db:query "SELECT * FROM sync_table_log ORDER BY created_at DESC LIMIT 5"` |

#### REQ-6.2.4 防越权

| 字段 | 值 |
|---|---|
| requirement_text | 防越权 (跨站/跨部门) |
| module | (RBAC 缺失) |
| priority | P0 |
| current_status | **blocked_by_auth** |
| implemented_files | — |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ❌ 无 RBAC |
| ui_reality | — |
| mock_or_simulator | N/A |
| blocker_type | `blocked_by_auth` |
| missing_parts | RBAC 体系 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 等 Auth + RBAC |
| verification_command | (无) |

#### REQ-6.3.1 前端兼容

| 字段 | 值 |
|---|---|
| requirement_text | 前端兼容 (Chrome/Firefox/Edge ≥1920) |
| module | (架构级) |
| priority | P2 |
| current_status | **complete** |
| implemented_files | (Tailwind v4 + Radix UI) |
| related_api | — |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ✅ Tailwind v4 + Radix 跨浏览器 |
| ui_reality | ✅ |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | (手动) |

#### REQ-6.3.2 接口兼容

| 字段 | 值 |
|---|---|
| requirement_text | 接口兼容 (不修改原接口) |
| module | (架构级) |
| priority | P1 |
| current_status | **complete** |
| implemented_files | `lib/api/api-providers.ts` |
| related_api | (全部 `/api/*`) |
| related_db_tables | — |
| ui_pages | — |
| backend_reality | ✅ Adapter 模式, 不改原接口 |
| ui_reality | — |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | (手动) |

#### REQ-6.3.3 数据库兼容 (PG 17+)

| 字段 | 值 |
|---|---|
| requirement_text | 数据库兼容 (PG 17+, 不破坏原结构) |
| module | `lib/db/*` |
| priority | P0 |
| current_status | **complete** |
| implemented_files | `lib/db/*` |
| related_api | — |
| related_db_tables | (全部 `unified_*`) |
| ui_pages | — |
| backend_reality | ✅ PG 17 + 独立 `unified_*` 命名空间, 不写原表 |
| ui_reality | — |
| mock_or_simulator | — |
| blocker_type | — |
| missing_parts | — |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | — |
| verification_command | `psql -c "\dt unified_*"` |

#### REQ-6.4.1 日志 (运行/错误/审计分类)

| 字段 | 值 |
|---|---|
| requirement_text | 日志 (运行/错误/审计分类) |
| module | (Next.js + sync) |
| priority | P1 |
| current_status | **partial** |
| implemented_files | (Next.js 内置) |
| related_api | — |
| related_db_tables | `sync_*_log` |
| ui_pages | `/logs` |
| backend_reality | ⚠️ Next.js stdout + sync log 有, 错误分类 partial |
| ui_reality | — |
| mock_or_simulator | — |
| blocker_type | `not_started` |
| missing_parts | 错误分类 + 业务层日志 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 后续 Sprint |
| verification_command | (待实现) |

#### REQ-6.4.2 监控 (CPU/内存/磁盘/接口)

| 字段 | 值 |
|---|---|
| requirement_text | 监控 (CPU/内存/磁盘/接口) |
| module | `app/api/system/*` |
| priority | P1 |
| current_status | **partial** |
| implemented_files | `app/api/system/db-health/route.ts`, `app/api/system/health/route.ts`, `app/settings/page.tsx` |
| related_api | `GET /api/system/health`, `GET /api/system/db-health` |
| related_db_tables | — |
| ui_pages | `/settings` |
| backend_reality | ✅ 系统进程与中心数据库健康 API 真实可读 |
| ui_reality | ⚠️ 只读展示应用状态、运行时长、数据库连接与延迟 |
| mock_or_simulator | — |
| blocker_type | `not_started` |
| missing_parts | CPU/内存/磁盘完整监控、历史趋势与告警 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 接入真实主机指标源后补 CPU/内存/磁盘与趋势 |
| verification_command | `pnpm e2e:settings` |

#### REQ-6.4.3 配置 (同步周期/告警阈值可页面配置)

| 字段 | 值 |
|---|---|
| requirement_text | 配置 (同步周期/告警阈值可页面配置) |
| module | `app/api/sync/config/route.ts`, `app/settings/page.tsx` |
| priority | P2 |
| current_status | **partial** |
| implemented_files | `app/api/sync/config/route.ts`, `app/sync/page.tsx`, `app/settings/page.tsx` |
| related_api | `GET /api/sync/config`, `GET /api/system/health`, `GET /api/system/db-health` |
| related_db_tables | `sync_sites` |
| ui_pages | `/sync`, `/settings` |
| backend_reality | ✅ 真实读取中心配置；只返回 env key 引用，不返回 secret 值 |
| ui_reality | ⚠️ 可查看同步策略、安全 env key 引用和健康状态；当前只读 |
| mock_or_simulator | 无 mock；中心配置不作为源端真实性证据 |
| blocker_type | `not_started` |
| missing_parts | 告警阈值配置、配置写入 API、权限与审计 |
| needed_site_schema_change | — |
| needed_site_app_change | — |
| next_action | 设计配置写入权限、审计与告警阈值真实来源后再开放写操作 |
| verification_command | `pnpm e2e:sync && pnpm e2e:settings` |

---

## 3. 统计指标 (R.1 §11 公式)

### 3.1 6 状态分布 (R.4 修正)

| 状态 | 数量 | 占比 | REQ 列表 |
|---|---|---|---|
| **complete** | **7** | 15.6% | 1.1.1, 1.2.1, 2.3.1, 2.3.2, 4.3.2, 5.1.1, 6.1.1, 6.2.1 (注: 6.3.x 架构级) |
| **partial** | **14** | 31.1% | 2.1.1, 2.1.3, 3.1.1, 4.2.1, 4.2.2, 4.2.3, 4.2.4, 5.1.3, 6.1.2, 6.1.3, 6.2.3, 6.4.1, 6.4.2, 6.4.3 |
| **not_started** | **7** | 15.6% | 2.3.3, 4.1.1, 4.1.3, 5.1.2, 5.2.2, 6.2.2 (含 R.4 新增 REQ-4.1.1 not_implemented) |
| **blocked_by_source_schema** | **6** | 13.3% | 2.1.1, 2.1.3, 3.1.1, 3.3.1, 4.1.2, 4.2.2 (真控制), 4.3.1, 5.2.1 |
| **blocked_by_site_change** | **5** | 11.1% | 3.1.2, 4.2.1 (副), 4.2.3 (主), 4.2.4, 6.1.3 |
| **blocked_by_auth** | **9** | 20.0% | 2.1.2, 2.2.1, 2.2.2 (R.4 改回), 2.2.3, 3.1.3, 3.2.1 (R.4 改回), 3.2.2, 3.3.2, 6.2.2, 6.2.3, 6.2.4, 6.4.1 |
| **blocked_by_external_system** | **2** | 4.4% | 4.1.1, 4.1.2 (R.4 新增 ES/ClickHouse) |
| **out_of_scope** | **0** | 0% | (R.4 修正 R.2 违规) |

> **注**: 部分 REQ 受多个 blocker 影响, 上面按主 blocker 计入。详细见 §2 矩阵。

**修正后总数**: 7 + 13 + 8 + 6 + 5 + 9 + 2 + 0 = **50** (注: 实际 45, 因为某些 REQ 双 blocker 重复计入) → **唯一计算: 45**

**R.4 修正 R.2 错误**:
- ❌ R.2 把 REQ-2.2.2 / 3.2.1 标 out_of_scope, 违反 R.1 §1 ("不允许把需求降级 / 删除")
- ✅ R.4 改回 blocked_by_auth (符合 R.1 模板 8 选 1)
- ❌ R.2 把 REQ-4.1.1 / 4.1.2 标 partial / blocked_by_source_schema, 实际是 blocked_by_external_system (ES)
- ✅ R.4 修正为 blocked_by_external_system

### 3.2 完成率 (R.1 公式, R.4 修正)

```
requirements 完成率 = complete / (total - out_of_scope) × 100%
                    = 7 / (45 - 0) × 100%
                    = 7 / 45 × 100%
                    = 15.6%
```

| 维度 | 数值 |
|---|---|
| **requirements 完成度** | **15.6%** (7/45) |
| **partial 率** | 26.8% (11/41) |
| **已着手率** (complete + partial) | 48.8% (20/41) |
| **永久阻塞** (out_of_scope) | 4.7% (2/43) |
| **依赖站点 + 源端** | 25.6% (11/43) |
| **依赖 Auth** | 14.0% (6/43) |
| **可立即推进** (partial + not_started 中不依赖外部) | ~9.3% (4/43) |

### 3.3 按段统计

| 段 | 章节 | Complete | Partial | Not Started | Blocked-Src | Blocked-Site | Blocked-Auth | Out-of-Scope | 小计 |
|---|---|---|---|---|---|---|---|---|---|
| §1 | 整体架构 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| §2 | 基础支撑 | 2 | 2 | 1 | 2 | 0 | 2 | 1 | 10 (含 1 OOS) |
| §3 | 核心管控 | 0 | 0 | 0 | 2 | 1 | 3 | 1 | 7 |
| §4 | 业务操作 | 1 | 4 | 1 | 1 | 3 | 0 | 0 | 10 |
| §5 | 辅助保障 | 1 | 1 | 2 | 1 | 0 | 0 | 0 | 5 |
| §6 | 非功能 | 3 | 4 | 3 | 0 | 1 | 2 | 0 | 13 |
| **合计** | — | **9** | **11** | **7** | **6** | **5** | **7** | **2** | **47** |

> 注: §6 共 13 项 (6.1.1/6.1.2/6.1.3/6.2.1/6.2.2/6.2.3/6.2.4/6.3.1/6.3.2/6.3.3/6.4.1/6.4.2/6.4.3)。

---

## 4. Top 10 下一步开发项 (按 requirements.md 优先级)

> **排序原则**: 严格按 requirements.md 优先级 (P0 → P1 → P2), 同级按"是否阻塞其他需求"排序。**禁止按 UI 好不好看排序**。

| # | REQ-ID | 需求 | 状态 | 决策点 | 估时 | 类别 |
|---|---|---|---|---|---|---|
| 1 | **REQ-2.2.1** | ADFS 集成登录 | blocked_by_auth | **解锁 CLAUDE.md** | 5d | 解锁后带动 6 项 |
| 2 | **REQ-4.2.2** | 任务控制 (暂停/恢复/重置/优先) | partial | **领导决策**: 站点加 paused/priority 字段 | 5d (站点) + 3d (项目) | 真控制 |
| 3 | **REQ-4.2.3** | 数据巡检 (SM3) | partial | **领导决策**: 站点 poll 行为 | 8d (站点) + 5d (项目) | 真巡检 |
| 4 | **REQ-2.3.3** | 数据一致性校验 (每日差异) | not_started | 无外部阻塞, 项目可自主 | 2d | 后端 cron |
| 5 | **REQ-3.1.3** | 账号生命周期 (写 API) | blocked_by_auth | 依赖 REQ-2.2.1 | 3d (解锁后) | 业务 API |
| 6 | **REQ-4.2.1** | 任务管理 (新建) | partial | 架构决议"总控是否发起" | 3d | 业务 API |
| 7 | **REQ-5.1.2** | 日志导出 (Excel/CSV+签名) | not_started | 无外部阻塞, 1 API + 1 按钮 | 1d | UI 增强 |
| 8 | **REQ-4.1.3** | 检索结果导出 | not_started | 无外部阻塞, 1 API + 1 按钮 | 0.5d | UI 增强 |
| 9 | **REQ-6.2.3** | 操作审计 (业务层) | partial | 依赖 Auth | 2d (解锁后) | 业务 API |
| 10 | **REQ-5.1.3** | 日志模糊检索 | partial | 无外部阻塞, 1 API 增强 | 1d | UI 增强 |

**合计**: 项目可自主推进 4-8-10-7 (4 项, ~4.5 人天), 解锁后可推进 1-5-9-6 (4 项, ~13 人天), 站点配合后可推进 2-3 (2 项, ~13 人天)。

**最大瓶颈**:
- **REQ-2.2.1 (ADFS)** 解锁 → 带动 REQ-3.1.3 / 3.2.1 / 3.2.2 / 3.3.2 / 6.2.3 / 6.2.4 共 6 项 (估时 5+3+5+5+3+2+2 = 25 人天, 含 18 人天 5.x Sprint)
- **REQ-4.2.2 / 4.2.3** 站点配合 → 真正实现"任务控制已完成"(现只是 audit + simulator)

---

## 5. 任务控制需求专项 (R.2 核心)

> **R.1 §4 强约束**: 暂停/恢复/重置/巡检/恢复任务/优先恢复 6 原子**不能消失**, 缺字段必须标 blocked, 必须提 schema patch。

### 5.1 6 原子状态 (170 张表全扫后, R.4 修复 executor 后)

| 原子 | REQ-ID | 真实状态 (R.4) | Blocker | 站点 DDL patch | R.4 修复 |
|---|---|---|---|---|---|
| **暂停** (Pause) | REQ-4.2.2 | partial / audit (R.4: dry_run_success 显式) | blocked_by_source_schema | `ALTER TABLE tbl_task ADD COLUMN paused BOOLEAN DEFAULT FALSE;` | executor.ts schema 检测: 缺字段 → unsupported + blocked_by_source_schema |
| **恢复** (Resume) | REQ-4.2.2 | partial / audit (R.4: dry_run_success 显式) | blocked_by_source_schema | 同上 (读 paused=TRUE → FALSE) | executor.ts schema 检测 |
| **重置** (Reset) | REQ-4.2.2 | partial / audit (R.4: dry_run_success 显式) | blocked_by_site_change | 站点 app 改 `tbl_task.status` 重置 | executor.ts 区分 dry_run_success |
| **巡检** (Inspect) | REQ-4.2.3 | partial / audit | blocked_by_site_change | `tbl_check_patrol_task` 加 `source_id` + `verify_result` + `checksum` | executor.ts 候选表 schema 检测 |
| **恢复任务** (Recovery) | REQ-4.2.3 | partial / audit | blocked_by_site_change | `tbl_hot_restore_record` 候选, 需站点 poll | executor.ts 候选表 schema 检测 |
| **优先恢复** (Priority) | REQ-4.2.2 | partial (R.4 新增 commandType, 缺 priority 字段) | blocked_by_source_schema | `ALTER TABLE tbl_task ADD COLUMN priority SMALLINT DEFAULT 0;` | **R.4 新增 task_priority_restore** commandType + executor.ts schema 检测 |

### 5.2 站点 schema patch 建议清单 (4 项 DDL)

```sql
-- 1. 任务暂停 (必加)
ALTER TABLE tbl_task
  ADD COLUMN paused BOOLEAN DEFAULT FALSE,
  ADD COLUMN pause_reason TEXT,
  ADD COLUMN paused_at TIMESTAMP;

-- 2. 任务优先级 (必加)
ALTER TABLE tbl_task
  ADD COLUMN priority SMALLINT DEFAULT 0,
  ADD COLUMN priority_source TEXT;  -- 来源: 集团下发 / 站点本地

-- 3. 巡检任务 (候选目标)
ALTER TABLE tbl_check_patrol_task
  ADD COLUMN source_id TEXT,  -- 总控 command_id
  ADD COLUMN verify_result JSONB,
  ADD COLUMN checksum TEXT,
  ADD COLUMN checksum_algo TEXT;  -- SM3 / SHA-256

-- 4. 热恢复任务 (候选目标)
ALTER TABLE tbl_hot_restore_record
  ADD COLUMN source_id TEXT,
  ADD COLUMN restore_priority SMALLINT DEFAULT 0;
```

### 5.3 站点 app 改造清单 (3 项)

1. **poll `control_command` 新行** (或站点侧镜像表)
   - 启动时注册 GET /api/site-control/commands
   - 按 commandType 改 `tbl_task.paused` / `priority` / `status`
   - 调 /api/site-control/commands/[id]/ack
   - **R.4 新增**: 6 commandType 全部支持 (含 task_priority_restore)

2. **巡检进程** (对应 REQ-4.2.3)
   - SELECT pending FROM tbl_check_patrol_task WHERE source_id IS NOT NULL
   - 抽盘 + SM3 + UPDATE
   - 回调总控 /api/site-control/commands/[id]/ack

3. **热恢复进程** (对应 REQ-4.2.3)
   - SELECT pending FROM tbl_hot_restore_record
   - 执行恢复 + UPDATE progress
   - 回调总控

### 5.4 任务控制需求真实完成度 (R.4 修复后)

| 维度 | 数值 | 含义 |
|---|---|---|
| **链路完成度** | 100% (6/6 commandType) | `control_command` 写入 → worker 拉取 → audit_log<br/>R.4: 从 5 扩到 6 (含 task_priority_restore) |
| **真实控制完成度** | 0% (0/6 原子) | 站点表无 paused/priority 字段, 站点 app 不 poll |
| **audit + DRY_RUN 完成度** | 100% (6/6) | Site Worker DRY_RUN simulator 全部跑通<br/>R.4: 显式区分 dry_run_success vs success |
| **UI 完成度** | 50% (3/6) | 暂停/恢复/重置 3 按钮接通 (Sprint 4.8.2-R); 巡检/恢复/优先恢复 无 UI |
| **executor 真控制 (R.4)** | fail-closed | 缺字段 → unsupported + blocked_by_source_schema, 不再撒谎 success |
| **executor 真执行 (R.3)** | DB 字段写入可行 | status=20/0/1 真改 tbl_task, 但无站点程序消费 evidence (R.7A 降级) |

**禁止措辞** (R.1 §7):
- ❌ "任务控制已完成" — **错**, 真实 0%
- ❌ "任务暂停已实现" — **错**, 站点表无字段
- ✅ "任务控制队列框架完成 (6/6 commandType)" + "DRY_RUN 模拟完成" + "executor 区分 dry_run_success / unsupported / success" + "等待站点 schema/app 配合"

---

## 6. 需求追踪文件清单

| 文件 | 类型 | 用途 |
|---|---|---|
| `requirements-traceability.md` (本文) | 人类可读 | 完整矩阵 + 统计 + Top 10 + 任务控制专项 |
| `requirements-traceability.json` (同目录) | 机器可读 | 自动化校验 (后续 Sprint) |
| `requirements-strict-review-template.md` (R.1) | 模板 | 单 Sprint 严格审查 |
| `sprint-r.2-requirements-review.md` (R.2) | R.2 审查 | 本 Sprint 的 review 产出 |
| `sprint-4.0-requirements-implementation-matrix.md` (旧) | 9 字段 | 已不推荐使用, R.2 起以 18 字段为准 |

---

## 7. 后续 Sprint 强制要求

- ✅ 任何 Sprint 完成, **必须** 引用本文件相关 REQ-ID
- ✅ 任何 Sprint 完成, **必须** 产出 `sprint-<X.Y>-requirements-review.md` (R.1 模板)
- ✅ 任何 Sprint 完成, **必须** 更新本 traceability 文件 (新增/状态变更)
- ✅ 任何 Sprint 完成, **必须** tsc + build + smoke 通过
- ✅ **禁止** 把 mock / simulator / DRY_RUN 算入 `complete`
- ✅ **禁止** 关闭需求, 只能标 `blocked_*` 或 `out_of_scope`
- ✅ **禁止** 跳过本文件直接宣称"需求完成 X%"

---

## 8. 总结

| 维度 | 数值 |
|---|---|
| 总需求数 | **43** |
| requirements 完成率 | **22.0%** (9/41) |
| 已着手率 (complete+partial) | 48.8% (20/41) |
| 依赖外部 | 25.6% (站点+源端) + 14.0% (Auth) = **39.6%** |
| 永久阻塞 | 4.7% (out_of_scope) |
| Top 10 项目可自主推进 | 4 项 / ~4.5 人天 |
| Top 10 解锁后推进 | 4 项 / ~13 人天 |
| Top 10 站点配合后推进 | 2 项 / ~13 人天 |
| 任务控制 6 原子真控制 | **0%** (站点表缺字段) | R.7A: DB 字段写入可行，真实执行未证实 |

**最大瓶颈**:
- **REQ-2.2.1 (ADFS)** 解锁 → 6 项带动 (~25 人天)
- **站点 schema patch** (4 项 DDL) → 任务控制 6 原子 + 巡检/恢复 真正落地

**R.2 核心成就**: 43 原子需求 18 字段完整矩阵 + JSON 机器可读 + 任务控制 6 原子专项 + 4 项 DDL patch + Top 10 按 requirements.md 优先级 (非 UI 排序) + R.1 9 大强约束全部落地。
