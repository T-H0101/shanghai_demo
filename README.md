# 统一光盘库总控平台

> 集团层级的统一管控平台。
> 它**不替代**各站点原有的光盘库管理软件，只在它们之上做统一查看、统一检索、统一任务派发和统一审计。
> 任何站点的本地数据都先同步到中心库，总控永远从中心库读取，绝不直接读站点的生产库。

---

## 这份文档给谁看

- **第一次接触代码的同事**：想了解项目是做什么的、怎么跑起来、目录在哪。
- **运维同事**：想了解怎么部署、依赖哪些外部服务、需要准备什么密钥。
- **测试或质量同事**：想了解怎么验证主链路是通的、怎么读需求完成度。
- **管理者**：想看当前做到什么程度、卡在哪里。

如果只想跑起来看效果，跳到 [第一节「本地起一个开发环境」](#1-本地起一个开发环境-五分钟)。

---

## 目录

1. [本地起一个开发环境](#1-本地起一个开发环境-五分钟)
2. [项目是什么，做什么](#2-项目是什么-做什么)
3. [目录结构说明](#3-目录结构说明)
4. [核心数据流是怎么走的](#4-核心数据流是怎么走的)
5. [日常开发常用命令](#5-日常开发常用命令)
6. [怎么验证修改是好的](#6-怎么验证修改是好的)
7. [部署到测试或生产环境](#7-部署到测试或生产环境)
   - 7.6 [各种部署方式](#76-各种部署方式按场景选)（PM2 / Docker / k8s / Vercel / Windows / nginx）
   - 7.7 [部署出错速查](#77-部署出错速查)
8. [需要外部提供的依赖](#8-需要外部提供的依赖)
9. [需求完成度怎么看](#9-需求完成度怎么看)
10. [禁止事项](#10-禁止事项)
11. [附录 A：Dockerfile + Compose 模板](#附录-adockerfile--compose-模板)
12. [附录 B：常用 SQL 查询](#附录-b常用-sql-查询)
13. [附录 C：端口占用参考](#附录-c端口占用参考)
14. [附录 D：常见问题](#附录-d常见问题)
15. [附录 E：贡献者必读](#附录-e贡献者必读)
16. [附录 F：文档索引](#附录-f文档索引)

---

## 1. 本地起一个开发环境（五分钟）

### 1.1 准备工具

需要装好：

| 工具 | 版本要求 | 检查命令 |
|---|---|---|
| Node.js | 18 或 20 | `node -v` |
| pnpm | 9 或 10 | `pnpm -v` |
| Docker Desktop | 任意较新版本 | `docker -v` |
| Git | 任意较新版本 | `git --version` |

如果用的是 macOS，推荐用 Homebrew：`brew install node pnpm docker`。

### 1.2 拉代码、装依赖

```bash
git clone <仓库地址>
cd 上海
pnpm install
```

`pnpm install` 会下载前端依赖（Next.js、React、Tailwind 等）。如果装不上，删掉 `node_modules` 重新试一次。

### 1.3 起数据库

项目用 PostgreSQL 17 存中心数据。docker-compose 已经写好了，直接起：

```bash
pnpm db:up
```

第一次跑会下载 postgres:17 镜像，等几十秒。看到 `unified_disc_postgres` 容器状态是 healthy 就好了。

如果想看启动日志：

```bash
pnpm db:logs
```

### 1.4 准备环境变量

```bash
cp .env.example .env.local
```

`.env.local` 不会被提交到 git。示例文件默认使用真实 API 模式；本地开发只需要按需替换连接地址和密钥引用。

### 1.5 初始化中心库（首次启动）

```bash
pnpm db:init        # 建当前完整中心库 schema + auth bootstrap
```

完成后应该有：

- 中心库 `unified_disc_platform` 已建好
- 当前版本需要的 DDL patch 已执行（同步日志、控制队列、审计、Auth、检索索引表等）
- 默认账号 `admin / admin` 已生效（角色：集团管理员）

### 1.6 启动前端

```bash
pnpm dev
```

打开浏览器访问 <http://localhost:3000>，用 `admin / admin` 登录。

第一次进入会看到首页有 4 大通道：同步、控制、检索、安全。如果哪个通道显示「待接入」或「阻塞」，是正常的——本地环境没有对接外部服务（详见 [第 8 节](#8-需要外部提供的依赖)）。

### 1.7 跑通完整链路（可选但推荐）

下面这串命令依次跑完，验证整个项目能跑：

```bash
# ⚠️ set -a 仅适合本地开发,把 .env.local 的 key 注入当前 shell
# 生产部署请用 systemd EnvironmentFile= / k8s secretRef / vault,不要 set -a
set -a && source .env.local && set +a
pnpm exec tsc --noEmit        # TypeScript 类型检查
pnpm build                    # 生产构建
pnpm smoke:sync               # 同步链路冒烟测试
pnpm check:sync-consistency -- --siteCode=SH01
                                # 一致性检查
pnpm baseline:check           # 项目基线冻结检查
```

全过才算 OK。任何一步出错，停下来看错误信息——通常是数据库没起、env 没 load、或端口被占。

---

## 2. 项目是什么，做什么

### 2.1 一句话解释

把分散在全国各地 N 个光盘库管理系统的数据，集中同步到一个 PostgreSQL 中心库，再在中心库之上做一个统一管控平台，给集团运维和审计用。

### 2.2 它解决了什么问题

| 问题 | 这个项目的做法 |
|---|---|
| 各站点系统不一样，没法集中看 | 站点数据导出成 SQL 包，统一摄入中心库 |
| 站点多了之后，找一个文件要挨个系统登录 | 中心库统一检索（用 OpenSearch 加速） |
| 总部要统一派发任务给站点（新建、暂停、巡检） | 控制命令走队列 + 站点 Agent 主动拉取执行 |
| 出问题了不知道谁改了什么 | 所有操作写审计日志，签名验签 |
| 一线人员看不懂系统内部实现 | UI 用统一风格，文案写人话，阻塞就明说阻塞 |

### 2.3 它不是什么

- **不是光盘库管理系统本身**：每个站点还在用各自的本地系统（比如 IBM TS 系列），总控不替代它。
- **不是实时同步**：默认 60 分钟一轮。实时性要求高的场景走站点 Agent 推送。
- **不是单一权限系统**：本地有 JWT + RBAC，正式生产需要接 ADFS/LDAP（详见 [第 8 节](#8-需要外部提供的依赖)）。

### 2.4 数字盘点（2026-06-21 快照）

| 维度 | 数字 |
|---|---|
| 严格完成的需求（真后端 + 真 UI + 真测试） | **29 / 45 = 64.4%** |
| 已写代码但需外部条件才能算严格完成 | 16 项 |
| 总控页面路由(`app/<段>/page.tsx`,不含 /login 与 /api) | 11 个(加 /login 共 12 个) |
| 后端 API 路由(`app/api/<段>/route.ts`) | 数十个 |
| 同步白名单表 | 13 张(`lib/sync/dump/manifest.ts:DUMP_ALLOWED_TABLES`) |
| 完整站点 schema 审计范围 | 170 张 |
| 同步链路 e2e 测试 | 以当前 `pnpm e2e:all` 输出为准 |

> ⚠️ 严格数和候选数**不能合并汇报**。候选数（45/45）是「代码已落地但生产条件不具备」，严格数（29/45）是「真后端、真 UI、真测试」。

---

## 3. 目录结构说明

```
上海/
├── app/                        # Next.js 路由（每个目录是一个 URL 段）
│   ├── page.tsx                # 首页（总控首页 / 4 大通道）
│   ├── login/                  # 登录
│   ├── tasks/                  # 任务管理
│   ├── sync/                   # 同步管理
│   ├── racks/                  # 盘架
│   ├── volumes/                # 卷
│   ├── sites/                  # 站点
│   ├── users/                  # 用户与权限
│   ├── logs/                   # 日志
│   ├── search/                 # 检索
│   ├── settings/               # 设置
│   ├── control/                # 控制命令
│   └── api/                    # 后端 API 端点（每个 route.ts 是一个 URL）
│
├── components/                 # React 组件
│   ├── ui/                     # 基础组件（按钮、表格、对话框）
│   ├── platform/               # 平台级组件（GlassPanel、CapsuleTabs 等）
│   ├── dashboard/              # 总控首页相关
│   ├── tasks/                  # 任务管理相关
│   ├── shared/                 # 跨页面共用
│   ├── layout/                 # 布局（侧栏、顶栏、首访引导）
│   └── site/                   # 站点相关
│
├── lib/                        # 业务核心代码
│   ├── db/                     # 数据库连接（PostgreSQL）
│   ├── auth/                   # 鉴权（JWT、RBAC、OIDC/LDAP 适配器）
│   ├── api/                    # API 调用层（真实 API 优先，失败显式阻塞）
│   ├── sync/                   # 同步逻辑（白名单、调度、写入）
│   ├── control/                # 控制命令（写入 control_command 队列）
│   ├── site-agent/             # 站点 Agent 适配（HMAC、心跳、控制）
│   ├── search/                 # 检索（OpenSearch 客户端）
│   ├── logs/                   # 日志（ClickHouse 客户端）
│   ├── ingest/                 # 数据摄入
│   ├── export/                 # 数据导出
│   ├── source/                 # 源端 schema 引用
│   └── types/                  # TypeScript 类型定义（Adapter 接口，禁止修改）
│
├── scripts/                    # 后台脚本
│   ├── sync/                   # 同步脚本（导出/摄入）
│   ├── scheduler/              # 调度器（定时跑同步）
│   ├── site-agent/             # 站点 Agent 入口
│   ├── e2e/                    # 端到端测试脚本（白盒）
│   ├── audit/                  # 审计脚本
│   ├── smoke-sync.ts           # 同步冒烟
│   ├── check-sync-consistency.ts
│   ├── check-project-baseline.ts
│   └── worker-site.ts          # 站点端 Worker
│
├── databases/                  # 数据库脚本
│   ├── sprint-2b0/             # 中心库基础 schema + 初始化脚本
│   ├── sprint-2c17/            # 同步包日志表
│   ├── sprint-4.5/             # control_command 控制队列表
│   ├── sprint-r.26/            # 本地 JWT/Auth/RBAC 基座
│   └── sprint-r41/             # audit hash chain 等增量 DDL
│
├── docs/                       # 项目文档
│   ├── source/                 # 原始需求（requirements.md 是最高标准）
│   ├── database-analysis/      # 数据库分析与 Sprint 严格审查
│   ├── testing/                # 测试报告（含质量门）
│   ├── architecture/           # 系统架构
│   ├── development/            # 开发指南
│   ├── operations/             # 运维部署指南
│   ├── summary/                # 状态和路线图
│   ├── superpowers/            # Sprint 设计与计划
│   └── secrets/                # 密钥轮换流程（gitignored）
│
├── deploy/                     # 部署模板
│   └── site-agent/             # 站点 Agent 的 systemd 模板
│
├── docker-compose.yml          # 本地依赖（PostgreSQL / OpenSearch / ClickHouse）
├── .env.example                # 环境变量模板（提交到 git）
├── package.json                # 前端依赖与脚本
├── CLAUDE.md                   # AI/Agent 工作约束
├── AGENTS.md                   # Agent 行为规范
└── README.md                   # 你正在看的这份
```

### 3.1 关键目录怎么用

| 想做什么 | 看哪里 |
|---|---|
| 改某个页面的 UI | `app/<页面>/page.tsx` + `components/<分类>/` |
| 改某个 API 行为 | `app/api/<路径>/route.ts` |
| 改同步逻辑 | `lib/sync/` |
| 改权限模型 | `lib/auth/rbac-policy.ts` |
| 改调度频率 | `lib/sync/sync-engine.ts` + `scripts/scheduler/sync-scheduler.ts` |
| 看质量门 | `docs/testing/r81-quality-gate-report.md` |
| 看某条需求的完成度 | `docs/database-analysis/requirements-traceability.json` |
| 看某个 Sprint 干了什么 | `docs/superpowers/plans/` 或 `docs/database-analysis/sprint-*-review.md` |

---

## 4. 核心数据流是怎么走的

整个系统有三股数据流，分清楚才不会乱。

### 4.1 站点 → 中心（同步链路）

```
站点 PostgreSQL
    │
    ▼  站点 Agent 用 pg_dump 导出 13 张白名单表
table_backup.sql
    │
    ▼  中心库 ingest 接口（带 HMAC 签名）
中心库 unified_* 表
    │
    ▼  同步日志写 sync_package_log / sync_table_log
    │
    ▼  审计日志写 audit_log
```

**关键点**：
- 站点库有 170 张表，**只同步 13 张**白名单表（`tbl_task`、`tbl_user` 等控制类表）。`tbl_file` 和 `tbl_folder` 是几亿行的大表，**不进 PostgreSQL**，走 OpenSearch。
- `table_backup.sql` 是文本格式，用 `pg_dump --table=...` 生成。
- HMAC 签名防篡改。
- 文档里的 `DATABASE_URL` / `SITE_DATABASE_URL` / `SOURCE_DATABASE_URL` 都是 **PostgreSQL 数据库连接串**，不是 HTTP API 地址。

#### 多站点怎么同步

多站点不是在中心服务里写多个 `SITE_DATABASE_URL`。

正确模型是：

```
中心服务
  ├─ DATABASE_URL -> 中心库 unified_disc_platform
  └─ sync_sites   -> 站点注册表，记录 SH01 / BJ02 / ...

SH01 站点 Agent
  ├─ SITE_WORKER_SITE_CODE=SH01
  └─ SITE_DATABASE_URL -> SH01 本地 PostgreSQL

BJ02 站点 Agent
  ├─ SITE_WORKER_SITE_CODE=BJ02
  └─ SITE_DATABASE_URL -> BJ02 本地 PostgreSQL
```

也就是说：
- 中心服务只有一个 `DATABASE_URL`，负责读写中心库。
- 每个站点各跑一个 Agent/Worker 进程，各自持有自己的 `SITE_DATABASE_URL`。
- 站点身份用 `siteCode` 区分，写入中心库时落到 `source_site_id` / `site_code` / `target_site_code`。
- 中心库只保存站点注册、状态、密钥引用和同步结果；**不保存真实站点数据库密码**。
- 本地只有一个 restore 库时，可以把它当作 `SH01` 测试站点；没有 restore 库时，项目仍能启动，但不能跑真实站点同步。

### 4.2 总控 → 站点（控制链路）

```
总控用户在 /tasks 点「新建」
    │
    ▼  POST /api/tasks/create
控制命令写 control_command 表
    │
    ▼  站点 Agent 定时 poll 中心库
FOR UPDATE SKIP LOCKED + 30 秒租约
    │
    ▼  站点 Agent 在站点库 tbl_task 真插入
站点 PostgreSQL
    │
    ▼  下一轮同步带回中心库
中心库 unified_tasks 出现新行
    │
    ▼  总控前端 /tasks 列表自动出现这条任务
```

**关键点**：
- 总控**不直接**连站点库。控制必须经过「中心队列 + Agent 拉取」两步。
- 「暂停」「恢复」「巡检」走的也是这个链路。
- Agent 拿不到锁会放弃，租约 30 秒超时自动让其他人接手（`SKIP LOCKED`）。
- 站点没启 Agent 时，命令会一直在队列里挂着。

### 4.3 总控 UI 读取（永远只读中心）

```
用户在 /tasks 打开页面
    │
    ▼  GET /api/tasks
SELECT * FROM unified_tasks
    │
    ▼  渲染表格
```

**绝对禁止**：UI 直接查站点库或 restore 库。这是 CLAUDE.md 一票否决的硬约束。

### 4.4 检索链路

```
用户在 /search 输入关键词
    │
    ▼  GET /api/search
    │
    ├─► 如果配置了 OpenSearch (SEARCH_ES_URL)
    │      └─► OpenSearch 索引 disc_file_index
    │
    └─► 否则
           └─► 返回 blocked_by_external_system
                （不返回假数据，不静默 mock）
```

`tbl_file` 几亿行，PG 检索太慢，所以放 OpenSearch。**绝不让 `tbl_file`/`tbl_folder` 进 PG**。

### 4.5 日志链路

```
/logs 页面
    │
    ▼  GET /api/logs
    │
    ├─► 如果后续启用 ClickHouse (CLICKHOUSE_URL)
    │      └─► ClickHouse 客户端/仓储边界承接高吞吐日志查询
    │
    └─► 否则
           └─► 中心 PG 日志（当前产品主链路）
                真实可用，但性能受限
```

---

## 5. 日常开发常用命令

### 5.1 开发期

```bash
pnpm dev                       # 起开发服务器（热更新）
pnpm exec tsc --noEmit         # TypeScript 类型检查
pnpm lint                      # ESLint 检查
pnpm build                     # 生产构建（提交前必跑）
```

### 5.2 数据库相关

```bash
pnpm db:up                     # 起 PostgreSQL
pnpm db:down                   # 停 PostgreSQL（保留数据）
pnpm db:down:volumes           # 停 + 删数据卷（危险！会丢数据）
pnpm db:logs                   # 看数据库日志
pnpm db:health                 # 查健康状态
pnpm db:init                   # 首次建当前完整中心库 schema
pnpm db:init:reset             # 删表重建
pnpm db:seed                   # 兼容命令：重放 Auth bootstrap（admin / RBAC）
pnpm db:init:sync              # 旧同步 mock 表初始化；当前主链路通常不用
```

### 5.3 同步相关

```bash
pnpm smoke:sync                # 跑一次同步冒烟
pnpm check:sync-consistency -- --siteCode=SH01
                               # 一致性检查
pnpm sync:dump:export --siteCode=SH01 --out=/tmp/sh01-table_backup.sql
                               # 从 SOURCE_DATABASE_URL / restore 库导出白名单表
pnpm sync:dump:ingest --siteCode=SH01 --file=/tmp/sh01-table_backup.sql
                               # 把 table_backup.sql 导入中心库
pnpm scheduler:sync:once -- SH01
                               # 对单站点跑一次调度同步
pnpm export:package            # 导出站点 SQL 包
pnpm push:package              # 推送到中心
pnpm import:all                # 从源端导入所有白名单表
pnpm import:tasks              # 单表导入
```

### 5.4 调度与 Agent

```bash
pnpm scheduler:sync            # 起调度器（持续运行）
pnpm scheduler:sync:once       # 跑一次同步就退出
pnpm agent:site                # 起站点 Agent（持续运行）
pnpm worker:site               # 起站点 Worker
```

### 5.5 端到端测试

```bash
pnpm e2e:sites                 # 站点注册表相关
pnpm e2e:tasks                 # 任务管理
pnpm e2e:task-create-control   # 任务创建 + 控制命令链路
pnpm e2e:sync                  # 同步
pnpm e2e:settings              # 设置
pnpm e2e:auth                  # 鉴权
pnpm e2e:rbac                  # 权限
pnpm e2e:users                 # 用户
pnpm e2e:search-es             # 检索边界（含 ES）
pnpm e2e:clickhouse-logs       # 日志边界（含 ClickHouse）
pnpm e2e:worst-case            # 最坏情况质量检查（5 项）
```

要一次跑全部：

```bash
pnpm e2e:all
```

### 5.6 基线与质量门

```bash
pnpm baseline:check            # 基线冻结检查（13 项）
pnpm exec tsc --noEmit         # 类型（提交前必跑）
pnpm build                     # 构建（提交前必跑）
pnpm smoke:sync                # 同步冒烟（提交前必跑）
```

---

## 6. 怎么验证修改是好的

### 6.1 提交前必跑（4 件套）

```bash
set -a && source .env.local && set +a
pnpm exec tsc --noEmit
pnpm build
pnpm smoke:sync
pnpm baseline:check
```

任何一项不过，不允许 commit。

### 6.2 改了前端，要跑的事件级测试

```bash
# 改了任务相关 → pnpm e2e:tasks + pnpm e2e:task-create-control
# 改了站点相关 → pnpm e2e:sites
# 改了同步相关 → pnpm e2e:sync + pnpm smoke:sync
# 改了设置相关 → pnpm e2e:settings
# 改了鉴权相关 → pnpm e2e:auth + pnpm e2e:rbac
# 改了日志相关 → pnpm e2e:logs + pnpm e2e:clickhouse-logs
```

事件级测试要求（CLAUDE.md 第 10 条）：
- 必须有真实 e2e 通过（不是只跑 tsc）
- 必须验证 API 真有调用、有真实响应
- 必须验证数据库真有写入
- toast 文案必须含「已提交到控制队列，等待站点 Agent 执行」，**不能**写「已暂停」「暂停成功」

### 6.3 怎么知道需求做到哪了

```bash
# 看严格完成度
pnpm exec tsx -e "
import j from './docs/database-analysis/requirements-traceability.json';
const rows = j.requirements || [];
const c = rows.filter(r => r.current_status === 'complete').length;
console.log('严格完成:', c, '/', rows.length, '=', (c/rows.length*100).toFixed(1) + '%');
"
```

更详细的查 `docs/database-analysis/requirements-traceability.json` 或对应的 `.md`。

### 6.4 写完一个 Sprint 必须产出

`docs/database-analysis/sprint-<编号>-requirements-review.md`，包含：

1. 对应 requirements 的 ID 列表
2. 改了哪些文件 / API / 表
3. 后端是真支持还是只是 UI 调用（必须有 SQL/API 证据）
4. UI 是不是会误导用户
5. mock / simulator / DRY_RUN / 真控制 四者明确区分
6. 没做完的列出来
7. Blocker 类型（8 选 1）
8. 站点侧需要配合的 schema/API 改动清单
9. Verdict：pass / partial / fail

---

## 7. 部署到测试或生产环境

### 7.1 部署前清单

| 检查项 | 说明 |
|---|---|
| Node.js 版本 | 18 或 20 |
| PostgreSQL 17 中心库 | 必须，存 `unified_*`、同步日志、控制队列、Auth、审计 |
| 站点 PostgreSQL / restore 库 | 同步来源；产品页面不能直读，只能由同步/Agent 写回中心库 |
| OpenSearch（可选） | 承接 `tbl_file` / `tbl_folder` 大文件索引；没配就返回 blocked 或走中心 `unified_file_index` |
| ClickHouse（可选） | 承接大规模任务/系统日志；没配就降级到中心 PG 可用日志 |
| 反向代理 | nginx / traefik 之类 |
| TLS 证书 | 站点 Agent HMAC 验签需要 HTTPS |
| `.env.local` | **不要**提交到 git，本地各自保管 |

### 7.2 关键环境变量（只列键名，**不**列值）

```bash
# 数据库连接串（都是 PostgreSQL 直连连接串，不是 HTTP API 地址）
DATABASE_URL=...               # 中心库连接串：总控服务读写 unified_disc_platform
DB_PASSWORD=...                # 必须与 DATABASE_URL 内嵌密码一致

# 同步来源连接串
SOURCE_DATABASE_URL=...        # 本地开发/restore 测试库连接串；用于导出/导入脚本
SITE_DATABASE_URL=...          # 站点 Agent/Worker 侧连接串；每个站点进程各自配置
SITE_WORKER_SITE_CODE=...      # 当前 Agent/Worker 代表的站点，如 SH01

# 鉴权
AUTH_SESSION_SECRET=...        # 本地 JWT session 签名密钥（生产必须 32+ 随机字符）
SITE_AGENT_SECRET=...          # 站点 Agent HMAC 签名密钥
SYNC_PACKAGE_SECRET=...        # 同步包签名密钥

# 检索（可选）
SEARCH_ES_URL=...
SEARCH_ES_INDEX=...

# 日志（可选）
CLICKHOUSE_URL=...
CLICKHOUSE_DATABASE=...
CLICKHOUSE_LOG_TABLE=...
CLICKHOUSE_USER=...
CLICKHOUSE_PASSWORD_KEY_REF=...

# SSO（生产需要，可选）
# ⚠️ 项目里实际有两套 SSO 环境变量,作用不同:
#   - OIDC_* / LDAP_* 是运行时真正消费的键(/api/auth/sso/start + lib/auth/oidc-provider.ts + lib/auth/ldap-provider.ts)
#   - AUTH_* 是 lib/auth/config.ts:getSafeAuthConfig() 的"配置探测"层,只返回 boolean 给前端展示用,不影响 SSO 实际跳转
# 配 SSO 时,OIDC_* 和 LDAP_* 必须配;AUTH_* 可选配(配了之后前端能识别"已配置 SSO"状态)
OIDC_ISSUER_URL=...
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...         # 或 OIDC_CLIENT_SECRET_KEY_REF=... 引用 secrets 管理器
OIDC_CLIENT_SECRET_KEY_REF=...
OIDC_JWKS_URL=...
LDAP_URL=...
LDAP_BASE_DN=...
LDAP_BIND_DN=...                # 或 LDAP_BIND_DN_KEY_REF=...
LDAP_BIND_PASSWORD=...          # 或 LDAP_BIND_PASSWORD_KEY_REF=...

# AUTH_* 配置探测层(可选,前端展示用,不配也不影响 SSO)
AUTH_ISSUER_URL=...
AUTH_CLIENT_ID=...
AUTH_CLIENT_SECRET=...
AUTH_CLIENT_SECRET_REF=...
AUTH_JWKS_URL=...
AUTH_LDAP_URL=...
AUTH_LDAP_BASE_DN=...
```

完整列表看 `.env.example`。**所有真实值通过环境变量注入，不要写进任何文件**。

### 7.3 部署步骤（简化版）

```bash
# 1. 准备服务器
ssh user@server
git clone <仓库>
cd 上海
pnpm install --frozen-lockfile

# 2. 注入环境变量（用 vault / k8s secret / 你的密钥管理工具）
# ⚠️ 下面 `export` 只在当前 shell 生效,关掉就丢。生产请改用:
#   - systemd:  EnvironmentFile=/etc/unified-disc-platform.env
#   - docker:   --env-file 或 compose secrets
#   - k8s:      envFrom: secretRef / vault sidecar
export DATABASE_URL=...
export AUTH_SESSION_SECRET=...
# ... 其他见 .env.example

# 3. 初始化数据库（只第一次）
pnpm db:init

# 4. 构建
pnpm build

# 5. 启动
pnpm start
# 或用 systemd / pm2 / docker 起
```

### 7.4 站点 Agent 部署

站点 Agent 是部署在每个站点本地的小程序，负责拉取控制命令、回写执行结果、上报心跳。

部署模板看 `deploy/site-agent/` 和 `docs/operations/site-agent-deployment.md`。

每个站点需要：

| 资源 | 说明 |
|---|---|
| 一台能联网到中心库的机器 | 站点本地即可 |
| 站点 PostgreSQL 连接串 | 写到该站点 Agent/Worker 的 `SITE_DATABASE_URL` |
| 站点编码 | 写到该站点 Agent/Worker 的 `SITE_WORKER_SITE_CODE`，例如 `SH01` |
| Agent HMAC 密钥 | 中心库生成，分发到站点 |
| 进程守护 | systemd / supervisor 二选一 |

多站点部署时，建议每个站点一份独立环境文件：

```bash
# /etc/unified-disc-agent-SH01.env
DATABASE_URL=postgresql://center_user:<center_password>@center-host:5432/unified_disc_platform
SITE_WORKER_SITE_CODE=SH01
SITE_DATABASE_URL=postgresql://site_user:<site_password>@sh01-db:5432/star_storage_db
SITE_AGENT_SECRET=<secret-ref-or-secret-value-from-deployer>

# /etc/unified-disc-agent-BJ02.env
DATABASE_URL=postgresql://center_user:<center_password>@center-host:5432/unified_disc_platform
SITE_WORKER_SITE_CODE=BJ02
SITE_DATABASE_URL=postgresql://site_user:<site_password>@bj02-db:5432/star_storage_db
SITE_AGENT_SECRET=<secret-ref-or-secret-value-from-deployer>
```

这些真实连接串只存在部署环境里，不能提交到仓库。

#### 同步和控制要部署哪些进程？

只配置数据库连接串不会自动同步。生产环境至少需要这些进程：

| 进程 | 部署位置 | 作用 |
|---|---|---|
| 中心 Web 服务 | 中心机房 / 云主机 | 提供页面和 `/api/*`，读写中心库 `DATABASE_URL` |
| 中心 PostgreSQL | 中心机房 / 云数据库 | 保存 `unified_*`、同步日志、控制队列、审计、Auth |
| 站点同步调度器 | 每个站点一份，或由中心按站点启动 | 定时导出站点白名单表并写回中心库 |
| 站点 Agent / Worker | 每个站点一份 | 拉取 `control_command`，在本站点库执行任务创建/暂停/恢复等操作 |

`pnpm scheduler:sync -- --siteCode SH01` 是**长运行同步进程**：默认每 3600 秒跑一轮，直到进程被停止。它不是数据库触发器，也不是打开网页后自动运行。

单站点常用命令：

```bash
# 每小时持续同步 SH01
pnpm scheduler:sync -- --siteCode SH01

# 只跑一次同步，用于测试
pnpm scheduler:sync:once -- SH01

# 控制闭环：站点侧持续拉取命令并执行
SITE_WORKER_SITE_CODE=SH01 SITE_WORKER_DRY_RUN=false pnpm worker:site
```

多站点需要每个站点各跑一份调度器/Agent，或者用 systemd、supervisor、PM2、k8s 为每个 `siteCode` 启一个实例：

```bash
pnpm scheduler:sync -- --siteCode SH01
pnpm scheduler:sync -- --siteCode BJ02

SITE_WORKER_SITE_CODE=SH01 SITE_WORKER_DRY_RUN=false pnpm worker:site
SITE_WORKER_SITE_CODE=BJ02 SITE_WORKER_DRY_RUN=false pnpm worker:site
```

如果某个新站点一直有任务新增，只要该站点的同步调度器持续运行，下一轮同步会把白名单表变化写入中心库；如需更快频率，可通过 `--interval` 调整：

```bash
pnpm scheduler:sync -- --siteCode SH01 --interval 300
```

### 7.5 健康检查

部署完，浏览器访问 `/api/system/health`，应该返回 200。看到 `{"status":"ok"}` 就对了。

### 7.6 各种部署方式（按场景选）

> 上面的 §7.3 是最简流程。下面按"你的环境是什么样"分类，每种都给完整步骤。
> 不知道选哪个？**先用方案 A（PM2 + 本机）**，企业生产用方案 C（Docker）或方案 D（k8s）。

#### 怎么选方案？

| 你的情况 | 用哪个 |
|---|---|
| 1 台 Linux 服务器,没装 Docker | **方案 A (PM2)** |
| 1 台 Linux 服务器,装了 Docker,想一条命令起全栈 | **方案 B (Docker Compose) — 但要先按本节提示补 compose** |
| 多环境,要推镜像仓库 (Harbor / GHCR) | **方案 C (Docker 镜像) — 但要先加 `next.config.mjs` 的 `output: 'standalone'`** |
| 多副本 + 滚动更新 + 自动伸缩 | **方案 D (k8s)** |
| 接受云端 Postgres,不要本机 Docker | **方案 E (Vercel)** |
| Windows 笔记本,本地开发调试 | **方案 F (Windows 本地)** |
| 不需要数据库,纯前端演示 | **方案 G 不适用 — 项目 API 路由强依赖 PG** |

#### 方案 A：单机 + PM2 守护（最简单，1 台服务器搞定）

适用:1 台 Linux 服务器,没有 Docker 或不想用 Docker。

```bash
# 1. 服务器准备
ssh user@server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm pm2
git clone <仓库> && cd 上海

# 2. 装依赖 + 编译
pnpm install --frozen-lockfile
pnpm build

# 3. 注入环境变量（推荐用 .env.production 或 systemd EnvironmentFile）
cp .env.example .env.production
# 编辑 .env.production 填入真实 DATABASE_URL / AUTH_SESSION_SECRET 等

# 4. 用 PM2 守护进程（开机自启 + 崩溃重启）
pm2 start "pnpm start" --name unified-disc-platform
pm2 save
pm2 startup   # 把提示的 sudo 命令复制粘贴执行
pm2 logs unified-disc-platform   # 看日志
```

更新代码:
```bash
cd /path/to/上海
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart unified-disc-platform
```

#### 方案 B：单机 + Docker Compose（一条命令起全栈）

适用:服务器装了 Docker,想把数据库 + 应用一起管。

> ⚠️ **必读 — 当前 compose 文件不完整**
>
> 仓库根目录的 `docker-compose.yml` 现在**只定义了 3 个数据服务**:
> `postgres` / `opensearch` / `clickhouse`,**没有 `app` service**。
> 直接 `docker compose up -d` 只能起数据服务,起不来 Next.js;`docker compose logs -f app` 会报 "service app not found"。
>
> **解决方案(任选一个)**:
> 1. **先用方案 A (PM2) 起应用,只用 compose 起数据服务**(最稳)
>    ```bash
>    docker compose up -d postgres opensearch clickhouse   # 只起数据
>    pnpm install --frozen-lockfile && pnpm build
>    pm2 start "pnpm start" --name unified-disc-platform
>    ```
> 2. **复制附录 A.2 全栈模板覆盖 compose**(一步到位,但要先备份原文件)
>    ```bash
>    cp docker-compose.yml docker-compose.yml.bak
>    # 把附录 A.2 的内容粘到 docker-compose.yml
>    ```
>
> 下面步骤默认你已经按方案 (1) 或 (2) 处理过 compose。

```bash
# 1. 服务器装 Docker（Ubuntu 示例）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # 重新登录生效

# 2. 拉代码
git clone <仓库> && cd 上海

# 3. 准备环境变量
cp .env.example .env.production
# 编辑填入 AUTH_SESSION_SECRET / SITE_AGENT_SECRET / SYNC_PACKAGE_SECRET 等

# 4. 当前仓库 compose 只起数据服务；应用请用方案 A，或先替换为附录 A.2 全栈模板
docker compose -f docker-compose.yml up -d postgres opensearch clickhouse

# 5. 看日志
docker compose logs -f postgres

# 6. 健康检查
curl http://localhost:3000/api/system/health
```

更新代码:
```bash
cd /path/to/上海
git pull
docker compose -f docker-compose.yml up -d --build
```

> 注意:当前 `docker-compose.yml` 只定义了 `postgres` / `opensearch` / `clickhouse` 三个数据服务。方案 B 要一条命令起全栈，需要补 `app` service,见附录 A.2。

#### 方案 C：纯 Docker 镜像（自包含,可推到镜像仓库）

适用:多环境部署,或推到 Harbor / Docker Hub / GHCR。

> ⚠️ **必读 — `next.config.mjs` 当前没有 `output: 'standalone'`,直接 build 会失败**
>
> 附录 A.1 给的 Dockerfile 里这一步会失败:
> ```
> COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
> ERROR: failed to solve: "/app/.next/standalone": not found
> ```
> 因为 `next build` 默认**不输出 standalone 目录**,必须显式开启。
>
> **先改 `next.config.mjs`**:
> ```js
> /** @type {import('next').NextConfig} */
> const nextConfig = {
>   output: 'standalone',   // ← 加这一行
>   typescript: { ignoreBuildErrors: false },
>   images: { unoptimized: true },
>   async redirects() { return [{ source: "/control", destination: "/tasks?view=commands", permanent: false }] },
> }
> export default nextConfig
> ```
> 然后 `pnpm build` 会输出 `.next/standalone/`,Dockerfile 才能 COPY。
>
> 下面步骤默认你已经改好 `next.config.mjs` 并把附录 A.1 的 Dockerfile 放到根目录。

```bash
# 1. 在仓库根目录创建 Dockerfile（项目当前没自带,见附录 A.1）

# 2. 本地构建
docker build -t unified-disc-platform:latest .

# 3. 推到镜像仓库
docker tag unified-disc-platform:latest registry.example.com/unified-disc-platform:v1.0.0
docker push registry.example.com/unified-disc-platform:v1.0.0

# 4. 在目标服务器拉取并运行
docker run -d \
  --name unified-disc-platform \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  registry.example.com/unified-disc-platform:v1.0.0

# 5. 健康检查
docker ps        # 看状态
docker logs -f unified-disc-platform
curl http://localhost:3000/api/system/health
```

#### 方案 D：Kubernetes（生产高可用）

适用:多副本 + 滚动更新 + 自动伸缩。

最小 `deployment.yaml` 模板:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unified-disc-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: unified-disc-platform
  template:
    metadata:
      labels:
        app: unified-disc-platform
    spec:
      containers:
        - name: app
          image: registry.example.com/unified-disc-platform:v1.0.0
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: unified-disc-platform-secrets   # kubectl create secret generic ...
          readinessProbe:
            httpGet:
              path: /api/system/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/system/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: unified-disc-platform
spec:
  type: ClusterIP
  selector:
    app: unified-disc-platform
  ports:
    - port: 80
      targetPort: 3000
```

应用:
```bash
kubectl apply -f deployment.yaml
kubectl get pods -l app=unified-disc-platform
kubectl logs -f -l app=unified-disc-platform
```

#### 方案 E：Vercel / Netlify（Next.js 原生托管）

适用:不需要连本机 PG,接受托管 Postgres (Neon / Supabase / Vercel Postgres)。

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 在仓库根目录
vercel link          # 连接 GitHub repo
vercel env add DATABASE_URL production       # 按提示粘贴
vercel env add AUTH_SESSION_SECRET production
# ... 其他 env

# 3. 部署
vercel --prod
# 或:git push origin main 自动部署
```

> 注意:Vercel 部署后,数据库需要是云端可达的(不能连 localhost 的 postgres)。当前 docker-compose.yml 的 PG 不能用,需改 Neon / Supabase 连接串。

#### 方案 F：Windows 本地（开发者用,不上生产）

```powershell
# 1. 装 Node 20 (用 nvm-windows 推荐)
nvm install 20
nvm use 20

# 2. 装 pnpm
npm install -g pnpm

# 3. 装 Docker Desktop
# 下载: https://www.docker.com/products/docker-desktop/

# 4. 拉代码
git clone <仓库>
cd 上海

# 5. 装依赖 + 起 PG + 初始化 + 跑
pnpm install
pnpm db:up
pnpm db:init
pnpm dev
# 浏览器打开 http://localhost:3000
```

#### 方案 G：纯静态导出（如果不需要数据库,纯演示）

> ⚠️ 本项目因为 Next.js API 路由强依赖 PG,**不能纯静态导出**。这个方案仅作为概念说明。

```bash
# 假设所有 API 改成 mock,可在 next.config.js 里加:
# output: 'export'
pnpm build
# 产物在 .next/ 下,丢到任何静态服务器 (nginx / CDN / GitHub Pages)
```

---

#### 反向代理（生产必备,放公网前）

**nginx** (`/etc/nginx/sites-available/unified-disc-platform`):
```nginx
server {
  listen 80;
  server_name platform.example.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name platform.example.com;

  ssl_certificate     /etc/letsencrypt/live/platform.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/platform.example.com/privkey.pem;

  # TLS 1.2+ (站点 Agent HMAC 验签需要)
  ssl_protocols TLSv1.2 TLSv1.3;

  client_max_body_size 100m;

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
  }
}
```

激活:
```bash
sudo ln -s /etc/nginx/sites-available/unified-disc-platform /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d platform.example.com   # 自动配 HTTPS
```

### 7.7 部署出错速查

> 90% 的部署问题落在下面 5 类。先看这里,5 分钟内搞定。

| 报错 / 现象 | 原因 | 解决 |
|---|---|---|
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | postgres 没起 / 端口没监听 | `pnpm db:up` 或 `docker compose ps` 看 postgres 状态;等 healthy |
| `Error: password authentication failed for user "unified"` | DATABASE_URL 密码与实际不符 | 看 `.env.local` 里 `DATABASE_URL` 和 docker-compose.yml 里 `POSTGRES_PASSWORD` 是否一致 |
| `Error: listen EADDRINUSE :::3000` | 3000 端口被占 | `lsof -i :3000` 找到占用进程 kill;或改 `PORT=3001 pnpm dev` |
| `Error: Cannot find module 'next/dist/...'` | node_modules 损坏 | `rm -rf node_modules pnpm-lock.yaml && pnpm install` |
| `npm WARN EBADENGINE` 或 peer dep 警告 | node 版本不对 | 必须 Node 20 LTS (项目用 next-themes + React 19 需要) |
| `pnpm install` 卡死 / 超时 | 镜像源问题 | `pnpm config set registry https://registry.npmmirror.com` 后重试 |
| `pnpm db:init` 报 SQL 语法错(某行 `\dt` 无效) | 端口混淆 / 连到了错误数据库 | 确认 `docker exec -it unified_disc_postgres psql -U unified -d unified_disc_platform` 能正常进库;SQL 脚本在 `databases/sprint-2b0/unified_schema.sql` |
| 浏览器访问 `/login` 显示 "认证服务暂不可用" | `/api/auth/login` 路由找不到 PG | 检查 `pnpm db:up` 状态 + 看 dev server stderr |
| 部署到生产后 502 Bad Gateway | 反向代理没指向 app 端口 | nginx `proxy_pass http://127.0.0.1:3000` 确认应用在监听 3000 |
| `permission denied` 写文件 | 用了 root 起应用 | 用方案 A 的非 root user (nextjs uid 1001),或在 Dockerfile 加 `USER nodejs` |
| `TLS handshake failed` | cert 过期或不匹配 | `sudo certbot renew`;检查 `server_name` 与证书域名一致 |
| 内存爆掉 (OOM) | Node 默认堆太大,容器内存限制 | 启动加 `NODE_OPTIONS="--max-old-space-size=512"` |
| `pnpm build` OOM | next build 大项目吃内存 | 同上加 `--max-old-space-size=2048` |
| docker 容器启动后立刻退出 | 缺 .env 或 DATABASE_URL | `docker compose logs app` 看 stderr,通常是 env 没注入 |
| `pnpm db:init` 卡住 / 报 "already exists" | 数据库已初始化过 | 想重置:`pnpm db:down:volumes && pnpm db:up && pnpm db:init` |

**通用排查套路**:
```bash
# 1. 看容器/进程状态
docker compose ps                 # docker 用户
pm2 status                       # pm2 用户
ps aux | grep -E "next|node"     # 直接跑的用户

# 2. 看日志（最近 50 行）
docker compose logs --tail=50 app
pm2 logs unified-disc-platform --lines 50

# 3. 看端口监听
ss -tlnp | grep 3000

# 4. 连数据库确认
docker exec -it unified_disc_postgres psql -U unified -d unified_disc_platform

# 5. 调 API 健康检查
curl -i http://localhost:3000/api/system/health
```

---

## 8. 需要外部提供的依赖

下列依赖是**阻塞**的，没拿到之前，对应的需求严格状态保持 `blocked_*`，不能宣称完成。

### 8.1 ADFS / OIDC / LDAP（5 项需求阻塞）

需要运维提供：

| 项 | 说明 |
|---|---|
| 端点地址 | ADFS / OIDC issuer URL 或 LDAP server URL |
| 客户端凭证 | OIDC client_id / client_secret |
| 回调地址 | OIDC redirect URI（与本平台域名匹配） |
| 测试账号 | 至少 1 个，含角色（viewer/operator/admin） |
| Claim 映射 | 把 IdP 的 group/role claim 映射到本平台角色 |

配置好后写到：

```bash
OIDC_ISSUER_URL=...
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET_KEY_REF=...
OIDC_JWKS_URL=...
```

受影响的 5 项：`REQ-2.1.2`、`REQ-2.2.2`、`REQ-3.2.1`、`REQ-3.2.2`、`REQ-3.3.2`。

### 8.2 OpenSearch / ES（1 项需求阻塞）

需要运维提供：

| 项 | 说明 |
|---|---|
| 集群地址 | `https://es-cluster:9200` |
| 索引策略 | 命名、保留期、备份策略 |
| 写权限凭证 | 本平台写入文件索引用的 API key |

配置：

```bash
SEARCH_ES_URL=...
SEARCH_ES_INDEX=disc_file_index
```

受影响的 1 项：`REQ-4.1.2`。

### 8.3 ClickHouse（partial 状态）

需要运维提供：

| 项 | 说明 |
|---|---|
| 集群地址 | `http://clickhouse:8123` |
| 日志库名 | 默认 `unified_logs` |
| 保留期 | 30/90/180 天 |
| 凭证 | user / password |

配置：

```bash
CLICKHOUSE_URL=...
CLICKHOUSE_DATABASE=unified_logs
CLICKHOUSE_LOG_TABLE=task_logs
CLICKHOUSE_USER=...
CLICKHOUSE_PASSWORD_KEY_REF=...
```

### 8.4 站点生产部署（4 项需求阻塞）

每个真实站点需要：

| 资源 | 说明 |
|---|---|
| 站点 Agent 部署 | 站点本地起 `pnpm agent:site` 并守护 |
| 站点库 schema | 必须包含站点侧需要的 `tbl_task` 等控制表 |
| Agent HMAC 密钥 | 中心生成，站点保管 |
| 网络连通性 | 站点能访问中心 PostgreSQL |

受影响的：`REQ-3.1.1`、`REQ-3.1.2`、`REQ-3.3.1`、`REQ-4.3.1`。

### 8.5 决策清单（提交给领导）

- ADFS/OIDC/LDAP 是否接入？由谁负责？测试账号谁出？
- ES 生产环境是否部署？保留期多久？
- ClickHouse 生产环境是否部署？
- 站点 Agent 部署节奏（先 BJ02 还是先 SH01 还是全量）？
- 站点 schema 改造由谁出（站点运维 or 总控配合）？

---

## 9. 需求完成度怎么看

### 9.1 看哪份文档

- **总览**：`docs/database-analysis/requirements-traceability.json`
- **可读版**：`docs/database-analysis/requirements-traceability.md`
- **质量门**：`docs/testing/r81-quality-gate-report.md`
- **当前状态**：`docs/summary/PROJECT_STATUS.md`

### 9.2 状态含义

| 状态 | 是什么意思 | 升级需要什么 |
|---|---|---|
| `complete` | 真后端 + 真 UI + 真测试都过 | - |
| `partial` | 部分实现，缺块 | 列在 review 里 |
| `blocked_by_auth` | 需要 ADFS/LDAP/OIDC | 运维提供 IdP |
| `blocked_by_external_system` | 需要 ES/ClickHouse | 运维部署 |
| `blocked_by_site_change` | 需要站点 app 改造 | 站点团队配合 |
| `blocked_by_source_schema` | 站点库缺字段 | 站点表加字段 |
| `out_of_scope` | 不在本项目范围 | 永远 out_of_scope |

### 9.3 严格数 vs 候选数

| 名字 | 含义 | 数字 |
|---|---|---|
| 严格完成 | 真后端 + 真 UI + 真测试 | 29 / 45 = 64.4% |
| 候选实现 | 代码落地但外部条件不具备 | 45 / 45 |

**不能合并**汇报。比如不能说「45/45 完成」。

### 9.4 汇报时该怎么说

✅ 可以说：

> 总控主链路已经完成候选实现并通过本地验证：产品页面统一读中心库，restore/source 只作为同步来源；pg_dump 白名单同步、Site Agent 轮询、控制命令队列、任务创建由 Agent 写站点 `tbl_task` 的本地恢复库路径、导出审计、安全边界和 e2e 已跑通。严格 requirements 当前 **29/45 = 64.4%**，候选覆盖 45/45。剩余主要依赖 ADFS/LDAP、ES/ClickHouse 正式环境、站点 schema 和生产 Agent 部署验证。

❌ 不可以说：

- 「45/45 已完成」
- 「ES/ClickHouse 已生产接入」
- 「ADFS/LDAP 已完成」
- 「控制已真实成功」但没有站点 Agent 执行和站点库回写证据
- 把「candidate」数字汇报成「complete」

---

## 10. 禁止事项

### 10.1 代码层面

| 不要做 | 原因 |
|---|---|
| 直接修改 `lib/types/*` | 这是 Adapter 接口，全平台依赖 |
| 修改 Mock 数据结构 | 应该扩展，不应该改 |
| 把 mock 数据当真实完成 | 会误导用户 |
| 把 DRY_RUN / simulator 当完成 | 模拟不等于生产 |
| 把 toast 写成「已暂停」/「暂停成功」 | 必须用「已提交到控制队列，等待站点 Agent 执行」 |
| 直接连站点库或 restore 库做产品页面 | 必须走中心库 |
| 删目录、删数据库 | 需要清理请移动到 `archive/` 或 `deprecated/` |
| 提交 `.env.local` 或真实密钥 | 用环境变量或密钥管理工具 |

### 10.2 数据层面

| 不要做 | 原因 |
|---|---|
| 把 `tbl_file` / `tbl_folder` 全量导入 PostgreSQL 17 | 几亿行会撑爆，走 OpenSearch |
| 同步未授权的表 | 只同步 13 张白名单，其他不碰 |
| 在测试中污染站点库 | 用 `source_restore` 测试库 |

### 10.3 流程层面

| 不要做 | 原因 |
|---|---|
| 只跑 `pnpm exec tsc --noEmit` + `pnpm build` 就说完成 | 必须跑真实 e2e |
| 不写 `sprint-*-requirements-review.md` 就合并 | 严格审查是硬约束 |
| 不映射到 `requirements.md` 的需求就做 | `requirements.md` 是最高标准 |
| 把需求降级或删除 | 只能标 `blocked_*` 或 `out_of_scope` |

---

## 附录 A：常用 Dockerfile + Compose 模板

> 项目仓库当前**没有自带 Dockerfile**(避免增加维护负担),下面给你可以直接用的最小模板。
> 复制到仓库根目录就能 `docker build`。

### A.1 多阶段 Dockerfile（Next.js 16 + Node 20）

```dockerfile
# syntax=docker/dockerfile:1.7
# ---- 依赖阶段 ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- 构建阶段 ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- 运行阶段 ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root 运行（安全建议）
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

**配套 `next.config.js`**(必须加,否则 standalone 模式不工作):
```js
module.exports = {
  output: 'standalone',
}
```

构建:
```bash
docker build -t unified-disc-platform:latest .
```

### A.2 全栈 docker-compose.yml（postgres + app 一条命令起）

> 替换现有 `docker-compose.yml` 内容（或备份后改名 `docker-compose.fullstack.yml`）。

```yaml
name: unified-disc-platform

services:
  postgres:
    image: postgres:17
    container_name: unified_disc_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: unified
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-unified123}
      POSTGRES_DB: unified_disc_platform
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./databases/sprint-2b0/unified_schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
      - ./databases/sprint-2c17/sync-package-log.sql:/docker-entrypoint-initdb.d/02-sync-package-log.sql
      - ./databases/sprint-2c18/file-index-schema.sql:/docker-entrypoint-initdb.d/03-file-index-schema.sql
      - ./databases/sprint-2e2/unified-user-site-platform.sql:/docker-entrypoint-initdb.d/04-unified-user-site-platform.sql
      - ./databases/sprint-4.5/control-command.sql:/docker-entrypoint-initdb.d/05-control-command.sql
      - ./databases/sprint-4.8/audit-log.sql:/docker-entrypoint-initdb.d/06-audit-log.sql
      - ./databases/sprint-r19/site-agent-runtime.sql:/docker-entrypoint-initdb.d/07-site-agent-runtime.sql
      - ./databases/sprint-r.26/auth-foundation.sql:/docker-entrypoint-initdb.d/08-auth-foundation.sql
      - ./databases/sprint-r27/auth-system-config.sql:/docker-entrypoint-initdb.d/09-auth-system-config.sql
      - ./databases/sprint-r39/sync-command-types.sql:/docker-entrypoint-initdb.d/10-sync-command-types.sql
      - ./databases/sprint-r41/audit-hash-chain.sql:/docker-entrypoint-initdb.d/11-audit-hash-chain.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U unified -d unified_disc_platform"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build: .
    container_name: unified_disc_app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://unified:${POSTGRES_PASSWORD:-unified123}@postgres:5432/unified_disc_platform
      AUTH_SESSION_SECRET: ${AUTH_SESSION_SECRET:-please-change-me-in-production-32-chars-min}
      SYNC_PACKAGE_SECRET: ${SYNC_PACKAGE_SECRET:-please-change-me-in-production-32-chars-min}
      SITE_AGENT_SECRET: ${SITE_AGENT_SECRET:-please-change-me-in-production-32-chars-min}
      NODE_ENV: production
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/system/health"]
      interval: 10s
      timeout: 5s
      retries: 6

volumes:
  postgres_data:
```

启动:
```bash
cp .env.example .env.production
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env.production
echo "AUTH_SESSION_SECRET=$(openssl rand -hex 32)" >> .env.production
echo "SYNC_PACKAGE_SECRET=$(openssl rand -hex 32)" >> .env.production
echo "SITE_AGENT_SECRET=$(openssl rand -hex 32)" >> .env.production
docker compose up -d
# 首次空 volume 会执行 /docker-entrypoint-initdb.d/*.sql；已有 volume 不会重放
docker compose logs -f app
```

---

## 附录 B：常用 SQL 查询

### A.1 看当前站点的同步状态

```sql
SELECT site_code,
       enabled,
       scheduler_enabled,
       last_connected_at,
       agent_status
FROM sync_sites
ORDER BY site_code;
```

### A.2 看最近的控制命令

```sql
SELECT id,
       command_type,
       target_site_code,
       status,
       created_at,
       acknowledged_at
FROM control_command
ORDER BY created_at DESC
LIMIT 20;
```

### A.3 看同步包日志

```sql
SELECT package_id,
       site_code,
       status,
       table_count,
       record_count,
       created_at
FROM sync_package_log
ORDER BY created_at DESC
LIMIT 20;
```

### A.4 看统一任务列表

```sql
SELECT task_id,
       site_code,
       task_type,
       status,
       created_at,
       source_site_id
FROM unified_tasks
ORDER BY created_at DESC
LIMIT 20;
```

---

## 附录 C：端口占用参考

| 端口 | 用途 | 默认在哪 |
|---|---|---|
| 3000 | Next.js 前端 | `pnpm dev` |
| 5432 | PostgreSQL 17 | docker compose |
| 9200 | OpenSearch | docker compose（可选） |
| 8123 | ClickHouse HTTP | docker compose（可选） |
| 9000 | ClickHouse TCP | docker compose（可选） |

如果端口被占，改 `docker-compose.yml` 的 ports 段，或在 `.env.local` 里指定其他端口。

---

## 附录 D：常见问题

**Q：本地起项目，登录失败？**
A：检查 `.env.local` 是否存在、`DATABASE_URL` 密码是否与 docker-compose 一致、是否跑了 `pnpm db:init`。默认账号 `admin / admin`。

**Q：改了前端代码没生效？**
A：`pnpm dev` 应该会自动热更新。如果没有，删 `.next/` 目录重启。

**Q：`pnpm build` 报错？**
A：先跑 `pnpm exec tsc --noEmit` 看类型错误，修了再 build。

**Q：怎么新增一个同步白名单表？**
A：改 `lib/sync/config.ts` 里的白名单列表 + `lib/sync/dump/export-restore-dump.ts`。**别忘了**更新 `docs/database-analysis/schema-inventory.md`。

**Q：怎么新增一个需求状态？**
A：改 `docs/database-analysis/requirements-traceability.json` 里的 schema，加新状态枚举。先看现有 6 种够不够用。

**Q：领导问「做到多少了」该怎么答？**
A：说严格数 29/45 = 64.4%。**不要**说 45/45。说候选数的话单独说，别合并。

**Q：怎么判断某个需求是不是真的完成了？**
A：看 `docs/database-analysis/requirements-traceability.json` 里那一条的 `current_status` 是不是 `complete`。如果有 SQL 证据、UI 截图、e2e 测试通过、产物 review，就是 `complete`。否则是 `partial` 或 `blocked_*`。

---

## 附录 E：贡献者必读

1. 改任何代码前，**先看** `docs/source/requirements.md` 对应章节。
2. 改完代码**必须**产出 `sprint-<编号>-requirements-review.md`。
3. **不要**只跑 tsc 就说完成。跑真 e2e 才行。
4. **不要**把 mock 数据当真实完成。
5. **不要**直接连站点库或 restore 库做产品页面。
6. 任何阻塞需求，**不要**关闭它，标 `blocked_*` 并列出升级所需。
7. **不要**把 "candidate" 数字汇报成 "complete"。
8. 看到 `lib/types/*` 的修改请求，请拒绝。
9. 提交前 4 件套：`pnpm exec tsc --noEmit` + `pnpm build` + `pnpm smoke:sync` + `pnpm baseline:check`。
10. 不确定的时候，看 `CLAUDE.md` 和 `AGENTS.md`。

---

## 附录 F：文档索引

| 想知道什么 | 看哪里 |
|---|---|
| 需求是什么 | `docs/source/requirements.md` |
| AI/Agent 工作约束 | `CLAUDE.md` |
| 系统架构 | `docs/architecture/system-architecture.md` |
| 同步链路细节 | `docs/architecture/sync-flow.md` |
| 大表策略 | `docs/architecture/large-table-strategy.md` |
| ID 策略 | `docs/architecture/id-strategy.md` |
| 站点 Agent 部署 | `docs/operations/site-agent-deployment.md` |
| 开发指南 | `docs/development/测试指南.md` |
| 项目当前状态 | `docs/summary/PROJECT_STATUS.md` |
| 路线图 | `docs/summary/ROADMAP.md` |
| 质量门 | `docs/testing/r81-quality-gate-report.md` |
| 各 Sprint 严格审查 | `docs/database-analysis/sprint-*-review.md` |
| 需求矩阵 | `docs/database-analysis/requirements-traceability.json` |
| 密钥轮换 | `docs/secrets/SECRETS.md` |

---

**最后更新：2026-06-21**
**对应 Sprint：R.76 - R.81（企业产品化收口）**
**严格完成度：29/45 = 64.4% · 候选覆盖：45/45**
