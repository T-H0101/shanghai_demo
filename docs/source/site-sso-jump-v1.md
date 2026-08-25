# 站点 SSO 跳转契约（近期 · legacy_jump_ticket）

> REQ-2.1.2 站点切换 — 阶段一  
> 总控已登录 → 签发短时 ticket → 打开站点 MultimediumNw → 免登进 UI  
> 站点退出 → 回总控 `/sites`；总控退出 → 总控登录页（未接企业 SSO）

## 组件

| 组件 | 路径 | 职责 |
|------|------|------|
| 总控 | `shanghai_demo` | 签票、拼 `jumpUrl`、审计 |
| 站点 Web | `SsnWin/MultimediumNw` | `GET /unified-sso/consume` 验票建会话 |
| 站点调度 | `MultimediumCentral` | `user_authToken`（按 username 查 `tbl_user`） |
| 站点前端 | `LongTermStorage-ui` | 退出已支持 `targeturl`，无需必改 |

## 共享密钥

双方必须一致（64 位 hex = 32 字节）：

- 总控 `.env.local`：`SITE_SSO_SECRET=...`
- 站点 NW `config`：`unifiedDisc.secretKey=...`（或 `authToken.secretKey`）

```bash
openssl rand -hex 32
```

## 跳转流程

1. 用户登录总控，打开 `/sites`，点有真实 `db_host:db_port` 的站的 **SSO**。
2. `GET /api/sites/{siteCode}/sso`（需登录 cookie）返回：

```json
{
  "code": 0,
  "status": "ready",
  "jumpUrl": "http://172.168.6.52:13000/unified-sso/consume?ticket=...",
  "returnUrl": "http://172.168.6.52:3000/sites"
}
```

3. 浏览器打开 `jumpUrl`。
4. NW 解密 ticket（AES-256-GCM，与 `crypto-util` 相同），校验可选 `unifiedDisc.siteCode`。
5. TCP 调 Central `user_authToken`（`username` = 总控当前用户名）：
   - 站点 `tbl_user.name` 已存在 → 直接建会话；
   - 不存在 → Central 自动创建普通用户（`role_id=4`）后再建会话。
6. 写 session + JWT，redirect `/{uiVersion}/?token=...`。
7. ticket 内 `returnUrl` 存入 `session.unifiedReturnUrl`；站点 `POST /logout` 返回 `targeturl` → UI 跳回总控。

## Ticket payload

```json
{
  "username": "admin",
  "siteCode": "CD01",
  "returnUrl": "http://总控:3000/sites",
  "jti": "...",
  "iat": 1710000000000
}
```

有效期默认 120 秒（NW：`unifiedDisc.sso.ticketTtlSeconds`）。

## 站点配置示例（MultimediumNw）

```json
"unifiedDisc": {
  "secretKey": "<与总控 SITE_SSO_SECRET 相同的 64 hex>",
  "siteCode": "CD01",
  "sso": {
    "portalUrl": "http://172.168.6.52:3000/sites",
    "ticketTtlSeconds": 120
  },
  "restore": {
    "path": ""
  }
}
```

`webserver.port`（默认 13000）须与推送到总控的 `db_port` 一致。

## 账号映射（近期）

跳转 ticket 的 `username` 来自 **站点账号映射**：有映射用站点本地名，无映射用当前登录用户名。  
站点无此用户时，`user_authToken` 会自动创建（默认 `role_id=4` 普通用户）。  
创建/鉴权失败则 consume 返回 403，不会默认成管理员。

## 验收

1. 总控与站点密钥一致；CD01 有真实 IP:端口。  
2. 总控登录后点 SSO → 新窗口打开站点且已登录。  
3. 站点退出 → 回到总控 `/sites`（总控会话仍在）。  
4. 总控退出 → 总控登录页。

## 远期

企业统一 SSO 就绪后：总控与站点改走 IdP；本 ticket 路径标记 `legacy_jump_ticket` 可关闭。站点退出仍回总控；总控退出改为企业 SSO 登出页。
