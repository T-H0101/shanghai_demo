# Sprint 2B.1 测试计划

> 日期: 2026-05-29
> 目标: 验证 Docker PostgreSQL 17 中心库初始化与 Seed 数据插入

---

## 一、测试环境

### 1.1 前置条件

- Docker Desktop 已安装并运行
- PostgreSQL 17 容器可用
- 项目依赖已安装 (`pnpm install`)

### 1.2 预期工具

| 工具 | 用途 |
|------|------|
| `docker` | 容器管理 |
| `psql` | 数据库连接 |
| `curl` | API 测试 |
| `pnpm` | npm scripts |

---

## 二、测试用例

### 2.1 数据库启动测试

| 用例 ID | TC-DB-001 |
|---------|-----------|
| 名称 | PostgreSQL 容器启动 |
| 步骤 | `pnpm db:up` |
| 预期 | 容器状态为 `running (healthy)` |
| 验证 | `docker compose ps` |

### 2.2 Schema 初始化测试

| 用例 ID | TC-DB-002 |
|---------|-----------|
| 名称 | 执行 DDL 脚本 |
| 步骤 | `pnpm db:init` |
| 预期 | 所有表创建成功，无报错 |
| 验证 | `\dt` 显示 13 张表 |

### 2.3 Seed 数据测试

| 用例 ID | TC-DB-003 |
|---------|-----------|
| 名称 | Seed 数据插入 |
| 步骤 | `pnpm db:seed` |
| 预期 | 数据插入成功，记录数符合预期 |
| 验证 | 各表记录数与设计一致 |

### 2.4 db-health API 测试

| 用例 ID | TC-API-001 |
|---------|-----------|
| 名称 | 数据库健康检查 |
| 步骤 | `curl http://localhost:3000/api/system/db-health` |
| 预期 | 返回 healthy 状态 |
| 验证 | `status: "healthy"`, `connected: true` |

### 2.5 db-summary API 测试

| 用例 ID | TC-API-002 |
|---------|-----------|
| 名称 | 数据库统计查询 |
| 步骤 | `curl http://localhost:3000/api/system/db-summary` |
| 预期 | 返回各表记录数 |
| 验证 | counts 对象包含 6 个键值对 |

### 2.6 重复执行测试

| 用例 ID | TC-DB-004 |
|---------|-----------|
| 名称 | Seed 重复执行 |
| 步骤 | `pnpm db:seed` 再次执行 |
| 预期 | 不报错（ON CONFLICT DO NOTHING） |
| 验证 | 记录数不变 |

---

## 三、执行步骤

### 3.1 启动数据库

```bash
# 启动 PostgreSQL
pnpm db:up

# 等待健康（10-30秒）
sleep 30
pnpm db:health
```

### 3.2 初始化 Schema

```bash
# 执行初始化（包含 seed）
pnpm db:init
```

### 3.3 启动开发服务器

```bash
# 新终端窗口
pnpm dev
```

### 3.4 测试 API

```bash
# 健康检查
curl http://localhost:3000/api/system/db-health

# 统计查询
curl http://localhost:3000/api/system/db-summary
```

### 3.5 清理

```bash
# 停止容器（保留数据）
pnpm db:down

# 或完全清理
pnpm db:down:volumes
```

---

## 四、预期结果

### 4.1 成功标准

| 检查项 | 预期 |
|--------|------|
| 容器启动 | ✅ running (healthy) |
| 表创建 | ✅ 13 张表存在 |
| Seed 插入 | ✅ 数据可查询 |
| db-health | ✅ status: healthy |
| db-summary | ✅ counts 正确 |
| build | ✅ tsc/build 无报错 |

### 4.2 失败处理

| 失败项 | 可能原因 | 处理方式 |
|--------|----------|----------|
| 容器无法启动 | Docker 未运行 | 启动 Docker Desktop |
| 端口冲突 | 5432 被占用 | 检查 `lsof -i :5432` |
| 连接失败 | 密码错误 | 检查 docker-compose.yml |
| API 报错 | 环境变量缺失 | 确认 .env.local |

---

## 五、回归检查

执行完测试后，运行以下命令确保没有破坏现有功能：

```bash
# 代码检查
pnpm lint

# 构建检查
pnpm build

# 现有功能验证
curl http://localhost:3000/api/system/health
```

---

## 六、测试记录

| 测试项 | 执行时间 | 结果 | 备注 |
|--------|----------|------|------|
| TC-DB-001 | - | - | - |
| TC-DB-002 | - | - | - |
| TC-DB-003 | - | - | - |
| TC-DB-004 | - | - | - |
| TC-API-001 | - | - | - |
| TC-API-002 | - | - | - |
| lint | - | - | - |
| build | - | - | - |

---

*Test plan created: 2026-05-29*