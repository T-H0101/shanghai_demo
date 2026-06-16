# Sprint UI-2026-06-D — Hover/UX 精细化 v2 — Requirements Review

## 1. 修复点

| # | 问题 | 修复 |
|---|---|---|
| 1 | Dashboard 重复 key 警告 (1/2/3) | skeleton 加前缀 (`alert-skeleton-` / `task-skeleton-` / `heatmap-`) |
| 2 | 搜索页 hover 与高亮不匹配 | 行加 `hover:bg-blue-50/50` + `cursor-pointer`; 按钮加 AppTooltip + cursor-pointer |
| 3 | FirstRunCoach 引导 5s 太短, 第 4/5 步看不到 | AUTO_NEXT_MS 5s → 8s; 加 scrollIntoView; 加进度点; 加暂停/上一步; 气泡加宽到 320px |
| 4 | 命令面板 ESC kbd 与 placeholder 视觉重叠 | 移除 Input 旁的 ESC kbd, 移到底部 footer (ESC 行为保留) |

## 2. Implementation

| 文件 | 修改 |
|---|---|
| `components/dashboard/alert-center.tsx` | skeleton key 加前缀 |
| `components/dashboard/task-table.tsx` | skeleton key 加前缀 |
| `components/dashboard/site-health-heatmap.tsx` | key 加前缀 + idx |
| `components/shared/first-run-coach.tsx` | AUTO_NEXT 5s→8s, scrollIntoView, 暂停/上一步按钮, 进度点, 320px 宽 |
| `components/shared/command-palette.tsx` | 移除 Input 旁 ESC kbd, 移到底部 footer |
| `app/search/page.tsx` | AppTooltip 包裹 4 个按钮 + 行 hover + cursor-pointer |
| `scripts/e2e/test-header-ux-lift.ts` | 76 → 94 项 |

## 3. Verdict

**pass** — 94/94 事件级测试 + 全套 e2e 0 fail

```
pnpm exec tsc --noEmit    ✅ 0 error
pnpm e2e:all              ✅ 0 fail
  - e2e:header-ux-lift    ✅ 94 pass (76 → 94, +18)
  - e2e:console-usability ✅ 45 pass
  - e2e:frontend-integration ✅ 9 pass
  - e2e:site-agent-control  ✅ R.19D PASS
```
