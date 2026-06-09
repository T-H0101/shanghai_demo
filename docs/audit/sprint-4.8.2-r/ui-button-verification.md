# UI 按钮触发 + Toast 文案验证 (Sprint 4.8.2-R)

> **Date**: 2026-06-09
> **Mode**: API 模式 (NEXT_PUBLIC_API_MODE=api)

## 按钮 handler 源码 (app/tasks/page.tsx:284-303)

```ts
const handleControlCommand = async (task, commandType, label, e?) => {
  e?.stopPropagation()
  if (!isApiMode) {
    toast({ title: "Mock 模式不支持", description: "请切换到 API 模式提交控制命令", variant: "destructive" })
    return
  }
  try {
    const res = await fetch("/api/control/commands", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceSiteId: task.siteCode,
        commandType,            // task_pause | task_resume | task_reset
        targetType: "task",
        targetId: task.id,
        payload: { taskNo, name, phase },
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || "提交失败")
    toast({
      title: `${label}命令已提交`,
      description: `「${task.name}」${label}命令已记录到控制队列, 等待站点拉取执行`,
    })
  } catch (err) {
    toast({ title: "提交失败", description: ..., variant: "destructive" })
  }
}
```

## API 模式校验 (Mock 模式阻断)
- ✅ 入口 guard: `if (!isApiMode) return toast(destructive)` — 防止 Mock 模式误用
- ✅ 后端校验: `POST /api/control/commands` 服务端再做 COMMAND_TYPES 白名单校验

## Toast 文案合规性
- ✅ 标题: `<label>命令已提交` (用"已提交"而非"已暂停", 不误导)
- ✅ 描述: `「<task.name>」<label>命令已记录到控制队列, 等待站点拉取执行` (明确"等待站点拉取")
- ✅ 错误: 走 `variant: "destructive"` 红色警示

## 按钮显示条件 (Tasks 表格操作列)
| 按钮 | phase 条件 | icon |
|---|---|---|
| 暂停 (Pause) | `scanning, preparing, splitting, packaging, verifying, writing` | Pause |
| 恢复 (Play) | `paused` | Play |
| 重置 (RotateCcw) | `pending, scanning, preparing, splitting, packaging, verifying, writing, paused` | RotateCcw |

## 按钮显示条件 (Tasks 详情抽屉)
| 按钮 | phase 条件 |
|---|---|
| 暂停 | running phases (in 操作组, 与标记完成/失败并列) |
| 恢复 | `paused` |
| 重置 | unfinished (非 completed/failed/paused) |

## 实测调用结果
- 暂停按钮 → POST /api/control/commands (commandType=task_pause) → ok=true
- 恢复按钮 → POST /api/control/commands (commandType=task_resume) → ok=true
- 重置按钮 → POST /api/control/commands (commandType=task_reset) → ok=true

## 视觉位置
- 表格操作列 (line 470-477): Eye / SkipForward / **Pause/Play/RotateCcw** / CheckCheck / XCircle / Download
- 详情抽屉 "任务操作" section (line 696-): 推进 / **暂停/恢复/重置** / 标记完成 / 标记失败 / 导出

## 结论
✅ UI 按钮接通 control_command 队列, 文案合规, API 模式 only
