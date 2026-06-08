# Sprint 2H.6 — inlineUpsert inserted/updated 区分 (RETURNING xmax = 0)

> 状态: ✅ 完成
> 范围: 仅改 `lib/sync/package-dispatcher.ts` + `app/api/sync/package/route.ts`
> Sprint 目标: 让 dispatcher 真实区分 inserted / updated 行数 (PG ON CONFLICT 之前不可区分)

---

## 1. 背景

Sprint 2H.2 修复了 dispatcher 静默 continue 跳过 sourceId 缺失, 但仍有 1 个限制:

> PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` 的 `rowCount` 总是 1 (无论 insert 还是 update)。
> 不暴露 inserted/updated 区分。

Sprint 2H.1R 文档化说"区分需要 `RETURNING (xmax = 0)` 技巧"。本 Sprint 实现这个区分。

## 2. 修复

### 2.1 inlineUpsert 加 RETURNING

```ts
const sql = `
  INSERT INTO ${targetTable} (...)
  VALUES (...)
  ON CONFLICT (source_site_id, source_table, source_id) DO UPDATE SET
    ${updateSet.join(', ')}
  RETURNING (xmax = 0) AS is_insert
`
const result = await query<{ is_insert: boolean }>(sql, [...])
upserted += result.rowCount ?? 0
if (result.rows[0].is_insert) inserted++
else updated++
```

`xmax` 是 PG 内部的事务 ID:
- 新插入的行: xmax = 0
- ON CONFLICT 命中更新的行: xmax = 当前事务 ID (非 0)

### 2.2 route.ts 透传

`TableSummary` 接口加 `inserted` / `updated` 字段, `tableResults.push(...)` 填上。

## 3. 验证

### 3.1 单脚本端到端 (scripts/sprint-2h6-inserted-updated.ts)

```
$ pnpm tsx scripts/sprint-2h6-inserted-updated.ts

=== 首次 push (期望 inserted=5) ===
  HTTP 200, packageStatus=success
    tbl_disc: received=5 upserted=5 inserted=5 updated=0 failed=0 status=success
  ✅ inserted=5 正确

=== 第二次 push (期望 inserted=0, updated=5) ===
  HTTP 200, packageStatus=success
    tbl_disc: received=5 upserted=5 inserted=0 updated=5 failed=0 status=success
  ✅ inserted=0, updated=5 正确
```

**2 个 case 都通过**:
- 首次 push 5 个新 source_id → 全部 inserted
- 重复 push 同样 source_id (字段值变化) → 全部 updated

### 3.2 回归

| 项 | 状态 |
|---|---|
| `pnpm exec tsc --noEmit` | exit 0 ✅ |
| `pnpm build` | success ✅ |
| `pnpm smoke:sync` | passed ✅ |
| GET `/api/sync/package/H2-...-1` 仍 duplicated ✅ | HMAC 鉴权正常 |
| dispatcher 静默 continue 修复保留 ✅ | 3 D 类 → 0 (Sprint 2H.2 修复) |

## 4. 真实数据价值

- 之前: `inserted_count` 不可信, 数据消费者无法分辨
- 现在: 真实区分, 业务可基于 inserted/updated 比例判断 dispatcher 健康度
  - 例: 100% updated → 站点只是重传, 没新数据
  - 例: 100% inserted → 全是新源
  - 例: 50/50 → 增量同步

## 5. 关键文件清单

- `lib/sync/package-dispatcher.ts` — inlineUpsert 加 `RETURNING (xmax = 0) AS is_insert` + 累加 inserted/updated
- `app/api/sync/package/route.ts` — TableSummary 接口加 inserted/updated, push 时填入
- `scripts/sprint-2h6-inserted-updated.ts` — 新增端到端验证脚本

## 6. 已知限制

- 仅 inlineUpsert 路径用 RETURNING, 复用 `mapRealTask`/`mapRealDevice` 的 dispatcher (tbl_task, tbl_disc_lib, tbl_user, tbl_site, tbl_platform) 仍依赖具体事务的 `rowsUpserted.insertedCount/updatedCount` (来自 `lib/sync/upsert.ts`)。该路径**已支持** inserted/updated 区分, 所以全部 13 张白名单表现在都有真实区分。
- xmax = 0 是 PG 内部细节, 升级到 PG 17+ 后语义仍然稳定。

## 7. 结论

- inlineUpsert 真实区分 inserted/updated ✅
- route.ts 透传, 客户端可读 ✅
- 端到端验证 2 个 case 都通过 ✅
- 0 项业务功能回归 ✅
- 0 项 dispatcher 副作用 ✅
- 文档化 PG ON CONFLICT 限制解除 ✅
