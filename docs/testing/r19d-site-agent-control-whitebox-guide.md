# R.19D Site Agent 控制白盒测试

## 前置条件

- 总控：`http://localhost:3000`
- 中心库：`DATABASE_URL`
- 测试恢复库：`SITE_DATABASE_URL`
- `SH01` 已存在于 `sync_sites`
- `.env.local` 已配置 HMAC secret，但不要把值写入文档或 Git

启动服务时让 Next 自己加载 `.env.local`：

```bash
pnpm dev
```

## 一键验证

```bash
set -a && source .env.local && set +a
pnpm e2e:site-agent-control-core
pnpm e2e:site-agent-control
pnpm e2e:tasks
pnpm e2e:site-agent
pnpm e2e:site-agent-client
```

`e2e:site-agent-control` 会自动：

1. 在恢复库插入唯一测试任务，初始状态 19。
2. 创建 pause command。
3. 运行一次独立 Agent。
4. 验证源库 19→20、中心 command success、audit、同步回读 paused。
5. 创建 resume command。
6. 使用同一 Agent state dir 再运行一次。
7. 验证源库 20→19，不恢复为猜测值 0。
8. 清理本次任务、命令、审计和同步日志。

## 节点创建跳转

当前 `.env.local` 默认：

```env
SITE_NODE_TASK_CREATE_URL_SH01=
```

因此 Tasks 页按钮应禁用并显示“节点任务创建地址未配置”。获得节点地址后只需设置该键并重启服务，不改代码。

## 边界

- 这是恢复库白盒验收，不是生产站点部署证据。
- reset/priority/inspect/recovery 仍未实现。
- 旧 `/api/control/commands/[id]/execute` 和 DRY_RUN worker 仅保留历史兼容测试，Tasks UI 不再调用。
