# R.18 Control Capability Matrix

> 对应 requirements §4.2。当前决策允许 Site Agent 主动轮询并在站点本地执行。

| 动作 | 官方依据 | 当前代码 | 生产 Agent 状态 | Blocker | 验收条件 |
|---|---|---|---|---|---|
| pause | `tbl_task.status=20` | 测试执行器可写 | R.22 实现 | Site Agent 未部署 | poll/ack/local update/result/resync/UI |
| resume | `tbl_task.status=0` | 测试执行器可写 | R.22 实现 | 需任务类型和前态校验 | 同上 |
| reset | `status=1,burn_status=0` 与官方重置语义不一致 | 测试 workaround | unsupported | 官方语义缺失 | 站点提供正式 API/状态机 |
| priority restore | requirements 要求 | commandType 存在 | unsupported | `tbl_task.priority` 不存在 | DDL/API + 调度行为 + result |
| inspect | 巡检候选表存在 | unsupported 路径存在 | unsupported | 缺 `source_id/verify_result/checksum` 和站点流程 | DDL/API + SM3 + 状态回传 |
| recovery | 热恢复候选表存在 | unsupported 路径存在 | unsupported | 缺关联字段和站点流程 | DDL/API + 进度回传 |
| create backup | requirements 要求 | 无真实创建 API | R.23 | 站点任务创建契约缺失 | Agent 创建 + source id + 同步回读 |
| create restore | requirements 要求 | 无真实创建 API | R.23 | 同上 | 同上 |

## 生产控制状态机

```text
pending
  -> pulled
  -> running
  -> success | failed | unsupported
```

- `pulled`: Agent 已领取。
- `running`: Agent 已 ack，正在本地执行。
- `success`: 本地执行完成且 result 回传，不能由总控推断。
- `failed`: 执行失败，必须有错误码和错误信息。
- `unsupported`: capability/schema/API 不支持，不允许伪造 success。

## 幂等

- `commandId` 是 Agent 本地幂等键。
- 重复 poll 不重复执行。
- 重复 result 不改变已有终态。
- Agent 重启后从本地执行记录恢复。

## UI 规则

- capability 未验证时按钮 disabled 或明确显示 blocked。
- toast 必须区分“命令已提交”和“站点执行完成”。
- 默认 DRY_RUN 结果不得显示为实际站点状态。
- 最终状态必须来自 Agent result 加同步回读。
