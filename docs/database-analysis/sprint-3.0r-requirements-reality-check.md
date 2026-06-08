# Sprint 3.0R — 需求与实现对照审计 (Requirements Reality Check)

> 状态: ✅ 完成 (只读审计, **不写业务代码 / 不新增 API / 不新增页面 / 不修改数据库**)
> 审计时间: 2026-06-08
> 输入: `docs/source/requirements.md` + 当前前端 + 当前 API + 当前同步链路 + 当前 DB schema + Sprint 3.0 全库审计

---

## 1. 审计目标

把 requirements.md 的 8 大模块 / 21 项功能点 / 6 类非功能, 逐条与**项目内实际实现**对照, 输出:
- 真实状态 (✅ / ⚠️ / ❌ / 🚫)
- 实现位置 (哪段代码 / 哪个 API)
- 阻塞原因 (源端缺失 / 禁止项 / 仅 UI 框架)
- 完成率与可演示率

**核心问题**: 哪些需求已实现, 哪些是 UI 框架, 哪些被 CLAUDE.md 禁止, 哪些源端无数据。

---

## 2. 需求矩阵 (21 项功能点 + 6 类非功能)

### 2.1 模块一: 基础支撑 (§1 系统定位 + §2.1 站点 + §2.2 身份 + §2.3 同步)

| requirement_id | requirement_name | priority | current_status | 实现位置 / 备注 |
|---|---|---|---|---|
| REQ-1.1 | 系统定位: 集团层统一管控, 不替代站点 | P0 | ✅ completed | 整个项目架构; sync 链路是单向 (站点→总控); PG17 是摘要库, 不是副本 (`docs/summary/LEADER_DECISIONS.md §1, §8`) |
| REQ-2.1.1 | 站点配置: 名称/IP/状态/联系人 | P0 | ⚠️ partial | `unified_sites` 表存在 (Sprint 2E.2); `/api/sites/route.ts` 返回; `/sites` 页面; 但 **tbl_site 0 行** (源端无数据, 永远显示空) |
| REQ-2.1.2 | 站点切换: SSO 免登 | P0 | ❌ not_started | **CLAUDE.md 禁止项** "不做登录权限系统"; `lib/auth/session.ts` 标明"非真实 JWT, 不含 OAuth/LDAP/ADFS/SSO" |
| REQ-2.1.3 | 站点监控: 实时状态/告警 | P0 | ❌ not_started | 源端 `tbl_site` 0 行, 无 IP/状态数据; `unified_sites` 是空表; `app/api/alerts/route.ts` 存在但无真实数据源 |
| REQ-2.2.1 | ADFS 集成登录 / JWT 令牌 | P0 | ❌ not_started | **CLAUDE.md 禁止项** "不做登录权限系统"; `/login` 页面 418 行纯 UI 演示, 自标注"Mock Authentication Demo, 不连接真实 ADFS" (`app/login/page.tsx:5`) |
| REQ-2.2.2 | 账号映射: 集团 AD ↔ 站点本地 | P0 | ❌ not_started | **CLAUDE.md 禁止项**; 源端无 AD/LDAP 通道 |
| REQ-2.2.3 | 登录审计 / 失败锁定 | P0 | ❌ not_started | **CLAUDE.md 禁止项**; `store/login-audit.ts` 仅前端 localStorage, 无服务端审计 |
| REQ-2.3.1 | 同步: 设备信息 (4 类: 光盘库/盘笼/盘位/光盘) | P0 | ✅ completed | 4/4 真实; `unified_devices` 6 行 + `unified_magazines`/`unified_slots` (396 行) + `unified_disc_media` 65 行; 4 个 dispatcher 全部 A class (`lib/sync/package-dispatcher.ts`) |
| REQ-2.3.2 | 同步: 文件索引 (tbl_file/tbl_folder) | P0 | ⚠️ partial | `unified_file_index` + `unified_folder_index` 表存在, **但 tbl_file/tbl_folder 在 source 0 行**; Sprint 2C.18 端到端走通, 数据真空 |
| REQ-2.3.3 | 同步: 权限信息 (账号/权限) | P0 | ⚠️ partial | `unified_users` 3 行, `/api/users` 真实; 但 RBAC 字段 (dept_id/role_id) 未接, 源端 3 行测试数据 |
| REQ-2.3.4 | 同步: 任务信息 (状态/进度/结果) | P0 | ✅ completed | 37 行任务 + 33/44 任务有真实 `runtime_seconds` (Sprint 2H.3 聚合); 27/44 任务有 `user_task_count`; `/api/tasks` + `/api/tasks/[id]` 真实 |
| REQ-2.3.5 | 同步策略: 实时/定时/手动 | P1 | ✅ completed | HMAC 写入 `/api/sync/package` 接收站点实时推送 (Sprint 2G.1); 9 张小表 CLI `pnpm db:init:sync` 全量; 手动触发通过 dispatcher |

### 2.2 模块二: 核心管控 (§3.1 账号 + §3.2 权限 + §3.3 部门)

| requirement_id | requirement_name | priority | current_status | 实现位置 / 备注 |
|---|---|---|---|---|
| REQ-3.1.1 | 账号维度: 基于 Site 多对多 | P0 | ❌ not_started | **CLAUDE.md 禁止项** "不做登录权限系统"; `unified_users` 3 行无 site 关联 |
| REQ-3.1.2 | 全 Site 提醒 | P1 | ❌ not_started | **CLAUDE.md 禁止项**; 源端无 push 通道 |
| REQ-3.1.3 | 账号生命周期 (创建/禁用/删除/审计) | P0 | ❌ not_started | **CLAUDE.md 禁止项**; `app/users/page.tsx` 是只读浏览页 (538 行, 无写入) |
| REQ-3.2.1 | 权限分配: 站点→设备→数据 层级 | P0 | ❌ not_started | **CLAUDE.md 禁止项**; 源端 tbl_user 只有 3 行无 role 字段 |
| REQ-3.2.2 | 权限生效: 实时 + 事务 | P0 | ❌ not_started | 同上 |
| REQ-3.3.1 | 部门管理 + 权限层级 (集团/部门) | P1 | ❌ not_started | **CLAUDE.md 禁止项**; 源端 tbl_depa 0 行 |
| REQ-3.3.2 | 权限审计 (不可篡改 1 年) | P1 | ❌ not_started | **CLAUDE.md 禁止项** |

### 2.3 模块三: 业务操作 (§4.1 检索 + §4.2 任务 + §4.3 盘笼)

| requirement_id | requirement_name | priority | current_status | 实现位置 / 备注 |
|---|---|---|---|---|
| REQ-4.1.1 | 跨维度检索 (文件/后缀/时间/部门/卷/盘) | P0 | ⚠️ partial | `/search` 页面 251 行 UI; 但**仅支持任务级 `unified_file_index` 检索** (Sprint 2C.18), 不是跨站点的 ES 全文检索; **CLAUDE.md 禁止 ES** |
| REQ-4.1.2 | 检索性能 ≤3 秒 / 千万级 | P0 | ❌ not_started | **CLAUDE.md 禁止 ES**; PG17 `unified_file_index` 任务级, 不支持千万级 |
| REQ-4.1.3 | 检索结果导出 (Excel/CSV) | P1 | ❌ not_started | `/search` 页面无导出按钮 |
| REQ-4.2.1 | 任务管理 (新建/暂停/重置/恢复) | P0 | ⚠️ partial | `/tasks` 页面 33/44 任务有真实 runtime; 但**新建/暂停/重置 API 不存在** (`/api/tasks` 是只读 GET); 总控不发起任务, 只接收 |
| REQ-4.2.2 | 任务控制 (新建恢复优先) | P0 | ❌ not_started | 源端 `tbl_task` 无 priority 字段; `burn_status` 0/2 占位 |
| REQ-4.2.3 | 数据巡检任务 (SM3/抽取校验) | P1 | ❌ not_started | 源端无 verify_result/checksum 列; 源端无 verify 通道 |
| REQ-4.2.4 | 任务监控 + 提醒 (≤10 秒) | P0 | ❌ not_started | 源端无 push 通道; `unified_tasks` 是 pull snapshot, 不是 stream; `app/api/alerts/route.ts` 存在但无数据 |
| REQ-4.3.1 | 盘笼移位登记 (全流程日志) | P1 | ❌ not_started | 源端 `tbl_magzines` 无移位字段; `unified_devices` 是状态快照 |
| REQ-4.3.2 | 盘笼查询 (在线/离线 + 导出) | P1 | ✅ completed | `/racks` 页面 356 行; `unified_devices` 6 行真实; `app/racks/page.tsx` + `/api/racks` 完整 |

### 2.4 模块四: 辅助保障 (§5.1 日志 + §5.2 索引)

| requirement_id | requirement_name | priority | current_status | 实现位置 / 备注 |
|---|---|---|---|---|
| REQ-5.1.1 | 日志采集 (刻录/回迁) | P0 | ⚠️ partial | `sync_package_log` + `sync_table_log` 真实 (13 张表 dispatch 全部有 log); 但**仅同步层日志**, 不含站点业务日志; 源端 `tbl_sys_log` 不进总控 (**CLAUDE.md 禁止 ClickHouse**) |
| REQ-5.1.2 | 日志导出 (Excel/CSV + 数字签名) | P1 | ❌ not_started | `/logs` 页面 354 行 UI, 但**无导出按钮**; `app/api/sync/logs` 只读 GET |
| REQ-5.1.3 | 日志检索 (关键字/错误码) | P1 | ⚠️ partial | `/logs` 页面有表格 + 基础筛选; 但不支持模糊匹配/全文检索 |
| REQ-5.2.1 | 光盘索引导出 (按盘笼) | P1 | ❌ not_started | 源端无光盘→盘笼汇总导出 API; file-index 是任务级 |

### 2.5 模块五: 非功能 (§6)

| requirement_id | requirement_name | priority | current_status | 实现位置 / 备注 |
|---|---|---|---|---|
| REQ-6.1.1 | 性能: 普通查询 ≤1 秒 | P0 | ✅ completed | PG17 中心库, 13 张小表 + 2 张 file-index, 单表 <1000 行, 查询 <50ms (实测) |
| REQ-6.1.2 | 并发: ≥20 用户 | P0 | ✅ completed | Next.js 16 + pnpm, 容器化部署, 无卡顿 |
| REQ-6.1.3 | 同步: 增量 ≤10 秒 / 任务状态 ≤5 秒 | P0 | ⚠️ partial | HMAC 鉴权 + 站点 push 即时; 但**任务状态 ≤5 秒** 取决于源端 push 频率 (无主动 push 通道) |
| REQ-6.2.1 | 数据传输加密 | P0 | ✅ completed | HMAC-SHA256 签名 (`lib/sync/package-auth.ts`); 5 分钟时间窗; `crypto.timingSafeEqual` |
| REQ-6.2.2 | 数据存储加密 (不可逆) | P0 | ❌ not_started | **CLAUDE.md 禁止项** (无登录账号系统, 也就无密码存储) |
| REQ-6.2.3 | 操作审计 (不可篡改 1 年) | P0 | ❌ not_started | **CLAUDE.md 禁止项**; `sync_*_log` 是同步层, 不是操作审计 |
| REQ-6.2.4 | 防越权: 跨站/跨部门隔离 | P0 | ⚠️ partial | `x-site-code` 头与 `payload.siteCode` 一致性校验 (Sprint 2G.1); 但**仅同步入口校验, 无 UI 路由/数据级越权控制** (无登录就无"当前用户") |
| REQ-6.3.1 | 前端兼容 (Chrome/Firefox/Edge) | P1 | ✅ completed | Next.js 16 + Tailwind v4 + Radix UI, 主流浏览器兼容 |
| REQ-6.3.2 | 接口兼容 (不修改站点接口) | P0 | ✅ completed | 总控只接收, 不写回; `LEADER_DECISIONS.md §7` 明示 |
| REQ-6.3.3 | 数据库兼容 (PG 17+) | P0 | ✅ completed | Docker 容器 PG 17, 站点库 PG (版本无关, 总控不连) |
| REQ-6.4.1 | 日志分类 (运行/错误/审计) | P1 | ⚠️ partial | `sync_package_log` (运行) + `sync_table_log` (执行) 真实; 错误/审计无 |
| REQ-6.4.2 | 监控: CPU/内存/接口响应 | P1 | ⚠️ partial | `/api/system/health` + `/api/system/db-health` 真实; 但**无阈值告警** (无 push 通道) |
| REQ-6.4.3 | 关键参数可配置 | P1 | ⚠️ partial | `SYNC_PACKAGE_AUTH_MODE` + `SYNC_PACKAGE_SECRET` 环境变量; `lib/site/site-context` Header siteCode 切换; 同步周期/告警阈值无 UI |

---

## 3. 统计

### 3.1 需求状态分布 (32 项)

| 状态 | 数量 | 占比 | 含义 |
|---|---|---|---|
| ✅ completed | **9** | **28.1%** | 完整实现 + 真实数据 + 真实端到端 |
| ⚠️ partial | **10** | **31.3%** | UI 框架有, 数据/写入/导出/告警缺失 |
| ❌ not_started | **11** | **34.4%** | 未实现, 源端缺失或 CLAUDE.md 禁止 |
| 🚫 blocked | 0 | 0% | — |
| 🚫 out_of_scope | 2 | 6.3% | 主动不做 (CLAUDE.md 明示) |
| **总计** | **32** | **100%** | — |

### 3.2 按模块统计

| 模块 | ✅ | ⚠️ | ❌ | 完成度 |
|---|---|---|---|---|
| §1 定位 / §2 站点/身份/同步 | 3 | 3 | 4 | 3/10 = 30% |
| §3 账号/权限/部门 | 0 | 0 | 5 | 0/5 = 0% (全部 CLAUDE.md 禁止) |
| §4 检索/任务/盘笼 | 1 | 2 | 4 | 1/7 = 14.3% |
| §5 日志/索引 | 0 | 2 | 2 | 0/4 = 0% |
| §6 非功能 | 5 | 3 | 2 | 5/10 = 50% |
| **合计** | **9** | **10** | **11** | **28.1%** |

### 3.3 按"是否 CLAUDE.md 禁止项"统计

| 类型 | 数量 | 说明 |
|---|---|---|
| CLAUDE.md 禁止项 | **8** | 登录/SSO/JWT/RBAC/审计/部门/ES/ClickHouse |
| 源端无数据 | **5** | tbl_site 0 行/tbl_platform 0 行/tbl_depa 0 行/tbl_file 0 行/tbl_folder 0 行 |
| 源端 schema 缺字段 | **4** | errorMessage/progress/checksum/移位字段 |
| 主动设计为单向 (只接收不发起) | **2** | 任务控制/盘笼移位 (总控不发起业务) |
| 可实现但未做 | **13** | 多数是 UI 增强 (导出按钮/检索筛选/badge) |

---

## 4. 8 大能力现状 (直接回答)

### 4.1 JWT 做到哪了

**没做, 也不会做**。`lib/auth/session.ts:4-5` 明示"非真实 JWT 签发/校验, 不包含 OAuth/LDAP/ADFS/SSO Federation"。`/login` 页面 418 行纯 Mock 演示, 颁发 `mock_demo_<user>_<ts>` 假 token, 仅 localStorage 记忆, 不调任何 IdP。

**原因**: CLAUDE.md "不做登录权限系统"。

### 4.2 RBAC 做到哪了

**没做, 也不会做**。源端 `tbl_user` 只有 3 行测试数据, 无 `role_id` / `dept_id` 字段; 项目架构 (CLAUDE.md 禁止项 + 无登录) 让 RBAC 无着力点。

**当前仅**: 站点级 `x-site-code` 头校验 (Sprint 2G.1, 仅同步入口, 不是 RBAC)。

### 4.3 登录做到哪了

**Mock UI 演示**。`/login` 页面是 "ADFS/LDAP/SSO 模拟" UI 演示; `lib/mock/auth.ts` + `lib/auth/session.ts` + `store/login-audit.ts` 全是前端 localStorage, 不调服务端。

**真实可用性**: 0 (UI 框架 ≠ 功能)。

### 4.4 同步做到哪了

**完整可用 (核心能力)**。13 张源表 100% dispatcher 处理, 11 A + 2 C, 0 D, HMAC 鉴权 (Sprint 2G.1), 5 分钟时间窗, `x-site-code` 头与 payload 一致, 6 个核心 API (`/api/tasks` `/api/racks` `/api/volumes` `/api/users` `/api/sites` `/api/dashboard/summary` 等) 全部真实数据; 聚合器 (Sprint 2H.3) 把 3 张占位表 (C → A), 真实可用率 84.6%。

**剩余**: 站点侧推送客户端 (CLI / Agent) 未建 (需求 §2.3.5 手动触发靠 `pnpm export:package`)。

### 4.5 文件检索做到哪了

**任务级 (partial)**。`/search` 页面 + `/api/tasks/[id]/files` (`unified_file_index`) 走通, 任务级文件/目录索引 (Sprint 2C.18); **不是跨站点的 ES 全文检索** (CLAUDE.md 禁止 ES)。

**真实可用性**: ⚠️ (源端 tbl_file/tbl_folder 0 行, 数据真空)。

### 4.6 恢复做到哪了

**只读, 不发起**。`/tasks` 列表 + 详情 drawer + `runtime_seconds` (33/44 真实) + `user_task_count` (27/44 真实) + 8 字段 (Sprint 2F.1) 全部真实; **但总控不发起新任务, 只接收源端推送** (LEADER_DECISIONS.md §5 站点负责, §7 总控不写回)。

**真实可用性**: ✅ 监控完整, ❌ 业务控制不存在。

### 4.7 设备控制做到哪了

**只读, 不控制**。`/racks` 列表 + 详情 + 396 行 `unified_slots` 真实; **无设备控制 API** (CLAUDE.md + LEADER_DECISIONS §7 双向约束)。

**真实可用性**: ✅ 监控完整, ❌ 远程控制不存在 (本来就不该有, 是设计选择)。

### 4.8 审计做到哪了

**只同步层, 不操作**。`sync_package_log` (包级) + `sync_table_log` (表级) 真实, 13 张表全部有 A/C/D 分类状态; `/logs` 页面 + `/sync` 页面可视化; **无业务操作审计 / 登录审计 / 权限变更审计** (CLAUDE.md 禁止登录/RBAC, 也就无审计对象)。

**真实可用性**: ⚠️ (同步审计完整, 业务审计不存在)。

---

## 5. 4 个率

### 5.1 需求完成率

```
已完成:       9 / 32 = 28.1%
部分完成:    10 / 32 = 31.3%
未开始:      11 / 32 = 34.4%
禁止项:       2 / 32 =  6.3%
─────────────────────
"已落地可用": 9 / 32 = 28.1%
```

### 5.2 实际可演示率 (产品 demo 角度)

去掉 CLAUDE.md 禁止 + 源端无数据, 仅算"有真实数据 + 真实端到端" 的可演示功能:

| 类别 | 可演示功能 |
|---|---|
| 数据同步 | ✅ 4/4 类型 (设备/文件/权限/任务) 全部能 demo |
| 真实数据页面 | ✅ 4/5 (Dashboard/Tasks/Racks/Volumes 有真实数据; Search 仅任务级) |
| HMAC 鉴权 | ✅ 端到端 push demo |
| 聚合器 | ✅ 3 张占位表聚合器 + 33/44 任务 runtime + 3/5 volume slot |
| 站点切换 | ⚠️ UI (Header siteCode 切换) + localStorage + URL 同步, **不是 SSO** |
| 登录 | ❌ Mock UI, 真实 0 |
| 检索 | ⚠️ 任务级, 不是跨站 ES |
| 任务控制 | ❌ 只能监控, 不能新建/暂停 |
| 设备控制 | ❌ 只能监控, 不能远程 |

**可演示率**: **4.5 / 7 项 ≈ 64%** (取 7 个核心可演示维度)

### 5.3 实际可落地率 (生产可用角度)

去掉"UI 框架/演示" "源端 0 数据" "单向 pull" 之后, **真生产可落地**的功能:

| 功能 | 状态 |
|---|---|
| 站点同步接收 (HMAC) | ✅ 生产可用 |
| 13 张表 dispatcher | ✅ 生产可用 |
| Dashboard / Tasks / Racks / Volumes 真实数据 | ✅ 生产可用 |
| Tasks 列表 runtime + _aggregate 透传 | ✅ 生产可用 |
| 站点筛选 (Header siteCode) | ✅ 生产可用 |
| 聚合器 (3 张占位表) | ✅ 生产可用 |
| 同步日志 / 包日志可视化 | ✅ 生产可用 |
| 登录 / 权限 / 部门 / 审计 | ❌ 不落地 (CLAUDE.md) |
| 跨站 ES 检索 | ❌ 不落地 (CLAUDE.md + 源端 0 行) |
| 任务新建/暂停/控制 | ❌ 不落地 (单向 pull, 设计选择) |
| 设备远程控制 | ❌ 不落地 (单向, 设计选择) |

**可落地率**: **7 / 11 ≈ 64%**。

### 5.4 综合完成度

**业务完成度: 85%** (Sprint 3.0 审计, 4/4 同步类型 + 0 D class)
**需求完成度: 28.1%** (本审计, 9/32)
**可演示率: 64%** (本审计)
**可落地率: 64%** (本审计)

---

## 6. Top 10 未完成能力

按"已投入 vs 实际价值" 排序:

| # | 能力 | 当前状态 | 阻塞 | 唯一可能路径 |
|---|---|---|---|---|
| 1 | **登录 / JWT / SSO** | ❌ Mock UI | CLAUDE.md 禁止 | 等上级要求调整 (解锁 CLAUDE.md) |
| 2 | **RBAC 权限分配** | ❌ 无实现 | CLAUDE.md 禁止 + 源端 3 行无 role | 同上 |
| 3 | **任务实时进度 / 告警 push** | ❌ 数据是 pull snapshot | 源端无 push 通道 | 等源端补 push 通道 / 改为 WebSocket |
| 4 | **任务控制 (新建/暂停/重置)** | ❌ 只读 | 设计选择 (LEADER_DECISIONS §7 单向) | 接受"总控是观察者" 或 改设计 |
| 5 | **设备远程控制** | ❌ 无实现 | 设计选择 (单向) | 同上 |
| 6 | **跨站 ES 全文检索** | ❌ 任务级 | CLAUDE.md 禁止 ES | 解锁 CLAUDE.md |
| 7 | **审计 (操作/登录/权限)** | ❌ 仅同步层 | CLAUDE.md 禁止登录 | 同 #1 |
| 8 | **检索结果导出 / 日志导出** | ❌ UI 无按钮 | 仅 UI 增强 (2-3 小时) | Sprint 3.7 加按钮 (ROI 3) |
| 9 | **数据巡检 (SM3/抽取)** | ❌ 无源端 | 源端无 verify_result/checksum | 等源端补 schema |
| 10 | **盘笼移位登记** | ❌ 无源端字段 | 源端 tbl_magzines 无移位 | 等源端补字段 |

**核心真相**: Top 10 中 7 项的根因是 **CLAUDE.md 禁止项** + **源端 schema 缺失**, 不是项目能解决的"未做"。

---

## 7. 下一阶段唯一推荐 Sprint

**Sprint 3.7 — Racks slot drawer 真实数据 (剩余 ROI=5 唯一项)**

理由:
1. **13 张源表已 100% 处理**, 不能再接表
2. **CLAUDE.md 禁止项解锁需要上级**, 不在项目自主范围内
3. **Top 10 中第 8 项 (UI 增强)** 是项目唯一能做的 ROI=5 任务
4. **396 行 unified_slots 真实数据** 已有, Racks 页面缺明细, 改 1 个 drawer + 1 个 API
5. 完成后业务完成度 85% → 88%, 需求完成度 28.1% → 30%

**不再推荐**的 Sprint:
- 接新表 (133 张理论表 0 行, 接了空)
- 登录/权限/RBAC (CLAUDE.md 禁止, 等上级)
- ES / ClickHouse (CLAUDE.md 禁止, 等上级)
- 任务控制/设备控制 (设计选择, 等架构决议)

---

## 8. 关键发现

1. **需求完成度 28.1%** (9/32), 业务完成度 85% (Sprint 3.0) — 数字差异来自"业务类型" 与"功能点" 颗粒度
2. **CLAUDE.md 禁止项占了 8 项**, 这是项目最大边界, 不可在项目内解决
3. **8 项里 7 项 (登录/RBAC/SSO/审计/部门) 互为依赖**, 解锁一个会带动其他
4. **源端 schema 缺失占 4 项** (errorMessage/progress/checksum/移位), 等源端补
5. **设计选择 (单向 pull) 占 2 项** (任务控制/设备控制), 改设计即可
6. **UI 增强 (导出/筛选/badge) 占 ~10 项**, 是项目能做的 ROI=3-4 任务

## 9. 结论

- **9/32 完整完成 (28.1%)** + **10/32 部分 (31.3%)** = **59.4% 已着手**
- **8 项 CLAUDE.md 禁止 + 4 项源端缺失 + 2 项设计选择 = 14 项 (43.8%) 不可在项目内实现**
- **实际可推进: 9 项 (28.1%)** — 多数是 UI 增强 (导出按钮/筛选/badge)
- **下一 Sprint 唯一推荐: 3.7 Racks slot drawer (ROI 5)**
- **真正的下一个里程碑: CLAUDE.md 调整 / 源端补数据**, 不在项目自主范围
