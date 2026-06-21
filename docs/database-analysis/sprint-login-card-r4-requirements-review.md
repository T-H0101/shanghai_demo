# Sprint login-card-r4 — Requirements Strict Review

> r4 范围:登录页毛玻璃质感增强 + 拓扑线 alpha 回滚。纯视觉,0 后端。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint login-card-r4` |
| Sprint 标题 | 登录卡玻璃感增强 + 拓扑线主体回滚 |
| 日期 | 2026-06-21 |
| 对应 requirement | `requirements.md §2.2.UI` (登录入口呈现) |
| 关联文档 | (无独立 spec, 沿用 r3 spec 框架) |
| 上游 | `login-bg-r3` |

---

## 1. Requirement IDs

| Req ID | 状态 | 备注 |
|---|---|---|
| REQ-2.2.UI | `partial` | r4: 玻璃质感增强 + 拓扑线主体 |

---

## 4. 实现明细

| 文件 | 改动 | commit |
|---|---|---|
| `components/auth/login-background.tsx` | 拓扑线 0.28→0.4, 节点 0.5→0.6 | `2afe6e9` |
| `components/auth/login-card.tsx` | 玻璃质感增强 (4 处) | `2afe6e9` |
| `scripts/e2e/test-login.ts` | 加 4 项 r4 断言 | `2afe6e9` |

---

## 5. 后端真实能力

0 后端改动。

---

## 6. UI 真实能力

| 元素 | 真实行为 |
|---|---|
| 玻璃卡 | `bg-white/12` + `backdrop-blur-2xl` + `backdrop-saturate-180`,背景穿透更明显 |
| Inner highlight | 顶部 1px 白光线 + 内层柔渐变,模拟光线打在玻璃面的反射 |
| 输入框 | `bg-slate-950/40` + `backdrop-blur-sm`,允许背景轻透入 |
| 拓扑线 | alpha 0.4,主体感回归 |

---

## 7. Mock / 真控制

0 mock / 0 DRY_RUN。

---

## 8. 缺失件

无新增。

---

## 11. 完成率

| 维度 | 数值 |
|---|---|
| 涉及 Req ID | 1 |
| `partial` | 1 |

---

## 12. Verdict: `partial`

**理由**:
- ✅ 玻璃质感大幅提升 (bg 12% + blur-2xl + saturate-180)
- ✅ 拓扑线主体回归 (alpha 0.4)
- ✅ 22/22 e2e 通过
- ✅ 性能 0 影响 (CSS 静态)
- ⚠️ SSO 仍 `blocked_by_auth`

---

## 13. 附录 — r4 设计细节

### 玻璃质感决策 (iPhone/Codex 范式)

| 属性 | r3 | r4 | 理由 |
|---|---|---|---|
| 背景透明度 | `bg-white/8` | `bg-white/12` | 8% 太弱,几乎看不出透明 |
| 模糊半径 | `backdrop-blur-xl` (24px) | `backdrop-blur-2xl` (40px) | 更强模糊让背景"软化" |
| 饱和度滤镜 | 无 | `backdrop-saturate-180` | 透过玻璃的颜色更鲜艳 |
| Inner highlight | 无 | 顶部 1px + 内层渐变 | 模拟光线打在玻璃面 |
| 输入框透明度 | `bg-slate-950/60` | `bg-slate-950/40` | 让玻璃面"贯穿" |
| 拓扑线 alpha | 0.28 (r3) | 0.4 (回滚) | 给玻璃面"供颜色变化" |

### 性能分析

- `bg-white/12` + `backdrop-blur-2xl` + `backdrop-saturate-180`:浏览器 GPU 合成层,静态,0 重绘
- Inner highlight:`bg-gradient-to-r ... transparent`:同上,静态
- 拓扑 alpha 回滚:只是数字变化,Canvas 渲染无额外开销