# Site Agent Web Acceptance Guide

> R.18 文档基线。R.19 实现后按本指南进行真实网页验收。

## 1. 环境

```bash
pnpm db:up
set -a && source .env.local && set +a
pnpm dev
```

另开终端启动 Site Agent:

```bash
set -a && source .env.local && set +a
pnpm agent:site -- --siteCode=SH01
```

浏览器打开 `http://localhost:3000`。

## 2. Sites 页面

打开 `/sites`，验证:

1. SH01 显示 Agent online/offline/stale。
2. 显示 Agent version、last heartbeat、database reachable。
3. Agent 停止超过阈值后变为 stale/offline，不保持假在线。
4. 页面不显示数据库 URL、密码、secret。
5. 刷新按钮触发真实 API。

API:

```bash
curl -s http://localhost:3000/api/sync/sites/status | jq
```

数据库:

```bash
docker exec unified_disc_postgres \
  psql -U unified -d unified_disc_platform \
  -c "SELECT site_code, agent_id, agent_version, reported_at FROM site_agent_runtime;"
```

## 3. Sync Center

打开 `/sync`，验证:

1. SH01 最近 package、scheduler、consistency 记录可见。
2. Agent 断网时显示失败或过期，不显示 success。
3. package table log 与实际白名单一致。
4. `tbl_file/tbl_folder` 不出现在 package 表列表。
5. 导出按钮下载真实日志内容。

API:

```bash
curl -s "http://localhost:3000/api/sync/packages?siteCode=SH01&limit=5" | jq
curl -s "http://localhost:3000/api/sync/consistency?siteCode=SH01" | jq
```

## 4. Tasks 控制

打开 `/tasks`，选择真实 SH01 任务:

1. 点击暂停后先显示“命令已提交”，不能立即显示“已暂停”。
2. `/control` 能看到 pending -> pulled -> running -> success/failed。
3. success 时数据库 before/after 为 `status -> 20`。
4. Agent result 后触发任务同步，`/tasks` 最终显示 paused。
5. resume 重复相同步骤，最终状态取决于站点回写。
6. reset/priority/inspect/recovery 未支持时必须 disabled 或 unsupported。

数据库:

```bash
docker exec unified_disc_postgres \
  psql -U unified -d unified_disc_platform \
  -c "SELECT command_no,command_type,status,result,error_message FROM control_command ORDER BY created_at DESC LIMIT 10;"

docker exec site_restore_full_postgres \
  psql -U postgres -d star_storage_db \
  -c "SELECT id,status,update_dt FROM tbl_task WHERE id=<TASK_ID>;"
```

## 5. 浏览器证据

每次验收记录:

- 页面 URL。
- 点击元素 selector。
- 点击前状态。
- 请求 method/endpoint/payload。
- HTTP 状态和关键字段。
- 站点数据库 before/after。
- 中心数据库 command/audit/sync 结果。
- 页面最终状态和 toast。
- mock/DRY_RUN 标记。
- 截图路径。

## 6. 自动化

```bash
pnpm e2e:sites
pnpm e2e:sync
pnpm e2e:tasks
pnpm e2e:control
pnpm e2e:site-agent
pnpm e2e:all
```

自动化通过不能替代真实浏览器查看；真实浏览器查看也不能替代数据库和 API 证据。
