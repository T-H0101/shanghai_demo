# Sprint 2C.6 — 源库—恢复库—中心库一致性审查 + 总控能力边界校准

> **日期**: 2026-06-04
> **范围**: 只做审查和文档，不写业务代码

---

## 一、SQL / Schema 文件盘点

| 文件路径 | 用途 | 类型 | 有效？ | 与当前一致？ |
|----------|------|------|--------|-------------|
| `databases/disc_files.sql` | 源系统完整 DDL（MySQL 语法，PG17 结构参考） | 站点源库 schema | ✅ 参考有效 | ⚠️ 列名大小写有差异 |
| `databases/sprint-2b0/unified_schema.sql` | 中心库建表 SQL | 中心库 schema | ✅ 有效 | ✅ 一致 |
| `databases/sprint-2b1/seed.sql` | 中心库种子数据 | seed | ✅ 有效 | ✅ 仍使用 |
| `databases/sprint-2b2/mock-tbl-task.sql` | mock 源表 tbl_task | mock 表 | ✅ 有效 | ✅ mock sync 使用 |
| `databases/sprint-2b4/mock-tbl-disc-lib.sql` | mock 源表 tbl_disc_lib | mock 表 | ✅ 有效 | ✅ mock sync 使用 |
| `databases/sprint-2b6/ingest-batch-log.sql` | ingest 批次日志表 | 中心表 | ✅ 有效 | ✅ 已建表 |
| `databases/sprint-2c2/add-used-slots.sql` | unified_devices 增加 used_slots 列 | patch | ✅ 有效 | ✅ 已执行 |

**结论**：所有 SQL 文件仍有效，与当前实现一致。disc_files.sql 中 `IP`（大写）与实际 PG 列 `ip`（小写）有差异，已在 mapper 中处理。

---

## 二、真实恢复库与 disc_files.sql 对齐审查

| 表名 | disc_files.sql | pg_restore_test | source_restore | 已 import？ | 当前用途 | 后续建议 |
|------|---------------|----------------|----------------|------------|---------|---------|
| tbl_task | ✅ | ✅ 37 条 | ✅ 37 条 | ✅ unified_tasks | 任务同步 | 已完成 |
| tbl_disc_lib | ✅ | ✅ 4 条 | ✅ 4 条 | ✅ unified_devices | 设备同步 | 已完成 |
| tbl_magzines | ✅ | ✅ 6 条 | ✅ 6 条 | ✅ 聚合到 unified_devices | 盘笼聚合 | 已完成 |
| tbl_slots | ✅ | ✅ 396 条 | ✅ 396 条 | ✅ 聚合到 unified_devices | 盘位聚合 | 已完成 |
| tbl_user | ✅ | ✅ 3 条 | ❌ | ❌ | 用户同步 | 后续考虑 |
| tbl_depa | ✅ | ✅ 0 条 | ❌ | ❌ | 部门同步 | 数据为空 |
| tbl_hd_info | ✅ | ✅ 8 条 | ❌ | ❌ | 硬盘健康 | 后续考虑 |
| tbl_lib_task | ✅ | ✅ 86 条 | ❌ | ❌ | 任务-设备关联 | 后续考虑 |
| tbl_disc | ✅ | ✅ 65 条 | ❌ | ❌ | 光盘详情 | 后续考虑 |
| tbl_logical_volume | ✅ | ✅ 3 条 | ❌ | ❌ | 逻辑卷 | 后续考虑 |
| tbl_volume_slot | ✅ | ✅ 161 条 | ❌ | ❌ | 卷-盘位关联 | 后续考虑 |
| tbl_iso | ✅ | ✅ 22 条 | ❌ | ❌ | ISO 文件 | 后续考虑 |
| tbl_config | ✅ | ✅ 26 条 | ❌ | ❌ | 系统配置 | 后续考虑 |
| tbl_sys_log | ✅ | ✅ 6 条 | ❌ | ❌ | 系统日志 | 后续考虑 |
| tbl_workflow_template | ✅ | ✅ 3 条 | ❌ | ❌ | 工作流模板 | 后续考虑 |
| tbl_file | ✅ | ✅ 0 条 | ❌ | ❌ | 大表 | 不导入 |
| tbl_folder | ✅ | ✅ 0 条 | ❌ | ❌ | 大表 | 不导入 |

**已发现差异**：

| 差异 | disc_files.sql | 实际 PG | 处理状态 |
|------|---------------|---------|---------|
| tbl_disc_lib.IP | `IP`（大写） | `ip`（小写） | ✅ mapper 已用小写 |
| tbl_task.uuid | 有 uuid 列 | 有 uuid 列 | ✅ raw_data 保留 |
| tbl_task.task_type | 有 | 有 | ✅ 已映射 |
| tbl_magzines 无 slot_count | disc_files.sql 无此列 | 实际无此列 | ✅ 通过 tbl_slots COUNT |
| tbl_hd_info 无 lib_id | disc_files.sql 无此列 | 实际无此列 | ✅ 不用于容量聚合 |

---

## 三、站点同步测试数据有效性审查

| 模块 | 数据 | 足够测试？ | 说明 |
|------|------|-----------|------|
| 任务同步 | 37 条 task | ✅ 足够 | 覆盖 5 种 status |
| 设备同步 | 4 条 disc_lib | ✅ 足够 | 覆盖 hdd_library + gen3_library + 离线设备 |
| 盘位容量 | 396 slots + 6 mags | ✅ 足够 | 覆盖有容量/无容量场景 |
| 用户管理 | 3 条 user | ⚠️ 偏少 | 仅系统账号，无真实操作员 |
| 部门管理 | 0 条 depa | ❌ 无数据 | tbl_depa 为空 |
| 任务-设备关联 | 86 条 lib_task | ✅ 足够 | 但未导入 source_restore |
| 光盘详情 | 65 条 disc | ✅ 足够 | 但未导入 source_restore |
| 硬盘健康 | 8 条 hd_info | ✅ 足够 | 但未导入 source_restore |
| 系统日志 | 6 条 sys_log | ⚠️ 偏少 | |
| 大表 tbl_file/tbl_folder | 0 条 | N/A | 无数据，当前阶段不处理 |

**结论**：
- 任务/设备/盘位模块可充分测试
- 用户/部门数据不足，需领导提供额外 dump 或样例数据
- 大表无数据，当前阶段无需处理

---

## 四、中心统一表与总控能力对齐

| 中心表 | 记录数 | 数据来源 | 真实同步？ | 服务页面 | 需扩字段？ | 需新增 import？ | 有 API？ | 接前端？ |
|--------|--------|---------|-----------|---------|-----------|----------------|---------|---------|
| unified_tasks | 82 | mock sync + real import | ✅ 部分 | Tasks | 否 | 否 | ⚠️ mock | ❌ |
| unified_devices | 10 | mock sync + real import | ✅ 部分 | Racks | 否 | 否 | ✅ 真实 | ✅ |
| unified_volumes | 3 | seed | ❌ seed | Volumes | 否 | 否 | ❌ | ❌ |
| unified_users | 0 | 空 | ❌ | Users | 是 | 是 | ❌ | ❌ |
| unified_alerts | 2 | seed | ❌ seed | Dashboard | 否 | 否 | ❌ | ❌ |
| unified_magazines | 0 | 空 | ❌ | — | 是 | 是 | ❌ | ❌ |
| unified_slots | 0 | 空 | ❌ | — | 是 | 是 | ❌ | ❌ |
| unified_hard_disks | 0 | 空 | ❌ | — | 是 | 是 | ❌ | ❌ |
| unified_device_groups | 0 | 空 | ❌ | — | 否 | 否 | ❌ | ❌ |
| unified_drivers | 0 | 空 | ❌ | — | 否 | 否 | ❌ | ❌ |
| sites | 2 | seed | ❌ seed | Sites | 否 | 否 | ❌ | ❌ |
| sync_sites | 2 | seed | ❌ seed | Settings | 否 | 否 | ❌ | ❌ |
| sync_progress | 2 | real sync | ✅ | Sync | 否 | 否 | ✅ | ❌ |
| sync_job_log | 76 | real sync | ✅ | Logs | 否 | 否 | ✅ | ❌ |
| ingest_batch_log | 9 | real ingest | ✅ | Logs | 否 | 否 | ✅ | ❌ |
| mock_tbl_task | 5 | seed | ❌ mock | — | 否 | 否 | — | — |
| mock_tbl_disc_lib | 3 | seed | ❌ mock | — | 否 | 否 | — | — |

**关键结论**：
- 只有 unified_tasks 和 unified_devices 有真实同步数据
- unified_magazines / unified_slots / unified_hard_disks 为空壳，容量数据通过聚合直接写入 unified_devices
- unified_users / unified_alerts / unified_volumes 为空或 seed
- sites / sync_sites 为 seed 数据
- sync_progress / sync_job_log / ingest_batch_log 有真实数据

---

## 五、总控与站点系统边界审查

| 能力 | 当前状态 | 建议处理 |
|------|---------|---------|
| 总控直接修改站点源数据 | ❌ 未实现 | **不应由总控做**。站点数据由站点系统维护 |
| 总控同步展示站点数据 | ✅ 已实现（设备） | **已实现**。通过 import → unified_* → API → 前端 |
| 总控配置展示字段（location/room/floor） | ❌ 未实现 | **可短期实现**。新增 device_config 表 |
| 跳转登录站点系统 | ❌ 未实现 | **需领导确认**。前端跳转 URL 还是 SSO？ |
| 站点访问地址/登录地址 | ❌ 未存储 | **需扩表**。sites 表需增加访问 URL 字段 |
| SSO / 跳转实现 | ❌ 无 | **需领导确认**方案后实现 |
| 新增设备 = 新增站点设备？ | ❌ | **不应由总控做**。站点侧添加设备 |
| 新增设备 = 新增总控展示配置？ | ❌ 未实现 | **可短期实现**。device_config 表 |
| 总控下发操作到站点 | ❌ 未实现 | **需领导确认**。是否需要远程操作？ |
| 总控只读查看站点任务 | ⚠️ mock | **可短期实现**。接 unified_tasks |

---

## 六、当前模块覆盖度审查

| 模块 | 页面？ | mock？ | API？ | 中心表？ | 真实源表？ | 接真实数据？ | 3 周内做？ | 推荐做法 |
|------|--------|--------|-------|---------|-----------|------------|-----------|---------|
| Dashboard | ✅ | ✅ mock | ✅ | ✅ | ❌ | ❌ | ⚠️ | 用现有数据聚合 |
| Racks/Devices | ✅ | ✅ | ✅ 真实 | ✅ | ✅ | ✅ | ✅ 已完成 | 保持 |
| Tasks | ✅ | ✅ mock | ⚠️ mock | ✅ | ✅ | ⚠️ 部分 | ⚠️ | 最小列表接入 |
| Sites | ✅ | ✅ mock | ❌ | ✅ seed | ❌ | ❌ | ⚠️ | seed 数据展示 |
| Users | ✅ | ✅ mock | ❌ | ✅ 空 | ❌ | ❌ | ❌ | 等领导提供数据 |
| Logs | ✅ | ✅ mock | ✅ | ✅ | ✅ sync/ingest | ❌ | ✅ | 接 sync_job_log |
| Sync/Import | ❌ 页面 | — | ✅ | ✅ | ✅ | ✅ | ⚠️ | 可做状态页 |
| Alerts | ❌ 独立页 | — | ❌ | ✅ seed | ❌ | ❌ | ❌ | 等需求 |
| Volumes | ✅ | ✅ mock | ❌ | ✅ seed | ❌ | ❌ | ❌ | 等需求 |
| Settings | ✅ | ✅ mock | ❌ | ✅ seed | ❌ | ❌ | ❌ | 保持 mock |
| 跳转站点/SSO | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 需领导确认 |

---

## 七、下一批真实接入优先级

| 优先级 | 方向 | 价值 | 依赖 | 需更多数据？ | 3 周内？ | 需先问领导？ |
|--------|------|------|------|------------|---------|------------|
| 1 | **C. sites/sync_sites 站点管理 + 站点筛选器** | 高 | 无 | 否 | ✅ | 否 |
| 2 | **D. /api/tasks 接 unified_tasks 最小列表** | 高 | 2C.3 status 已完成 | 否 | ✅ | 否 |
| 3 | **F. logs 页面接 sync_job_log / ingest_batch_log** | 中 | 无 | 否 | ✅ | 否 |
| 4 | **B. sync/import 日志页面接真实数据** | 中 | 方向 F | 否 | ✅ | 否 |
| 5 | **A. import_job_log + import history API** | 中 | 无 | 否 | ✅ | 否 |
| 6 | **G. device_config 总控配置表** | 中 | 无 | 否 | ⚠️ | 需确认 |
| 7 | **H. 站点跳转登录 / SSO 占位方案** | 中 | 无 | 否 | ⚠️ | 需确认 |
| 8 | **E. users 页面接真实数据** | 低 | tbl_user 数据不足 | 是 | ❌ | 需提供数据 |
| 9 | **J. 设备详情页继续增强** | 低 | 更多关联表 | 否 | ❌ | 否 |
| 10 | **I. tbl_file/tbl_folder 大表同步方案** | 低 | ES/ClickHouse | 否 | ❌ | 需确认 |

---

## 八、剩余 3 周路线

### Week 1：站点管理 + 任务最小列表 + 日志接入

**做**：
- 接 /api/tasks 读 unified_tasks 最小列表（taskNo, type, status, totalFiles, totalSize）
- 接 /api/logs 读 sync_job_log + ingest_batch_log 真实数据
- 整理 sites/sync_sites seed 数据，确保站点页面可展示
- 写演示文档

**验收**：
- Tasks 页面展示真实任务列表（至少 taskNo + status）
- Logs 页面展示真实同步日志
- Sites 页面展示 seed 站点数据
- tsc/build 通过

**不做**：
- 不接 task 详情
- 不做任务进度/速度
- 不做用户管理
- 不做 SSO

### Week 2：站点筛选器 + 设备配置 + 部署文档

**做**：
- 站点筛选器：Racks/Tasks 页面支持 siteCode 筛选
- device_config 最小版：支持 location/room/floor 配置
- 部署文档：Docker 环境 + 数据库初始化 + import 流程

**验收**：
- Racks 页面可通过站点筛选器过滤设备
- device_config 表已建，API 可读写
- 部署文档可复现环境

**不做**：
- 不做 SSO
- 不做站点跳转
- 不做大表同步

### Week 3：演示排练 + 收口 + 最终打磨

**做**：
- 演示路径排练
- Dashboard 聚合真实数据（设备数、任务数、容量统计）
- 空态/错误态打磨
- 最终文档整理

**验收**：
- 可完整演示：Dashboard → Racks（真实设备） → Tasks（真实任务） → Logs（真实日志）
- 所有页面无 mock 数据残留（API mode 下）
- 演示文档 + 部署文档完整

**不做**：
- 不做用户管理
- 不做大表
- 不做 SSO
- 不做 ES

---

## 九、需要领导确认的问题

1. **总控是否需要跳转登录站点系统？** 如果需要，是前端跳转 URL 还是 SSO token？当前 sites 表是否需要增加站点访问地址字段？

2. **总控是否允许配置设备位置/展示信息？** 即是否需要 device_config 表存储 location/room/floor/display_name？

3. **站点同步后续是定期导入 dump，还是需要自动同步？** 当前是手动 CLI import，正式环境是否需要定时任务？

4. **用户/部门真实数据是否会提供？** 当前 tbl_user 只有 3 个系统账号，tbl_depa 为空。正式演示是否需要真实用户数据？

5. **日志/审计数据来源是什么？** 是站点 tbl_sys_log 还是总控自行记录？当前 sync_job_log 和 ingest_batch_log 是否足够？

6. **大表 tbl_file/tbl_folder 是否只做检索方案？** 即通过 ES/ClickHouse 做索引，不导入中心库？

7. **总控是否能下发操作到站点？** 例如远程触发备份任务、暂停任务等。还是只读查看？

8. **演示优先看哪些模块？** 请确认 3 周后的演示重点：设备管理？任务管理？站点管理？全部？

---

## 附录：disc_files.sql 列名差异

| 表.字段 | disc_files.sql | 实际 PG | mapper 处理 |
|---------|---------------|---------|------------|
| tbl_disc_lib.IP | `IP` | `ip` | ✅ 用 `source.ip` |
| tbl_task.task_type | `task_type` | `task_type` | ✅ |
| tbl_task.status | `status` | `status` | ✅ |
| tbl_task.uuid | `uuid` | `uuid` | ✅ raw_data 保留 |
| tbl_magzines.slot_count | 无此列 | 无此列 | ✅ 通过 tbl_slots COUNT |
| tbl_hd_info.lib_id | 无此列 | 无此列 | ✅ 不用于容量聚合 |
