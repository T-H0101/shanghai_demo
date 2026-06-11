# Sprint R.9A-Review — /sites 真实化 Post-Review

> **日期**: 2026-06-11
> **范围**: 仅复核 R.9A, 不新增功能
> **结论**: ✅ R.9A 通过, 修复 1 处文档小 bug (requirements 完成率公式不一致)

---

## 1. Push 结果

```
$ git push origin main
To https://github.com/T-H0101/shanghai_demo.git
   690f0aa..c84b979  main -> main
```

**✅ 推送成功** — `c84b979 fix: connect sites page to real sites api` 已上 remote

---

## 2. mockSites / mockSiteProvider 引用检查

| 引用类型 | 结果 |
|---|---|
| `import { sites as mockSites }` | ✅ 不存在 |
| `from "@/lib/mock/sites"` | ✅ 不存在 |
| `mockSiteProvider` import | ✅ 不存在 |
| 注释中提及 (历史描述) | ⚠️ 6 行命中, 全部为 `*` 注释块 / `//` 注释, 描述 R.9A 改造前的旧状态, **不影响运行** |

**结论**: ✅ /sites 页面运行时不引用任何 mock, 真实接入 /api/sites

---

## 3. 按钮禁用 / Toast 检查

### 3.1 按钮状态 (4 个交互按钮 + 1 个真实)

| 按钮 | disabled | tooltip | onClick | 真实后端 |
|---|---|---|---|---|
| 刷新 | `disabled={loading}` | — | `loadSites()` | ✅ 真实 fetch /api/sites |
| 注册新站点 | `disabled` | "站点登记功能未接入" | `handleUnsupported("注册新站点")` | ❌ 不存在, 显式提示 |
| 启用/禁用 (Power) | `disabled` | "站点启用/禁用功能未接入" | `handleUnsupported("启用/禁用")` | ❌ 不存在, 显式提示 |
| SSO | `disabled` | "SSO 跳转功能未接入 (REQ-2.1.2 blocked_by_auth)" | `handleUnsupported("SSO 跳转")` | ❌ blocked_by_auth, 显式提示 |
| 数据一致性校验 | `disabled={checking}` | — | `fetch /api/sync/consistency` | ✅ 真实 R.7 API |

### 3.2 Toast 文案审计 (R.1 §7)

| 模式 | 命中数 | 详情 |
|---|---|---|
| "已暂停" / "暂停成功" | 0 | ✅ |
| "已启用" / "已禁用" | 0 | ✅ |
| "跳转成功" | 0 | ✅ |
| "同步成功" | 0 | ✅ |
| "站点创建成功" | 0 | ✅ |
| **"功能未接入"** | 3 (L175 + 3 次点击触发) | ✅ 显式告知 blocked |

**handleUnsupported toast 真实内容**:
```typescript
title: "功能未接入",
description: `${feature}：站点登记功能未接入，当前 /api/sites 仅提供列表与一致性校验`,
variant: "destructive"
```
- ✅ 标题不含"成功"
- ✅ description 显式说明功能未接入
- ✅ variant: destructive 视觉明确为警告/错误

**一致性校验 toast**: "校验完成" (描述操作结果, 不是误导, e2e 已验证)

---

## 4. /api/sites API 检查

### 4.1 实测响应

```
HTTP 200
dataSource=derived
source=unified_tasks/unified_devices/unified_volumes/sync_package_log
data[]=7 站点
meta.requirement.id=REQ-2.1.1
meta.requirement.status=blocked_by_source_schema
```

### 4.2 审计清单

| 项 | 结果 |
|---|---|
| dataSource 不为 mock | ✅ derived (允许值之一) |
| dataSource 允许值 | ✅ database / derived / empty / error |
| 失败时不允许 fallback mock | ✅ route.ts catch (L179-192) 返回 dataSource=error, **不**返回 mock |
| meta.requirement 显式 | ✅ REQ-2.1.1 / blocked_by_source_schema |

---

## 5. 浏览器 / e2e 检查

### 5.1 e2e:sites (22/22 ✅)

所有 R.9A 新增检查项全部通过:
- ✅ 页面 /sites 200
- ✅ /api/sites 200
- ✅ dataSource=derived (≠ mock)
- ✅ 7 站点 (含 source=unified_tasks/...)
- ✅ 页面不再 import mockSites / mockSiteProvider
- ✅ 页面不再硬编码 6 mock 站点名
- ✅ fetch /api/sites 已接入
- ✅ dataSource 标识在源码
- ✅ 4 个按钮 (注册/Power/SSO/刷新) 状态正确
- ✅ 误导 toast/onClick 措辞 0 命中
- ✅ error / empty 错误态已处理
- ✅ 一致性校验调 /api/sync/consistency
- ✅ 7 核心 API siteCode 联动 7/7
- ✅ 派生 siteCode 与 unified_tasks 重叠 5/5
- ✅ HTML 不再渲染 mock 6 站点全名

### 5.2 e2e:all (91/91 ✅)

| 脚本 | 通过 |
|---|---|
| Dashboard | 9/9 |
| Tasks | 11/11 |
| Sync | 17/17 |
| Control | 19/19 |
| Sites (R.9A) | 22/22 |
| Search | 13/13 |
| **合计** | **91/91** |

---

## 6. requirements 完成率公式一致性

### 6.1 R.9A 第一次产出 (commit c84b979) 公式

```markdown
## 13. requirements 完成度
- complete: 9
- partial: 13
- blocked_by_*: ...
- requirements 完成率: 9/(45-2) = 20.9%
```

### 6.2 ❌ 不一致问题

| 维度 | R.3/R.4/R.6/R.7 | R.9A 初版 (c84b979) | 问题 |
|---|---|---|---|
| 公式 | `complete / (total - out_of_scope) × 100%` | `9/(45-2)` | ❌ 公式不同 |
| complete | 7 | 9 | ❌ 数字错误 (R.3 后 complete 一直是 7) |
| 完成率 | **15.6%** | 20.9% | ❌ 错误 |
| 与 baseline 矩阵对齐 | ✅ 7/45 | ❌ 9/43 | ❌ 漂移 |

### 6.3 ✅ 修正 (本 Sprint R.9A-Review)

R.9A-requirements-review.md 文档已修正:

```markdown
## 13. requirements 完成度
- complete: 7 (R.3 重算, R.4 维持)
- partial: 13
- blocked_by_source_schema: 6
- blocked_by_site_change: 5
- blocked_by_auth: 9 (R.4 +2)
- blocked_by_external_system: 2 (R.4 +2)
- not_started: 8 (R.4 +1)
- out_of_scope: 0 (R.4 修正 R.2 违规)
- requirements 完成率: 7 / (45 - 0) = 15.6%
```

### 6.4 公式依据 (CLAUDE.md 附录 B)

```
requirements 完成率 = complete / (total - out_of_scope) × 100%
```

**R.x 全部一致**:
- R.2: 9/41 = 22.0% (R.3 之前)
- R.3: 7/45 = 15.6% (重算, 揭露 R.2 漏 2 项)
- R.4: 7/45 = 15.6% (修 bug 不增能力)
- R.6: 7/45 = 15.6% (修 e2e 不增能力)
- R.7: 7/45 = 15.6% (一致性 +1, partial)
- **R.9A: 7/45 = 15.6%** (页面真实化不改变需求侧状态)

---

## 7. 7 项验证结果 (R.9A-Review 重跑)

| # | 命令 | 结果 |
|---|---|---|
| 1 | `pnpm exec tsc --noEmit` | ✅ 0 错 |
| 2 | `pnpm build` | ✅ 成功 |
| 3 | `pnpm smoke:sync` | ✅ passed |
| 4 | `pnpm check:sync-consistency -- --siteCode=SH01` | ✅ 7/7 matched |
| 5 | `pnpm baseline:check` | ✅ 13/13 |
| 6 | `pnpm e2e:sites` | ✅ 22/22 |
| 7 | `pnpm e2e:all` | ✅ 91/91 |

---

## 8. R.9A-Review 修复清单

| # | 修复项 | 严重度 | 文件 |
|---|---|---|---|
| 1 | requirements 完成率公式: 9/(45-2) → 7/(45-0) = 15.6% | 🟡 中 (误导读者) | docs/database-analysis/sprint-r.9a-requirements-review.md §13 |

**无功能性 bug**, 仅 1 处文档数字错误。

---

## 9. 约束自检

- ✅ 不新增业务功能
- ✅ 不新增数据库表/API/页面
- ✅ 不改 mock 数据结构
- ✅ 不写 secret / env
- ✅ 不修改 source_restore / star_storage_db
- ✅ 不删除目录/数据库
- ✅ 不修改 R.9A 实际代码 (c84b979)
- ✅ 不修改 requirements-traceability.md (主基线已 15.6%)
- ✅ 仅修正 R.9A review 文档中的 1 处数字

---

## 10. 提交信息

```
fix: review sites real data integration
```

修正内容:
- `docs/database-analysis/sprint-r.9a-requirements-review.md` §13 数字 (20.9% → 15.6%, 与 R.3/R.4/R.6/R.7 一致)
