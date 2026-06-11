# R.11 导出、同步与设置真实化设计

## 目标

按 `docs/source/requirements.md` 完成 4 个独立、可验证的需求单元。所有数据读取中心库真实表，空数据显式返回 empty，不使用 mock、simulator 或 DRY_RUN 冒充完成。

## R.11A 设备真实导出

- 对应：REQ-4.3.2。
- 新增 `GET /api/racks/export`，从 `unified_devices` 导出 CSV。
- 支持 `siteCode` 和 `status` 过滤；响应包含文件名、记录数和 SHA-256 内容摘要。
- `/racks` 的导出按钮下载当前站点范围的真实数据，不再显示“开发中”。
- 不新增表，不改变设备数据结构。
- 由于认证与站点权限过滤尚未接入，REQ-4.3.2 仍保持 `partial`。

## R.11B 同步日志完整性摘要导出

- 对应：REQ-5.1.2。
- 新增 `GET /api/sync/export`，支持 package、table、scheduler、consistency 四类真实日志。
- 支持 CSV/JSON、站点过滤和 SHA-256 完整性摘要；响应明确数据源、记录数和摘要。
- `/sync` 提供真实导出事件，下载内容由 API 生成。
- Excel、长期归档和基于证书的不可抵赖签名尚未实现，因此 REQ-5.1.2 仅提升为 `partial`。

## R.11C 每站点最新状态

- 对应：REQ-2.3.3、REQ-6.1.3。
- 新增 `GET /api/sync/sites/status`。
- 以 `sync_sites` 为注册配置基准，关联每站点最近 scheduler、consistency 和 package 日志。
- `/sync` 展示每站点最新调度、推送、数据包和一致性状态。
- 不把 `sync_sites` 的配置记录当作源端站点真实性证据。
- 每日自动差异任务、人工修复和按类型配置仍缺失，REQ-2.3.3 保持 `partial`。

## R.11D Settings 站点与调度视图

- 对应：REQ-2.1.1、REQ-6.4.3。
- `/settings` 同时读取 `/api/sites` 和 `/api/sync/sites/status`。
- 分开展示站点注册/派生来源与中心调度配置，避免把派生站点或 seed 配置混称为真实源端注册。
- 展示每站点同步周期、最近调度和一致性状态。
- 所有写操作继续禁用；JWT、RBAC、ADFS 与配置变更审计保持 `blocked_by_auth` 或 `not_implemented`。

## 安全与验证

- API 不返回数据库密码、连接串或 secret 值，只允许环境变量键引用。
- 不读取或全量同步 `tbl_file`、`tbl_folder`。
- 不新增 ES、ClickHouse、API 页面或业务表。
- 每个单元先写失败测试，再实现，完成目标测试、浏览器事件验证、全量检查后单独提交。
