# R.19D 节点跳转与暂停/继续控制闭环设计

> 日期: 2026-06-15
> 状态: 用户已确认
> 领导口径: 总控不重复创建任务；创建任务跳转节点；总控实现暂停和继续

## 1. Requirement 对照

本单元对应:

- `requirements.md §1.1`: 总控不替代站点原有系统。
- `requirements.md §1.2`: 总控与站点通过标准接口松耦合。
- `requirements.md §2.1`: 站点配置和站点切换。
- `requirements.md §4.2`: 任务暂停、恢复和统一任务查看。
- `requirements.md §6.2`: 控制鉴权、审计和防越权。
- `requirements.md §6.3`: 保持站点系统和数据库兼容。
- `requirements.md §6.4`: 配置可替换且不依赖修改代码。

本单元不会降低 `requirements.md`:

- `REQ-4.2.1` 新建备份/恢复任务仍保留为 requirement。当前产品边界改为从总控跳转站点节点创建；节点 URL 和 SSO 未提供前保持 `partial` / `blocked_by_auth`，不标记 `complete`。
- `REQ-4.2.2` 仅关闭有真实字段依据的 `pause` 和 `resume` 两个原子动作。`reset`、优先恢复、巡检和恢复任务继续保持 `unsupported` 或对应 `blocked_*`。

## 2. 已确认决策

1. 不再实现第二套总控任务创建逻辑。
2. “新建任务”改为跳转当前站点节点的任务创建页面。
3. 当前没有可访问的节点 URL，因此配置缺失时按钮必须禁用并明确提示，禁止假跳转。
4. 后续只需替换环境变量即可启用节点跳转，不修改业务代码。
5. Site Agent 主动轮询总控命令，并在本地直连站点数据库执行控制。
6. 第一阶段只真实执行:
   - `task_pause`: `tbl_task.status = 20`
   - `task_resume`: 恢复暂停命令记录的原运行状态
7. `star_storage_db` 是允许写入专用测试数据的 SH01 测试站点库，可用于真实控制闭环证据。
8. Auth/RBAC 开发禁令解除，但没有真实 ADFS/LDAP 信息时只建立可替换配置边界，不生成假 token、不伪造登录完成。
9. 生产部署和告警渠道在功能闭环完成后验收。

## 3. 方案选择

### 3.1 方案 A: 保留总控创建任务

拒绝。该方案与领导口径冲突，并复制站点任务创建规则，形成双写和规则漂移。

### 3.2 方案 B: 总控直接连接站点库执行控制

拒绝作为目标架构。虽然测试环境可直连，但会让总控持有所有站点连接信息，扩大故障和安全范围，不符合松耦合要求。

### 3.3 方案 C: 节点跳转 + Site Agent 本地控制

采用。

```text
创建任务:
总控 Tasks UI
  -> 读取安全站点跳转配置
  -> URL 未配置: 禁用并解释
  -> URL 已配置: 跳转站点任务创建页

暂停/继续:
总控 Tasks UI
  -> POST /api/control/commands
  -> control_command=pending
  -> Site Agent HMAC poll
  -> ACK running
  -> PostgresSiteActionAdapter 本地事务执行
  -> result success/failed/unsupported
  -> 立即执行 tbl_task 增量同步
  -> 总控读取最终任务状态和审计
```

该方案将高层控制协议与 PostgreSQL 实现分离。未来可替换为站点 HTTP API 或消息队列，不影响总控 UI 和命令状态机。

## 4. 架构边界

采用 Ports and Adapters，并保持单一职责:

| 模块 | 职责 |
|---|---|
| `SiteNavigationConfig` | 读取、校验并安全输出站点节点 URL |
| `ControlTransport` | HMAC poll、ack、result |
| `ControlCoordinator` | 编排拉取、ACK、执行、回传和立即同步 |
| `SiteActionAdapter` | 定义站点动作能力和执行接口 |
| `PostgresSiteActionAdapter` | 在站点本地事务修改 `tbl_task` |
| `SyncCoordinator` | 复用 R.19C 增量同步，不包含控制 SQL |

目标接口:

```typescript
interface SiteActionAdapter {
  capabilities(): Promise<SiteActionCapability[]>
  execute(command: SiteControlCommand): Promise<SiteActionResult>
}
```

首期只有 `PostgresSiteActionAdapter`。未来可增加 `HttpSiteActionAdapter`，不修改 `ControlCoordinator`。

## 5. 节点跳转设计

环境变量使用站点级 key:

```env
SITE_NODE_TASK_CREATE_URL_SH01=
```

规则:

1. `.env.example` 只保留空值和说明，不写真实地址或凭据。
2. `.env.local` 由本地或部署环境填写，不提交 Git。
3. URL 必须是 `http:` 或 `https:`，拒绝 `javascript:`、`data:` 和相对路径。
4. API 只返回当前站点所需的安全 URL 和 `configured` 状态，不返回数据库连接或 secret。
5. URL 未配置时:
   - “新建任务”按钮禁用；
   - 页面显示“节点任务创建地址未配置”；
   - 不写 `control_command`；
   - 不打开空页面或假页面。
6. URL 配置后使用新窗口跳转，并带 `noopener,noreferrer`。
7. SSO 参数、token 和账号映射在真实 ADFS 接入前不拼接。

## 6. 控制协议

### 6.1 拉取

Agent 定期请求:

```http
GET /api/site-control/commands?siteCode=SH01&limit=20
```

控制接口统一升级到与 heartbeat 相同的请求级 HMAC:

- `x-site-code`
- `x-agent-timestamp`
- `x-agent-nonce`
- `x-agent-signature`

签名覆盖 method、path、query 和 body hash，并校验时间窗、站点一致性与 nonce 防重放。废弃“header 直接等于 secret”的简化生产路径。

### 6.2 ACK

Agent 拉到命令后立即调用:

```http
POST /api/site-control/commands/:id/ack
```

状态只能从 `pulled/pending` 转为 `running`。ACK 仅表示收到并开始执行，不表示成功。

### 6.3 本地执行

`PostgresSiteActionAdapter` 必须:

1. 仅连接 `SITE_DATABASE_URL`。
2. 仅接受 `task_pause` 和 `task_resume`。
3. 使用参数化 SQL。
4. 开启事务并 `SELECT ... FOR UPDATE`。
5. 校验目标任务存在、当前状态和动作前置条件。
6. 保存 before/after。
7. 更新 `update_dt`，保证 R.19C 增量读取可观察到变化。
8. 提交后重新读取最终状态。
9. 失败回滚并返回结构化错误。

`docs/source/tbl_task_status.docx` 明确说明:

- `status=20`: 任务暂停。
- 备份/刻录类 `status=0`: 刻录成功。
- 回迁类 `status=0`: 下载成功。

因此“继续”不能直接写 `status=0`，否则会把继续操作误写成任务完成。首期采用保守状态机:

| 动作 | 任务类型 | 允许前态 | 目标状态 |
|---|---|---|---|
| pause | `0/2/3` 备份/刻录类 | `19` 正在备份 | `20` |
| pause | `1` 回迁类 | `1` 开始回迁或 `9` 正在读盘 | `20` |
| resume | `0/1/2/3` | `20`，且存在同任务最近成功 pause 记录 | 恢复 pause 的 `before.status` |

暂停成功结果必须保存 `previousStatus`。Agent 本地幂等状态同时持久化该值；result 的 before/after 也写入中心审计。没有可信 `previousStatus` 时，resume 返回 `unsupported`，禁止猜测。

### 6.4 结果与立即同步

Agent 执行后调用:

```http
POST /api/site-control/commands/:id/result
```

结果必须区分:

- `success`
- `failed`
- `unsupported`

真实 Agent 路径禁止返回 `dry_run_success` 作为完成证据。

源端执行成功后，Agent 先调用 `SyncCoordinator.syncOnce({ includeSnapshots: false })`，中心确认同步后再回传 command final result。同步或 result 回传失败均保留本地 pending result 并重试，不重复执行 SQL。总控只有在:

1. command result 为 `success`；
2. 中心 `unified_tasks` 回读到目标状态；

两者都满足后，UI才显示最终“已暂停”或“已继续”。

## 7. 前端行为

### 7.1 新建任务

- 删除 API 模式下的总控创建表单入口和假写入逻辑。
- 按当前 `siteCode` 获取节点跳转配置。
- “全部站点”模式不允许跳转，要求先选择站点。
- URL 未配置时按钮禁用，旁边明确显示配置缺失。
- 不新增页面。

### 7.2 暂停和继续

- 前端只提交 `control_command`，不再调用 `/api/control/commands/:id/execute`。
- toast 固定使用:
  - “暂停命令已提交到控制队列，等待站点 Agent 执行”
  - “继续命令已提交到控制队列，等待站点 Agent 执行”
- 命令 pending/running 时不提前改变任务最终状态。
- 命令 success 且同步回读后刷新任务列表和详情。
- `reset` 保持禁用或明确 `unsupported`，不进入真实执行路径。

旧 `/api/control/commands/:id/execute` 和 `scripts/worker-site.ts` 只保留为历史测试实现，不允许前端和生产 Agent调用；后续独立清理前需保持兼容测试，不做破坏性删除。

## 8. Auth 可替换配置边界

本单元只建立配置模型，不实现假认证:

```env
AUTH_MODE=disabled
AUTH_ISSUER_URL=
AUTH_CLIENT_ID=
AUTH_CLIENT_SECRET_REF=
AUTH_JWKS_URL=
AUTH_LDAP_URL=
AUTH_LDAP_BASE_DN=
```

规则:

1. 默认 `AUTH_MODE=disabled`，UI和API必须显示认证尚未接入。
2. `.env.example` 只列 key 和空值。
3. `.env.local` 可以配置本地环境，但不得提交。
4. `AUTH_CLIENT_SECRET_REF` 保存 secret 的环境变量 key 引用，不保存 secret 值。
5. 未提供真实 ADFS/LDAP/JWKS 时，REQ-2.2 和 RBAC requirement 继续 `blocked_by_auth`。
6. 后续实现通过 `AuthProvider` 接口扩展，不把 ADFS逻辑散落到页面和业务 API。

## 9. 故障处理

| 场景 | 行为 |
|---|---|
| 节点 URL 未配置 | 禁用跳转，明确提示 |
| 控制接口鉴权失败 | Agent不执行，记录失败，不降级为无鉴权 |
| Agent离线 | 命令保持 pending，UI显示等待 |
| 目标任务不存在 | result=`failed`，不写数据库 |
| 动作不支持 | result=`unsupported`，给出 blocker |
| SQL执行失败 | 事务回滚，回传错误 |
| result回传失败 | 本地持久化待回传结果并重试，禁止重复执行SQL |
| 立即同步失败 | command 保持 running，本地 pending result 重试同步；不提前宣称 success |
| 重复命令 | 依据 command ID 和终态幂等，不重复执行 |

Control spool 与 Sync spool 分开存储，避免一个领域的失败阻塞另一个领域。

## 10. TDD 与验收

先写失败测试，再实现。必须覆盖:

1. 未配置节点 URL 时按钮和API fail closed。
2. 非法 URL 被拒绝且不泄露配置。
3. 配置 URL 后生成正确站点跳转。
4. 前端不再调用直接 execute API。
5. control poll 请求级 HMAC、过期、篡改、跨站和nonce重放。
6. Agent只接受 pause/resume。
7. pause 将专用测试任务状态真实改为20。
8. resume 仅允许从20恢复到同一任务pause记录的原运行状态。
9. 非法前态不修改数据库。
10. ACK、result状态机正确。
11. result回传失败不会重复执行SQL。
12. `status=0` 不得作为通用resume目标，防止把继续误写为完成。
13. 成功后立即同步，中心状态与站点一致。
14. before/after和审计不包含secret。
15. reset/priority/inspect/recovery继续 unsupported。
16. 前端事件测试验证点击、API、数据库、toast和最终刷新。

提交前执行:

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm check:sync-consistency -- --siteCode=SH01
pnpm baseline:check
pnpm e2e:all
pnpm test:e2e:worker
```

另增加并执行 R.19D 定向 Agent control e2e。

## 11. 完成口径

本单元完成后允许宣称:

- 总控任务创建已按领导口径收敛为节点跳转配置，不再重复实现。
- SH01测试恢复库的暂停/继续已通过Site Agent真实控制闭环。
- 控制命令具备请求级HMAC、ACK、结果回传、审计和立即同步。

禁止宣称:

- 新建任务 requirement 整体完成；
- reset、优先恢复、巡检或恢复任务完成；
- ADFS/JWT/RBAC完成；
- 生产站点控制部署完成；
- 整个 `requirements.md §4.2` 完成。
