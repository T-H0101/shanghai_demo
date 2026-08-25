# 站点 OpenSearch 文件/目录索引推送契约 v1

> 对应 `requirements.md` §4.1（统一检索）/ §2.3（大表不进 PG，走索引引擎）。  
> **实现归属**：推送脚本、调度、水位文件、`_bulk` 写入 **全部在业务系统**（MultimediumCentral `syncDB`）完成，**与总控无关**。  
> 本文件是契约说明，供业务侧按此实现；总控仓 `shanghai_demo` **不实现**推送代码。

## 1. 范围与非目标

### 1.1 本期范围

| 项 | 定案 |
|----|------|
| 文件源表 | `tbl_file_{volumeId}_a`（按卷分表；`_a` = 任务成功后归档表） |
| 目录源表 | `tbl_folder_{volumeId}`（按卷分表，同期推送） |
| 增量规则 | 各表独立 `WHERE id > lastId ORDER BY id LIMIT N`（仅新增） |
| 进度存储 | syncDB 数据目录下 JSON，**按表**记录 `lastId` |
| 目标索引 | `disc_file_index`（同一 index；`doc_type` 区分 `file` / `folder`） |
| `create_date`（文件） | **源表归档时间**，不是推送时刻 |

### 1.2 非目标（本期不做）

- 删除 / 修改回扫（已推过的行改 `status` 或软删，不会因 `id > lastId` 再次推送）
- 将 `tbl_file*` / `tbl_folder*` 写入中心 PostgreSQL
- 在总控仓实现推送脚本、推送 API、水位表
- 总控 `/api/search`、`es-client`、`FileIndexDocument` 字段改造（另开任务）
- 推送 `tbl_file_N`（无 `_a`）、`*_empty` / `*_error` / `*_repeat` 等过程/异常表

### 1.3 实现落点

| 项 | 路径 |
|----|------|
| 业务仓 | `MultimediumCentral` |
| 现有小表推送 | `syncDB/`（`sync-once.js` / `sync-schedule.js` / `lib/sync-runner.js`） |
| ES 大表推送 | `syncDB/es-push-once.js`、`es-push-schedule.js`、`lib/es-push-runner.js` 等 |
| 随主服务拉起 | `controllers/unified_disc_center_service.js` 分别 spawn 小表与 ES 两个子进程 |
| 水位文件 | `<syncDB_data_root>/es-push-progress.json` |
| 总控仓 | 检索读 OpenSearch；本契约文档；不写站点推送实现 |

小表 15 张全量 push（约 5 分钟一轮）与本契约无关；大表索引建议独立调度（1～5 分钟一轮）。

## 2. 架构

```text
站点库 tbl_file_N_a / tbl_folder_N
        │
        ▼
业务 syncDB ES 推送脚本  ◄── es-push-progress.json（按表 lastId）
        │
        ▼  _bulk upsert（确定性 _id）
OpenSearch 索引 disc_file_index
```

- 总控若日后做统一检索：只读 `disc_file_index`，**不连站点库、不跑推送**。
- 历史样例：总控仓 R.85/R.86（`file-indexer` / `file_index_jobs` center pull）**不是**本生产路径；生产以本契约 + syncDB 实现为准。

## 3. 调度与批大小

| 项 | 建议 |
|----|------|
| 频率 | 独立于小表 sync；1～5 分钟一轮 |
| 单表每批 SQL | 1000～2000 行（上限 5000） |
| OpenSearch 写入 | `_bulk`；可与 SQL 批同批，或拆成 500～1000/请求 |
| 一轮策略 | 发现全部目标表后轮询；可设时间盒（如 60s）避免单卷饿死其它卷 |
| 水位推进 | **仅本批 `_bulk` 全部成功后**，将该表 `lastId` 更新为本批 `max(id)` |

## 4. 表发现

每轮开始：

1. `SELECT volume_id FROM tbl_logical_volume WHERE type IN (1, 2, 3, 5, 7) AND del_flag <> 1 ORDER BY volume_id`
   - type：1 光盘 / 2 磁盘(NAS) / 3 硬盘 / 5 磁带库 / 7 磁带机（不含 6 校验卷、8 中转卷等）
   - `del_flag <> 1`：排除已删除卷
2. 对每个 `volume_id` 检查物理表是否存在：
   - `tbl_file_{volume_id}_a` → 存在则加入文件推送队列
   - `tbl_folder_{volume_id}` → 存在则加入目录推送队列
3. **表不存在**：打日志并跳过，**不**在进度 JSON 中建条目
4. 文件表存在但目录表不存在：仍推文件，`folder_path` 为空（打警告日志）
5. 读进度 JSON；仅对**本轮实际开始推送**的表，若尚未有条目则补：

```json
{ "lastId": 0, "lastSuccessAt": null, "rowsPushed": 0 }
```

说明：`_N` 是**卷 id**（来自 `tbl_logical_volume.volume_id`），不是按行数分片。某表当前 `lastId` 追上 `MAX(id)` **不代表**以后不会再有新行；下一轮仍执行 `id > lastId`。

只推 `_a` 正式文件表与目录表；不推 `_empty` / `_error` / `_repeat`。

## 5. SQL

字段定义对齐站点 schema 基线 `databases/disc_files.sql`（`tbl_file` / `tbl_folder` 及动态分表模板）。

### 5.1 文件表 `tbl_file_{N}_a`

推送时 LEFT JOIN 同卷目录表，写入 ES 的 `folder_path`（总控检索「路径」列）：

```sql
SELECT f.id, f.file_size, f.file_name, f.folder_id, f.hash, f.hash1,
       f.task_id, f.items_id, f.create_date, f.status, f.slot_id, f.content_type,
       COALESCE(NULLIF(fo.folder_path, ''), fo.name) AS folder_path
FROM `{tbl_file_N_a}` f
LEFT JOIN `{tbl_folder_N}` fo ON fo.id = f.folder_id
WHERE f.id > ?
ORDER BY f.id
LIMIT 1000;
```

绑定参数：`?` = 该表进度中的 `lastId`（新表为 `0`）。

> **根目录陈年数据**：建卷时根目录常为 `name='/'`、`folder_path=''`。推送时若 `folder_path` 为空则回退用 `name`（根下文件会推成 `folder_path: "/"`）。  
> 已推送过、文档中无 `folder_path` 的历史文件：将该表水位 `lastId` 置 `0`（或删水位条目）后重推；`_id` 覆盖写回。

### 5.2 目录表 `tbl_folder_{N}`

```sql
SELECT id, name, folder_path, disc_path, s_level, parent,
       sum_files, files, subs
FROM `{tbl_folder_N}`
WHERE id > ?
ORDER BY id
LIMIT 1000;
```

### 5.3 盘位/设备映射（每轮一次，不 JOIN file 大表）

按逻辑卷 `tbl_logical_volume.type` 分支：

| type | 含义 | 位置解析 |
|------|------|----------|
| 1 | 光盘卷 | `file.slot_id` → `tbl_slots` → mag → disc_lib（RFID / slot_order / disc_side / device_ip） |
| 3 | 硬盘卷 | `file.slot_id` → `tbl_hd_info`；`serial_num` → slots → mag → disc_lib 取 device_ip；推送 `serial_num`，**不推** magazine_rfid / disc_side / slot_order |
| 2/5/7 | NAS/磁带等 | 本轮不填物理位置 |

光盘：

```sql
SELECT s.slot_id, s.slot_order, s.disc_side, m.RFID AS magazine_rfid, d.IP AS device_ip, d.port AS device_port
FROM tbl_slots s
LEFT JOIN tbl_magzines m ON m.mag_id = s.mag_id
LEFT JOIN tbl_disc_lib d ON d.lib_id = m.lib_id
```

硬盘：

```sql
SELECT h.slot_id AS hd_id, h.serial_num, d.IP AS device_ip, d.port AS device_port
FROM tbl_hd_info h
LEFT JOIN tbl_slots s ON s.serial_num = h.serial_num
LEFT JOIN tbl_magzines m ON m.mag_id = s.mag_id
LEFT JOIN tbl_disc_lib d ON d.lib_id = m.lib_id
WHERE h.serial_num IS NOT NULL AND h.serial_num <> ''
```

文档字段额外：`volume_type`（逻辑卷 type）、`serial_num`（硬盘 SN）。
## 6. 进度文件

路径：`<syncDB_data_root>/es-push-progress.json`  
（业务侧数据根；与总控 `SITE_AGENT_STATE_DIR` 无关。）

### 6.1 示例

```json
{
  "version": 1,
  "siteCode": "CD01",
  "updatedAt": "2026-08-13T10:00:00+08:00",
  "tables": {
    "tbl_file_1_a": {
      "lastId": 125800,
      "lastSuccessAt": "2026-08-13T10:00:00+08:00",
      "rowsPushed": 125800
    },
    "tbl_folder_1": {
      "lastId": 3200,
      "lastSuccessAt": "2026-08-13T09:58:00+08:00",
      "rowsPushed": 3200
    }
  }
}
```

### 6.2 规则

1. 每张物理表一条进度；`lastId` 空间互相独立。
2. 仅 `_bulk` 成功后更新该表 `lastId` / `lastSuccessAt` / `rowsPushed`。
3. 失败不推进水位；下轮重试同一 `id` 窗口。
4. 写入采用原子替换：写临时文件 → `rename` 覆盖，避免写一半进程崩溃导致损坏。
5. `updatedAt` / `lastSuccessAt` 建议使用北京时间 ISO-8601（与业务侧其它 sync 日志一致即可）。

## 7. OpenSearch 文档契约

### 7.1 索引与文档 ID

| 项 | 值 |
|----|------|
| Index | `disc_file_index` |
| `_id` | `{siteCode}:{source_table}:{id}` |

示例：

- `CD01:tbl_file_1_a:125801`
- `CD01:tbl_folder_1:3201`

使用 `_bulk` 的 `index` 动作 + 固定 `_id`，保证重试幂等（同一文档覆盖，不产生重复文档）。

### 7.2 公共元数据（file / folder 均带）

| ES 字段 | 类型建议 | 来源 / 说明 |
|---------|----------|-------------|
| `source_site_id` | keyword | 配置中的 siteCode |
| `source_table` | keyword | 物理表名 |
| `source_record_id` | keyword | 源表 `id` 转 string |
| `volume_id` | long | 从表名解析 |
| `volume_type` | integer | `tbl_logical_volume.type`（1光盘 / 3硬盘 …） |
| `doc_type` | keyword | `file` 或 `folder` |
| `indexed_at` | date | **推送时刻**（运维用；勿写入 `create_date`） |
| `deleted` | boolean | 一期固定 `false`（预留删改；本期不做） |

### 7.3 file 文档字段

| ES 字段 | 类型建议 | 来源 |
|---------|----------|------|
| `file_name` | text + keyword | 表 |
| `file_size` | long | 表 |
| `folder_id` | long | 表 |
| `folder_path` | text + keyword | **推送时** `LEFT JOIN tbl_folder_{volumeId}`；`COALESCE(NULLIF(folder_path,''), name)`（空路径回退 name，兼容根目录 `name='/'`） |
| `hash` | keyword | 表 |
| `hash1` | keyword | 表 |
| `task_id` | keyword | 表（数值转 string；null 可省略或写空） |
| `items_id` | keyword | 表（转 string） |
| `create_date` | date | 表 datetime → ISO-8601（**源表时间**） |
| `status` | integer | 表 |
| `slot_id` | integer | 表（关联键） |
| `slot_order` | integer | **推送时** 仅光盘卷：`slot_id` Map ← `tbl_slots.slot_order`；硬盘为 null |
| `disc_side` | integer | **推送时** 仅光盘卷：Map ← `tbl_slots.disc_side`（0=A，1=B）；硬盘为 null |
| `magazine_rfid` | keyword | **推送时** 仅光盘卷：Map ← `tbl_magzines.RFID`；硬盘为 null（不推假托盘 RFID） |
| `device_ip` | keyword | **推送时** 光盘经 slots Map；硬盘经 hd_info→serial→slots→lib |
| `device_port` | keyword | 同上 |
| `serial_num` | keyword | **推送时** 仅硬盘卷：`tbl_hd_info.serial_num` |
| `content_type` | keyword | 表 |
| `extension` | keyword | 从 `file_name` 推导（无后缀则为 null） |

### 7.4 folder 文档字段

| ES 字段 | 类型建议 | 来源 |
|---------|----------|------|
| `folder_name` | text + keyword | 表字段 `name` |
| `folder_path` | text + keyword | 表；空则回退 `name`（与文件推送一致） |
| `disc_path` | text | 表 |
| `s_level` | integer | 表 |
| `parent` | long | 表 |
| `sum_files` | long | 表 |
| `files` | integer | 表 |
| `subs` | integer | 表 |

检索可用 `doc_type` 过滤；文件检索与目录定位共用同一索引。

### 7.5 Mapping 与 ensureIndex

业务侧首次推送前：

1. `HEAD /disc_file_index`（或不存在时）
2. `PUT /disc_file_index` 写入与上表一致的 mapping（snake_case）
3. 索引已存在时：`PUT /disc_file_index/_mapping` 补 `slot_order` / `disc_side` / `magazine_rfid` / `device_ip` / `device_port`

字段类型冲突时以本契约为准。不要用自动生成 `_id` 的单条 `POST /_doc` 作为生产写入方式。

### 7.6 Bulk 形态（示意）

```http
POST /_bulk
Content-Type: application/x-ndjson
```

```text
{"index":{"_index":"disc_file_index","_id":"CD01:tbl_file_1_a:125801"}}
{"source_site_id":"CD01","source_table":"tbl_file_1_a","source_record_id":"125801","volume_id":1,"doc_type":"file","file_name":"报告.pdf","file_size":1048576,"folder_id":789,"folder_path":"/归档/报告","hash":"...","hash1":"...","task_id":"1001","items_id":"2002","create_date":"2026-08-01T08:00:00.000Z","status":1,"slot_id":12,"slot_order":3,"disc_side":0,"magazine_rfid":"E200001122334455","device_ip":"10.186.1.21","device_port":"5000","content_type":"application/pdf","extension":"pdf","indexed_at":"2026-08-13T02:00:00.000Z","deleted":false}
{"index":{"_index":"disc_file_index","_id":"CD01:tbl_folder_1:3201"}}
{"source_site_id":"CD01","source_table":"tbl_folder_1","source_record_id":"3201","volume_id":1,"doc_type":"folder","folder_name":"归档","folder_path":"/归档","disc_path":"","s_level":1,"parent":0,"sum_files":0,"files":0,"subs":0,"indexed_at":"2026-08-13T02:00:00.000Z","deleted":false}
```

任一条目失败 → 整批视为失败 → **不**更新该表 `lastId`。

## 8. 失败重试与幂等

| 场景 | 行为 |
|------|------|
| SQL 成功、bulk 部分/全部失败 | 不推进水位；下轮同一窗口重推 |
| 进程崩溃在 rename 前 | 水位未更新；重推靠 `_id` 覆盖 |
| OpenSearch 短暂不可用 | 本轮跳过或失败退出；不影响小表 push-session |
| 新卷建表 | 自动发现，`lastId=0` 追赶 |

### 8.1 OpenSearch HTTP 鉴权

业务侧实现（MultimediumCentral `syncDB`）使用 **HTTP Basic Auth**：

| 配置 | 说明 |
|------|------|
| `opensearch.username` / `password` | 同时非空时，所有请求带 `Authorization: Basic ...` |
| `opensearch.requireAuth` | `true` 时强制必须配置账号密码（**生产建议开启**） |

联调环境可暂时关闭集群鉴权、账号密码留空且 `requireAuth=false`；上生产必须启用鉴权并配置账号密码。

## 9. 与总控硬边界

| 项 | 结论 |
|----|------|
| 推送脚本 / 水位 / `_bulk` | **仅业务系统（syncDB）** |
| 总控 R.85/R.86 pull、`file_index_jobs` | 历史样例，**不是**本生产推送路径 |
| 总控代码 | 本期不改造 search / es-client / FileIndexDocument |
| 总控仓产出 | 本契约 + roadmap 短链，供业务侧对照实现 |
| 小表 push-session | 见 [site-push-session-v1.md](./site-push-session-v1.md)；与本契约并行、互不替代 |

总控侧若已配置 `SEARCH_ES_URL` / `SEARCH_ES_INDEX=disc_file_index`，仅表示**可检索同一索引**；写入权责仍在业务侧。

### 9.1 与总控历史样例的差异（避免混用）

| 点 | 总控历史样例（R.85/R.86） | 本生产契约 |
|----|---------------------------|------------|
| 方向 | 中心 pull `SITE_DATABASE_URL` | 站点 syncDB push |
| 水位 | PG `file_index_jobs` | 本地 `es-push-progress.json` |
| 写入 | 多为单条 `POST /_doc`、自动 `_id` | `_bulk` + 确定性 `_id` |
| 字段 | camelCase / 字段有裁剪 | snake_case + 本节字段表 |
| 表范围 | 分类清单含 empty/error 等 | 仅 `tbl_logical_volume` → 存在的 `tbl_file_N_a` + `tbl_folder_N` |

## 10. 验收清单

业务侧实现后建议逐项核对：

1. **发现**：`tbl_logical_volume` 有新卷且物理表已建，下一轮自动纳入；进度 JSON 仅在首次成功进入推送时增加条目且 `lastId=0`。
2. **追赶**：某卷无新数据时，该表 `lastId` ≈ `SELECT MAX(id)`。
3. **增量**：插入更大 `id` 后，下一轮 ES 可按 `_id` 查到新文档。
4. **幂等**：人为把某表 `lastId` 回退再跑一轮，同一 `_id` 不产生重复 hits（count 不倍增）。
5. **时间**：文件文档 `create_date` 等于源行；`indexed_at` 可为推送时刻且可不同于 `create_date`。
6. **类型**：`doc_type=file` 与 `doc_type=folder` 均可检索；目录字段含 `folder_path` / `parent`。
7. **边界**：确认进程跑在 MultimediumCentral `syncDB`，总控仓无对应推送实现。

## 11. 已知限制（诚实标注）

一期仅 `id > lastId` 新增同步：

- 已索引行后续改 `status`、软删等 **不会**自动更新/删除 ES 文档。
- 对 `requirements.md` §4.1 而言，检索结果可能含过时状态 → 能力状态为 **`partial`**；删改同步另开二期。

## 12. 修订记录

| 版本 | 说明 |
|------|------|
| v1 | 首版：file `_a` + folder 按卷分表；JSON 水位；`disc_file_index`；业务侧实现 |
