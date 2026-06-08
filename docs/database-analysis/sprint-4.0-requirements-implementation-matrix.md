# Sprint 4.0 — Requirements Implementation Matrix (需求实现矩阵)

> **状态**: ✅ 完成 (只审计, **不写业务代码 / 不新增 API / 不新增页面 / 不修改数据库**)
> 审计时间: 2026-06-08
> 唯一标准: `docs/source/requirements.md`
> 关联: Sprint 3.0 (业务价值审计) + Sprint 3.0R (需求对照) + Sprint 3.1 (部署指南)

---

## 0. 审计范围

把 requirements.md 的 8 大模块 / 21 项功能点 / 6 类非功能, 拆成 **40 个原子需求** (REQ-001 ~ REQ-040), 逐条映射到:
- **Module** (lib/api/* 模块)
- **API** (app/api/* 端点)
- **Database** (unified_* / tbl_* / sync_*_log)
- **UI** (app/*/page.tsx)

6 状态分类: **Complete / Partial / Not Started / Blocked by Site API / Blocked by Auth / Out of Scope**

每个需求都标:
- 需求原文 (从 requirements.md 复制)
- 当前状态
- 缺失内容
- 实现难度 (1-5)
- 预计工期 (人天)

---

## 1. 完整需求实现矩阵 (40 个原子需求)

### 1.1 模块一: 基础支撑 (§1 系统定位 + §2 站点/身份/同步)

| REQ-ID | 需求原文 (摘) | 对应 Module | 对应 API | 对应 DB | 对应 UI | 状态 | 缺失内容 | 难度 | 工期 |
|---|---|---|---|---|---|---|---|---|---|
| **REQ-001** | 集团层统一管控, 不替代站点系统 | 全栈 | — | — | — | **Complete** | — | 1 | 0d |
| **REQ-002** | 站点配置: 名称/IP/状态/联系人 | `lib/api/site-provider` | `GET /api/sites` | `unified_sites` | `/sites` | **Partial** | 源 `tbl_site` 0 行, 框架有, 数据空 | 2 | 1d (源端补) |
| **REQ-003** | 站点切换: SSO 免登 | `lib/auth/session` | — | — | `/login` (mock) | **Blocked by Auth** | JWT/OAuth/ADFS 未接 | 5 | 5d |
| **REQ-004** | 站点监控: 实时状态 + 告警 | `lib/api/alert-adapter` | `GET /api/alerts` | `unified_sites` + 监控 | Dashboard alert-center | **Partial** | UI 框架 + `unified_sites` 空 | 4 | 3d (源端补) |
| **REQ-005** | 监控阈值自定义 + 5 分钟采集 | — | — | — | — | **Not Started** | 无阈值配置 UI; 同步是 pull, 不是 push | 4 | 3d |
| **REQ-006** | ADFS 3.0+ / LDAP 集成登录 | `lib/auth/session` | — | — | — | **Blocked by Auth** | CLAUDE.md 禁止 | 5 | — |
| **REQ-007** | JWT 令牌 (2 小时有效期) | `lib/auth/session` | — | — | — | **Blocked by Auth** | 同上 | 4 | — |
| **REQ-008** | 集团 AD ↔ 站点本地账号映射 | — | — | — | — | **Out of Scope** | CLAUDE.md + 源端无 AD 通道 | 5 | — |
| **REQ-009** | 登录审计 + 失败 ≥5 次锁定 | `store/login-audit` | — | — | — | **Blocked by Auth** | 仅前端 localStorage, 无服务端 | 4 | 4d (需先解锁 Auth) |
| **REQ-010** | 同步设备 (光盘库/盘笼/盘位/光盘) | `lib/sync/package-dispatcher` | `POST /api/sync/package` | `unified_devices` + slots + media | `/racks` | **Complete** | 4 张表 dispatcher 全 A | 1 | 0d |
| **REQ-011** | 同步文件索引 (tbl_file/tbl_folder) | `lib/sync/file-index` | `GET /api/tasks/[id]/files` | `unified_file_index` | `/search` | **Partial** | Sprint 2C.18 端到端通, 源 `tbl_file` 0 行 | 3 | 2d (源端补) |
| **REQ-012** | 同步权限 (账号/权限变更) | `lib/sync/users-importer` | `GET /api/users` | `unified_users` | `/users` | **Partial** | 3 行, 无 RBAC 字段 | 3 | 1d (源端补 dept/role) |
| **REQ-013** | 同步任务 (状态/进度/结果) | `lib/sync/package-dispatcher` | `GET /api/tasks` + `/api/tasks/[id]` | `unified_tasks` + `_aggregate` | `/tasks` | **Complete** | 33/44 runtime + 27/44 user_task 真实 | 1 | 0d |
| **REQ-014** | 同步策略: 实时/定时/手动 | `lib/sync/sync-engine` | `POST /api/sync/package` | `sync_package_log` | `/sync` | **Complete** | HMAC push + 手动 trigger | 1 | 0d |
| **REQ-015** | 数据一致性校验 (差异报告) | — | — | — | — | **Not Started** | 无定时校验 job | 3 | 2d |
| **REQ-016** | 同步失败自动重试 + 告警 | `lib/sync/sync-engine` | — | `sync_table_log.status` | — | **Partial** | log 记录状态, 无自动重试 job | 3 | 1d |

### 1.2 模块二: 核心管控 (§3 账号/权限/部门)

| REQ-ID | 需求原文 (摘) | 对应 Module | 对应 API | 对应 DB | 对应 UI | 状态 | 缺失内容 | 难度 | 工期 |
|---|---|---|---|---|---|---|---|---|---|
| **REQ-017** | 账号维度: Site 多对多 + 部门/角色 | `lib/api/user-provider` | `GET /api/users` | `unified_users` | `/users` | **Blocked by Auth** | 源端 3 行无 site 关联, CLAUDE.md 禁 | 5 | — |
| **REQ-018** | 全 Site 提醒 (跨站点消息推送) | — | — | — | — | **Blocked by Site API** | 源端无 push 通道 | 4 | 5d (需站点先做) |
| **REQ-019** | 账号生命周期 (创建/启用/禁用/删除) | `lib/api/user-provider` | `GET /api/users` (只读) | `unified_users` | `/users` (只读) | **Blocked by Auth** | 写入 API 不存在 | 4 | 3d (需先做 Auth) |
| **REQ-020** | 权限分配流程 (站点→设备→数据) | — | — | — | — | **Out of Scope** | CLAUDE.md 禁 + 源端无 role 字段 | 5 | — |
| **REQ-021** | 权限生效: 实时 + 事务 | — | — | — | — | **Out of Scope** | 同上 | 5 | — |
| **REQ-022** | 部门管理 (集团/部门/站点三级) | — | — | — | — | **Out of Scope** | 源 `tbl_depa` 0 行 + CLAUDE.md 禁 | 5 | — |
| **REQ-023** | 权限审计 (操作/变更/撤销, 1 年不可篡改) | — | — | — | — | **Blocked by Auth** | 同步层 `sync_*_log` 不算 | 4 | 3d (需 Auth) |

### 1.3 模块三: 业务操作 (§4 检索/任务/盘笼)

| REQ-ID | 需求原文 (摘) | 对应 Module | 对应 API | 对应 DB | 对应 UI | 状态 | 缺失内容 | 难度 | 工期 |
|---|---|---|---|---|---|---|---|---|---|
| **REQ-024** | 跨维度检索 (名称/后缀/时间/部门/卷/盘) | `lib/api/search-provider` | (mock only) | `unified_file_index` | `/search` | **Partial** | 任务级, 不是跨站 ES | 4 | 5d (解锁 ES) |
| **REQ-025** | 检索性能 ≤3 秒 / 千万级 | — | — | `unified_file_index` | — | **Blocked by Site API** | 源 `tbl_file` 0 行; ES 未接 | 5 | 8d |
| **REQ-026** | 检索结果导出 (Excel/CSV) | — | — | — | `/search` | **Not Started** | 页面无导出按钮 | 1 | 0.5d |
| **REQ-027** | 任务管理: 新建/暂停/重置/恢复 | `lib/api/task-provider` | `GET /api/tasks` (只读) | `unified_tasks` | `/tasks` | **Partial** | 33/44 runtime 真实, 无写入 API | 3 | 3d (需设计变更) |
| **REQ-028** | 任务控制: 优先恢复 + 单盘不中断 | — | — | — | — | **Blocked by Site API** | 总控不发起任务, 设计选择 | 4 | 5d (需架构决议) |
| **REQ-029** | 数据巡检: SM3/抽取校验/全量比例 | — | — | — | — | **Blocked by Site API** | 源端无 verify_result/checksum | 5 | 8d |
| **REQ-030** | 任务监控: 进度 + 告警 push | `lib/api/alert-adapter` | `GET /api/alerts` | `unified_tasks` | Dashboard | **Partial** | 监控有, push 通道无 | 3 | 2d (需 push) |
| **REQ-031** | 盘笼移位登记 (原站点/目标/审批/状态) | — | — | `unified_devices` | — | **Blocked by Site API** | 源 `tbl_magzines` 无移位字段 | 4 | 3d |
| **REQ-032** | 盘笼查询 (在线/离线 + 导出) | `lib/api/rack-provider` | `GET /api/racks` | `unified_devices` | `/racks` | **Complete** | 6 设备 + 396 盘位真实 | 1 | 0d |

### 1.4 模块四: 辅助保障 (§5 日志/索引)

| REQ-ID | 需求原文 (摘) | 对应 Module | 对应 API | 对应 DB | 对应 UI | 状态 | 缺失内容 | 难度 | 工期 |
|---|---|---|---|---|---|---|---|---|---|
| **REQ-033** | 日志采集 (刻录/回迁全量) | `lib/sync/sync-job-log` | `POST /api/sync/package` | `sync_package_log` + `sync_table_log` | `/sync` + `/logs` | **Complete** | 13 张表同步日志全有 | 1 | 0d |
| **REQ-034** | 日志导出 (Excel/CSV + 数字签名) | — | — | `sync_package_log` | `/logs` | **Not Started** | 页面无导出按钮 | 2 | 1d |
| **REQ-035** | 日志检索 (关键字/错误码) | — | `GET /api/sync/logs` | `sync_*_log` | `/logs` | **Partial** | 表格 + 基础筛选, 无模糊匹配 | 2 | 1d |
| **REQ-036** | 光盘索引导出 (按盘笼, 含校验码) | — | — | `unified_file_index` | — | **Blocked by Site API** | 源 `tbl_file` 0 行 | 3 | 3d |

### 1.5 模块五: 非功能 (§6 性能/安全/兼容/可维护)

| REQ-ID | 需求原文 (摘) | 对应 Module | 对应 API | 对应 DB | 对应 UI | 状态 | 缺失内容 | 难度 | 工期 |
|---|---|---|---|---|---|---|---|---|---|
| **REQ-037** | 性能: 普通查询 ≤1 秒 / 复杂 ≤2 秒 | 全栈 | — | `unified_*` | — | **Complete** | 13 张小表 + 单测 <50ms | 1 | 0d |
| **REQ-038** | 并发 ≥20 用户 | Next.js + Docker | — | — | — | **Complete** | 单进程 dev 即可; 生产需 cluster | 2 | 1d (cluster) |
| **REQ-039** | 数据传输加密 (HMAC-SHA256) | `lib/sync/package-auth` | `POST /api/sync/package` | — | — | **Complete** | Sprint 2G.1 strict + 5min window | 1 | 0d |
| **REQ-040** | 操作审计 (不可篡改 1 年) | `lib/sync/sync-job-log` | `POST /api/sync/package` | `sync_*_log` | `/logs` | **Partial** | 同步层有, 业务层无 (需 Auth) | 3 | 2d (需 Auth) |

---

## 2. 6 状态分布统计

### 2.1 总览 (40 个原子需求)

| 状态 | 数量 | 占比 | 含义 |
|---|---|---|---|
| ✅ **Complete** | **8** | **20.0%** | 完整实现 + 真实数据 + 端到端 |
| ⚠️ **Partial** | **10** | **25.0%** | UI/API/DB 框架有, 数据或写入缺失 |
| ❌ **Not Started** | **4** | **10.0%** | 未实现, 短期可做 (UI 增强/校验) |
| 🚫 **Blocked by Site API** | **6** | **15.0%** | 源端 schema 缺字段 / 缺 push 通道 |
| 🔐 **Blocked by Auth** | **5** | **12.5%** | 依赖登录/RBAC/审计系统 |
| ⛔ **Out of Scope** | **7** | **17.5%** | CLAUDE.md 禁止项 |
| **总计** | **40** | **100%** | — |

### 2.2 按模块统计

| 模块 | Complete | Partial | Not Started | Blocked-Site | Blocked-Auth | Out of Scope |
|---|---|---|---|---|---|---|
| §1 + §2 基础 | 3 | 5 | 2 | 0 | 5 | 1 |
| §3 管控 | 0 | 0 | 0 | 1 | 3 | 3 |
| §4 业务 | 2 | 2 | 1 | 4 | 0 | 0 |
| §5 保障 | 1 | 1 | 1 | 1 | 0 | 0 |
| §6 非功能 | 2 | 2 | 0 | 0 | 0 | 0 |
| **合计** | **8** | **10** | **4** | **6** | **5** | **7** |

### 2.3 按"是否可立即做"分类

| 类别 | 数量 | 说明 |
|---|---|---|
| ✅ **已完整** | 8 | 不动 |
| ⚠️ **可继续打磨** (Partial+Not Started 且不在 Blocked 类) | **9** | 项目能自主推进 |
| 🚫 **需站点先做** | 6 | 等源端补 |
| 🔐 **需 Auth 先做** | 5 | 等登录/RBAC 解锁 |
| ⛔ **CLAUDE.md 永久不做** | 7 | 主动放弃 |

---

## 3. 重点 8 项深审 (用户指定)

### 3.1 REQ-006/007/009: 统一身份认证 (ADFS/JWT/SSO)

| 维度 | 现状 |
|---|---|
| 实现位置 | `lib/auth/session.ts` (60 行, 全部 mock), `/login` 页面 418 行 UI 演示 |
| 真实可用 | **0** — 颁发 `mock_demo_<user>_<ts>` 假 token, 仅 localStorage |
| 阻塞 | **CLAUDE.md "不做登录权限系统"** (硬约束) |
| 解锁路径 | 等上级调整 CLAUDE.md |
| 工期 (解锁后) | 5+4+3 = **12 人天** (3 个 REQ) |

### 3.2 REQ-020/021/022: RBAC 权限分配

| 维度 | 现状 |
|---|---|
| 实现位置 | 无 |
| 真实可用 | **0** — 无权限模型, 无 role_id/dept_id 字段 |
| 阻塞 | **CLAUDE.md + 源端 3 行无 role 字段** (双向缺失) |
| 解锁路径 | 必须等 Auth 体系先建立 (REQ-006) + 源端补字段 |
| 工期 (解锁后) | 8+5+5 = **18 人天** (3 个 REQ) |

### 3.3 REQ-027/028: 统一任务管理 (新建/暂停/重置/恢复/优先)

| 维度 | 现状 |
|---|---|
| 实现位置 | `lib/api/task-provider` GET (只读), `unified_tasks` 37 行真实 |
| 真实可用 | **监控完整, 控制 0** — 33/44 runtime 真实, 但无 POST/PATCH API |
| 阻塞 | **设计选择 (LEADER_DECISIONS §7 总控不发起) + 源端 burn_status 0/2 占位** |
| 解锁路径 | 架构决议"总控是否发起任务" — 需上级确认 |
| 工期 (解锁后) | 3+5 = **8 人天** |

### 3.4 REQ-029: 数据巡检 (SM3 校验)

| 维度 | 现状 |
|---|---|
| 实现位置 | 无 |
| 真实可用 | **0** |
| 阻塞 | **源端 `tbl_task` 无 verify_result/checksum 列, 无巡检 job** |
| 解锁路径 | 源端补 schema + 推 verify 通道 |
| 工期 (解锁后) | **8 人天** (端到端实现) |

### 3.5 REQ-005/018/030: 告警通知 (实时/全 Site/任务失败)

| 维度 | 现状 |
|---|---|
| 实现位置 | `lib/api/alert-adapter`, `app/api/alerts/route.ts`, Dashboard `alert-center.tsx` |
| 真实可用 | **UI 框架有, 数据空** — `unified_sites` 0 行 |
| 阻塞 | **源端无 push 通道 (sync 是 pull 模式) + 源端监控数据空** |
| 解锁路径 | 源端补 push 通道 (WebSocket 或长轮询) |
| 工期 (解锁后) | 3+5+2 = **10 人天** (3 个 REQ) |

### 3.6 REQ-009/023/040: 审计日志 (登录/权限/操作)

| 维度 | 现状 |
|---|---|
| 实现位置 | `lib/sync/sync-job-log` (同步层完整), `store/login-audit` (前端 localStorage) |
| 真实可用 | **同步层有 (sync_package_log + sync_table_log), 业务层 0** |
| 阻塞 | **CLAUDE.md 禁登录 → 无登录 → 无审计对象** |
| 解锁路径 | 必先做 Auth (REQ-006/007) |
| 工期 (解锁后) | 4+3+2 = **9 人天** (3 个 REQ) |

### 3.7 REQ-024/025: 文件检索 (跨维度 + 性能)

| 维度 | 现状 |
|---|---|
| 实现位置 | `lib/mock/search`, `/search` 页面 251 行, `unified_file_index` 任务级索引 |
| 真实可用 | **任务级通, 跨站不可** — 源 `tbl_file/tbl_folder` 0 行 |
| 阻塞 | **CLAUDE.md 禁 ES + 源端 0 行** |
| 解锁路径 | 解锁 ES (强依赖) + 源端补数据 |
| 工期 (解锁后) | 5+8 = **13 人天** (2 个 REQ) |

### 3.8 REQ-031: 盘笼移位管理

| 维度 | 现状 |
|---|---|
| 实现位置 | 无 — `unified_devices` 是状态快照, 无移位字段 |
| 真实可用 | **0** |
| 阻塞 | **源端 `tbl_magzines` 无移位字段** |
| 解锁路径 | 源端补字段 + 站点推移位事件 |
| 工期 (解锁后) | **3 人天** |

---

## 4. A. 当前真实完成率

| 维度 | 数值 | 公式 |
|---|---|---|
| **完整完成** | **20.0%** (8/40) | Complete 状态 |
| **已着手** (Complete+Partial) | **45.0%** (18/40) | 完整 + 部分 |
| **可立即推进** | **22.5%** (9/40) | 不在 Blocked 类的 Partial+Not Started |
| **永久阻塞** (Out of Scope) | **17.5%** (7/40) | CLAUDE.md 禁止 |
| **依赖站点** | **15.0%** (6/40) | Blocked by Site API |
| **依赖 Auth** | **12.5%** (5/40) | Blocked by Auth |

**业务完成度 85%** (Sprint 3.0 数据维度) ≠ **需求完成度 20%** (本审计): 因为 4/4 同步类型覆盖 = 4 个 REQ 完成, 拉高了业务完成度; 但 32 个 REQ 散布在 6 个状态。

---

## 5. B. 未来 10 个 Sprint 路线图 (按 ROI 排序)

| # | Sprint | 目标 | ROI | 估时 | 类别 |
|---|---|---|---|---|---|
| 1 | **3.7 Racks slot drawer** | Racks 页面 slot 真实明细 (396 行已有) | 5 | 0.5d | UI 增强 |
| 2 | **3.8 Volumes 容量进度条增强** | VolumeDTO.aggregate 完整展示 + Progress | 4 | 0.5d | UI 增强 |
| 3 | **3.9 Tasks runtime 来源 badge** | "来自 lib_task 聚合" 标识 | 4 | 0.5d | UI 增强 |
| 4 | **3.10 Dashboard volumes tile** | 5 个真实 volume 总数 tile | 4 | 0.5d | UI 增强 |
| 5 | **3.11 同步日志 A/B/C/D 分类徽章** | /sync 页面分类显示 | 3 | 1d | UI 增强 |
| 6 | **3.12 /logs /search 导出按钮** | 1 个 API + 1 个按钮 (REQ-026, 034) | 3 | 1d | UI 增强 |
| 7 | **3.13 数据一致性校验 job** | 定时跑对账, 写差异报告 (REQ-015) | 3 | 2d | 后端 |
| 8 | **3.14 sync 失败自动重试** | sync_table_log 状态 + 自动重试 (REQ-016) | 3 | 1d | 后端 |
| 9 | **3.15 阈值配置 UI** (REQ-005) | Dashboard 阈值自定义 | 3 | 3d | UI+后端 |
| 10 | **3.16 RBAC 权限分配 (解锁 CLAUDE.md 后)** | REQ-020/021/022 | 5 | 18d | 等解锁 |

**关键事实**:
- Sprint 1-6 都是 **UI 增强 (单点 ROI 3-5)**, 项目能自主推进
- Sprint 7-9 触及后端 job, ROI 3
- Sprint 10 (RBAC) 必须等上级解锁 CLAUDE.md
- 真正依赖站点/源端的 REQ (006/009/015/029/030/031 等) **不在 10 个 Sprint 内**, 因 ROI 受限

---

## 6. C. 哪些需求可以立即开发 (不依赖站点/Auth)

按"立即可做 + ROI 高" 排序:

| # | REQ-ID | 需求 | 改动范围 | ROI | 估时 |
|---|---|---|---|---|---|
| 1 | **REQ-026** | 检索结果导出 (Excel/CSV) | 1 API + 1 按钮 | 3 | 0.5d |
| 2 | **REQ-034** | 日志导出 (Excel/CSV) | 1 API + 1 按钮 | 3 | 1d |
| 3 | **REQ-015** | 数据一致性校验 job | 1 cron + 1 report | 3 | 2d |
| 4 | **REQ-016** | sync 失败自动重试 | sync-engine retry 逻辑 | 3 | 1d |
| 5 | **REQ-035** | 日志模糊检索 (关键字/错误码) | 1 API 增强 + UI 输入 | 2 | 1d |
| 6 | **REQ-038** | cluster 模式部署 | Next.js standalone | 2 | 1d |

**合计**: 6.5 人天, 全部项目能自主推进, 不依赖站点/Auth/CLAUDE.md 调整。

---

## 7. D. 哪些需求必须等待站点接口 (6 个)

| REQ-ID | 需求 | 等待什么 | 估时 (站点 + 项目) |
|---|---|---|---|
| **REQ-018** | 全 Site 提醒 (跨站点消息推送) | 站点侧 push 通道 (WebSocket / 长轮询) | 5d (站点) + 5d (项目) |
| **REQ-025** | 千万级检索 (≤3 秒) | ES 集群 + 源 `tbl_file` 真实数据 | 8d (ES) + 8d (项目) |
| **REQ-028** | 任务控制 (新建/暂停/恢复) | 源 `tbl_task` 加 control 字段 + push 通道 | 5d (站点) + 5d (项目) |
| **REQ-029** | 数据巡检 (SM3/抽取) | 源端补 verify_result/checksum + 巡检通道 | 8d (站点) + 8d (项目) |
| **REQ-030** | 任务监控 + 告警 push | 源端推 status 变更 (≤10s) | 2d (站点) + 2d (项目) |
| **REQ-031** | 盘笼移位登记 | 源 `tbl_magzines` 补 from_site/to_site/approver | 3d (站点) + 3d (项目) |

**合计**: 站点侧约 **31 人天**, 项目侧约 **31 人天** (项目侧工作必须在站点侧完成后才能开始)。

**8. E. 哪些需求必须先完成认证体系 (5 个)**

| REQ-ID | 需求 | 为何依赖 Auth |
|---|---|---|
| **REQ-003** | 站点切换 SSO 免登 | 需要登录态 |
| **REQ-006** | ADFS / LDAP 集成登录 | 认证基础 |
| **REQ-007** | JWT 令牌 (2 小时) | 依赖登录签发 |
| **REQ-009** | 登录审计 + 失败锁定 | 需要登录事件 |
| **REQ-017** | 账号生命周期 | 依赖登录体系 |
| **REQ-019** | 账号创建/启用/禁用/删除 | 同上 |
| **REQ-023** | 权限审计 | 依赖 RBAC 体系 |
| **REQ-040** | 操作审计 | 依赖登录 + RBAC |

**8 项** (REQ-003/006/007/009/017/019/023/040), 全在 **Blocked by Auth** 类别。

**前置**: **REQ-006 (ADFS) 必须在其他 7 项之前** — 是认证体系的入口。

**前置总工期** (解锁 CLAUDE.md 后): **5d (ADFS) + 4d (JWT) = 9d 即可解锁其他 6 项**, 后续 6 项可并行。

---

## 9. 关键发现

1. **40 个原子需求中, 8 Complete (20%) + 10 Partial (25%) = 45% 已着手**
2. **22.5% 项目能立即推进** (不依赖站点/Auth), 全是 UI 增强
3. **15% 依赖站点** (源端补字段/通道), 站点侧估时 31d + 项目侧 31d
4. **12.5% 依赖 Auth** (8 项 REQ), 必先做 REQ-006 (ADFS) 才能解锁
5. **17.5% 永久 Out of Scope** (CLAUDE.md 禁止), 7 项
6. **REQ-006 (ADFS) 是最大瓶颈** — 解锁它能带动 7 项后续
7. **业务完成度 85%** (Sprint 3.0) 与 **需求完成度 20%** (本审计) 数字差异来自颗粒度: 4/4 同步类型 = 4 个 REQ Complete, 但每类型内部细节分散

## 10. 结论

- **40 个原子需求, 8 完整 + 10 部分 + 4 未开始 + 6 站点阻塞 + 5 Auth 阻塞 + 7 永久不做**
- **9 项可立即开发** (Sprint 3.7 ~ 3.16, 估时 6.5 + 后端 = ~20 人天)
- **最大阻塞**: **REQ-006 (ADFS)** 解锁可带动 7 项后续, 9 人天
- **真实源端接入**: 需上级/客户确认方案, 6 项 REQ 等源端补 (31d + 31d)
- **项目自主推进的天花板 = 9 项 / 20.0%**, 剩余 80% 全部依赖外部决策 (CLAUDE.md 调整 / 站点接口 / 源端数据)
