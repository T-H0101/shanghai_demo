# Sprint R.19E Frontend Integration Plan

1. 新增白盒事件测试 `scripts/e2e/test-frontend-integration.ts` 并纳入 `e2e:all`。
2. 抽取真实 `ControlCommandPanel`，复用现有 `/api/control/commands`。
3. 在 `/tasks` 增加 URL 驱动的任务/命令双视图。
4. 将 `/control` 改为兼容重定向，移除侧栏重复入口。
5. 将顶部伪搜索替换为真实 `/search` 导航入口。
6. 更新 R.19E requirements review、PROJECT_STATUS、ROADMAP。
7. 运行前端专项和完整提交门禁。
