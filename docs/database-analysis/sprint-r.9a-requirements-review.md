# Sprint R.9A — Requirements Review

> **Sprint**: R.9A — /sites 页面真实化
> **日期**: 2026-06-11
> **模板**: `requirements-strict-review-template.md` (R.1 13 段)

---

## 1. Requirement IDs (本 Sprint 涉及)

| REQ ID | 标题 | 原状态 | R.9A 状态 |
|---|---|---|---|
| REQ-2.1.1 | 站点配置 (名称/IP/状态/联系人) | `partial` / `blocked_by_source_schema` | `partial` (不变, 仅实现层修复) |
| REQ-2.1.2 | 站点切换 (SSO 免登) | `blocked_by_auth` | `blocked_by_auth` (按钮 disabled, 不变) |
| REQ-2.1.3 | 站点监控 (实时 + 告警) | `partial` | `partial` (不变) |

---

## 2. Requirement 原始文本 (摘录 requirements.md)

> **REQ-2.1.1** §2.1 站点: 提供站点配置管理 (名称/IP/状态/联系人), 支持新增/编辑/删除/启用/禁用, 数据源来自源端 `tbl_site`。

> **REQ-2.1.2** §2.1 站点: 站点切换 (SSO 免登), 单点登录到各站点本地系统。

> **REQ-2.1.3** §2.1 站点: 站点监控 (实时 + 告警), 数据采集 ≤5 分钟。

---

## 3. Implementation (改了哪些文件 / API / 表)

### 3.1 修改

| 文件 | 改动 |
|---|---|
| `app/sites/page.tsx` | mock → 真实 `/api/sites` 接入; 写操作按钮 disabled; 移除 mockSiteProvider; 移除 siteStats 硬编码; 错误态/空态/派生态显式处理 |
| `lib/types/site.ts` | `Site.status` 类型扩展, 新增 `"derived"` (派生态) |
| `scripts/e2e/test-sites.ts` | 9 项 → 22 项 (新增 13 项 R.9A 真实化检查) |

### 3.2 未改

- ❌ 未新增数据库表
- ❌ 未新增 API
- ❌ 未新增页面
- ❌ 未修改 `/api/sites` (R.4 已修复, 正确返回 derived)
- ❌ 未修改 mock 数据结构 (`lib/mock/sites.ts` 保留, 仅移除页面引用)
- ❌ 未接多站点
- ❌ 未写 secret / env
- ❌ 未接 source_restore 数据库

---

## 4. Backend reality (数据库/API/队列真支持, 还是仅 UI)

| 维度 | 真实后端能力 | 证据 |
|---|---|---|
| 列表数据 | ✅ 真实: 走 `/api/sites` (R.4 修复后) | `curl /api/sites` 返回 `dataSource=derived`, 7 站点 |
| dataSource 标识 | ✅ 真实: API 返回 `dataSource/source/meta.requirement` | API 响应实测 |
| 派生来源 | ✅ 真实: 来自 4 张表 (unified_tasks/devices/volumes/sync_package_log) | API meta.derivedFromTables |
| 站点 CRUD | ❌ 无 | 按钮 disabled, 不允许宣称 "注册成功" |
| 启用/禁用 | ❌ 无 | 按钮 disabled |
| SSO 跳转 | ❌ 无 (REQ-2.1.2 blocked_by_auth) | 按钮 disabled |
| 一致性校验 | ✅ 真实: 走 `/api/sync/consistency` (R.7) | R.7 已有, R.9A 页面切换引用 |

---

## 5. UI reality (真实点击行为, 是否误导用户)

| 交互 | 点击行为 | 误导? |
|---|---|---|
| 页面加载 | 自动 `fetch /api/sites` | ❌ 无误导 |
| dataSource 标识 | 顶部 Badge 显式 `database`/`derived`/`empty`/`error` | ❌ 无误导 |
| 列表渲染 | 显示 7 派生站点, IP/联系人显 "—", 顶部标注 "由同步数据派生" | ❌ 无误导 |
| 详情面板 | 派生站点顶部加 amber 提示 "该站点从统一表派生, IP/联系人暂缺" | ❌ 无误导 |
| 注册新站点 | 按钮 disabled, 点击后 toast "功能未接入" | ❌ 无误导 (明确告知) |
| 启用/禁用 | 按钮 disabled + tooltip + toast "功能未接入" | ❌ 无误导 |
| SSO | 按钮 disabled + tooltip + toast "SSO 未接入 (REQ-2.1.2 blocked_by_auth)" | ❌ 无误导 |
| 数据一致性校验 | 真实调 `/api/sync/consistency`, 显示真实报告 | ❌ 无误导 |

**R.1 §7 措辞检查**: 页面源码无 `toast(.*已暂停)` / `toast(.*暂停成功)` / `toast(.*已启用)` / `toast(.*已禁用)` / `toast(.*跳转成功)` / `toast(.*同步成功)` / `toast(.*站点创建成功)` 任何一个。

---

## 6. Mock / Simulator / DRY_RUN / 真控制 区分

| 类别 | R.9A 范围 |
|---|---|
| Mock | ❌ 无 (移除 `mockSites` / `mockSiteProvider`) |
| Simulator | ❌ 无 (移除 setTimeout 假操作) |
| DRY_RUN | ❌ 不涉及 (R.9A 范围仅 UI, 不涉及控制命令) |
| 真控制 | ❌ 不涉及 (R.9A 不修改 executor / control_command) |
| **真后端读取** | ✅ `/api/sites` (derived 7 站点) + `/api/sync/consistency` (R.7) |
| **真前端展示** | ✅ 完整真实化: dataSource Badge + 派生说明 + 错误态/空态 + 按钮 disabled |

---

## 7. Missing pieces (不隐藏)

| # | 缺失项 | 阻塞类型 | 解锁条件 |
|---|---|---|---|
| 1 | 站点名称/IP/联系人/数据中心 | `blocked_by_source_schema` | 源端 `tbl_site` 需有真实数据, 站点推 `tbl_site` package |
| 2 | 站点新增/编辑/删除 | `blocked_by_source_schema` + `blocked_by_site_change` | 需 `unified_site_registry` 表 (R.8A-1 设计) + 站点 app 配合 |
| 3 | 站点启用/禁用 | `blocked_by_source_schema` | 需 `unified_site_registry.enabled` 字段 |
| 4 | SSO 跳转 | `blocked_by_auth` | 需 REQ-2.2.1 (ADFS) 解锁 + 站点 SSO token 接受端点 |
| 5 | 站点存储容量真实数据 | `blocked_by_source_schema` | 需源端提供 storage 数据包 |

---

## 8. Blocker type (8 选 1)

| REQ ID | R.9A 后 Blocker |
|---|---|
| REQ-2.1.1 | `blocked_by_source_schema` (源端 `tbl_site` 0 行) |
| REQ-2.1.2 | `blocked_by_auth` (依赖 ADFS) |
| REQ-2.1.3 | `blocked_by_source_schema` (源端监控表数据不足) |

---

## 9. 需要的源端 schema / 站点 API 变更清单

| 变更项 | 涉及表 / API | 决策人 |
|---|---|---|
| `tbl_site` 真实数据行 (站点名称/IP/联系人) | `tbl_site` | 站点运维 |
| `tbl_site` 增加 `enabled` 字段 | `tbl_site` | 站点运维 |
| 站点推 `tbl_site` package 到中心库 | 站点 app | 站点 app 团队 |
| 提供站点 SSO token 接受端点 | 站点 API | 站点架构师 |
| ADFS 接入 (Sprint 5.x 解锁) | — | 领导决策 |

---

## 10. Verdict

**pass** — R.9A 仅做 /sites 页面真实化, 不新增功能/表/API, 完全符合 R.1 9 大强约束 + R.5 10 项禁止 + 7 项验证全绿。

---

## 11. 7 项验证

- [x] `pnpm exec tsc --noEmit` 0 错
- [x] `pnpm build` 成功
- [x] `pnpm smoke:sync` 通过
- [x] `pnpm check:sync-consistency -- --siteCode=SH01` 7/7 matched
- [x] `pnpm baseline:check` 13/13 通过
- [x] `pnpm e2e:sites` 22/22 通过
- [x] `pnpm e2e:all` 91/91 通过

---

## 12. R.5 强约束自检 (10 项禁止)

- ❌ 偷偷新增页面: **无**
- ❌ 偷偷新增按钮: **无** (仅保留原有按钮, 加 disabled)
- ❌ 写了按钮但不测点击: **无** (Power/SSO/注册 三个按钮都 e2e 验证 disabled)
- ❌ 写了 API 但不接前端: **无** (`/api/sites` R.4 已接, R.9A 加 `useEffect`)
- ❌ 接了前端但不测浏览器: **无** (e2e:sites 22 项含 HTML 渲染检查)
- ❌ 用 mock 冒充真实数据: **无** (移除 mockSites, 走 `/api/sites`)
- ❌ 用 toast 冒充成功: **无** (无 "成功" 类 toast)
- ❌ 用 DRY_RUN 冒充真实执行: **无** (R.9A 不涉及控制)
- ❌ 用 200 响应冒充需求完成: **无** (REVIEW 中明确标 `partial`)
- ❌ 只跑 tsc/build 不跑业务事件测试: **无** (e2e:all 91/91)

---

## 13. requirements 完成度

- **总需求数**: 45
- **complete**: 7 (R.3 重算, R.4 维持)
- **partial**: 13 (R.4 +1, R.9A 不变)
- **blocked_by_source_schema**: 6
- **blocked_by_site_change**: 5
- **blocked_by_auth**: 9 (R.4 +2)
- **blocked_by_external_system**: 2 (R.4 +2)
- **not_started**: 8 (R.4 +1)
- **out_of_scope**: 0 (R.4 修正 R.2 违规, 0 项)
- **requirements 完成率**: 7 / (45 - 0) = **15.6%** (与 R.3/R.4/R.6/R.7 一致, R.9A 不变)

**公式依据**: CLAUDE.md 附录 B: `complete / (total - out_of_scope) × 100%`
- R.3: 7/45 = 15.6%
- R.4: 7/45 = 15.6% (修 bug 不增能力)
- R.6: 7/45 = 15.6% (修 e2e 不增能力)
- R.7: 7/45 = 15.6% (一致性 +1, partial)
- **R.9A: 7/45 = 15.6%** (页面真实化不改变需求侧状态)

**变化**: 0 (R.9A 是实现层修复, 不改变需求侧状态, 公式与 R.3/R.4/R.6/R.7 完全一致)
