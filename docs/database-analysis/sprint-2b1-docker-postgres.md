# Sprint 2B.1 Docker PostgreSQL 本地开发环境

> 日期: 2026-05-29
> 目标: 使用 Docker 启动本地 PostgreSQL 17，作为统一平台中心库验证环境

---

## 一、前提条件

### 1.1 安装 Docker Desktop

**macOS:**
```bash
# 使用 Homebrew 安装
brew install --cask docker

# 或从官网下载
# https://www.docker.com/products/docker-desktop/
```

**验证安装:**
```bash
docker --version
docker compose version
```

### 1.2 启动 Docker Desktop

在应用程序中启动 Docker Desktop，等待状态栏显示 Docker 运行中。

---

## 二、启动 PostgreSQL

### 2.1 一键启动

```bash
# 启动 PostgreSQL 17
pnpm db:up

# 或使用 docker compose
docker compose up -d postgres
```

### 2.2 验证容器状态

```bash
# 查看容器状态
docker compose ps

# 查看健康状态
pnpm db:health

# 或查看日志
pnpm db:logs
```

**预期输出:**
```
NAME                 STATUS
unified_disc_postgres   running (healthy)
```

---

## 三、配置环境变量

### 3.1 创建 .env.local

```bash
# 项目根目录创建 .env.local
cat > .env.local << EOF
DATABASE_URL=postgresql://unified:unified123@localhost:5432/unified_disc_platform
EOF
```

### 3.2 验证配置

```bash
# 查看环境变量是否生效
grep DATABASE_URL .env.local
```

**注意:**
- `.env.local` 不要提交到 git（包含密码）
- `.env.example` 是示例文件，可以安全提交

---

## 四、初始化中心库 Schema

### 4.1 执行初始化脚本

```bash
# 使用 npm script
pnpm db:init

# 或手动指定连接字符串
bash databases/sprint-2b0/init.sh -d 'postgresql://unified:unified123@localhost:5432/unified_disc_platform'
```

### 4.2 验证表创建

```bash
# 连接数据库查看表
psql 'postgresql://unified:unified123@localhost:5432/unified_disc_platform' -c "\dt"
```

**预期输出:**
```
                    List of relations
 Schema |            Name             |   Type   | Owner
--------+------------------------------+----------+-------
 public | sync_job_log               | table    | unified
 public | sync_progress              | table    | unified
 public | sync_sites                 | table    | unified
 public | sites                      | table    | unified
 public | unified_alerts            | table    | unified
 public | unified_devices           | table    | unified
 public | unified_drivers           | table    | unified
 public | unified_hard_disks        | table    | unified
 public | unified_magazines        | table    | unified
 public | unified_slots            | table    | unified
 public | unified_tasks            | table    | unified
 public | unified_users            | table    | unified
 public | unified_volumes          | table    | unified
(13 rows)
```

---

## 五、验证数据库连接

### 5.1 启动开发服务器

```bash
pnpm dev
```

### 5.2 测试健康检查接口

```bash
# 测试基础健康检查
curl http://localhost:3000/api/system/health

# 测试数据库健康检查
curl http://localhost:3000/api/system/db-health
```

**预期响应 (db-health):**
```json
{
  "service": "db-health",
  "timestamp": "2026-05-29T...",
  "database": {
    "status": "healthy",
    "connected": true,
    "latencyMs": 5,
    "pool": { "total": 1, "idle": 1, "waiting": 0 }
  }
}
```

---

## 六、停止和清理

### 6.1 停止容器

```bash
# 停止容器（保留数据卷）
pnpm db:down

# 或使用 docker compose
docker compose down
```

### 6.2 完全清理

```bash
# 停止容器并删除数据卷（清除所有数据）
docker compose down -v

# 或使用 npm script
pnpm db:down:volumes
```

### 6.3 查看日志

```bash
# 实时查看日志
docker compose logs -f postgres

# 或使用 npm script
pnpm db:logs
```

---

## 七、常见问题

### 7.1 Docker 启动失败

**问题:** `Cannot connect to the Docker daemon`

**解决:**
1. 确保 Docker Desktop 已启动
2. 点击 Docker Desktop 图标，等待状态变为"running"
3. 重试 `pnpm db:up`

### 7.2 端口冲突

**问题:** `Bind for 0.0.0.0:5432 failed: port is already allocated`

**解决:**
1. 检查是否有其他 PostgreSQL 实例占用端口
```bash
lsof -i :5432
```
2. 停止其他 PostgreSQL 实例
3. 或修改 docker-compose.yml 中的端口映射

### 7.3 连接被拒绝

**问题:** `could not connect to server: Connection refused`

**解决:**
1. 确保容器正在运行: `docker compose ps`
2. 等待 healthcheck 通过（容器启动需要 10-30 秒）
3. 验证 DATABASE_URL 配置正确

### 7.4 数据库连接超时

**问题:** `connection timeout`

**解决:**
1. 检查 Docker 是否正常运行
2. 等待容器 healthcheck 变为 healthy
3. 检查防火墙设置

### 7.5 数据丢失

**问题:** 重启后数据不见了

**解决:**
- 使用 `docker compose down` 而非 `docker compose down -v`
- `-v` 参数会删除数据卷，导致数据丢失

---

## 八、完整工作流

```bash
# 1. 启动 PostgreSQL
pnpm db:up

# 2. 等待容器健康（10-30秒）
sleep 30
pnpm db:health

# 3. 初始化 Schema（首次）
pnpm db:init

# 4. 配置环境变量
echo "DATABASE_URL=postgresql://unified:unified123@localhost:5432/unified_disc_platform" > .env.local

# 5. 启动开发服务器
pnpm dev

# 6. 验证连接
curl http://localhost:3000/api/system/db-health

# 7. 完成后停止
pnpm db:down
```

---

## 九、Sprint 2B.1 约束遵守

| 约束 | 状态 |
|------|------|
| 不连接真实源库 | ✅ |
| 不同步真实数据 | ✅ |
| 不改页面 UI | ✅ |
| 不替换 API 数据源 | ✅ |
| 不提交真实密码 | ✅ (使用 .env.local) |
| 不处理大表 | ✅ |

---

*Report updated: 2026-05-29*