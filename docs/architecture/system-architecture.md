# 系统总体架构图

> 文档版本: v1.0
> 更新时间: 2026-05-28

---

## 一、系统架构总览

### 1.1 多站点数据采集架构

```mermaid
graph TB
    subgraph SiteA["站点 A 数据库 (MySQL)"]
        A_Task[tbl_task<br/>任务表]
        A_Device[tbl_disc_lib<br/>设备表]
        A_Slot[tbl_slots<br/>盘位表]
        A_Alert[tbl_early_warning<br/>告警表]
    end

    subgraph SiteB["站点 B 数据库 (MySQL)"]
        B_Task[tbl_task<br/>任务表]
        B_Device[tbl_disc_lib<br/>设备表]
        B_Slot[tbl_slots<br/>盘位表]
        B_Alert[tbl_early_warning<br/>告警表]
    end

    subgraph SiteC["站点 C 数据库 (MySQL)"]
        C_Task[tbl_task<br/>任务表]
        C_Device[tbl_disc_lib<br/>设备表]
        C_Slot[tbl_slots<br/>盘位表]
        C_Alert[tbl_early_warning<br/>告警表]
    end

    subgraph SyncLayer["同步服务层"]
        direction LR
        S_Task[任务同步]
        S_Device[设备同步]
        S_Slot[盘位同步]
        S_Alert[告警同步]
    end

    subgraph StorageLayer["存储层"]
        Staging[Staging Area<br/>临时存储]
        Mirror[Mirror Table<br/>镜像表]
    end

    subgraph CenterDB["统一平台中心库 (PostgreSQL)"]
        C_Tasks[unified_tasks]
        C_Devices[unified_devices]
        C_Slots[unified_slots]
        C_Alerts[unified_alerts]
    end

    subgraph Frontend["前端展示层"]
        Dashboard[Dashboard<br/>首页统计]
        TaskPage[任务管理]
        RackPage[盘架管理]
        AlertPage[告警管理]
    end

    A_Task --> S_Task
    B_Task --> S_Task
    C_Task --> S_Task

    A_Device --> S_Device
    B_Device --> S_Device
    C_Device --> S_Device

    A_Slot --> S_Slot
    B_Slot --> S_Slot
    C_Slot --> S_Slot

    A_Alert --> S_Alert
    B_Alert --> S_Alert
    C_Alert --> S_Alert

    S_Task --> Staging
    S_Device --> Staging
    S_Slot --> Staging
    S_Alert --> Staging

    Staging --> Mirror

    Mirror --> C_Tasks
    Mirror --> C_Devices
    Mirror --> C_Slots
    Mirror --> C_Alerts

    C_Tasks --> Dashboard
    C_Devices --> Dashboard
    C_Slots --> Dashboard
    C_Alerts --> Dashboard

    C_Tasks --> TaskPage
    C_Devices --> RackPage
    C_Slots --> RackPage
    C_Alerts --> AlertPage
```

---

### 1.2 数据流向说明

| 层级 | 说明 | 同步方式 |
|------|------|----------|
| **站点数据库** | 各站点 MySQL 数据库，包含全部原始数据 | - |
| **同步服务** | 定时任务，增量读取站点数据 | 每 5 分钟 |
| **Staging Area** | 临时存储，接收原始数据 | 写入后处理 |
| **Mirror Table** | 镜像表，最终合并数据 | 处理后合并 |
| **统一中心库** | 合并后的统一数据 | 展示使用 |
| **前端页面** | Dashboard / 任务 / 盘架 / 告警 | 实时读取 |

---

## 二、不同步的数据

### 2.1 不同步的文件级数据

```mermaid
graph LR
    subgraph NotSync["不同步的数据"]
        FileData["tbl_file<br/>文件明细<br/>(可能几千万~几亿)"]
        FolderData["tbl_folder<br/>文件夹明细<br/>(可能几千万)"]
        ContentData["tbl_zip_file<br/>压缩包内容<br/>(可能几千万)"]
        LogData["tbl_sys_log<br/>系统日志<br/>(可能几百万~几千万)"]
    end

    subgraph Future["未来按需查询"]
        FileSearch["文件搜索索引"]
        FileExport["文件导出"]
        FilePreview["文件预览"]
    end

    FileData -.->|"按需查询"| FileSearch
    FolderData -.->|"按需查询"| FileSearch
```

### 2.2 不同步原因

| 数据类型 | 原因 | 处理方式 |
|----------|------|----------|
| 文件明细 | 单站点可达千万，多站点可达亿级 | 按需查询、搜索索引 |
| 文件夹明细 | 目录树结构，变化少 | 按需同步根目录 |
| 压缩包内容 | 二进制数据，体积大 | 流式读取，不存储 |
| 系统日志 | 量大，价值低 | 按时间范围拉取 |

---

## 三、统一平台定位

### 3.1 统一平台不是

- ❌ **不是**文件存储系统
- ❌ **不是**文件检索系统
- ❌ **不是**文件备份系统
- ❌ **不是**全量数据同步平台

### 3.2 统一平台是

- ✅ **是**多站点任务汇总平台
- ✅ **是**多站点设备监控平台
- ✅ **是**多站点告警汇聚平台
- ✅ **是**多站点容量统计平台
- ✅ **是**统一管理入口

### 3.3 架构原则

```
┌─────────────────────────────────────────────────────────────┐
│                    统一平台核心定位                        │
├─────────────────────────────────────────────────────────────┤
│  1. 只同步元数据，不同步文件内容                            │
│  2. 只同步统计数据，不同步明细流水                         │
│  3. 保留站点来源，支持数据溯源                            │
│  4. 实时性要求高的数据优先同步（告警、任务状态）            │
│  5. 静态数据定时同步（用户、配置、字典）                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 统一中心库 | PostgreSQL 17 | 关系型数据库 |
| 同步服务 | Node.js / Python | 定时任务脚本 |
| 前端框架 | Next.js 16 | React 19 |
| 前端样式 | Tailwind CSS v4 | - |
| 组件库 | Radix UI | - |
| 图表 | Recharts | - |
