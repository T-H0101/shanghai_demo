# Sprint login-bg-r3 — Requirements Strict Review

> r3 范围:登录页背景微调 — 加 1 个色斑 + 1 个 vignette + 拓扑 alpha 微降。纯视觉,0 后端。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint login-bg-r3` |
| Sprint 标题 | 登录背景渐变 + 拓扑 alpha 微调 |
| 日期 | 2026-06-21 |
| 对应 requirement 节 | `requirements.md §2.2 统一身份认证` UI 子维度 |
| 关联文档 | `docs/superpowers/specs/2026-06-21-login-bg-r3-design.md` |
| 上游 | `Sprint login-redesign` + `Sprint login-cmd-r2` |
| 总控负责人 | (TBD) |
| 验证人 | (TBD) |

---

## 1. Requirement IDs 列表

| Req ID | 需求原文 | 状态 | 备注 |
|---|---|---|---|
| REQ-2.2.UI | 登录入口呈现 (UI/UX) | `partial` | r3 增强 — 渐变 + 玻璃感 |

> 仅 1 个 Req ID 涉及,其他 (2.2.1/2/3) 沿用上一 Sprint 状态。

---

## 2. Requirement 原始文本 (摘录)

```
§2.2 统一身份认证
核心: 实现集团级统一登录, 打通企业域账号体系, 保障账号安全与便捷访问。
```

r3 不涉及新条款,纯视觉增强。

---

## 3. 状态枚举

| Req ID | 状态 | 解释 |
|---|---|---|
| REQ-2.2.UI | `partial` | r3: 中间空白 + 拓扑线降权(给色斑让位) |

---

## 4. 实现明细

| Req ID | 文件 | 改动 | commit |
|---|---|---|---|
| REQ-2.2.UI | `app/login/page.tsx` | 容器 div 加 inline `style` (2 个 radial-gradient) | `dd7b8d6` |
| REQ-2.2.UI | `components/auth/login-background.tsx` | 拓扑线 alpha 0.35→0.28,节点 alpha 0.6→0.5 | `dd7b8d6` |
| REQ-2.2.UI | `scripts/e2e/test-login.ts` | 加 1 项 `radial-gradient` 断言 | `dd7b8d6` |
| REQ-2.2.UI | `docs/superpowers/specs/2026-06-21-login-bg-r3-design.md` | 新增 spec | `dd7b8d6` |

---

## 5. 后端真实能力

无后端改动。

---

## 6. UI 真实能力

| 元素 | 真实行为 |
|---|---|
| 页面底层 | inline style 双层 radial-gradient (色斑 + vignette), SSR 序列化进 HTML |
| 拓扑线 | Canvas 绘制,alpha 0.28 |
| 节点 | alpha 0.5,带 r*4 光晕 |

---

## 7. Mock / Simulator / 真控制

0 mock / 0 simulator / 0 DRY_RUN。

---

## 8. 缺失件

无。r3 未引入新缺失件。

---

## 9. Blocker

无新增。

---

## 10. 源端 schema/API 变更清单

无。

---

## 11. 完成率

| 维度 | 数值 |
|---|---|
| 本 Sprint 涉及 Req ID | 1 |
| `complete` | 0 |
| `partial` | 1 (REQ-2.2.UI) |
| `not_started` | 0 |
| `blocked_*` | 0 |
| `out_of_scope` | 0 |
| **本 Sprint 完成率** | 0 / 1 = **0%** (UI 子维度,SSO 仍未达 complete) |

注:数字公式严格按附录 B,但 r3 是 UI 增强,不计 complete。

---

## 12. 最终判决

### Verdict: `partial`

**理由**:
- ✅ 1 色斑 + 1 vignette + 拓扑线降 alpha,中间空白填补
- ✅ 性能 0 影响(CSS 静态 + GPU 合成层)
- ✅ 主题不破坏(品牌冷色系内)
- ✅ 18/18 e2e 通过(原 17 + 1 r3 新增)
- ⚠️ SSO 仍 `blocked_by_auth`(沿用)

**美学决策**:
- 色斑颜色 `#5b21b6` (蓝紫) 与品牌 `#3b82f6` (蓝) 同色相,色温偏冷
- opacity 0.18 — 在"克制"范围,用户明确"加一点就行"
- vignette opacity 0.4 — 边缘暗化收焦点,不喧宾夺主

---

## 13. 提交前检查清单

- [x] §1 所有 Req ID 已列
- [x] §3 每个 Req ID 打了状态标签
- [x] §5 后端真实能力 — 0 后端
- [x] §7 mock/simulator/DRY_RUN — 0
- [x] §8 缺失件 — 无
- [x] §10 schema/API 变更 — 无
- [x] §11 完成率已计算
- [x] §12 verdict 给出 (`partial`)
- [x] 文件命名 `sprint-login-bg-r3-requirements-review.md` 放在 `docs/database-analysis/`
- [ ] PR 已更新 (待推送,网络超时)
- [ ] PROJECT_STATUS.md / ROADMAP.md (领导决定)