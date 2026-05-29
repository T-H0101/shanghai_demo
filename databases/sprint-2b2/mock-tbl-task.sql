-- ============================================================
-- 模拟源表：mock_tbl_task
-- Sprint 2B.2 - 用于验证同步服务骨架
-- ============================================================
-- 幂等性保证：
-- - task_no VARCHAR(100) NOT NULL UNIQUE
-- - ON CONFLICT (task_no) DO NOTHING
-- ============================================================

-- 创建模拟源表
CREATE TABLE IF NOT EXISTS mock_tbl_task (
  id BIGSERIAL PRIMARY KEY,
  task_no VARCHAR(100) NOT NULL UNIQUE,
  task_name VARCHAR(200),
  task_type VARCHAR(50),
  status VARCHAR(50),
  phase VARCHAR(50),
  priority VARCHAR(20),
  data_classification VARCHAR(100),
  archive_name VARCHAR(200),
  source_path VARCHAR(1000),
  package_path VARCHAR(1000),
  operator VARCHAR(100),
  department VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_mock_task_id ON mock_tbl_task(id);
CREATE INDEX IF NOT EXISTS idx_mock_task_status ON mock_tbl_task(status);

-- 插入 Seed 数据（5条记录）
INSERT INTO mock_tbl_task (task_no, task_name, task_type, status, phase, priority, data_classification, archive_name, source_path, package_path, operator, department)
VALUES
  ('TASK-001', '财务报表备份', 'backup', 'completed', 'finished', 'high', '财务数据', '2026-05-report', '/data/finance/reports', '/archive/backup/report.tar.gz', '张伟', '财务部'),
  ('TASK-002', '客户数据归档', 'archive', 'running', 'transferring', 'normal', '客户数据', 'customer-archive', '/data/customers', '/archive/pending/customer.tar.gz', '李娜', 'IT运维部'),
  ('TASK-003', '日志导出', 'export', 'failed', 'error', 'low', '系统日志', 'syslog-2026-05', '/var/log', '/export/pending/syslog.tar.gz', '赵强', 'IT运维部'),
  ('TASK-004', '备份验证', 'backup', 'pending', 'waiting', 'normal', '系统数据', 'backup-verify', '/data/backup', '/archive/verify.tar.gz', '王明', 'IT运维部'),
  ('TASK-005', '数据清理', 'export', 'pending', 'waiting', 'low', '临时数据', 'cleanup-2026', '/data/temp', '/export/cleanup.tar.gz', '刘芳', 'IT运维部')
ON CONFLICT (task_no) DO NOTHING;

-- 验证数据
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'mock_tbl_task 创建完成';
  RAISE NOTICE '========================================';
  RAISE NOTICE '记录数: %', (SELECT COUNT(*) FROM mock_tbl_task);
  RAISE NOTICE 'ID 范围: % - %', (SELECT MIN(id) FROM mock_tbl_task), (SELECT MAX(id) FROM mock_tbl_task);
END $$;