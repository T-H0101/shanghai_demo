# Sprint 2C.5 — 2C 阶段稳定性审查 + 演示路径确认

> **日期**: 2026-06-04
> **范围**: 只做审查和文档，不写业务代码
> **前置**: 2C.1-2C.4 全部完成

---

## 一、当前标准实现快照

### 1.1 Git 状态

```
分支: main
最新 commit: 5052161 fix: clarify racks data source and empty capacity states
与 origin/main: 一致
工作区: 干净
```

### 1.2 tsc / build

- tsc: ✅ 通过
- build: ✅ 通过

### 1.3 数据库状态

**unified_disc_platform（中心库）**：

| 表 | 记录数（TEST_CLEAN） | 说明 |
|----|---------------------|------|
| unified_tasks | 37 | task status 已用组合映射 |
| unified_devices | 4 | 含真实容量/盘位数据 |

**source_restore（源库）**：

| 表 | 记录数 | 说明 |
|----|--------|------|
| tbl_task | 37 | 全部 task_type=0 |
| tbl_disc_lib | 4 | HD32-X, BD200, BD100, ntest |
| tbl_slots | 396 | 已从 pg_restore_test 导入 |
| tbl_magzines | 6 | 已从 pg_restore_test 导入 |

**pg_restore_test**：
- star_storage_db 完整保留，155 张表
- 包含 tbl_slots(396), tbl_hd_info(8), tbl_lib_task(86), tbl_disc(65) 等

### 1.4 当前 API 状态

| API | 数据源 | 状态 |
|-----|--------|------|
| GET /api/racks | unified_devices（真实 DB） | ✅ 已接入 |
| GET /api/tasks | mock 数据 | ⚠️ 仍读 mock |
| GET /api/sync/status | sync_progress 表 | ✅ 正常 |
| POST /api/ingest/tasks | unified_tasks | ✅ 正常 |
| POST /api/ingest/devices | unified_devices | ✅ 正常 |

### 1.5 真实导入数据

| 数据 | 数量 | siteCode |
|------|------|----------|
| TEST_CLEAN tasks | 37 | TEST_CLEAN |
| TEST_CLEAN devices | 4 | TEST_CLEAN |
| Racks 页面真实设备 | 4 | TEST_CLEAN |

---

## 二、2C.1-2C.4 成果复盘

### 2C.1：真实设备数据 API + Racks 页面接入

**目标**：打通 unified_devices → /api/racks → Racks 页面

**修改文件**：
- `app/api/racks/route.ts` — 从 mock 改为查询 unified_devices

**当前能力**：
- /api/racks 读取 unified_devices 真实数据
- 支持 siteCode/status 筛选
- 设备类型中文映射（hdd_library → "智能硬盘库"）
- 设备状态映射（online/offline/warning/error）

**验收结果**：✅ 通过

**剩余风险**：
- DB 不可用时 fallback 到 mock（2C.4 已加提示）
- usedSlots/usagePercent 初始为 0（2C.2 已修正）

### 2C.2：设备关联表 import + 盘位/容量字段修正

**目标**：补充真实容量/盘位数据

**修改文件**：
- `lib/import/device-capacity-aggregator.ts`（新增）
- `lib/import/device-importer.ts`（扩展）
- `lib/sync/upsert.ts`（增加 used_slots 列）
- `lib/sync/types.ts`（增加 used_slots 字段）
- `lib/api/dto/index.ts`（usedSlots/usagePercent 改 optional）
- `databases/sprint-2c2/`（schema patch）

**当前能力**：
- 聚合 tbl_slots + tbl_magzines 计算 usedSlots/totalSlots/capacity
- unified_devices 存储真实容量数据
- /api/racks 返回真实 usagePercent/capacity

**验收结果**：✅ 通过

**剩余风险**：
- SH01 早期 import 无容量数据（需重跑 import）
- schema patch 未纳入正式 migration

### 2C.3：Task Status 组合映射

**目标**：修正 raw_status_* 为 task_type + status 组合映射

**修改文件**：
- `lib/import/real-field-mapper.ts`（组合映射 + task_no 改为 siteCode-id）

**当前能力**：
- status 从 raw_status_0 改为 burn_success
- task_type=0/2/3 共享 16 种状态
- task_type=1 有 9 种状态
- 未知组合 fallback: unknown_<type>_<status>
- task_no: TEST_CLEAN-{id} 格式

**验收结果**：✅ 通过

**剩余风险**：
- 只覆盖 task_type=0/1/2/3，其他 type 用 fallback
- /api/tasks 仍读 mock，未接入真实数据

### 2C.4：Racks 页面企业级收口

**目标**：数据源标识、fallback 提示、空态修正

**修改文件**：
- `app/api/racks/route.ts`（source: "database"）
- `app/racks/page.tsx`（fallback 提示 + 空态 "—"）
- `lib/api/api-providers.ts`（数据源追踪）
- `lib/api/dto/index.ts`（usagePercent optional）
- `lib/api/index.ts`（导出 getRacksDataSource）
- `docs/database-analysis/sprint-2c4-racks-real-data-closure.md`

**当前能力**：
- API 响应包含 source: "database"
- 前端检测 fallback 并显示提示条
- 无容量设备显示 "—" 而非误导性 "0%"
- 数据链路文档完整

**验收结果**：✅ 通过

**剩余风险**：
- 多 siteCode 数据共存
- device_config 未建

---

## 三、真实设备展示链路

```
1. pg_basebackup 恢复（领导提供的备份文件）
   └─ Docker 容器 pg_restore_test，端口 5433
       └─ star_storage_db（完整源系统库，155 张表）

2. 数据导出/导入
   └─ pg_dump tbl_disc_lib → source_restore（Docker 操作）
   └─ pg_dump tbl_slots + tbl_magzines → source_restore（2C.2 操作）

3. source_restore（unified_disc_postgres 容器内，端口 5432）
   ├─ tbl_task（37 条）
   ├─ tbl_disc_lib（4 条）
   ├─ tbl_slots（396 条）← 2C.2 导入
   └─ tbl_magzines（6 条）← 2C.2 导入

4. Import 脚本
   ├─ scripts/import-from-source.ts
   ├─ lib/import/real-field-mapper.ts（字段映射 + status 组合映射）
   ├─ lib/import/device-capacity-aggregator.ts（容量聚合）
   └─ lib/import/device-importer.ts / task-importer.ts

5. unified_disc_platform 中心库
   ├─ unified_devices（4 条，含容量/盘位）
   └─ unified_tasks（37 条，含组合 status）

6. API 层
   └─ app/api/racks/route.ts（查询 unified_devices，返回 RackDTO）

7. Provider 层
   └─ lib/api/api-providers.ts（apiRackProvider，数据源追踪）

8. 前端展示
   └─ app/racks/page.tsx（Racks 页面，真实设备 + 空态 + fallback 提示）
```

**关键文件清单**：

| 层 | 文件 | 作用 |
|----|------|------|
| 源数据 | pg_restore_test / source_restore | 真实 PG17 备份恢复 |
| 聚合 | lib/import/device-capacity-aggregator.ts | tbl_slots+tbl_magzines 聚合 |
| 映射 | lib/import/real-field-mapper.ts | 字段映射 + status 组合映射 |
| 导入 | lib/import/device-importer.ts | 写入 unified_devices |
| DB | lib/db/postgres.ts | PostgreSQL 连接池 |
| API | app/api/racks/route.ts | 设备列表接口 |
| Provider | lib/api/api-providers.ts | 数据源追踪 |
| 前端 | app/racks/page.tsx | Racks 页面 |

---

## 四、演示路径

### 演示步骤

**Step 1：打开 Racks 页面**
- 路径：`/racks`
- 讲解："这是统一管控平台的盘架管理页面，展示所有站点的存储设备"

**Step 2：展示真实设备列表**
- 展示 HD32-X、BD200、BD100、ntest 四台设备
- 讲解："这些设备数据来自真实的 PG17 备份恢复，不是 mock 模拟数据"

**Step 3：展示设备详情**
- 点击 HD32-X 展开详情
- 展示：设备名、类型（智能硬盘库）、IP（127.0.0.1）、在线状态
- 讲解："设备信息从源系统的 tbl_disc_lib 表同步而来"

**Step 4：展示容量/盘位数据**
- HD32-X：96 盘位，8 已使用，291 TB 总容量，24% 使用率
- BD200：200 盘位，48 已使用，130 GB 总容量，24% 使用率
- BD100：100 盘位，15 已使用，65 GB 总容量，14% 使用率
- 讲解："容量和盘位数据通过聚合 tbl_slots 和 tbl_magzines 表计算得出"

**Step 5：展示空态处理**
- ntest 设备：盘位显示 "—"，使用率显示 "—"
- 讲解："无容量数据的设备显示空态，不会误导显示为 0%"

**Step 6：展示数据源标识**
- 正常情况：页面无额外提示
- 讲解："API 响应包含 source: 'database' 标记，前端可识别数据来源"

**Step 7：说明数据链路**
- 简述：pg_basebackup → source_restore → import → unified_devices → API → 前端
- 讲解："整条链路从真实备份到前端展示，全部基于真实数据"

**Step 8：说明架构定位**
- 讲解："平台不替代站点系统，只做统一管控视图"
- 讲解："mock 数据仅作开发兜底，正式主线是 database"

### 不要主动提

- pg_restore_test 容器和端口 5433（内部实现细节）
- Docker 命令和 SQL 操作（非演示内容）
- SH01 早期测试数据（避免混淆）
- JSON ingest 测试数据（DEV-INGEST-001/002）
- source_restore 和 pg_restore_test 的关系（过于技术）
- 任务页面尚未接入（除非被问到）

---

## 五、当前剩余风险

| # | 风险 | 严重度 | 影响 |
|---|------|--------|------|
| 1 | 多 siteCode 数据共存（TEST_CLEAN + SH01 + JSON ingest） | 中 | 正式环境需站点筛选器 |
| 2 | SH01 早期数据无容量聚合 | 低 | 需重跑 import |
| 3 | device_config 未实现，location/room/floor 无数据 | 中 | 设备位置信息缺失 |
| 4 | /api/tasks 仍读 mock | 中 | 任务页面无法展示真实数据 |
| 5 | task 表部分字段为空（operator/department/phase） | 中 | 任务页展示需谨慎 |
| 6 | DB fallback 到 mock 已有提示，但生产可能需禁用 | 低 | 企业部署需评估 |
| 7 | schema patch 是 SQL 文件，无正式 migration 系统 | 低 | 多环境部署需规范化 |
| 8 | pg_restore_test/source_restore 是本地试点 | 低 | 正式部署需规范化导入流程 |

---

## 六、下一步候选方向评估

### A. 继续接 tasks 页面真实数据

**优点**：打通任务管理真实数据，提升平台完整度
**缺点**：大量字段为空（progress/speed/operator/department），展示体验差；需改 /api/tasks 路由 + 前端
**推荐**：❌ 暂不做。任务页数据完整度不够，强行接入反而暴露缺陷。

### B. 做站点筛选器 / siteCode 配置

**优点**：解决多 siteCode 数据共存问题，正式环境必需
**缺点**：需要前端站点选择器组件 + API 支持
**推荐**：✅ 推荐。解决当前最明显的展示问题。

### C. 做 device_config 总控配置表

**优点**：补充 location/room/floor 等展示信息
**缺点**：需要建表 + 配置管理界面 + API
**推荐**：⏳ 后续。当前设备列表已可用，位置信息非核心。

### D. 做演示文档 / 部署文档 / README

**优点**：降低演示和部署门槛，提升专业度
**缺点**：需要整理文档，不涉及代码
**推荐**：✅ 推荐。演示前必备。

### E. 做 import_job_log / import API

**优点**：可追踪 import 历史，支持定时导入
**缺点**：需要建表 + API + 前端
**推荐**：⏳ 后续。当前 CLI import 够用。

### F. 继续扩展设备详情页

**优点**：展示盘笼/盘位/硬盘详情
**缺点**：需要更多关联表 import + 前端组件
**推荐**：⏳ 后续。当前设备列表已够演示。

### 推荐顺序

1. **D. 演示文档 + 部署文档**（无代码，立即可做）
2. **B. 站点筛选器**（解决多 siteCode 问题）
3. **C. device_config**（补充位置信息）
4. **F. 设备详情页**（盘笼/盘位详情）
5. **A. tasks 页面**（等数据完整度提升）
6. **E. import_job_log**（等正式部署需求）

---

## 七、明确下一步建议

### 1. 3 周内企业级可交付 demo

**第一周**：
- 写演示文档和部署文档（方向 D）
- 准备演示环境（确保 Docker + DB + import 正常）

**第二周**：
- 做站点筛选器（方向 B）
- 清理多 siteCode 数据问题

**第三周**：
- 做 device_config 基础版（方向 C）
- 最终演示排练

### 2. 坚决不做

- ❌ tasks 页面接入（数据不够，强行接入反而减分）
- ❌ tbl_file / tbl_folder 大表处理
- ❌ ES / 全文搜索
- ❌ 定时任务 / cron
- ❌ 登录权限系统
- ❌ 大规模重构

### 3. 是否现在接 tasks 页面

**不推荐**。原因：
- 大量字段为空（progress/speed/operator/department/phase）
- 展示体验比 mock 更差
- 等 tbl_user_task / tbl_lib_task 关联数据补充后再考虑

### 4. 是否现在写部署和演示文档

**推荐**。原因：
- 演示文档是给领导/评审看的必备材料
- 部署文档确保环境可复现
- 不涉及代码，风险为零

### 5. 是否需要清理代码

**暂不需要**。当前代码结构清晰，无明显技术债。2C 阶段的改动都是增量，没有引入冗余代码。

---

## 附录：2C 阶段 commit 历史

```
5052161 fix: clarify racks data source and empty capacity states     (2C.4)
f813523 feat: map real task status with task type context             (2C.3)
68cc48d docs: add Sprint 2C.2 schema patch for used slots            (2C.2)
dcd1c36 feat: enrich racks with real slot capacity data               (2C.2)
1f98da0 feat: connect racks page to unified devices API              (2C.1)
```

共 5 个 commit，涉及 11 个文件修改 + 2 个新文件 + 1 个文档。
