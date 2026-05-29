# Sprint 2B.3 测试计划

> 日期: 2026-05-30
> 目标: 验证同步状态与日志查询接口

## 一、测试环境

- 数据库: Docker PostgreSQL (unified_disc_postgres)
- 开发服务器: pnpm dev
- API Base: http://localhost:3000

## 二、测试用例

### 2.1 GET /api/sync/status

| ID | 测试项 | 命令 | 期望结果 |
|----|--------|------|----------|
| S1 | 全量查询 | `curl /api/sync/status` | data 数组非空 |
| S2 | 站点过滤 | `curl "?site=SH01"` | 只含 SH01 |
| S3 | 表过滤 | `curl "?table=tbl_task"` | 只含 tbl_task |
| S4 | 精确过滤 | `curl "?site=SH01&table=tbl_task"` | 单条 |
| S5 | 无效站点 | `curl "?site=NO_SUCH_SITE"` | data: [] |
| S6 | 无效表 | `curl "?table=NO_SUCH_TABLE"` | data: [] |

### 2.2 GET /api/sync/logs

| ID | 测试项 | 命令 | 期望结果 |
|----|--------|------|----------|
| L1 | 默认查询 | `curl /api/sync/logs` | limit=10 |
| L2 | 自定义 limit | `curl "?limit=5"` | limit=5 |
| L3 | limit=1 | `curl "?limit=1"` | limit=1 |
| L4 | limit=100 | `curl "?limit=100"` | limit=100 |
| L5 | limit 超限 | `curl "?limit=999"` | limit=100 |
| L6 | limit 负数 | `curl "?limit=-5"` | limit=1 |
| L7 | 站点过滤 | `curl "?site=SH01&limit=5"` | 只含 SH01 |
| L8 | 表过滤 | `curl "?table=tbl_task&limit=5"` | 只含 tbl_task |
| L9 | 空结果 | `curl "?site=NO_SUCH"` | data: [] |

### 2.3 错误响应

| ID | 测试项 | 命令 | 期望结果 |
|----|--------|------|----------|
| E1 | status 错误 | 停数据库后请求 | `{ "data": [], "error": "..." }` |
| E2 | logs 错误 | 停数据库后请求 | `{ "data": [], "limit": N, "error": "..." }` |

## 三、性能要求

- 响应时间 < 200ms
- limit=100 时查询正常

## 四、验收标准

- [ ] TypeScript 编译无错误
- [ ] Next.js 构建成功
- [ ] 所有 API 测试通过
- [ ] 文档已更新