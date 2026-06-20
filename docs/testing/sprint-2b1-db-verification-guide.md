# Sprint 2B.1 数据库本地验证流程

> 日期: 2026-05-29
> 目标: 验证 Docker PostgreSQL 17 本地中心库初始化成功
> 适用场景: 开发者本地环境首次配置、验证环境正常

---

## 一、前置条件

### 1.1 必需条件

| 条件 | 验证方式 | 说明 |
|------|----------|------|
| Docker Desktop 已启动 | `docker info` | 无报错即可 |
| 项目依赖已安装 | `pnpm install` | 确保 node_modules 存在 |
| `.env.local` 已配置 | `cat .env.local` | 包含 DATABASE_URL |
| Docker 容器已启动 | `docker ps` | 能看到 unified_disc_postgres |

### 1.2 不需要安装

- ❌ PostgreSQL（Docker 容器自带）
- ❌ psql 客户端（容器内已安装）
- ❌ 其他数据库工具

> **注意**: 本文档所有数据库操作都使用 Docker 容器内的 psql，不需要本机安装任何 PostgreSQL 客户端。

---

## 二、.env.local 配置

### 2.1 创建 .env.local

```bash
# 项目根目录
cat > .env.local << 'EOF'
# API Mode Configuration
NEXT_PUBLIC_API_MODE=mock

# PostgreSQL 数据库配置（仅后端 API 使用）
DATABASE_URL=postgresql://<center_user>:<center_password>@localhost:5432/unified_disc_platform
EOF
```

### 2.2 配置说明

| 配置项 | 说明 |
|--------|------|
| `NEXT_PUBLIC_API_MODE=mock` | 页面使用 mock 数据，不走后端 API |
| `DATABASE_URL` | 后端 API 连接 PostgreSQL 使用 |

### 2.3 注意事项

- `.env.local` **不要提交到 git**（包含密码）
- `.gitignore` 已配置忽略 `.env.local`
- **`DATABASE_URL` 不要以 `NEXT_PUBLIC_` 开头**，前端页面通过 API 层访问数据库，不直接连接

---

## 三、启动 PostgreSQL

### 3.1 一键启动

```bash
pnpm db:up
```

### 3.2 验证容器状态

```bash
docker compose ps
```

**期望输出:**
```
NAME                 STATUS           PORTS
unified_disc_postgres   running (healthy)   0.0.0.0:5432->5432/tcp
```

### 3.3 查看日志（可选）

```bash
pnpm db:logs
# 或
docker compose logs postgres --tail=20
```

---

## 四、初始化中心库

### 4.1 背景说明

Sprint 2B.1 之前的 `pnpm db:init` 依赖本机安装的 `psql` 客户端。
如果本机没有安装 psql，会报错：
```
psql: command not found
```

**解决方案**: 使用 Docker 容器内的 psql，不要求本机安装。

### 4.2 初始化步骤

**步骤 1: 执行 schema（创建表结构）**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2b0/unified_schema.sql
```

**步骤 2: 执行 seed（插入初始数据）**

```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2b1/seed.sql
```

### 4.3 使用 npm scripts（推荐）

```bash
# 初始化 schema + seed（自动使用 Docker psql）
pnpm db:init

# 如需重置数据库后重新初始化
pnpm db:init:reset
```

### 4.4 验证初始化成功

```bash
# 查看表列表
docker exec unified_disc_postgres psql -U unified -d unified_disc_platform -c "\dt"
```

**期望输出:**
```
                  List of relations
 Schema |            Name             |   Type   | Owner
--------+------------------------------+----------+-------
 public | sites                      | table    | unified
 public | sync_job_log               | table    | unified
 public | sync_progress              | table    | unified
 public | sync_sites                 | table    | unified
 public | unified_alerts             | table    | unified
 public | unified_device_groups      | table    | unified
 public | unified_devices            | table    | unified
 public | unified_drivers           | table    | unified
 public | unified_hard_disks        | table    | unified
 public | unified_magazines         | table    | unified
 public | unified_slots             | table    | unified
 public | unified_tasks             | table    | unified
 public | unified_users            | table    | unified
 public | unified_volumes           | table    | unified
(14 rows)
```

---

## 五、启动项目

```bash
pnpm dev
```

等待启动完成，访问 http://localhost:3000

---

## 六、API 验证

### 6.1 健康检查

```bash
curl http://localhost:3000/api/system/health
```

**期望响应:**
```json
{
  "service": "optical-disc-management",
  "status": "ok",
  "timestamp": "2026-05-29T...",
  "version": "1.0.0",
  "checks": {
    "api": "ok",
    "memory": "ok"
  }
}
```

### 6.2 数据库健康检查

```bash
curl http://localhost:3000/api/system/db-health
```

**期望响应:**
```json
{
  "service": "db-health",
  "timestamp": "2026-05-29T...",
  "database": {
    "status": "healthy",
    "connected": true,
    "latencyMs": 5,
    "pool": {
      "total": 1,
      "idle": 1,
      "waiting": 0
    }
  }
}
```

### 6.3 数据库统计

```bash
curl http://localhost:3000/api/system/db-summary
```

**期望响应:**
```json
{
  "status": "ok",
  "connected": true,
  "timestamp": "2026-05-29T...",
  "counts": {
    "sites": 2,
    "syncSites": 2,
    "tasks": 3,
    "devices": 3,
    "volumes": 3,
    "alerts": 2
  }
}
```

---

## 七、进入数据库查看

### 7.1 连接数据库

```bash
docker exec -it unified_disc_postgres psql -U unified -d unified_disc_platform
```

### 7.2 常用 SQL

**查看所有表:**
```sql
\dt
```

**查看站点:**
```sql
SELECT * FROM sites;
```

**查看任务（带来源标识）:**
```sql
SELECT id, source_site_id, task_name, status FROM unified_tasks;
```

**查看设备（带来源标识）:**
```sql
SELECT id, source_site_id, device_name, status FROM unified_devices;
```

**查看存储卷:**
```sql
SELECT id, source_site_id, volume_name, volume_type, status FROM unified_volumes;
```

**查看告警:**
```sql
SELECT id, source_site_id, alert_level, message, status FROM unified_alerts;
```

### 7.3 退出

```sql
\q
```

---

## 八、常见问题

### 8.1 psql 未安装

**问题:**
```
psql: command not found
```

**原因:** 本机没有安装 PostgreSQL 客户端

**解决:** 使用 Docker 容器内的 psql：
```bash
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < seed.sql
```

---

### 8.2 Docker 未启动

**问题:**
```
Cannot connect to the Docker daemon
```

**原因:** Docker Desktop 未运行

**解决:**
1. 打开 Docker Desktop 应用
2. 等待状态栏显示 "Docker Desktop is running"
3. 重试 `pnpm db:up`

---

### 8.3 5432 端口占用

**问题:**
```
Bind for 0.0.0.0:5432 failed: port is already allocated
```

**原因:** 其他 PostgreSQL 实例占用了端口

**解决:**
```bash
# 检查占用端口的进程
lsof -i :5432

# 停止其他 PostgreSQL 实例
# 或修改 docker-compose.yml 中的端口映射为 5433:5432
```

---

### 8.4 .env.local 缺失

**问题:**
```
error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

**原因:** DATABASE_URL 未设置

**解决:**
```bash
cp .env.example .env.local
# 确认 .env.local 包含 DATABASE_URL
cat .env.local | grep DATABASE_URL
```

---

### 8.5 db-health unhealthy

**问题:**
```json
{
  "database": {
    "status": "unhealthy",
    "connected": false
  }
}
```

**原因:**
- Docker 容器未启动
- DATABASE_URL 配置错误
- 数据库密码错误

**解决:**
1. 检查容器: `docker ps | grep postgres`
2. 检查 .env.local: `cat .env.local | grep DATABASE_URL`
3. 重启容器: `pnpm db:down && pnpm db:up`

---

### 8.6 seed 重复执行

**问题:** 重复执行 seed.sql 会不会插入重复数据？

**答案:** 不会

**原因:** seed.sql 使用 `ON CONFLICT DO NOTHING`，是幂等操作

```sql
INSERT INTO sites (site_code, site_name, ...)
VALUES ('SH01', '上海数据中心A', ...)
ON CONFLICT (site_code) DO NOTHING;
```

**验证:**
```bash
# 第一次执行
pnpm db:init

# 第二次执行（不会重复插入）
pnpm db:seed
```

---

## 九、当前阶段说明

### 9.1 已完成的工作

| 项目 | 状态 | 说明 |
|------|------|------|
| Docker PostgreSQL 17 | ✅ | 本地开发环境 |
| 中心库 Schema | ✅ | 14 张表 |
| Seed 数据 | ✅ | 15 条记录 |
| db-health API | ✅ | 健康检查 |
| db-summary API | ✅ | 统计查询 |
| 文档 | ✅ | Sprint 2B.1 完成 |

### 9.2 当前状态

- ✅ 本地中心库初始化成功
- ✅ API 可以读取数据库
- ❌ 没有连接真实源库
- ❌ 没有同步真实业务数据
- ✅ 页面仍然可以使用 mock 数据

### 9.3 下一步

**Sprint 2B.2**: 数据同步服务

- 设计同步服务架构
- 实现第一个小表的同步逻辑
- 使用 seed 数据测试同步流程
- 暂不连接真实源库

---

## 十、快速验证清单

| 步骤 | 命令 | 期望结果 |
|------|------|----------|
| 1. 启动 Docker | `pnpm db:up` | postgres healthy |
| 2. 初始化数据库 | `pnpm db:init` | 14 表 + 15 数据 |
| 3. 启动项目 | `pnpm dev` | localhost:3000 可访问 |
| 4. 健康检查 | `curl .../health` | status: ok |
| 5. 数据库检查 | `curl .../db-health` | connected: true |
| 6. 统计检查 | `curl .../db-summary` | counts 有数据 |

---

*文档创建: 2026-05-29*
*Sprint 2B.1 - Docker PostgreSQL 本地中心库验证*
