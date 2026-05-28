# 方案展示站

双击 `index.html` 即可在浏览器中打开。

## 内容章节

| 章节 | 来源 |
|------|------|
| 项目概览 | 静态生成 |
| 系统架构 | `architecture/system-architecture.md` |
| 数据同步方案 | `architecture/sync-flow.md` |
| 同步范围 | `database-analysis/sync-candidates.md` |
| 大表处理 | `architecture/large-table-strategy.md` |
| ID策略 | `architecture/id-strategy.md` |
| 当前Demo | 截图 |
| 下一阶段 | 静态生成 |

## 独立汇报文件

生成单文件 HTML（可发给领导）:

```bash
cd docs/presentation && node gen.js
```

输出: `/Users/tian/Desktop/上海/统一平台方案汇报.html`

## 技术特性

- 纯静态，无 Node.js 依赖
- 离线可用（CDN 缓存后）
- 深色/浅色主题切换
- Markdown 渲染 + Mermaid 图表