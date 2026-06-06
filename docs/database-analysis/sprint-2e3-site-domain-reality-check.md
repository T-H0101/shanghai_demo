# Sprint 2E.3 - 站点域真实性审查

> **日期**: 2026-06-06
> **范围**: 站点域审查 + 路线图确认 (零代码变更)
> **前置**: Sprint 2E.2 已建立 unified_sites / unified_platforms, 但 tbl_site (0 rows) / tbl_platform (0 rows)

---

## 一、扫描结论: 源表完全没有"站点"概念

### 关键事实

源 MySQL 数据库 (disc_files.sql) 的 146 张表中:
- **"site"** 实际语义是 **"房间/监控分组"** (tbl_site COMMENT: "房间表（监控分组，由该表组成监视地点树结构）")
- **"platform"** 实际语义是 **"第三方监控平台"** (tbl_platform COMMENT: "监控平台信息表")
- **没有任何表承担"总控站点主表"的角色**

### 候选扫描 (关键字 site/station/node/platform/server/cluster/center/storage/device)

| 表 | 实际语义 | 业务价值 | 记录数 |
|---|---|---|---|
| tbl_site | 房间/监控分组 | 监控领域, 与总控无关 | 0 |
| tbl_platform | 第三方监控平台 | 监控领域, 与总控无关 | 0 |
| tbl_platform_type | 监控平台类型字典 | 监控领域, 与总控无关 | - |
| tbl_site_monitor | 房间-监控设备关联 | 监控领域, 与总控无关 | - |
| tbl_platform_monitor | 平台-监控设备关联 | 监控领域, 与总控无关 | - |
| tbl_project | 项目主表 | **业务项目** (非"站点") | - |
| tbl_project_site | 项目-站点关联 | 业务项目关联 | - |
| tbl_device_device | 设备-设备关联 (lib_id_c/lib_id_s) | 设备间通信, 非总控站点 | - |

### 引用关系 (外键)

| 字段 | 引用表 | 引用方 |
|---|---|---|
| `site_id` | tbl_site | tbl_site_monitor, tbl_project_site (各 1 引用) |
| `plat_id` | tbl_platform | tbl_site_monitor, tbl_platform_monitor (各 1 引用) |
| `project_id` | tbl_project | tbl_task_items, tbl_project_monitor_files, tbl_project_site, tbl_task_projects (5 引用) |

**结论**: `tbl_site` 和 `tbl_platform` 在源 schema 中是**"房间/监控"**领域, 引用极少 (各自 1-2 处), 实质是**未使用的空表**。**不是真实"总控站点主表"**。

---

## 二、当前系统真实站点信息在哪?

### 答案: **总控自创的逻辑字段 source_site_id**

中心库 PG17 的统一表都有 `source_site_id` 字段, 这是**总控设计的逻辑标识**, 用于:
- 多站点数据隔离
- 站点筛选 (Sync Center, Tasks 页面)
- package 路由 (`findPackageByBatch(siteCode, batchId)`)

### 数据来源

| 字段 | 真实来源 |
|---|---|
| source_site_id | **总控传参** (例如 `pnpm import:tasks SH01`) |
| source_id | 源表主键 (例如 `tbl_task.id`) |

**没有"站点主表"** — `source_site_id` 是**字符串字面量**, 由总控操作员/包推送方传入。

---

## 三、当前系统真实平台信息在哪?

### 答案: **没有"总控平台"概念**

源 schema 中的 "platform" 全部是**第三方监控平台** (tbl_platform, tbl_platform_monitor, tbl_platform_type)。

**总控本身不存储"自己是哪个平台"** — 这是一个**外部配置文件** (例如 `NEXT_PUBLIC_PLATFORM_NAME` 环境变量), 没必要作为数据表。

---

## 四、已接入表是否包含 siteCode / siteName / platformCode?

| 已接入表 | siteCode 字段 | siteName 字段 | platformCode 字段 | 备注 |
|---|---|---|---|---|
| tbl_task | ❌ | ❌ | ❌ | 66 字段, 无站点引用 |
| tbl_disc_lib | ❌ | ❌ | ❌ | 30 字段, 无站点引用 |
| tbl_hd_info | ❌ | ❌ | ❌ | 25 字段, 无站点引用 |
| tbl_user | ❌ | ❌ | ❌ | 25 字段, 无站点引用 |
| tbl_magzines | ❌ | ❌ | ❌ | - |
| tbl_slots | ❌ | ❌ | ❌ | - |
| tbl_lib_task | (lib_id 关系) | ❌ | ❌ | 任务-设备关联 |
| tbl_user_task | (user_id 关系) | ❌ | ❌ | 任务-用户关联 |
| tbl_disc | ❌ | ❌ | ❌ | - |
| tbl_logical_volume | ❌ | ❌ | ❌ | - |
| tbl_volume_slot | (volume_id 关系) | ❌ | ❌ | - |

**确认**: **所有已接入源表都没有站点/平台代码字段**。站点隔离完全靠总控的 `source_site_id` 标识。

---

## 五、tbl_site / tbl_platform 是否生产有效?

### tbl_site
- **业务语义**: 房间/监控分组 (非总控站点)
- **生产价值**: 监控领域, **与总控无业务关系**
- **样本数**: 0 (空表)
- **引用方**: 2 (tbl_site_monitor, tbl_project_site)
- **建议**: **不接入**, 浪费 Sprint

### tbl_platform
- **业务语义**: 第三方监控平台
- **生产价值**: 监控领域, **与总控无业务关系**
- **样本数**: 0 (空表)
- **引用方**: 2 (tbl_site_monitor, tbl_platform_monitor)
- **建议**: **不接入**, 浪费 Sprint

---

## 六、是否存在替代站点表?

### 否

源 schema 中**没有"总控站点"主表**。`tbl_project` 是"项目"概念, 不是"站点"概念:
- `tbl_project`: 项目 (maintitle/project_title/subtitle), 通过 `tbl_project_site` 关联
- `tbl_project_site`: 项目-站点多对多关联

如果强行映射, **tbl_project** 是最接近"总控可展示业务域"的概念, 但语义不匹配 ("项目" ≠ "站点")。

### 真实需求路径

总控的"站点"概念是**总控自创的逻辑实体**, 不在源数据库中。正确做法是:
- 总控在配置层 (env / config) 维护一个站点白名单
- 每个站点的数据通过 package 端点推送时, 携带 siteCode
- 总控根据 siteCode 路由和隔离数据

---

## 七、站点域分析矩阵

| 表 | 记录数 | 业务含义 | 是否生产有效 | 总控需要 | 优先级 |
|---|---|---|---|---|---|
| **tbl_site** | 0 | 房间/监控分组 | ❌ 监控域, 不相关 | ❌ | **不接** |
| **tbl_platform** | 0 | 第三方监控平台 | ❌ 监控域, 不相关 | ❌ | **不接** |
| **tbl_platform_type** | - | 监控平台类型字典 | ❌ 监控域, 不相关 | ❌ | **不接** |
| **tbl_site_monitor** | - | 房间-监控设备 | ❌ 监控域 | ❌ | **不接** |
| **tbl_platform_monitor** | - | 平台-监控设备 | ❌ 监控域 | ❌ | **不接** |
| **tbl_project** | - | 项目主表 | ⚠️ 业务项目, 语义不匹配 | ⚠️ 可选 | **P3** |
| **tbl_project_site** | - | 项目-站点关联 | ⚠️ | ⚠️ | **P3** |
| **tbl_device_device** | - | 设备-设备通信 | ❌ 站点概念不符 | ❌ | **不接** |

---

## 八、Sprint 2E.2 已建但实际无效?

### unified_sites / unified_platforms

Sprint 2E.2 已建立:
- `unified_sites` (建表)
- `unified_platforms` (建表)
- `lib/import/user-site-platform/` (4 文件)
- `app/api/sites/route.ts` (mock fallback)
- `app/api/platforms/route.ts` (新)

**问题**:
- `tbl_site` 0 rows → 导入后 `unified_sites` 0 rows
- `tbl_platform` 0 rows → 导入后 `unified_platforms` 0 rows
- API 调用走 mock fallback (mock 数据, 6 items)

**Sprint 2E.2 不是"错"**:
- 中心表已就绪
- importer + dispatcher 可用
- 当未来真有机房需要登记时, 直接 import + push 即可

**但目前 0 真实数据**, 站点筛选等"基于多站点"的功能**无法用真实数据验证**。

### 建议保留

不删除 (Sprint 2E.2 投入已沉没), 但**不再投入额外 Sprint 接入**。当前 `unified_sites` / `unified_platforms` 处于**"已就绪, 等待数据"** 状态。

---

## 九、唯一推荐

### **推荐 B: 转任务域 P0 补全**

#### 理由

1. **站点域无效**:
   - tbl_site / tbl_platform 是监控领域, 不是总控站点
   - 0 真实数据, 接入无 ROI
   - 站点的"逻辑标识"已经通过 `source_site_id` 实现
   - Sprint 2E.2 已就绪, 未来有机房登记时直接用

2. **任务域 P0 仍有真实可补的字段**:
   - **volumeId / packagingMode** ← tbl_task 已有但未写入 unified_tasks (低风险, 高 ROI)
   - **progress / currentPhase** ← tbl_interface_task.job_progress (有真实数据)
   - **errorMessage** ← tbl_task.ret_msg (有真实数据)
   - **runtime** ← 计算 update_dt - create_dt (零成本)
   - **packageCount / successCount / errorCount** ← 计算 from tbl_disc (有真实数据)

3. **Sprint 2E.1 任务域审查的 P0 仍有 4-5 个字段**未补, 现在站点域路线已确认无 ROI, 应该回到任务域。

### 转任务域 P0 的具体目标 (Sprint 2F.1 建议)

| 任务 | 字段 | 来源 | 难度 | ROI |
|---|---|---|---|---|
| **1. 写入 tbl_task 已有但 unified_tasks 缺的字段** | volume_id, task_mode | tbl_task.volume_id, task_mode | 低 (importer 改) | 高 |
| **2. 接入 tbl_interface_task** | progress, currentPhase, errorMessage | tbl_interface_task.job_progress/job_stage/err_str | 中 (新表) | 高 |
| **3. 派生 runtime 字段** | runtime | 计算: update_dt - create_dt | 低 (DTO 计算) | 中 |
| **4. 派生 disc 计数** | packageCount, successCount, errorCount | SELECT count from unified_disc_media | 中 (DTO 计算) | 高 |
| **5. 优化 Tasks 页面 mock 字段** | backupScope, packagingMode 等 | tbl_task.task_type 推断 | 低 | 中 |

### 推迟项

- tbl_task_certif_status (sm3Status) - 依赖 sm3 校验流程
- tbl_task_error_file (errorFiles) - 需新增 errorFiles API
- tbl_task_check, tbl_task_items 等 - 复杂任务域子表

### 不再投入

- **站点域 (tbl_site / tbl_platform)**: 监控域, 与总控无关, 不投入
- **tbl_project**: 业务项目, 与总控"任务"概念不重叠

---

## 十、最终固定统计

```
Sprint 2E.3 审查结论
=====================
源表总数量: 146
站点/平台域相关表: 8 张
  - tbl_site: 监控域, 不接
  - tbl_platform: 监控域, 不接
  - tbl_platform_type: 监控域, 不接
  - tbl_site_monitor: 监控域, 不接
  - tbl_platform_monitor: 监控域, 不接
  - tbl_project: 业务项目, P3 推迟
  - tbl_project_site: 业务项目, P3 推迟
  - tbl_device_device: 设备通信, 不接

已接入表含 siteCode 字段数: 0
总控站点通过 source_site_id 逻辑标识: 100%

下批推荐方向: 转任务域 P0 补全 (Sprint 2F.1)
不再继续站点域: 是
```

---

## 十一、git status / commit

- 仅文档变更, 不改代码
- 严格遵守: tsc/build 通过, 业务代码零变更
- 已 commit, 已 push
