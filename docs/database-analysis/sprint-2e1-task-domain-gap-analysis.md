# Sprint 2E.1 - 任务域字段缺口与关联表补全审查

> **日期**: 2026-06-06
> **范围**: 任务域字段缺口 + 关联表分析 + 路线图
> **本 Sprint 不做功能开发，只做审查与规划**

---

## 一、当前任务域现状

### 已接入表 (6 张)
| 源表 | target | sync_mode | status |
|---|---|---|---|
| tbl_task | unified_tasks | full | done |
| tbl_lib_task | (unified_tasks join) | aggregate | done |
| tbl_user_task | (unified_tasks join) | aggregate | done |
| tbl_disc | unified_disc_media | full | done |
| tbl_logical_volume | unified_volumes | full | done |
| tbl_volume_slot | (unified_volumes join) | aggregate | done |

### unified_tasks schema (22 字段)
id, source_site_id, source_table, source_id, synced_at, task_no, task_name, task_type, status, phase, priority, data_classification, archive_name, source_path, package_path, volume_id, device_id, rack_id, operator, department, notes, total_files, total_size, created_at, updated_at, raw_data

**重要发现**: `unified_tasks` **没有** progress / speed / remainingTime / currentFile / runtime / currentPhase / sm3Status / errorMessage / retryCount 字段。这些字段在 TaskDTO 中存在但都从 mock 来。

---

## 二、Tasks 页面字段矩阵 (实际使用 vs 已实现)

| 字段 | 前端使用 | DTO 存在 | API 返回 | DB 存在 | 状态 |
|---|---|---|---|---|---|
| id | ✅ | ✅ | ✅ | ✅ | 真 |
| name | ✅ | ✅ | ✅ | ✅ (task_name) | 真 |
| taskNo | ✅ | ✅ | ✅ | ✅ (task_no) | 真 |
| type | ✅ | ✅ | ✅ | ✅ (task_type) | 真 |
| phase | ✅ | ✅ | ✅ | ✅ (status→phase 推断) | 真(推断) |
| status | ✅ | ✅ | ✅ | ✅ (status→status 推断) | 真(推断) |
| progress | ✅ | ✅ | ⚠️ 0/100 假 | ❌ | **mock 假** |
| archiveName | ✅ | ✅ | ✅ | ✅ (archive_name) | 真 |
| dataClassification | ✅ | ✅ | ❌ "" | ❌ | **mock 假** |
| siteName | ✅ | ✅ | ✅ | ✅ (source_site_id) | 真 |
| siteCode | ✅ | ✅ | ✅ | ✅ | 真 |
| operator | ✅ | ✅ | ✅ | ✅ (tbl_user_task join) | 真 |
| department | ✅ | ✅ | ✅ | ❌ (unified_tasks 无此字段) | **缺来源** |
| sourcePath | ✅ | ✅ | ✅ | ❌ (unified_tasks 无此字段) | **缺来源** |
| packagePath | ✅ | ✅ | ✅ | ❌ (unified_tasks 无此字段) | **缺来源** |
| volumeId | ✅ | ✅ | ✅ | ❌ | **缺来源** |
| backupScope | ✅ | ✅ | "full" | ❌ | **mock 假** |
| packagingMode | ✅ | ✅ | ❌ | ❌ | **缺来源** |
| deviceId | ✅ | ✅ | ✅ | ❌ (unified_tasks 有但未填) | **未填** |
| deviceName | ✅ | ✅ | ✅ | ✅ (tbl_lib_task join) | 真 |
| startedAt | ✅ | ✅ | ✅ | ⚠️ (created_at 误用) | **真但语义错** |
| updatedAt | ✅ | ✅ | ✅ | ✅ | 真 |
| completedAt | ✅ | ✅ | ❌ | ❌ | **缺来源** |
| fileCount | ✅ | ✅ | ✅ | ✅ (total_files) | 真 |
| totalSize | ✅ | ✅ | ✅ | ✅ (total_size) | 真 |
| packageCount | ✅ | ✅ | ❌ | ❌ | **缺来源** |
| successCount | ✅ | ✅ | ❌ | ❌ | **缺来源** |
| errorCount | ✅ | ✅ | ❌ | ❌ | **缺来源** |
| **speed** | ✅ | ✅ | ❌ | ⚠️ (tbl_task.burn_speed) | **缺来源(没填)** |
| **remainingTime** | ✅ | ✅ | ❌ | ❌ | **mock 假** |
| **sm3Status** | ✅ | ✅ | ❌ | ⚠️ (tbl_task_certif_status) | **缺来源** |
| **sm3Progress** | ✅ | ✅ | ❌ | ❌ | **mock 假** |
| **errorMessage** | ✅ | ✅ | ❌ | ⚠️ (tbl_task.ret_msg) | **缺来源** |
| **retryCount** | ✅ | ✅ | ❌ | ❌ | **mock 假** |
| **recentLogs** | ✅ | ✅ | [] | ❌ | **缺来源** |
| packagingThreads | ✅ | ✅ | [] | ❌ | **缺来源** |

**统计**:
- **真数据**: 13 个 (id/name/taskNo/type/phase/status/siteName/siteCode/operator/deviceName/fileCount/totalSize/updatedAt)
- **缺来源(可接)**: 13 个 (department/sourcePath/packagePath/volumeId/packagingMode/completedAt/packageCount/successCount/errorCount/speed/sm3Status/errorMessage/recentLogs)
- **mock 假数据**: 7 个 (progress/dataClassification/backupScope/remainingTime/sm3Progress/retryCount/packagingThreads)
- **缺来源(无源)**: 1 个 (operator 实际从 tbl_user_task join 但 schema 无)

---

## 三、关联表分析 (任务域)

### A. 任务核心表 (15 张)

| 表 | 字段亮点 | 接入价值 | 当前状态 |
|---|---|---|---|
| **tbl_task** | create_dt/update_dt/status/burn_status/ret_value/ret_msg/burn_speed | 主表 | **已接入** |
| **tbl_task_folder** | task_id + folder_id (任务-目录关联) | 中 | 未接入 |
| **tbl_task_items** | task_id + root_path + item_name (任务条目) | 中 | 未接入 |
| **tbl_task_files** | file_path + file_size + close_time (任务-文件关联) | 中 | 未接入 |
| **tbl_task_check** | lib_id + mode + accept + reject + spot (校验) | 高 | 未接入 |
| **tbl_task_print** | title + subtitle + print_copies (打印配置) | 中 | 未接入 |
| **tbl_task_projects** | task_id + project_id (任务-项目) | 中 | 未接入 |
| **tbl_task_receipts** | task_id + r_id (回执关联) | 中 | 未接入 |
| **tbl_task_certif_status** | task_id + status (0未开始/1进行中/2完成/3失败) | **高** (sm3Status 来源) | 未接入 |
| **tbl_task_error_file** | task_id + file_path + error_type (异常文件) | 高 | 未接入 |
| **tbl_lib_task** | task_id + lib_id (任务-设备) | 高 | **已接入** |
| **tbl_user_task** | task_id + user_id (任务-用户) | 高 | **已接入** |
| **tbl_interface_task** | job_progress (0-100) + job_status + job_stage + err_code + err_str | **高** (progress 来源) | 未接入 |
| **tbl_iso_task_sync** | task_id + status (0新建/10同步中/1已同步) | 中 | 未接入 |
| **tbl_drivers_burn** | driver 配置 (刻录驱动) | 低 | 未接入 |

### B. 任务间接相关表

| 表 | 关联 | 状态 |
|---|---|---|
| **tbl_logical_volume** | 任务目标卷 | **已接入** |
| tbl_remote_backup | 远程备份任务 | 未接入 |
| tbl_hot_backup_record | 含 progress 字段 | 未接入 |
| tbl_hot_restore_record | 含 progress 字段 | 未接入 |
| tbl_data_receive_tasks | 数据接收任务 | 未接入 |
| tbl_file_path_restore | 恢复路径 | 未接入 |
| tbl_import_folder_log | 导入目录日志 | 未接入 |
| tbl_wait_download_file_task | 下载任务 | 未接入 |

### C. 重要字段映射

| 任务域字段 | 真实来源表 | 字段名 | 备注 |
|---|---|---|---|
| progress | **tbl_interface_task** | job_progress | 0-100 整数 |
| currentPhase | **tbl_interface_task** | job_stage | 阶段代码 |
| errorMessage | **tbl_task** | ret_msg / **tbl_interface_task** | err_str | 错误文本 |
| speed | **tbl_task** | burn_speed | 实际是 burn_speed |
| sm3Status | **tbl_task_certif_status** | status | 0/1/2/3 |
| runtime | **tbl_task** | update_dt - create_dt | 计算字段 |
| recentLogs | **无真实表** | — | 站点运行时输出，无源 |
| fileIndex | **tbl_task_items** | root_path + item_name | 任务-目录-文件 |
| errorFiles | **tbl_task_error_file** | file_path + error_type | 异常文件 |
| taskReceipts | **tbl_task_receipts** | r_id | 接收单 |
| taskProjects | **tbl_task_projects** | project_id | 项目关联 |

### D. 已知不可接的字段
- **progress / speed / remainingTime / currentFile / currentPhase / runtime / sm3Progress / retryCount / packagingThreads / recentLogs** — 大部分运行时字段在源 schema 中**没有持久化记录**
- 这些字段应继续显示 `—` 或从派生计算得出
- **不可伪造**

---

## 四、字段缺口矩阵

| 字段 | 当前状态 | 来源表 | 已接入 | 难度 | 优先级 |
|---|---|---|---|---|---|
| progress | mock 假 (0/100) | tbl_interface_task.job_progress | ❌ | 中 | **P0** |
| errorMessage | mock 假 | tbl_task.ret_msg / tbl_interface_task.err_str | ❌ | 低 | **P0** |
| sm3Status | mock 假 | tbl_task_certif_status.status | ❌ | 中 | **P1** |
| errorFiles / errorCount | mock 假 | tbl_task_error_file | ❌ | 中 | **P1** |
| runtime | mock 假 | 计算: update_dt - create_dt | ⚠️ 计算可做 | 低 | **P1** |
| speed | mock 假 | tbl_task.burn_speed | ❌ | 低 | **P2** |
| remainingTime | mock 假 | 无 | ❌ | — | **P2** (无源, 保留 `—`) |
| currentFile | mock 假 | 无 | ❌ | — | **P2** (无源, 保留 `—`) |
| currentPhase | mock 假 | tbl_interface_task.job_stage | ❌ | 中 | **P1** |
| packagingThreads | mock 假 | 无 | ❌ | — | **P2** (无源) |
| retryCount | mock 假 | 无 | ❌ | — | **P2** (无源) |
| recentLogs | mock 假 | 无 | ❌ | — | **P2** (无源) |
| packageCount | mock 假 | 计算: tbl_disc count by task_id | ⚠️ 可派生 | 中 | **P1** |
| successCount | mock 假 | 计算: tbl_disc.burn_success by task_id | ⚠️ 可派生 | 中 | **P1** |
| errorCount | mock 假 | 计算: tbl_disc.burn_errors by task_id | ⚠️ 可派生 | 中 | **P1** |
| completedAt | mock 假 | tbl_task.update_dt (status=completed) | ⚠️ 可推断 | 低 | **P1** |
| dataClassification | mock 假 | tbl_task 缺, tbl_data_classification 有 | ⚠️ 未关联 | 高 | **P3** |
| backupScope | mock 假 ("full") | tbl_task 无直接字段, 可能 task_type 推断 | ⚠️ 可推断 | 中 | **P2** |
| department | mock 假 | tbl_task 缺, tbl_depa 需 join | ❌ | 高 | **P3** |
| sourcePath | mock 假 | tbl_task_items.root_path | ❌ | 中 | **P1** |
| packagePath | mock 假 | tbl_task_items.original_path | ❌ | 中 | **P1** |
| volumeId | mock 假 | tbl_task.volume_id (源表字段) | ❌ (未写入) | 低 | **P0** |
| packagingMode | mock 假 | tbl_task.task_mode | ❌ (未写入) | 低 | **P0** |

---

## 五、任务域路线图

### P0 (必须补)
- **tbl_interface_task** — 接入 `job_progress`, `job_status`, `job_stage`, `err_code`, `err_str`
  - 解决 progress / currentPhase / errorMessage 缺口
  - 优先级最高: 这是总控需要看任务进度的核心来源
- **统一 unified_tasks.volume_id / task_mode 字段** — tbl_task 已有但未写入中心表
  - 解决 volumeId / packagingMode 缺口

### P1 (建议补)
- **tbl_task_certif_status** → 解决 sm3Status
- **tbl_task_error_file** → 解决 errorFiles
- **tbl_task_items** → 解决 sourcePath / packagePath
- 派生字段 (计算) — packageCount / successCount / errorCount / runtime / completedAt
- **tbl_task_check** → 校验状态详情 (用于"任务详情"扩展)

### P2 (以后再说)
- speed (有 burn_speed 但语义不一致)
- backupScope 推断
- remainingTime / currentFile (无源, 继续 `—`)

### P3 (不需要, 取消或永久 mock)
- packagingThreads / retryCount / recentLogs (无源, 继续 `—`)
- dataClassification / department (需多表 join, ROI 低)

---

## 六、跨域分析: 用户/权限/站点域是否更优先?

### 用户域 (tbl_user, tbl_user_role, tbl_role, tbl_role_fuc, tbl_fuc, tbl_user_mfa)
- **核心问题**: 没有用户列表, 总控无法做权限管控
- **接入价值**: 高 (登录 / 鉴权前置条件)
- **已有支撑**: unified_users 表已存在
- **ROI**: 高 (单源表, 类似 tbl_disc_lib 模式)

### 站点域 (tbl_site, tbl_platform, tbl_platform_type, tbl_project_site)
- **核心问题**: 总控不知道"我是哪个站点的中央", 站点筛选器无法实现
- **接入价值**: 高 (多站点管控前置)
- **已有支撑**: 无 unified_sites / unified_platforms
- **ROI**: 高 (单源表, 简单)

### 权限域 (tbl_fuc, tbl_role, tbl_user_role, tbl_role_fuc)
- **核心问题**: 角色/权限无法持久化
- **接入价值**: 中 (等用户域稳定后)
- **已有支撑**: 无
- **ROI**: 中

### 任务域 vs 用户/权限/站点域对比

| 维度 | 任务域 | 用户/权限/站点域 |
|---|---|---|
| 字段缺口 | 大量 | 几乎全部缺失 (未接入) |
| 已接入表数 | 6 | 0 |
| ROI | 中 (提升展示丰富度) | 高 (启用登录/多站点) |
| 数据复杂 | 高 (多表 join, 派生计算) | 低 (单表 UPSERT) |
| 总控价值 | 增强体验 | **解锁核心功能** |

---

## 七、最终推荐: 唯一 Sprint 方向

### **推荐 B: 转用户/站点/平台域 (Sprint 2E.2)**

**唯一推荐理由**:

1. **任务域 P0 实际可补的字段有限**
   - progress 来源 (tbl_interface_task) 接入后, 总控也只能显示接口任务进度, 不覆盖所有类型任务
   - volumeId / packagingMode 字段虽然缺失, 但都是任务**创建/配置**信息, 不影响"查看任务"
   - 真正不可补的字段 (speed/remainingTime/currentFile/recentLogs) 没有源数据

2. **任务域已 6 张表, 剩余需要的多表 join 复杂度高**
   - 派生字段 (packageCount/successCount/errorCount) 需要按 task_id 聚合 tbl_disc
   - sourcePath/packagePath 需要 join tbl_task_items
   - **每个 Sprint 只能解 1-2 个字段, ROI 低**

3. **用户/站点/平台域完全缺失, 是登录/多站点的前置**
   - 站点域缺失 → Sync Center 无法按 siteCode 真正有效
   - 用户域缺失 → 总控无法做权限/操作员归属
   - 平台域缺失 → 总控不知道是哪个总控

4. **用户/站点/平台域接入模式与已有 10 张小表完全一致**
   - 复用 package-schema, package-dispatcher
   - 复用 unified_* UPSERT
   - 复用 sync_package_log
   - **单 Sprint 可接入 3-5 张**

### Sprint 2E.2 范围 (推荐)

| 任务 | 产出 |
|---|---|
| tbl_user → unified_users | P0 (用户主表) |
| tbl_site → unified_sites | P0 (站点主表) |
| tbl_platform → unified_platforms | P0 (平台主表) |
| 扩展 package-schema + dispatcher | 复用已有模式 |
| 站点筛选器 (前端) | 增强 Sync Center |
| API 端点 (可选) | /api/sites, /api/users, /api/platforms |

### Sprint 2E.3 (后续)

- tbl_role + tbl_user_role + tbl_fuc + tbl_role_fuc → 权限基础
- 多站点策略 (登录后默认 siteCode)

### 任务域补全延后到 Sprint 2E.4+

- tbl_interface_task 接入 (解 progress/phase/errorMessage 缺口)
- 派生字段 (packageCount/successCount/errorCount)
- tbl_task_certif_status (sm3Status)

---

## 八、最终固定统计

```
Sprint 2E.1 审查结论
=====================
已接入任务域源表: 6 张
任务域关联表总数: 35 张 (含日志和间接)
任务域可补字段: 5 个 (P0/P1)
任务域不可补字段: 7 个 (P2, 继续显示 —)
任务域无源字段: 4 个 (P3, 永久 mock)

下批推荐方向: 用户/站点/平台域 (Sprint 2E.2)
不再补任务域: 是 (Sprint 2E.1 审查后)
```
