# 同步测试与自动化说明

## 模式说明

- `NEXT_PUBLIC_API_MODE=api`：Tasks、Racks、Volumes 读取中心 API，失败时保留 mock fallback。
- `NEXT_PUBLIC_API_MODE=mock`：页面只使用 mock provider，不请求真实数据 API。
- `/sync` 始终读取 `/api/sync/packages` 与表级日志接口。
- API 模式目前只支持设备数据展示；设备控制、挂载、介质写入和设备任务创建接口尚未接入，前端会明确提示。

## 手工同步

小表人工回归命令：

```bash
pnpm import:tasks
pnpm import:devices
pnpm import:discs
pnpm import:volumes
pnpm import:hard-disks
```

文件索引只能按任务受控执行，不得加入默认全量同步：

```bash
pnpm import:file-index -- <siteCode> <taskId> --from-id 0 --limit 1000
```

## Package 同步

站点向总控发送：

```http
POST /api/sync/package
Content-Type: application/json
```

当前白名单为已接入的 10 张小表。`tbl_file`、`tbl_folder` 禁止进入 package 全量同步。

处理结果写入：

- `sync_package_log`：包级状态、批次、站点、记录数。
- `sync_table_log`：表级状态、处理数、失败原因。

可在 `/sync` 或以下接口查看：

```text
GET /api/sync/packages
GET /api/sync/packages/{packageId}/tables
```

## 一键 Smoke Test

```bash
pnpm smoke:sync
```

脚本直接调用现有 package route/service 链路，不依赖浏览器或 dev server，验证：

1. 中心库为 `unified_disc_platform`。
2. 核心业务表和同步日志表存在。
3. `TEST_SMOKE` 的任务、设备各 1 条可以 UPSERT。
4. package log 和两条 table log 写入成功。
5. 相同 `batchId` 再次执行返回 `duplicated`。

脚本不读取或写入 `tbl_file`、`tbl_folder`，不触发 `import:all`。

## 每小时同步设计

1. 站点侧 cron 每小时执行小表导出、打包并调用 `POST /api/sync/package`。
2. 总控不主动直连或拉取站点数据库。
3. 总控接口负责校验、幂等判断、分表入库和日志记录。
4. 后续如增加中心调度，也只能调用站点导出接口，不直接操作站点数据库。
5. 开发环境使用 `pnpm smoke:sync` 验证接收、入库、日志和幂等链路。

## 已知限制

- 真实设备控制 API 未接入；API 模式下操作按钮只提示，不会伪造成功结果。
- `/volumes` 业务页面尚不存在，当前仅提供 `/api/volumes`。
- package checksum 当前保留字段，尚未实现严格 SHA-256 比对。
