# Sprint login-bg-r5 — Requirements Strict Review

> r5 范围:背景渐变增密(4 色斑)+ 节点加密(12-20 → 25-35)+ 3 枢纽节点(SH01/BJ02/GZ03)+ 输入框回滚实色。纯视觉,0 后端。

---

## 0. Sprint 元信息

| 字段 | 值 |
|---|---|
| Sprint ID | `Sprint login-bg-r5` |
| Sprint 标题 | 背景渐变 + 节点加密 + 枢纽节点 |
| 日期 | 2026-06-22 |
| 对应 requirement | `requirements.md §2.2.UI` |
| 上游 | r3 / r4 |

---

## 1. Requirement IDs

| Req ID | 状态 | 备注 |
|---|---|---|
| REQ-2.2.UI | `partial` | r5: 背景 mesh + 节点加密 + hub |

---

## 4. 实现明细

| 文件 | 改动 | commit |
|---|---|---|
| `app/login/page.tsx` | 背景 1 色斑 → 4 色斑 mesh | `f6f71b2` |
| `components/auth/login-background.tsx` | Node/Edge 接口扩 isHub/hubLabel/hub + buildGraph 重写 + drawTopology 3 阶段 | `f6f71b2` |
| `components/auth/login-card.tsx` | 输入框回滚到 `bg-slate-950/60` 实色 | `f6f71b2` |
| `scripts/e2e/test-login.ts` | 加 5 项 r5 断言 | `f6f71b2` |

---

## 5. 后端真实能力

0 后端改动。

---

## 6. UI 真实能力

| 元素 | 真实行为 |
|---|---|
| 背景 | 4 个 radial-gradient 色斑(深蓝 #1e3a8a / 蓝紫 #5b21b6 / 青绿 #0e7490 / 靛紫 #4338ca),CSS-only,GPU 合成层 |
| 普通节点 | 25-35 个,半径 1.6-2.8px,蓝色脉冲 |
| 枢纽节点 | 3 个 (SH01/BJ02/GZ03),固定位置,外圈 8x 光晕,亮蓝白核心,label |
| Hub 连线 | 1.2px,rgba(147,197,253,0.55) |
| 普通连线 | 1px,rgba(96,165,250,0.35) |
| 输入框 | 恢复实色 `bg-slate-950/60` (LoginCard 玻璃感独立,输入框不参与) |

---

## 7. Mock / 真控制

0 mock / 0 DRY_RUN。

---

## 8. 缺失件

无新增。

---

## 9. Blocker

无。

---

## 10. 源端 schema/API 变更

无。

---

## 11. 完成率

| 维度 | 数值 |
|---|---|
| 涉及 Req ID | 1 |
| `partial` | 1 |

---

## 12. Verdict: `partial`

**理由**:
- ✅ 背景 mesh 4 色斑(品牌冷色系,主色不变)
- ✅ 节点加密 +75%(12-20 → 25-35)
- ✅ 3 枢纽节点(SH01/BJ02/GZ03)有 label 和光晕
- ✅ 输入框回滚实色,毛玻璃感聚焦在 LoginCard 主体
- ✅ 27/27 e2e 通过
- ⚠️ SSO 仍 `blocked_by_auth`

**美学决策**:
- 4 色斑位置分布四角(左上/右上/中下偏右/中下偏左),不重叠,自然过渡
- 枢纽节点位置:左上(15%, 22%) / 右上(82%, 32%) / 中下(50%, 78%) — 黄金分割三角
- label 字号 10px 不抢眼,但提供"主体"标识

**性能分析**:
- 节点数 25-35 → Canvas drawTopology O(N+E),现代 GPU 单帧 < 5ms
- 背景 4 radial-gradient → CSS 静态,0 重绘
- 字体 ctx.fillText → 3 次/帧,可忽略

---

## 13. 附录 — 设计对比

| 维度 | r4 | r5 |
|---|---|---|
| 背景色斑 | 1 | 4 |
| 节点数 | 12-20 | 25-35 |
| 枢纽节点 | 0 | 3 (带 label) |
| Hub 连线 alpha | — | 0.55 |
| 输入框背景 | 实色 | 实色 (回滚) |

注:r4 曾把输入框改成 `bg-slate-950/40 + backdrop-blur-sm`,r5 回滚到原 `bg-slate-950/60` 实色,毛玻璃感只给 LoginCard 主体。