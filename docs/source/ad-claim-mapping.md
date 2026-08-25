# ADFS / OIDC Claim 与站点账号映射

> `requirements.md` §2.2  
> 药明 `ADFS4.docx` 默认返回：**员工号、邮箱**。JWT 字段名文档未写死，总控用环境变量配置候选 key。

## AD → 用户表

AD 与密码登录进同一张 `auth_accounts`。无账号则新建，有则登录并回写员工号、邮箱。

总控用户名：**AD 登录名优先**，员工号/邮箱只作属性与对账。

| 用途 | 环境变量 | 默认候选 key |
|---|---|---|
| 登录名（用户名） | `OIDC_CLAIM_LOGIN_NAME` | `preferred_username`, `winaccountname`, `samaccountname`, `upn` |
| 员工号 | `OIDC_CLAIM_EMPLOYEE_ID` | `employeeid`, `employee_id`, `EmployeeId`, `employeenumber` |
| 邮箱 | `OIDC_CLAIM_EMAIL` | `email`, `upn`, `unique_name`, `mail` |
| 显示名 | `OIDC_CLAIM_DISPLAY_NAME` | `name`, `displayname`, `display_name` |
| 部门 | `OIDC_CLAIM_DEPARTMENT` | `department` |

对账顺序：员工号 → 邮箱 → 用户名。

## 站点账号映射

表 `auth_site_user_mappings`：当前账号（`auth_account_id` / 用户名）→ `site_code` + `site_local_username`（站点 `tbl_user.name`）。

不区分密码登录还是 AD 登录。未映射时 ticket 用当前用户名；站点没有该用户则由站点新建。映射只存总控库，不自动推送到站点。
