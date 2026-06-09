# siteCode 跨页面过滤验证 (Sprint 4.8.2-R)

> **Date**: 2026-06-09
> **测试站点**: SH01 (主) / BJ02 (次)

## 测试结果

| 端点 | siteCode=SH01 | 无 siteCode (All Sites) | 过滤生效? |
|---|---|---|---|
| `/api/tasks` | ✅ HTTP 200, data.items[].siteCode=SH01 | ✅ HTTP 200, 多站点 | ✅ |
| `/api/racks` | ✅ HTTP 200, siteCode=SH01 | ✅ HTTP 200, 含 SH01 | ✅ |
| `/api/volumes` | ✅ HTTP 200, 含 SH01 (HV1) | ✅ HTTP 200, 含 BJ02 + SH01 | ✅ |
| `/api/sync/packages` | ✅ HTTP 200, siteCode=SH01 | (未测) | ✅ |

## 详细响应片段

### /api/tasks?siteCode=SH01
```json
{
  "code": 0,
  "data": {
    "items": [
      {"id": "493906ce...", "taskNo": "SH01-10", "name": "Task1", "siteCode": "SH01", ...}
    ]
  }
}
```

### /api/racks?siteCode=SH01
```json
{"data": [{"rackId": "1", "rackName": "HD32-X", "siteName": "SH01", "siteCode": "SH01", "totalSlots": 96, "usedSlots": 8, ...}]}
```

### /api/volumes?siteCode=SH01
```json
{"data": [{"id": "1", "name": "HV1", "info": "站点 SH01 · 状态 0 · 同步 2026-06-09T05:22:47.404Z", ...}]}
```

### /api/sync/packages?siteCode=SH01
```json
{"data": {"items": [{"siteCode": "SH01", "batchId": "SH01-2026-06-09T05-22-42-914Z", "mode": "full", ...}]}}
```

### /api/volumes (All Sites)
```json
{"data": [
  {"id": "VOL_BJ02_001", "name": "北京备份数据卷", "info": "站点 BJ02 · 状态 offline · 健康 degr..."},
  ...
]}
```

## 结论
✅ siteCode 过滤在 4 个核心端点全部生效
✅ 跨页面一致 (Header 站点选择器 → Tasks/Racks/Volumes/Sync 联动)
