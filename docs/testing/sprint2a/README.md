# Sprint 2A 测试文档

> 2026-05-28 完成

## 文件说明

| 文件 | 说明 |
|------|------|
| `test-plan.md` | 测试计划 |
| `acceptance-checklist.md` | 验收清单 |

## 测试方法

```bash
# 1. 创建 .env.local
echo "NEXT_PUBLIC_API_MODE=mock" > .env.local
# 或
echo "NEXT_PUBLIC_API_MODE=api" > .env.local

# 2. 启动服务
pnpm dev

# 3. 测试完成后停止
```

## 后续 Sprint

- `../sprint2b/` - Sprint 2B 测试文档
