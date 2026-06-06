# Sprint 2E.2 - 用户 / 站点 / 平台域接入

> **日期**: 2026-06-06
> **范围**: 用户/站点/平台基础域接入中心库
> **前置**: Sprint 2E.1 任务域审查结论, 转域推进

---

## 一、源表画像

| 源表 | source_restore | pg_restore_test | 样本数 | 适合小表 |
|---|---|---|---|---|
| tbl_user | ✅ 已存在 | ✅ 3 rows | 3 | ✅ |
| tbl_site | ❌ (已导入 schema) | ✅ 0 rows | 0 | ✅ |
| tbl_platform | ❌ (已导入 schema) | ✅ 0 rows | 0 | ✅ |

**导入方式**: 从 pg_restore_test `star_storage_db` 导出 `tbl_site / tbl_platform` schema-only 到 `source_restore`。**未导入任何数据**（样本库本身 0 行）。tbl_user 在 source_restore 已有 3 真实样本。

## 二、修改文件清单 (14 个新增/修改)

```
新增:
  databases/sprint-2e2/unified-user-site-platform.sql   # 中心表 schema
  databases/sprint-2e2/README.md
  lib/import/user-site-platform/types.ts
  lib/import/user-site-platform/mapper.ts
  lib/import/user-site-platform/upsert.ts
  lib/import/user-site-platform/importer.ts
  scripts/import-user-site-platforms.ts                # CLI
  lib/api/list-helper.ts                               # 通用列表 helper
  app/api/platforms/route.ts                            # 新增

修改:
  package.json                                         # +4 scripts
  lib/sync/package-schema.ts                           # +3 表到白名单
  lib/sync/package-dispatcher.ts                       # +3 handlers
  app/api/users/route.ts                               # 优先读中心库
  app/api/sites/route.ts                               # 优先读中心库
```

## 三、中心表 schema

| 表 | 字段 | 备注 |
|---|---|---|
| unified_users | 8 业务 + 5 公共 | 已存在 (Sprint 2B), schema 沿用 `role` / `department` |
| unified_sites | 6 业务 + 5 公共 | Sprint 2E.2 新建 |
| unified_platforms | 6 业务 + 5 公共 | Sprint 2E.2 新建 |

公共字段每张表都有: `id (uuid PK) / source_site_id / source_table / source_id / synced_at / raw_data (jsonb) / created_at / updated_at / UNIQUE(source_site_id, source_table, source_id)`

## 四、字段真实来源 (不伪造)

### unified_users
| 字段 | 来源 |
|---|---|
| user_id | tbl_user.user_id ✅ |
| username | tbl_user.name ✅ |
| display_name | tbl_user.display_name (fallback real_name) ✅ |
| status | tbl_user.login_status 映射 (0=normal, 1=locked) ✅ |
| role | tbl_user.role_id ✅ |
| department | tbl_user.department ✅ |
| phone | tbl_user.phone ✅ |
| email | tbl_user.email ✅ |

### unified_sites
| 字段 | 来源 |
|---|---|
| site_code | tbl_site.site_id (映射) ✅ |
| site_name | tbl_site.site_name ✅ |
| status | **固定 'active' (源表无 status 字段, 不伪造)** |
| location | **null (源表无)** |
| endpoint_url | **null (源表无)** |
| description | tbl_site.cmt ✅ |

### unified_platforms
| 字段 | 来源 |
|---|---|
| platform_id | tbl_platform.plat_id ✅ |
| platform_name | tbl_platform.plat_name ✅ |
| platform_type | tbl_platform.type_id ✅ |
| status | **固定 'active' (源表无, 不伪造)** |
| version | **null (源表无)** |
| endpoint_url | ip+port 拼接 (有则填) ✅ |

## 五、脱敏字段说明

`raw_data` 在写入前通过 `sanitizeRawData()` 移除以下字段值:

| 脱敏字段 | 替换为 |
|---|---|
| password | `[REDACTED]` |
| pwd | `[REDACTED]` |
| passwd | `[REDACTED]` |
| root_pwd | `[REDACTED]` |
| token | `[REDACTED]` |
| secret | `[REDACTED]` |
| key | `[REDACTED]` |
| password_salt | `[REDACTED]` |
| password_algo | `[REDACTED]` |
| face_path | `[REDACTED]` |

**验证**: 
- 3 users 写入后, `raw_data->>'pwd'` = `[REDACTED]`
- package 测试 1 user, `raw_data->>'pwd'` = `[REDACTED]`

## 六、Import 验证

| 测试 | 结果 |
|---|---|
| `pnpm import:users SH01` | 3 read, 3 upserted ✅ |
| `pnpm import:sites SH01` | 0 read, 0 upserted ✅ |
| `pnpm import:platforms SH01` | 0 read, 0 upserted ✅ |
| `pnpm import:user-site-platforms SH01` | users 3, sites 0, platforms 0 ✅ |
| 重复 import | 仍 3 upserted (幂等, ON CONFLICT UPDATE) ✅ |

## 七、Package 验证

| 测试 | 结果 |
|---|---|
| POST /api/sync/package with tbl_user | 200 success, 1 upserted ✅ |
| 重复同 batchId | duplicated ✅ |
| tbl_file | 400 forbidden (白名单外) ✅ |

## 八、API 验证

| API | 状态 | 数据源 | items |
|---|---|---|---|
| GET /api/users | 200 | database (3) | ✅ |
| GET /api/sites | 200 | mock fallback (unified_sites 0 行) | ✅ |
| GET /api/platforms | 200 | database (0) | ✅ |
| 回归 /api/tasks | 200 | database | ✅ |
| 回归 /api/racks | 200 | database | ✅ |
| 回归 /api/volumes | 200 | database | ✅ |
| 回归 /api/sync/packages | 200 | database | ✅ |

## 九、tsc / build / smoke

- `pnpm exec tsc --noEmit`: exit 0 ✅
- `pnpm build`: 成功 (24 路由) ✅
- `pnpm smoke:sync`: success, duplicateDetected=true ✅
- `pnpm import:file-index` (无参): exit 1 guard 仍拒绝 ✅

## 十、固定统计

```
Sprint 2E.2 完成统计
=====================
本次新增接入源表：3 张 (tbl_user, tbl_site, tbl_platform)
本次新增中心表：2 张 (unified_sites, unified_platforms)
本次新增 package 支持：3 张
本次新增只读 API：3 个 (/api/users/sites/platforms 优先中心库)
本次新增 CLI：4 个 (import:users/sites/platforms/user-site-platforms)
本次新增页面：0
本次脱敏字段：10 类
本次影响登录：否
是否触碰 file-index：否
是否触碰 ES/ClickHouse：否
```

## 十一、是否影响登录
**否**。本 Sprint 仅接入数据, 不改任何 auth/login 逻辑。
后续 Sprint (2E.4+) 可基于 unified_users / unified_sites 做权限/登录。

## 十二、git status / commit

- 已 commit, 已 push (见最终报告)
