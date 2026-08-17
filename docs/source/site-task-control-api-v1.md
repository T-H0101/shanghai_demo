# 总控 → 站点任务控制（经 MultimediumNw，与 SSO / 立即推送同入口）

> **不另开端口。** 走站点业务 Web（`sync_sites.db_host:db_port`），与 `unified-sso/consume`、`unified-sync/trigger` 一致。  
> **不部署 Site Agent。** 站点只有业务系统；总控同步直调站点 HTTP。

## 调用链

```text
总控 UI 暂停/重置
  → POST /api/control/commands（总控）
  → 查 sync_sites.db_host:db_port
  → POST http://{db_host}:{db_port}/unified-task-control
  → MultimediumNw（验 SITE_SSO 同源密钥）
  → TCP request: center_task_pause | center_task_reset | center_task_continue
  → MultimediumCentral：查实时 tbl_task 预检 → 原 pauseTask / resetTask / continueTask
  → 总控写 control_command 审计 + 回写 unified_tasks 状态（减少展示滞后）
```

与立即推送一致：总控主动 HTTP 通知站点，**不是** Agent 拉 `control_command` 队列。

## HTTP（Nw）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/unified-task-control` | 任务控制入口 |

鉴权头（二选一，值与 `unifiedDiscSso.secretKey` / 总控 `SITE_SSO_SECRET` 一致）：

- `x-unified-task-control-secret`
- `x-unified-sync-secret`（兼容立即推送同一密钥）

Body：

```json
{
  "action": "pause | reset | continue",
  "taskId": 123,
  "siteCode": "SH01",
  "requestedBy": "admin",
  "fromBlue": false
}
```

### 预检拒绝（站点实时状态，常见因总控滞后）

| reasonCode | 含义 |
|---|---|
| `TASK_ALREADY_FINISHED` | 已结束，未执行 |
| `ALREADY_PAUSED` | 已暂停 |
| `NOT_ALLOWED` | 当前状态不允许 |
| `USE_RESET_INSTEAD` | 请用重置并继续 |
| `CENTRAL_UNREACHABLE` | Nw 连不上 Central TCP |

业务语义：暂停成功后 **`tbl_task.status=20` 立即变更**；当前盘可继续跑完，下一张盘起停。总控列表在站点成功后会把中心 `unified_tasks` 标为 `paused`，无需等下一轮推送。

## 总控配置

| 环境变量 | 说明 |
|---|---|
| `SITE_SSO_SECRET` 或 `SITE_SYNC_TRIGGER_SECRET` | 与 Nw `unifiedDiscSso.secretKey` 一致 |
| `SITE_TASK_CONTROL_BASE_URL` | 可选覆盖整站基址 |
| `SITE_TASK_CONTROL_BASE_URL_<SITE>` | 按站点覆盖，如 `SITE_TASK_CONTROL_BASE_URL_SH01` |
| `SITE_TASK_CONTROL_PATH` | 默认 `/unified-task-control` |

生产主路径：**站点推送登记的 `sync_sites.db_host` / `db_port`**（与 SSO、立即推送相同）。  
env 覆盖仅用于联调。

总控映射：`task_pause`→`pause`；`task_resume` / `task_reset`→`reset`（业务「重置任务状态并继续任务」）。

## Central（仅 TCP，无独立 HTTP 端口）

总控交互集中在单一服务文件：`controllers/unified_disc_center_service.js`（立即推送 + 任务控制）。

| request | 说明 |
|---|---|
| `syncDB_triggerPush` | 立即触发 syncDB 推送 |
| `center_task_pause` | 预检 + pauseTask |
| `center_task_reset` | 预检 + resetTask |
| `center_task_continue` | 预检 + continueTask |

由 Nw 转发调用；**不要**再起独立 HTTP 端口。
