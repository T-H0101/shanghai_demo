# 总控 → 站点：按物理位置写入待回迁记录（仅落库待执行，不执行回迁）

> **不另开端口。** 走站点业务 Web（`sync_sites.db_host:db_port`），与 `unified-sso/consume`、`unified-sync/trigger`、`unified-task-control` 一致。  
> **本阶段范围：** 站点只登记待执行：`tbl_task`（`task_type=1` + `task_mode=2`）+ `tbl_restore_file`；**不**写 `tbl_task_items`，**不**触发物理回迁执行。总控文案只能写「待回迁记录已提交」。  
> **展示链路：** 站点需将 `tbl_restore_file` 纳入小表推送；总控接收至 `unified_restore_files`，任务管理对 `task_type=1` + `task_mode=2` 从该表展示路径 / 回迁状态 / `restore_comment`。  
> 站点 Nw 配置键：`unifiedDisc`（含 `sso` / `restore.path`）；`restore_root_path` 由 Nw 本地配置注入 TCP，总控不传。

## 调用链

### 未迁入（归档站已知）

```text
总控检索页「发起回迁」
  → 校验 RFID + 盘位 + 盘面 + 路径 + hash（设备 IP/Port 可不传）
  → POST /api/search/restore（单站）
  → POST 目标站 /unified-restore-file
  → Central：按 RFID 查在线盘笼 → 认领 lib_ip/lib_port → 建任务 + INSERT tbl_restore_file
```

### 迁入区域（站点未定）

```text
总控检索页「发起回迁」（relocated）
  → 校验 RFID + 盘位 + 盘面 + 路径 + hash + regionCode
  → POST /api/search/restore（fanoutByRegion）
  → 并行请求该区域下全部可访问站点 /unified-restore-file
  → 各站：RFID 在线则建单；不存在/离线则失败
  → ≥1 成功 → 整体成功（按 site_code 排序取第一个成功站展示/跳转）
  → 全失败 → 列出各站失败原因
```

寻址键（**禁止**用归档站 `slot_id` 跨站寻址）：

| 总控/HTTP 字段 | 写入 `tbl_restore_file` | 说明 |
|---|---|---|
| `magazine_rfid` | `mag_rfid` | 盘笼 RFID（必填） |
| `slot_order` | `slot_order` | 片匣内盘位号（从 0 起） |
| `disc_side` | `disc_side` | 光盘 AB 面：0=A，1=B |
| `file_path` | `file_full_path` | 文件在介质上的全路径 |
| `file_hash` | `hash` | 文件校验码 |
| `size`（可选） | `size` | 文件字节数；缺省可 null |
| `device_ip` / `device_port`（可选，可忽略） | `lib_ip` / `lib_port` | **由站点按 RFID 认领在线设备后写入**，总控可不传 |
| —（Nw 配置） | `restore_root_path` | `unifiedDisc.restore.path` |
| — | `task_id` | 关联新建的物理回迁任务 |
| — | `restore_status=1` | 1=待处理（本接口只写待处理） |

## HTTP（Nw）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/unified-restore-file` | 待回迁记录写入（仅落库） |

鉴权头（与立即推送 / 任务控制同源密钥）：

- `x-unified-restore-file-secret`
- `x-unified-sync-secret`（兼容）

Body（snake_case；设备字段可选）：

```json
{
  "magazine_rfid": "E200001122334455",
  "slot_order": 3,
  "disc_side": 0,
  "file_path": "/归档/报告/报告.pdf",
  "file_hash": "...",
  "size": 1048576,
  "request_id": "uuid",
  "site_code": "SH01",
  "requested_by": "admin",
  "source": "central-control"
}
```

成功响应示例：

```json
{
  "code": 0,
  "accepted": true,
  "message": "待回迁记录已写入",
  "taskId": 1001,
  "restoreFileId": 12345,
  "lib_ip": "10.186.1.21",
  "lib_port": "5000",
  "device_name": "一体机-1"
}
```

失败时返回非 0 `code` 或 HTTP 4xx/5xx，可带 `reasonCode`：

| reasonCode | HTTP | 含义 |
|---|---|---|
| `MAGAZINE_NOT_FOUND` | 404 | 本站无此盘笼 |
| `MAGAZINE_OFFLINE` | 404 | 盘笼离线 |
| `RESTORE_IN_PROGRESS` | 409 | 5 分钟内同键待处理 |
| `INVALID_PHYSICAL_LOCATION` | 400 | 缺必填字段 |

短时重复发起示例：

```json
{
  "code": -1,
  "accepted": false,
  "reasonCode": "RESTORE_IN_PROGRESS",
  "message": "当前文件正在回迁中，请勿重复发起"
}
```

## 总控配置

| 环境变量 | 说明 |
|---|---|
| `SITE_SSO_SECRET` 或 `SITE_SYNC_TRIGGER_SECRET` | 与 Nw `unifiedDisc.secretKey` 一致 |
| `SITE_RESTORE_FILE_PATH` | 默认 `/unified-restore-file` |
| `SITE_RESTORE_FILE_BASE_URL` | 可选覆盖整站基址 |
| `SITE_RESTORE_FILE_BASE_URL_<SITE>` | 按站点覆盖 |

生产主路径：**`sync_sites.db_host` / `db_port`**。

## 站点侧实现要求（本阶段）

1. 验密钥后创建 `tbl_task`（`task_type=1`，`task_mode=2`），再 `INSERT tbl_restore_file`（含 `task_id`、`disc_side`）。
2. **不要**写 `tbl_task_items`。
3. **不要**在本接口内启动机械臂/光驱回迁；执行由站点后续消费表数据完成。
4. `restore_root_path` 取自本站 `unifiedDisc.restore.path`。
5. 已有库需 `ALTER TABLE tbl_restore_file ADD COLUMN disc_side INT DEFAULT 0;`（若缺列）。
6. **落库前按 RFID 认领设备（Central `createRestoreFile`）**：
   - **不再**要求总控传 `lib_ip`/`lib_port`，**不再**做 IP/端口一致性校验；
   - 按 `mag_rfid` 大写后正序 + hex 字节对倒序查 `tbl_magzines` ⋈ `tbl_disc_lib`；
   - 查无 → `MAGAZINE_NOT_FOUND`；
   - `mag_order` 空 → `MAGAZINE_OFFLINE`；
   - 在线 → 用库内 `IP`/`port` 写入 `tbl_restore_file`，并在响应中回传。
7. **短时防连点（`newTask` 之前）**：
   - 匹配键：`mag_rfid` + `slot_order` + `disc_side` + `file_full_path` + `hash`；
   - `restore_status=1` 且 `create_dt` 在 5 分钟内 → `RESTORE_IN_PROGRESS`（HTTP 409）。

## 总控验收口径

| 可宣称 | 不可宣称 |
|---|---|
| 物理位置校验完成（含 AB 面） | 回迁成功 / 已回迁 |
| 站点待回迁记录已提交（含区域扇出后命中站） | 站点已执行物理取盘 |
| 成功展示命中站/设备并跳转该站 | requirements 回迁能力 complete |
| 全失败列出各站原因 | |
| audit_log 有登记痕迹 | |
