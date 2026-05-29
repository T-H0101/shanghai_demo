# mock_tbl_task 模拟源表

## 用途

用于 Sprint 2B.2 验证同步服务骨架，从 mock_tbl_task 表读取数据并同步到 unified_tasks。

## 幂等性

- `task_no VARCHAR(100) NOT NULL UNIQUE` - 唯一约束
- `ON CONFLICT (task_no) DO NOTHING` - 重复执行不插入重复数据

## 数据内容

| task_no | task_name | status | 说明 |
|---------|----------|--------|------|
| TASK-001 | 财务报表备份 | completed | 已完成备份 |
| TASK-002 | 客户数据归档 | running | 归档进行中 |
| TASK-003 | 日志导出 | failed | 导出失败 |
| TASK-004 | 备份验证 | pending | 待验证 |
| TASK-005 | 数据清理 | pending | 待清理 |

## 同步测试

1. 首次同步：`curl -X POST http://localhost:3000/api/sync/tasks`
   - 预期：rowsRead=5, rowsUpserted=5

2. 再次同步：
   - 预期：rowsRead=0, status=skipped

3. 新增记录后同步：
   - 预期：rowsRead=N, rowsUpserted=N

## 执行方式

```bash
# 使用 Docker psql
docker exec -i unified_disc_postgres psql -U unified -d unified_disc_platform < databases/sprint-2b2/mock-tbl-task.sql
```

## 数据更新

如需添加新记录进行增量同步测试：

```sql
INSERT INTO mock_tbl_task (task_no, task_name, task_type, status, phase, priority, data_classification, archive_name, source_path, package_path, operator, department)
VALUES ('TASK-006', '新任务', 'backup', 'pending', 'waiting', 'normal', '测试数据', 'test-001', '/data/test', '/archive/test.tar.gz', '测试员', 'IT运维部')
ON CONFLICT (task_no) DO NOTHING;
```