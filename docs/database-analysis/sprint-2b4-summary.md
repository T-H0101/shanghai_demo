# Sprint 2B.4 总结

> 日期: 2026-05-30
> 状态: 完成

---

## 目标

实现第二个同步对象（devices），验证多同步对象模式，同时解决 UPSERT 重复问题。

---

## 对应 requirements.md

| 章节 | 内容 |
|------|------|
| 2.1 站点管理/站点监控 | 设备信息汇聚 |
| 2.3 数据同步/设备信息同步 | 盘库设备数据同步 |
| 4.3 盘笼统一管理前置数据 | 设备数据基础 |
| 6.4 可维护性/状态监控基础 | 同步状态可视化 |

---

## 修改文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `lib/sync/sync-engine.ts` | 最小同步引擎（~80行） |
| `lib/sync/devices-sync.ts` | devices 同步入口 |
| `app/api/sync/devices/route.ts` | POST /api/sync/devices |
| `databases/sprint-2b4/mock-tbl-disc-lib.sql` | mock 源表 seed |

### 修改文件

| 文件 | 说明 |
|------|------|
| `lib/sync/config.ts` | 添加 DEVICE_SYNC_CONFIG |
| `lib/sync/types.ts` | 添加 DeviceSourceRecord/UnifiedDeviceRecord |
| `lib/sync/upsert.ts` | 签名改为 client 参数，新增 upsertDevice |
| `lib/sync/tasks-sync.ts` | 重构使用 sync-engine（167行→28行） |
| `lib/sync/source-reader.ts` | 添加 readDiscLibSource |
| `lib/sync/field-mapper.ts` | 添加 mapDiscLibToTarget |

---

## 新增接口

**POST /api/sync/devices**
- 触发 devices 同步
- 返回结构与 /api/sync/tasks 一致
- source_table = `tbl_disc_lib`

---

## 验收结果

### Phase 1: Tasks 重构

| 检查项 | 预期 | 实际 |
|--------|------|------|
| rowsRead | 5 | ✅ 5（干净环境首次同步） |
| rowsUpserted | 5 | ✅ 5 |
| sync_progress tbl_task | 更新 | ✅ |
| sync_job_log tbl_task | 有记录 | ✅ |
| API 返回结构 | 不变 | ✅ |

### Phase 2/3: Devices 同步

| 检查项 | 预期 | 实际 |
|--------|------|------|
| 首次 rowsRead | 3 | ✅ 3 |
| 首次 rowsUpserted | 3 | ✅ 3 |
| 第二次同步 | skipped | ✅ skipped |
| sync_progress | tbl_task + tbl_disc_lib | ✅ 两者都有 |
| sync_job_log | tbl_task + tbl_disc_lib | ✅ 两者都有 |
| raw_data 字段 | last_heartbeat/operator/device_status | ✅ |
| ip_address | 有值 | ✅ 192.168.1.101 |

### 构建

| 检查项 | 结果 |
|--------|------|
| tsc --noEmit | ✅ |
| build | ✅ |

---

## 不做事项

- ❌ 不 ALTER unified_devices（扩展字段存 raw_data）
- ❌ 不接真实源库
- ❌ 不改 UI
- ❌ 不处理 tbl_file/tbl_folder
- ❌ 不做定时任务

---

## 架构设计

**sync-engine 事务管理策略**：
- sync-engine 负责事务，upsertBatch 使用传入的 client
- updateProgressInTransaction 使用同一 client
- 不混用，无 placeholder

**字段映射**：
- mock_tbl_disc_lib.device_no → unified_devices.device_id
- mock_tbl_disc_lib.ip_address → unified_devices.ip_address（主字段）
- 扩展字段（last_heartbeat/operator/device_status）→ raw_data

---

## 后续建议

1. **同步 idempotency 验证**：多次运行 devices 同步，确认幂等性
2. **client 类型优化**：当前 `client: any`，可改为 PoolClient（需要 export）
3. **其他同步对象**：volumes/disc_lib 可复用 sync-engine 模式
4. **真实源库接入**：需先确认源表结构，再调整 mock 表

---

*Sprint 2B.4 完成: 2026-05-30*
*14 个 commits 待 push*