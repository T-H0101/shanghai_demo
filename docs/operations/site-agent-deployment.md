# Site Agent Deployment

> R.19B 可部署 heartbeat client。当前不包含 package push 或 control adapter。

## 1. 安全边界

- Agent 部署在站点网络内，主动访问总控。
- 总控不连接生产站点数据库。
- `SITE_DATABASE_URL` 和 `SITE_AGENT_SECRET` 由站点 secret manager 或
  root-only 环境文件注入，不写入 Git。
- 日志只输出环境变量 key 引用、siteCode、版本和运行结果。
- 当前 control capability 全部为 `supported=false`，不能宣称真实控制。

## 2. 环境文件

以 `deploy/site-agent/site-agent.env.example` 为键清单，在站点创建:

```bash
sudo install -m 600 /dev/null /etc/unified-disc-site-agent.env
sudoedit /etc/unified-disc-site-agent.env
```

必须填写:

- `SITE_CODE`: 已存在于总控 `sync_sites`。
- `SITE_AGENT_ID`: 站点内唯一 Agent ID。
- `SITE_AGENT_VERSION`: 发布版本。
- `PLATFORM_URL`: 总控 HTTPS 地址。
- `SITE_DATABASE_URL`: 站点数据库连接，仅注入本机环境。
- `SITE_AGENT_SECRET`: 总控和站点共同配置的 HMAC secret。

## 3. 一次性验收

```bash
set -a
source /etc/unified-disc-site-agent.env
set +a
pnpm agent:site -- --once
```

成功日志必须包含 `heartbeat_recorded`，且不得出现数据库 URL 或 secret。

中心库验证:

```bash
docker exec unified_disc_postgres \
  psql -U unified -d unified_disc_platform \
  -c "SELECT site_code,agent_id,agent_version,reported_at,database_reachable FROM site_agent_runtime;"
```

网页验证: 打开 `/sync`，查看“每站点最新状态”中的 Site Agent 列。

## 4. systemd

```bash
sudo cp deploy/site-agent/unified-disc-site-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now unified-disc-site-agent
sudo systemctl status unified-disc-site-agent
```

日志:

```bash
journalctl -u unified-disc-site-agent -f
```

Agent 停止后，总控根据最后 heartbeat 时间显示 `stale` 或 `offline`，不能维持
假在线。

## 5. 当前未完成

- 真实小表 package push、重试和 spool。
- control poll/ack/result 和本地 adapter。
- CPU/内存/磁盘指标与自动告警。
- Docker 镜像交付。
