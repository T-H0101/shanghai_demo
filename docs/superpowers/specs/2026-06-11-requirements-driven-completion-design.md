# Requirements-driven Completion Run 设计

## 目标

按 `docs/source/requirements.md` 推进 4 个独立、可验证的真实化单元，不新增业务页面，不引入 ADFS、ES、ClickHouse，不把 mock、seed、DRY_RUN 当作真实完成。

## 需求单元

### R.10A 调度参数与多站点安全配置

- 对应：REQ-2.3.2、REQ-6.4.3。
- 修复 scheduler 对 `--siteCode=SH01` 参数解析错误。
- 新增只读同步配置 API，仅返回 `sync_sites` 的站点编码、名称、启用状态、周期、状态和凭据键引用。
- 不返回数据库地址、用户名、密码或 secret 值。
- `/sync` 展示真实中心库配置，并明确 `sites/sync_sites` 当前是中心配置，不是源端站点真实性证据。

### R.10B Settings 真实只读化

- 对应：REQ-6.4.2、REQ-6.4.3。
- 移除 `/settings` 的 mock 配置、假保存、假导出、假邮件和假服务监控。
- 展示 R.10A 安全配置、系统健康和数据库健康。
- 所有配置只读；写入能力明确标记 `partial`，需后续运维配置存储和权限控制。

### R.10C Users 真实只读化

- 对应：REQ-3.1.1、REQ-3.1.3、REQ-3.2.1。
- `/api/users` 删除 mock fallback，中心库失败返回错误，空数据返回 empty。
- `/users` 读取 `unified_users`，展示真实账号基础属性和来源。
- 创建、启禁、删除、密码重置、权限编辑、权限同步全部禁用并标记 `blocked_by_auth`。

### R.10D Racks API fail-closed

- 对应：REQ-2.3.1、REQ-4.3.2。
- API 模式下 `/racks` 不再在空数据或失败时回退 mock。
- 空数据展示 empty，接口失败展示 error；统计同步清零。
- Mock 数据仅保留显式 Mock 模式，不进入 API 模式。

## 数据边界

- `requirements.md` 决定需求。
- `disc_files.sql` 与 `star_storage_db` 用于源 schema/数据核验。
- `source_restore` 仅同步测试源。
- `sites/sync_sites` 是中心配置表，当前含 seed 数据，必须标注配置来源。
- 不读取或输出 secret 值，只输出环境变量键名和是否配置。

## 验证

每单元必须运行用户要求的 6 项全量检查；涉及页面时新增目标 e2e 并纳入 `e2e:all`。R.10A 额外运行 scheduler 命令和 `e2e:scheduler`。
