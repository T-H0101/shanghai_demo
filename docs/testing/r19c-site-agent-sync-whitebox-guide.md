# R.19C Site Agent 同步白盒测试

## 前提

- Next.js 服务运行在 `BASE_URL`，默认 `http://localhost:3000`。
- `.env.local` 配置中心 `DATABASE_URL`、完整测试站点 `SITE_DATABASE_URL` 和 `SYNC_PACKAGE_SECRET`。
- `SITE_DATABASE_URL` 必须指向完整 `star_storage_db`，不能用 13 表 `source_restore` 代替需求证据。

## 定向测试

```bash
set -a && source .env.local && set +a
pnpm e2e:site-agent-sync-core
pnpm e2e:site-agent-sync
pnpm e2e:site-agent
SITE_AGENT_STATE_DIR="$(mktemp -d)" pnpm e2e:site-agent-client
```

覆盖:

- 稳定 SHA-256、原子 state/spool、损坏状态 fail closed；
- 13 表白名单和 `tbl_file/tbl_folder` 拒绝；
- `tbl_task` 真实增量读取；
- package HMAC、HTTP 结果分类；
- 失败不推进 watermark、恢复优先补传；
- 13 表真实 bootstrap、无变化跳过、离线恢复和 batch 幂等；
- heartbeat 的 `lastSyncAt`、`spoolDepth` 真值。

测试使用唯一 `siteCode` 写中心库，并在 `finally` 清理对应中心数据；不修改站点源数据。

## 强制验证

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
```

任一命令失败不得提交。
