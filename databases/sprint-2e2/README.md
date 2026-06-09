# Sprint 2E.2 - User / Site / Platform 中心表

## 概述

为多站点筛选、权限、登录、站点合法性校验等后续 Sprint 提供基础数据。

## 三张表

| 表 | 源 | 字段数 | 脱敏字段 |
|---|---|---|---|
| unified_users | tbl_user | 8 业务 + 5 公共 | pwd / root_pwd / password_salt / face_path |
| unified_sites | tbl_site | 6 业务 + 5 公共 | — |
| unified_platforms | tbl_platform | 6 业务 + 5 公共 | pwd |

## 公共字段 (每张表都有)

```
id              UUID PK
source_site_id  VARCHAR(50) NOT NULL
source_table    VARCHAR(100) NOT NULL
source_id       VARCHAR(100) NOT NULL
synced_at       TIMESTAMPTZ
raw_data        JSONB
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
UNIQUE(source_site_id, source_table, source_id)
```

## 脱敏策略

`raw_data` 写入前会移除以下字段：
- password / pwd / root_pwd
- token / secret
- key
- password_salt / password_algo

不脱敏的字段全部保留在 raw_data 中供审计。

## 部署

```bash
psql -U unified -d unified_disc_platform -f databases/sprint-2e2/unified-user-site-platform.sql
```

## 索引

- `idx_unified_users_user_id` / `idx_unified_users_username`
- `idx_unified_sites_code`
- `idx_unified_platforms_id` / `idx_unified_platforms_type`
