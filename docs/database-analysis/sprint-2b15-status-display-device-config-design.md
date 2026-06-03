# Sprint 2B.15 — 真实任务状态映射 + 前端展示字段决策 + 设备配置方案设计

> **日期**: 2026-06-03
> **范围**: 只做设计，不写代码、不改数据库、不改 mapper、不改前端
> **前置**: Sprint 2B.14 真实关联表探索完成

---

## 一、当前标准快照

### 1.1 Git 状态

```
分支: main
最新 commit: b497690 docs: add real relation exploration and frontend readiness review
与 origin/main: 一致
工作区: 干净
```

### 1.2 tsc / build 状态

- tsc: ✅ 通过（exit 0）
- build: ✅ 通过

### 1.3 数据库状态（基于 2B.14 探索数据，Docker 当前未运行）

**source_restore**：
- tbl_task: 37 条（全部 task_type=0）
- tbl_disc_lib: 4 条

**unified_disc_platform**：
- unified_tasks: 37 条（TEST_CLEAN siteCode）
- unified_devices: 4 条（TEST_CLEAN siteCode）

### 1.4 import 命令状态

```bash
pnpm import:tasks [siteCode]   # 可用
pnpm import:devices [siteCode] # 可用
pnpm import:all [siteCode]     # 可用
```

默认 siteCode=SH01，实测用 TEST_CLEAN 验证过。

---

## 二、Task Status 组合映射设计

### 2.1 设计原则

1. **status 含义依赖 task_type**：同一 status 值在不同 task_type 下含义不同
2. **英文 code 存储**：unified_tasks.status 存储英文 code，不存中文
3. **fallback 兜底**：未知组合使用 `unknown_<task_type>_<status>`
4. **raw_data 保留原始值**：原始 task_type 和 status 数字值始终在 raw_data 中

### 2.2 task_type=0/2/3 共享状态映射

> type=0（备份）、type=2（刻录并封盘）、type=3（EPSON光盘刻录打印一体机任务）共享同一组状态定义。

| status | 英文 code | 中文含义 | 语义分组 |
|--------|-----------|----------|----------|
| 0 | burn_success | 刻录成功 | success |
| 1 | data_preparing | 数据准备中 | preparing |
| 2 | task_cancelled | 任务取消 | cancelled |
| 3 | api_ready | Restful接口插入tbl_folder与tbl_file表后准备就绪 | ready |
| 4 | video_project_added | 视频下载任务项目添加完成 | preparing |
| 5 | video_download_ready | 视频下载任务准备成功，可以开始下载 | ready |
| 6 | ready | 就绪 | ready |
| 7 | remote_pending | 远程备份任务创建完成待处理 | pending |
| 10 | burn_failed | 刻录失败 | failed |
| 13 | s3_data_preparing | S3数据准备中 | preparing |
| 19 | maketask_scanning | MakeTask成功完成，正在备份 | in_progress |
| 20 | task_paused | 任务暂停 | paused |
| 21 | no_new_files | 计划任务没有修改或新增的文件 | skipped |
| 22 | maketask_scanning_pending | MakeTask已启动扫描，未完成（原始status≠3） | scanning |
| 23 | maketask_scanning_api | MakeTask已启动扫描，未完成（原始status=3后） | scanning |
| 29 | jdf_generated | 已生成JDF文件 | ready |

### 2.3 task_type=1（恢复任务）状态映射

| status | 英文 code | 中文含义 | 语义分组 |
|--------|-----------|----------|----------|
| 0 | restore_success | 下载成功 | success |
| 1 | restore_started | 开始回迁任务 | in_progress |
| 3 | api_ready | Restful接口插入tbl_ft_file表后准备就绪 | ready |
| 6 | disc_read_complete | 数据从光盘上读取完成 | success |
| 7 | disc_read_error | 数据从光盘上读取出错 | failed |
| 9 | disc_reading | 正在光盘中读取 | in_progress |
| 10 | read_failed | 读取失败 | failed |
| 11 | read_warning | 警告：回迁出错 | warning |
| 20 | task_paused | 任务暂停 | paused |

### 2.4 Fallback 规则

```
未知组合 → unknown_<task_type>_<status>
```

示例：
- task_type=5, status=0 → `unknown_5_0`
- task_type=0, status=99 → `unknown_0_99`

### 2.5 实现建议

当前 real-field-mapper.ts 的 `mapTaskStatus(value)` 只接收 status 数字值，无法做组合映射。需要改为：

```typescript
// 伪代码，不实现，只设计
function mapTaskStatus(taskType: number, status: number): string {
  if (taskType === 0 || taskType === 2 || taskType === 3) {
    return TASK_0_2_3_STATUS_MAP[status] ?? `unknown_${taskType}_${status}`
  }
  if (taskType === 1) {
    return TASK_1_STATUS_MAP[status] ?? `unknown_${taskType}_${status}`
  }
  return `unknown_${taskType}_${status}`
}
```

`mapRealTask()` 需将 `source.task_type` 传入 `mapTaskStatus()`。

### 2.6 是否需要新增 status_meaning 中文字段？

**建议暂不新增**。理由：
1. 当前 unified_tasks 表无此字段，改 schema 需审批
2. 英文 code 已包含足够语义，前端可根据 code 显示中文
3. 中文含义可在 API 层或前端层映射，不必存储

**后续可选**：如果前端频繁需要中文含义，可在 unified_tasks 表增加 `status_meaning VARCHAR(100)` 字段，import 时一并写入。需单独设计 schema 变更方案。

---

## 三、任务前端展示编号设计

### 3.1 真实 tbl_task 字段分析

| 字段 | 类型 | 含义 | 唯一性 | 可读性 | 适合做编号？ |
|------|------|------|--------|--------|-------------|
| id | integer | 主键自增 | ✅ 全局唯一 | ⚠️ 纯数字 | 可用 |
| no | integer | 任务序号（1-28） | ❌ 不唯一（多站点会冲突） | ⚠️ 纯数字 | 不适合 |
| uuid | uuid | UUID | ✅ 全局唯一 | ❌ 不可读 | 不适合 |
| task_name | text | 备注/别名 | ❌ 多为空或重复 | ❌ 大部分为空 | 不适合 |
| cmt | text | 备注 | ❌ 全部为空 | - | 不适合 |
| create_dt | timestamp | 创建时间 | - | - | 辅助信息 |

### 3.2 推荐：taskNo = siteCode + "-" + id

**理由**：
1. `id` 是源系统主键，保证站点内唯一
2. 加 `siteCode` 前缀保证多站点不冲突
3. 格式如 `SH01-1`、`SH01-37`，可读且可追溯
4. 与当前 `mapRealTask()` 中 `task_no: String(source.id)` 兼容，只需加前缀

**实现变更**（设计，不实现）：
```typescript
// 当前
task_no: String(source.id)
// 建议
task_no: `${siteCode}-${source.id}`
```

### 3.3 推荐：name 展示策略

| 场景 | TaskDTO.name 显示 |
|------|-------------------|
| task_name 有值 | 显示 task_name |
| task_name 为空 | 回退显示 taskNo（即 siteCode-id） |

**理由**：
1. task_name 大部分为空，直接留空体验差
2. 回退到 taskNo 保证每行都有标识
3. 前端可统一用 `task.name ?? task.taskNo` 处理

### 3.4 task_name 定位

**定位为备注/别名字段**：
- 不作为主标识
- 前端可显示为"备注"列或 tooltip
- 大部分为空时该列隐藏或显示"—"

### 3.5 推荐 TaskDTO 显示策略

| TaskDTO 字段 | 数据来源 | 显示逻辑 |
|-------------|----------|----------|
| taskNo | `${siteCode}-${source.id}` | 主标识，始终显示 |
| name | task_name ?? taskNo | task_name 有值显示 task_name，否则显示 taskNo |
| type | task_type 映射 | 已有 TASK_TYPE_MAP |
| status | task_type+status 组合映射 | 2B.15 设计的新映射 |
| phase | null（当前无数据） | 暂不展示或显示"—" |
| archiveName | null（当前无数据） | 暂不展示 |
| operator | null（当前无数据） | 暂不展示，待 tbl_user_task 关联 |
| department | null（当前无数据） | 暂不展示，待 tbl_depa 数据 |
| totalFiles | total_files | 展示，多数为 0 |
| totalSize | total_size | 展示，多数为 0 |
| deviceName | null（当前无数据） | 暂不展示，待 tbl_lib_task 关联 |

---

## 四、设备位置配置方案设计

### 4.1 设备字段来源分层

```
┌─────────────────────────────────────────────────┐
│            unified_devices 展示层                │
│  (最终呈现给前端的字段)                           │
├─────────────────────────────────────────────────┤
│  Layer 1: 站点源表字段（source_restore）          │
│  lib_id, name, type, device_status, ip,         │
│  vendor, model, sn, mags, slots, use_status     │
│  → 权威数据，由站点系统维护                       │
├─────────────────────────────────────────────────┤
│  Layer 2: 设备关联表聚合（star_storage_db）       │
│  tbl_magzines → 盘笼数量/盘位分布                │
│  tbl_slots → 盘位状态/容量                       │
│  tbl_hd_info → 硬盘型号/健康/容量                 │
│  → 只读聚合，不覆盖源表数据                       │
├─────────────────────────────────────────────────┤
│  Layer 3: 总控配置字段（中心侧新增）              │
│  location, room, floor, site_name,              │
│  display_name, tags, remarks                    │
│  → 由总控管理员维护，补充源表不提供的展示信息       │
└─────────────────────────────────────────────────┘
```

### 4.2 各层字段来源

| 展示字段 | 来源层 | 来源 | 说明 |
|----------|--------|------|------|
| device_id | L1 | lib_id | 站点主键 |
| device_name | L1 | name | 设备名称 |
| device_type | L1 | type | 设备类型枚举 |
| status | L1 | device_status | 在线状态 |
| ip_address | L1 | ip | IP 地址 |
| manufacturer | L1 | vendor | 厂商 |
| model | L1 | model | 型号 |
| serial_no | L1 | sn | 序列号 |
| slot_count | L1 | slots | 总盘位数 |
| cage_count | L1 | mags | 总盘笼数 |
| total_capacity | L2 | tbl_hd_info SUM | 硬盘总容量 |
| used_capacity | L2 | tbl_slots SUM | 已用容量 |
| magazine_details | L2 | tbl_magzines | 盘笼列表 |
| slot_details | L2 | tbl_slots | 盘位列表 |
| hd_details | L2 | tbl_hd_info | 硬盘列表 |
| location | L3 | device_config | 机房位置 |
| room | L3 | device_config | 机房 |
| floor | L3 | device_config | 楼层 |
| site_name | L3 | device_config | 站点显示名称 |
| display_name | L3 | device_config | 设备显示名称 |
| tags | L3 | device_config | 标签 |
| remarks | L3 | device_config | 备注 |

### 4.3 是否新增 device_config 表？

**建议：暂不建表，在设计中保留配置入口。**

理由：
1. 当前只有 4 台设备，手动配置价值低
2. schema 变更需审批流程
3. 前端还未接真实数据，配置界面无载体

**后续建表时机**：
- 当设备数量超过 20 台，或需要多站点管理时
- 当前端设备页面已接通真实数据后
- 当领导确认需要"总控编辑设备配置"功能时

### 4.4 总控"新增设备"的含义

**两种理解**：

| 理解 | 含义 | 影响 |
|------|------|------|
| A. 新增站点源设备 | 在源系统（站点侧）添加新设备 | 总控无法控制，需站点操作 |
| B. 新增总控展示配置 | 在总控侧为已存在的站点设备补充展示信息 | 总控可控，不涉及源系统 |

**建议**：当前阶段"新增设备"应理解为 **B — 新增总控展示配置**。

理由：
1. 站点源设备由站点系统管理（pg_dump / JSON push 同步）
2. 总控不应直接操作站点源数据
3. 总控的角色是"补充展示配置"而非"创建设备"

### 4.5 如何避免总控配置覆盖站点源数据

**原则：总控配置只补充，不覆盖。**

展示层合并逻辑（伪代码）：
```typescript
function mergeDeviceDisplay(source: SourceDevice, config?: DeviceConfig) {
  return {
    // Layer 1: 源表字段，始终使用源表值
    device_id: source.lib_id,
    device_name: source.name,
    device_type: source.type,
    status: source.device_status,
    ip_address: source.ip,
    // ...

    // Layer 3: 配置字段，仅在配置存在时使用
    location: config?.location ?? null,
    room: config?.room ?? null,
    floor: config?.floor ?? null,
    display_name: config?.display_name ?? null,

    // 最终展示名称：配置优先，否则用源表 name
    show_name: config?.display_name ?? source.name,
  }
}
```

**关键规则**：
- Layer 1 字段（源表）：**不可被总控覆盖**
- Layer 3 字段（配置）：总控独占，源表无此字段
- display_name 作为"展示别名"，不修改 device_name

---

## 五、前端接真实数据优先级

### 5.1 是否优先接设备页面？

**是**。原因：
1. 设备数据相对完整（4 条 + 关联表有盘笼/盘位）
2. 设备 status/type 映射已正确
3. 数据量小，易验证
4. 任务页面 status 映射需大改（本文档设计中）

### 5.2 接设备页面前是否必须先扩展设备关联表 import？

**不是必须**。可以分两步：
1. **第一步（最小可用）**：只用 unified_devices 现有字段（device_id, name, type, status, ip, model, serial_no），先接通设备列表
2. **第二步（数据丰富）**：扩展 import 聚合 tbl_magzines/tbl_slots/tbl_hd_info，补充容量/盘位信息

### 5.3 是否可以先只用 unified_devices 做最小设备列表？

**可以**。当前 unified_devices 已有：

| 字段 | 有值？ | 可展示？ |
|------|--------|---------|
| device_id | ✅ | ✅ |
| device_name | ✅ | ✅ |
| device_type | ✅ | ✅ |
| status | ✅ | ✅ |
| ip_address | ✅ | ✅ |
| model | ✅ | ✅ |
| serial_no | ✅ | ✅ |
| manufacturer | ✅ | ✅ |
| slot_count | ✅ | ✅ (HD32-X=96, BD200=200) |
| cage_count | ✅ | ✅ (HD32-X=4, BD200=1) |
| total_capacity | ❌ null | ❌ |
| used_capacity | ❌ null | ❌ |
| location | ❌ null | ❌ |
| room | ❌ null | ❌ |
| floor | ❌ null | ❌ |

**最小可用**：前 10 个字段足以展示设备列表卡片/表格。

### 5.4 Tasks 页面为什么应暂缓？

1. **status 映射需大改**：当前 raw_status_<value> 不正确，需改为 task_type+status 组合映射（本文档设计）
2. **大量字段为空**：progress、speed、deviceName、operator、department、phase、archiveName 全部无数据
3. **展示体验差**：表格大部分列为空白
4. **需等领导确认**：taskNo 映射、name 展示策略需领导确认后才能实现

### 5.5 是否需要先设计 API DTO？

**是，但可在实现 Sprint 中一起设计**。当前已有 TaskDTO 和 RackDTO 接口，只需：
1. 新增 `GET /api/unified-devices` 路由
2. 查询 unified_devices 表
3. 适配为 RackDTO 格式返回

DTO 设计可在实现时完成，不必单独 Sprint。

---

## 六、下一步候选 Sprint

| 方向 | 内容 | 前置依赖 | 工作量 | 推荐顺序 |
|------|------|----------|--------|---------|
| **A. 实现 task status 组合 mapper** | 修改 real-field-mapper.ts，实现 task_type+status 映射 | 本文档设计（已有） | 小（~1h） | **2** |
| **B. 扩展设备关联表 import** | 聚合 tbl_magzines/tbl_slots/tbl_hd_info 到 unified_devices | 2B.14 探索（已有） | 中（~2h） | **3** |
| **C. 设计/实现 devices API** | 新增 GET /api/unified-devices，读取 unified_devices | 方向 A 完成后 | 小（~1h） | **4** |
| **D. 设计中心侧 device_config** | 设计 device_config 表结构和配置管理方案 | 本文档设计（已有） | 中（设计+实现 ~3h） | **5** |
| **E. 直接接前端 devices 页面** | 修改前端 racks 页面使用真实 API | 方向 C 完成后 | 中（~2h） | **6** |

**推荐 2B.16 执行顺序**：

1. **A. 实现 task status 组合 mapper**（小改动，高价值）
   - 修改 `real-field-mapper.ts` 的 `mapTaskStatus()` 为组合映射
   - 修改 `mapRealTask()` 传入 task_type
   - 重跑 import 验证 status 映射正确
   - 修改 task_no 为 `siteCode + "-" + id`

2. **B. 扩展设备关联表 import**（中等工作量）
   - 新增设备详情聚合查询
   - 更新 unified_devices 的 total_capacity / used_capacity
   - 验证盘笼/盘位/硬盘数据

3. **C. 设计/实现 devices API**（小改动）
   - 新增 `GET /api/unified-devices` 路由
   - 查询 unified_devices，适配 RackDTO

4. **D+E. 前端接真实数据**（中等工作量）
   - 前端 racks 页面切换到 API 模式
   - 验证设备列表展示

**不建议在 2B.16 做**：
- device_config 表（需等前端接通后再设计）
- 任务关联表 import（优先级低于设备）
- tasks 页面接入（status mapper 改完后再考虑）

---

## 七、仍需领导确认的问题

### Q1: taskNo 格式确认
建议 taskNo = `siteCode + "-" + id`（如 SH01-1）。领导是否同意？还是保持 `String(id)`？

### Q2: name 展示策略
建议 name 优先显示 task_name，task_name 为空时回退显示 taskNo。领导是否同意？

### Q3: 优先接设备页面
建议 2B.16 先做设备侧（status mapper + devices API + 前端），任务页面延后。领导是否同意？

### Q4: device_config 建表时机
建议暂不建 device_config 表，等前端设备页面接通后再设计。领导是否同意？

### Q5: status 映射范围
建议 2B.16 的 mapper 改动覆盖 task_type=0/1/2/3 的所有已知状态（按 docx），其他 type 用 fallback。是否需要覆盖更多 type（4-10）？

### Q6: 总控"新增设备"语义
建议"新增设备"= 新增总控展示配置（不创建站点源设备）。领导是否同意？

---

## 附录：task_status 组合映射速查表（完整）

```
// task_type = 0/2/3
{0: "burn_success", 1: "data_preparing", 2: "task_cancelled",
 3: "api_ready", 4: "video_project_added", 5: "video_download_ready",
 6: "ready", 7: "remote_pending", 10: "burn_failed",
 13: "s3_data_preparing", 19: "maketask_scanning",
 20: "task_paused", 21: "no_new_files",
 22: "maketask_scanning_pending", 23: "maketask_scanning_api",
 29: "jdf_generated"}

// task_type = 1
{0: "restore_success", 1: "restore_started", 3: "api_ready",
 6: "disc_read_complete", 7: "disc_read_error", 9: "disc_reading",
 10: "read_failed", 11: "read_warning", 20: "task_paused"}

// fallback
unknown_<task_type>_<status>
```
