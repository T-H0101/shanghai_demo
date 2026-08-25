# 总控 → 站点：按物理位置写入待回迁记录（仅落库待执行，不执行回迁）

> **不另开端口。** 走站点业务 Web（`sync_sites.db_host:db_port`），与 `unified-sso/consume`、`unified-sync/trigger`、`unified-task-control` 一致。  
> **本阶段范围：** 站点只登记待执行：`tbl_task`（`task_type=1` + `task_mode=2`）+ `tbl_restore_file`；**不**写 `tbl_task_items`，**不**触发物理回迁执行。总控文案只能写「待回迁记录已提交」。  
> **展示链路：** 站点需将 `tbl_restore_file` 纳入小表推送；总控接收至 `unified_restore_files`，任务管理对 `task_type=1` + `task_mode=2` 从该表展示路径 / 回迁状态 / `restore_comment`。  
> 站点 Nw 配置键：`unifiedDisc`（含 `sso` / `restore.path`）；`restore_root_path` 由 Nw 本地配置注入 TCP，总控不传。

## 调用链

```text
总控检索页「发起回迁」
  → 校验物理位置（含 disc_side；size 可选补传）
  → POST /api/search/restore（总控）
  → 查 sync_sites.db_host:db_port（目标站 = 当前物理所在站）
  → POST http://{db_host}:{db_port}/unified-restore-file
  → MultimediumNw（验密钥；注入 unifiedDisc.restore.path）
  → TCP request: center_restore_file_register
  → MultimediumCentral：
       1) INSERT tbl_task (task_type=1, task_mode=2)
       2) INSERT tbl_restore_file（含 task_id / disc_side / size / restore_root_path，restore_status=1）
  → 总控 audit_log 留痕
```

寻址键（**禁止**用归档站 `slot_id` 跨站寻址）：

| 总控/HTTP 字段 | 写入 `tbl_restore_file` | 说明 |
|---|---|---|
| `device_ip` | `lib_ip` | 当前设备 IP（移位登记覆盖优先） |
| `device_port` | `lib_port` | 当前设备端口 |
| `magazine_rfid` | `mag_rfid` | 盘笼 RFID |
| `slot_order` | `slot_order` | 片匣内盘位号（从 0 起） |
| `disc_side` | `disc_side` | 光盘 AB 面：0=A，1=B |
| `file_path` | `file_full_path` | 文件在介质上的全路径 |
| `file_hash` | `hash` | 文件校验码 |
| `size`（可选） | `size` | 文件字节数；总控从检索 hit 补传，缺省可 null |
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

Body（snake_case）：

```json
{
  "device_ip": "10.186.1.21",
  "device_port": "5000",
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

建议响应：

```json
{
  "code": 0,
  "accepted": true,
  "message": "待回迁记录已写入",
  "taskId": 1001,
  "restoreFileId": 12345
}
```

失败时返回非 0 `code` 或 HTTP 4xx/5xx，可带 `reasonCode`。

## 总控配置

| 环境变量 | 说明 |
|---|---|
| `SITE_SSO_SECRET` 或 `SITE_SYNC_TRIGGER_SECRET` | 与 Nw `unifiedDisc.secretKey` 一致 |
| `SITE_RESTORE_FILE_PATH` | 默认 `/unified-restore-file` |
| `SITE_RESTORE_FILE_BASE_URL` | 可选覆盖整站基址 |
| `SITE_RESTORE_FILE_BASE_URL_<SITE>` | 按站点覆盖 |

生产主路径：**`sync_sites.db_host` / `db_port`**。未配置时也可回退 `SITE_TASK_CONTROL_BASE_URL[_SITE]`。

## 站点侧实现要求（本阶段）

1. 验密钥后创建 `tbl_task`（`task_type=1`，`task_mode=2`），再 `INSERT tbl_restore_file`（含 `task_id`、`disc_side`）。
2. **不要**写 `tbl_task_items`。
3. **不要**在本接口内启动机械臂/光驱回迁；执行由站点后续消费表数据完成。
4. `restore_root_path` 取自本站 `unifiedDisc.restore.path`。
5. 已有库需 `ALTER TABLE tbl_restore_file ADD COLUMN disc_side INT DEFAULT 0;`（若缺列）。
6. **落库前校验盘笼/设备（Central `createRestoreFile`）**：
   - 按 `mag_rfid` **大写**后，用正序 + **hex 字节对倒序**（例 `E00401D003AFE0A5` ↔ `A5E0AF03D00104E0`）查 `tbl_magzines` ⋈ `tbl_disc_lib`（库内 `RFID` 已为大写，直接等值匹配）；
   - 查无 → 报错「盘笼 RFID 不存在」；
   - 多命中优先 `mag_order` 非空（在线），在线仍多个取第一条；`mag_order` 空 → 报错「盘笼离线」；
   - 命中库的 `IP`/`port` 须与总控传入的 `device_ip`/`device_port` 一致，否则报错；
   - `tbl_restore_file.mag_rfid` 仍写总控传入值（不改成库内另一方向字符串）。

## 总控验收口径

| 可宣称 | 不可宣称 |
|---|---|
| 物理位置校验完成（含 AB 面） | 回迁成功 / 已回迁 |
| 站点待回迁记录已提交 | 站点已执行物理取盘 |
| audit_log 有登记痕迹 | requirements 回迁能力 complete |
