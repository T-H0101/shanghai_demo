#!/usr/bin/env python3
"""
SQL Schema Analyzer for Disc Files Database
解析 SQL 文件，分析表结构，生成同步方案建议

用法:
    python3 scripts/analyze_disc_schema.py /path/to/disc_files.sql
    python3 scripts/analyze_disc_schema.py --input /path/to/disc_files.sql --out docs/database-analysis

@legacy / @obsolete — Python 脚本混进 pnpm + tsx 项目
  - 已被 scripts/import-from-source.ts 完全替代
  - Sprint 4.6A 处置: 保留不删 (低风险), Sprint 4.7+ 决定移走
  - 详见 docs/summary/SCRIPTS_INDEX.md §2.D
"""

import re
import sys
import json
import os
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional
from collections import defaultdict

# ============================================================
# 数据结构
# ============================================================

@dataclass
class Column:
    name: str
    data_type: str
    nullable: bool = True
    primary_key: bool = False
    default: Optional[str] = None
    comment: Optional[str] = None
    is_foreign_key: bool = False
    references: Optional[str] = None

@dataclass
class Index:
    name: str
    columns: list
    unique: bool = False
    comment: Optional[str] = None

@dataclass
class Table:
    name: str
    comment: Optional[str] = None
    columns: list = field(default_factory=list)
    primary_keys: list = field(default_factory=list)
    foreign_keys: list = field(default_factory=list)
    indexes: list = field(default_factory=list)
    is_view: bool = False
    # 分析结果
    relevance_score: int = 0
    category: Optional[str] = None
    is_large_table: bool = False
    is_system_table: bool = False
    sync_priority: str = "P3"  # P0, P1, P2, P3
    sync_strategy: Optional[str] = None
    keywords_matched: list = field(default_factory=list)

# ============================================================
# SQL 解析器
# ============================================================

class SQLParser:
    """解析 MySQL/PostgreSQL 风格的 SQL 文件"""

    def __init__(self, sql_content: str):
        self.sql = sql_content
        self.tables: dict[str, Table] = {}
        self._parse_all()

    def _extract_create_table_blocks(self) -> list[tuple[str, str]]:
        """提取所有 CREATE TABLE 语句"""
        blocks = []

        # 使用更宽松的正则匹配
        # 匹配 CREATE TABLE 和其后的表名，然后找到对应的语句结束
        pattern = r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?(\w+)[`"]*'
        for match in re.finditer(pattern, self.sql, re.IGNORECASE):
            table_name = match.group(1)

            # 排除动态表名
            if '{tableId}' in table_name or '{' in table_name:
                continue
            if table_name.startswith('tbl_certif_record_'):
                continue

            # 从匹配位置开始，找到匹配的括号对
            start = match.start()
            # 找到 CREATE TABLE 后第一个 ( 的位置
            paren_start = self.sql.find('(', start)
            if paren_start == -1:
                continue

            # 括号计数匹配
            count = 1
            i = paren_start + 1
            while i < len(self.sql) and count > 0:
                if self.sql[i] == '(':
                    count += 1
                elif self.sql[i] == ')':
                    count -= 1
                i += 1

            if count == 0:
                # 找到语句结束的分号
                stmt_end = self.sql.find(';', i)
                if stmt_end != -1:
                    end = stmt_end + 1
                else:
                    end = i

                create_stmt = self.sql[start:end].strip()
                if create_stmt:
                    blocks.append((table_name, create_stmt))

        return blocks

    def _parse_columns(self, columns_str: str) -> list[Column]:
        """解析列定义"""
        columns = []
        lines = columns_str.split(',')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 跳过约束定义
            if any(kw in line.upper() for kw in ['PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'KEY `', 'INDEX ', 'CONSTRAINT']):
                continue
            if line.startswith('PRIMARY KEY') or line.startswith('FOREIGN KEY'):
                continue

            # 解析列
            col = self._parse_single_column(line)
            if col:
                columns.append(col)

        return columns

    def _parse_single_column(self, line: str) -> Optional[Column]:
        """解析单列定义"""
        line = line.strip()
        if not line:
            return None

        # 提取列名
        name_match = re.match(r'[`"]?(\w+)[`"]?\s+', line)
        if not name_match:
            return None
        name = name_match.group(1)

        # 提取数据类型
        type_match = re.search(r'(\w+(?:\s*\([^)]+\))?)', line[name_match.end():])
        data_type = type_match.group(1) if type_match else 'UNKNOWN'

        # 检查 nullable
        nullable = 'NOT NULL' not in line.upper()

        # 检查 PRIMARY KEY
        is_pk = 'PRIMARY KEY' in line.upper()

        # 提取默认值
        default = None
        default_match = re.search(r"DEFAULT\s+('[^']*'|\"[^\"]*\"|[^\s,]+)", line, re.IGNORECASE)
        if default_match:
            default = default_match.group(1)

        # 提取 COMMENT
        comment = None
        comment_match = re.search(r"COMMENT\s+'([^']*)'", line, re.IGNORECASE)
        if comment_match:
            comment = comment_match.group(1)

        return Column(
            name=name,
            data_type=data_type.upper(),
            nullable=nullable,
            primary_key=is_pk,
            default=default,
            comment=comment
        )

    def _extract_primary_keys(self, columns_str: str) -> list[str]:
        """提取主键"""
        pk_match = re.search(r'PRIMARY\s+KEY\s*\([^)]+\)', columns_str, re.IGNORECASE)
        if pk_match:
            pk_str = pk_match.group(0)
            cols = re.findall(r'[`"]?(\w+)[`"]?', pk_str)
            return cols[1:] if cols else []  # 跳过 'PRIMARY KEY' 本身
        return []

    def _extract_foreign_keys(self, columns_str: str) -> list[tuple[str, str]]:
        """提取外键"""
        fks = []
        fk_matches = re.findall(
            r'FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES\s+[`"]?(\w+)[`"]?\s*\([^)]+\)',
            columns_str,
            re.IGNORECASE
        )
        for match in fk_matches:
            # 这里简化处理，实际应该从列定义中获取
            fks.append((match, match))
        return fks

    def _extract_table_comment_from_header(self, table_name: str, create_stmt: str) -> Optional[str]:
        """从 CREATE TABLE 语句前的注释行提取表注释"""
        # 找到 CREATE TABLE 的位置
        create_pos = self.sql.find(f'CREATE TABLE `{table_name}`')
        if create_pos == -1:
            return None

        # 向前查找注释行（最多20行）
        before_text = self.sql[max(0, create_pos - 2000):create_pos]
        lines = before_text.split('\n')

        for line in reversed(lines[-10:]):
            line = line.strip()
            if not line:
                continue
            # 匹配 "-- Table structure for tbl_xxx 注释"
            match = re.search(r'--\s*(?:Table structure for\s+)?`?(\w+)`?\s*(.*)', line, re.IGNORECASE)
            if match:
                table_in_comment = match.group(1)
                comment_part = match.group(2).strip()
                if table_in_comment == table_name and comment_part:
                    return comment_part
            # 匹配 "-- 注释"
            if line.startswith('--') and not line.startswith('---'):
                comment = line.lstrip('-').strip()
                if comment and 'Table structure' not in comment and '----' not in comment:
                    return comment
        return None

    def _extract_comment(self, create_stmt: str) -> Optional[str]:
        """提取表注释"""
        # 先尝试从 ENGINE= 行后的 COMMENT
        comment_match = re.search(r"COMMENT\s*=\s*['\"]([^'\"]+)['\"]", create_stmt, re.IGNORECASE)
        if comment_match:
            return comment_match.group(1)
        return None

    def _parse_all(self):
        """解析所有表"""
        blocks = self._extract_create_table_blocks()

        for table_name, create_stmt in blocks:
            # 提取列定义部分
            columns_match = re.search(r'\(([\s\S]+)\)', create_stmt)
            if not columns_match:
                continue

            columns_str = columns_match.group(1)

            # 解析列
            columns = self._parse_columns(columns_str)

            # 提取主键
            pk_cols = self._extract_primary_keys(columns_str)

            # 标记主键列
            for col in columns:
                if col.name in pk_cols:
                    col.primary_key = True

            # 提取外键
            fks = self._extract_foreign_keys(columns_str)

            # 提取注释 - 优先从 ENGINE= 行后提取，其次从表头注释提取
            comment = self._extract_comment(create_stmt)
            if not comment:
                comment = self._extract_table_comment_from_header(table_name, create_stmt)

            table = Table(
                name=table_name,
                comment=comment,
                columns=columns,
                primary_keys=pk_cols,
                foreign_keys=fks
            )

            self.tables[table_name] = table

# ============================================================
# 关键词配置
# ============================================================

# 任务管理相关关键词
TASK_KEYWORDS = [
    'task', 'job', 'schedule', 'backup', 'restore', 'recovery', 'copy',
    'inspection', 'check', 'check_task', 'patrol', 'scan', 'package', 'archive'
]

# 设备/盘架相关关键词
DEVICE_KEYWORDS = [
    'device', 'rack', 'library', 'lib', 'cabinet', 'disk', 'disc', 'optical',
    'hard', 'drive', 'slot', 'tray', 'mag', 'media', 'driver', 'hd_', 'hdd'
]

# 存储卷相关关键词
VOLUME_KEYWORDS = [
    'volume', 'storage', 'pool', 'mount', 'logical', 'capacity', 'group'
]

# 文件/数据相关关键词
FILE_KEYWORDS = [
    'file', 'folder', 'directory', 'folder', 'path', 'iso', 'zip', 'package',
    'archive', 'metadata', 'checksum', 'md5', 'sha', 'sm3', 'content', 'part'
]

# 告警/日志相关关键词
ALERT_KEYWORDS = [
    'alert', 'alarm', 'warning', 'log', 'audit', 'event', 'operation',
    'monitor', 'early_warning', 'verify'
]

# 用户/权限相关关键词
USER_KEYWORDS = [
    'user', 'role', 'permission', 'auth', 'account', 'depa', 'department',
    'workspace', 'project'
]

# 系统表关键词
SYSTEM_KEYWORDS = [
    'sys', 'dict', 'config', 'setting', 'platform', 'site', 'api_interface'
]

# 大表关键词
LARGE_TABLE_PATTERNS = [
    'file_', 'files', 'folder_', 'directory', 'detail', 'content',
    'checksum', 'hash', 'archive_item', 'package_item', 'log_detail',
    '_detail', '_file', '_log'
]

# ============================================================
# 分析器
# ============================================================

class SchemaAnalyzer:
    """分析表结构，计算相关性"""

    def __init__(self, tables: dict[str, Table]):
        self.tables = tables

    def analyze(self):
        """分析所有表"""
        for table in self.tables.values():
            self._analyze_table(table)

    def _analyze_table(self, table: Table):
        """分析单张表"""
        # 收集所有关键词匹配
        matched_keywords = []

        # 1. 表名匹配
        table_name_lower = table.name.lower()

        # 检查是否是大表
        for pattern in LARGE_TABLE_PATTERNS:
            if pattern in table_name_lower:
                table.is_large_table = True
                break

        # 检查是否是系统表
        for kw in SYSTEM_KEYWORDS:
            if kw in table_name_lower:
                table.is_system_table = True
                break

        # 任务管理
        for kw in TASK_KEYWORDS:
            if kw in table_name_lower:
                matched_keywords.append(f"task:{kw}")
                table.relevance_score += 20

        # 设备/盘架
        for kw in DEVICE_KEYWORDS:
            if kw in table_name_lower:
                matched_keywords.append(f"device:{kw}")
                table.relevance_score += 15

        # 存储卷
        for kw in VOLUME_KEYWORDS:
            if kw in table_name_lower:
                matched_keywords.append(f"volume:{kw}")
                table.relevance_score += 10

        # 文件/数据
        if 'file' in table_name_lower or 'folder' in table_name_lower:
            matched_keywords.append("file:file/folder")
            table.relevance_score += 5
            # 文件表很可能是大表
            if 'detail' not in table_name_lower:
                table.is_large_table = True

        # 告警/日志
        for kw in ALERT_KEYWORDS:
            if kw in table_name_lower:
                matched_keywords.append(f"alert:{kw}")
                table.relevance_score += 10

        # 用户/权限
        for kw in USER_KEYWORDS:
            if kw in table_name_lower:
                matched_keywords.append(f"user:{kw}")
                table.relevance_score += 8

        # 2. 字段名匹配
        for col in table.columns:
            col_name_lower = col.name.lower()

            for kw in TASK_KEYWORDS:
                if kw in col_name_lower:
                    table.relevance_score += 5
                    matched_keywords.append(f"col:task:{kw}")

            for kw in DEVICE_KEYWORDS:
                if kw in col_name_lower:
                    table.relevance_score += 3
                    matched_keywords.append(f"col:device:{kw}")

        # 3. 时间字段加分（适合同步）
        time_fields = ['create_time', 'update_time', 'updated_at', 'created_at', 'create_dt', 'last_sync']
        for col in table.columns:
            if col.name.lower() in time_fields:
                table.relevance_score += 5
                matched_keywords.append(f"time:{col.name}")
                table.sync_strategy = "适合增量同步"

        # 4. status/state 字段加分
        for col in table.columns:
            if col.name.lower() in ['status', 'state', 'device_status', 'task_status']:
                table.relevance_score += 3
                matched_keywords.append(f"status:{col.name}")

        # 5. ID 字段加分（可关联）
        id_fields = ['device_id', 'task_id', 'volume_id', 'media_id', 'file_id', 'lib_id', 'slot_id']
        for col in table.columns:
            if col.name.lower() in id_fields:
                table.relevance_score += 2
                matched_keywords.append(f"fk:{col.name}")

        # 记录匹配的关键词
        table.keywords_matched = list(set(matched_keywords))

        # 6. 确定分类
        table.category = self._determine_category(table)

        # 7. 确定同步优先级
        table.sync_priority = self._determine_priority(table)

    def _determine_category(self, table: Table) -> str:
        """确定表分类"""
        name = table.name.lower()

        if any(kw in name for kw in ['task', 'job', 'schedule']):
            return "任务管理"
        if any(kw in name for kw in ['lib', 'device', 'disc', 'slot', 'driver', 'mag', 'hd_']):
            return "设备/盘架"
        if any(kw in name for kw in ['volume', 'mount', 'logical']):
            return "存储卷"
        if any(kw in name for kw in ['file', 'folder', 'path', 'archive', 'iso']):
            return "文件/数据"
        if any(kw in name for kw in ['alert', 'log', 'check', 'inspect', 'monitor']):
            return "告警/日志"
        if any(kw in name for kw in ['user', 'role', 'depa', 'workspace']):
            return "用户/权限"
        if any(kw in name for kw in ['sys', 'dict', 'platform', 'site']):
            return "系统配置"

        return "其他"

    def _determine_priority(self, table: Table) -> str:
        """确定同步优先级"""
        name = table.name.lower()

        # 核心业务表优先
        if table.relevance_score >= 40:
            if table.is_large_table:
                return "P1"  # 相关但需要分页处理
            return "P0"

        if table.relevance_score >= 25:
            return "P1"

        if table.relevance_score >= 15:
            return "P2"

        if table.relevance_score >= 8:
            return "P2"

        return "P3"

# ============================================================
# 报告生成器
# ============================================================

class ReportGenerator:
    """生成分析报告"""

    def __init__(self, tables: dict[str, Table], analyzer: SchemaAnalyzer):
        self.tables = tables
        self.analyzer = analyzer
        self.sorted_tables = sorted(tables.values(), key=lambda t: -t.relevance_score)

    def generate_all(self, output_dir: str):
        """生成所有报告"""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        self._generate_inventory_markdown(output_dir / 'schema-inventory.md')
        self._generate_inventory_json(output_dir / 'schema-inventory.json')
        self._generate_relevant_tables(output_dir / 'relevant-tables.md')
        self._generate_sync_candidates(output_dir / 'sync-candidates.md')
        self._generate_sync_strategy(output_dir / 'sync-strategy-proposal.md')

        print(f"\n报告已生成到: {output_dir}")
        self._print_summary()

    def _generate_inventory_markdown(self, output_path: Path):
        """生成表清单 Markdown"""
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# 数据库表清单\n\n")
            f.write(f"> 分析时间: {self._get_timestamp()}\n")
            f.write(f"> 总表数: {len(self.tables)}\n\n")

            f.write("## 目录\n\n")
            f.write("1. [任务管理相关](#任务管理相关)\n")
            f.write("2. [设备/盘架相关](#设备盘架相关)\n")
            f.write("3. [存储卷相关](#存储卷相关)\n")
            f.write("4. [文件/数据相关](#文件数据相关)\n")
            f.write("5. [告警/日志相关](#告警日志相关)\n")
            f.write("6. [用户/权限相关](#用户权限相关)\n")
            f.write("7. [系统配置](#系统配置)\n")
            f.write("8. [其他](#其他)\n\n")

            # 按分类分组
            categories = defaultdict(list)
            for table in self.sorted_tables:
                categories[table.category].append(table)

            for category in ['任务管理', '设备/盘架', '存储卷', '文件/数据', '告警/日志', '用户/权限', '系统配置', '其他']:
                tables = categories.get(category, [])
                if not tables:
                    continue

                f.write(f"## {category}\n\n")

                for table in tables:
                    f.write(self._format_table_summary(table))

                f.write("\n")

    def _format_table_summary(self, table: Table) -> str:
        """格式化表摘要"""
        lines = []
        lines.append(f"### {table.name}\n")

        if table.comment:
            lines.append(f"**说明**: {table.comment}\n")

        # 基本信息
        info = []
        info.append(f"列数: {len(table.columns)}")
        if table.primary_keys:
            info.append(f"主键: `{'`, `'.join(table.primary_keys)}`")
        if table.foreign_keys:
            info.append(f"外键: {len(table.foreign_keys)} 个")
        if table.indexes:
            info.append(f"索引: {len(table.indexes)} 个")
        if table.is_large_table:
            info.append("⚠️ **疑似大表**")
        if table.is_system_table:
            info.append("🔧 系统表")

        lines.append("| 属性 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 相关性评分 | {table.relevance_score} |")
        lines.append(f"| 同步优先级 | {table.sync_priority} |")
        lines.append(f"| 分类 | {table.category} |")
        lines.append(f"| {'⚠️ 大表' if table.is_large_table else '常规表'} | {'是' if table.is_large_table else '否'} |")
        lines.append(f"| 系统表 | {'是' if table.is_system_table else '否'} |")
        lines.append("\n")

        # 字段列表
        lines.append("**字段**:\n\n")
        lines.append("| 列名 | 类型 | nullable | 主键 | 说明 |")
        lines.append("|------|------|---------|------|------|")
        for col in table.columns[:15]:  # 最多显示15个字段
            pk = "✓" if col.primary_key else ""
            nullable = "" if col.nullable else "NOT NULL"
            comment = col.comment or ""
            lines.append(f"| `{col.name}` | {col.data_type} | {nullable} | {pk} | {comment} |")

        if len(table.columns) > 15:
            lines.append(f"\n*...共 {len(table.columns)} 个字段，仅显示前15个*\n")

        lines.append("\n")
        return "\n".join(lines)

    def _generate_inventory_json(self, output_path: Path):
        """生成 JSON 格式清单"""
        data = {
            "generated_at": self._get_timestamp(),
            "total_tables": len(self.tables),
            "tables": {}
        }

        for name, table in self.tables.items():
            data["tables"][name] = {
                "name": table.name,
                "comment": table.comment,
                "column_count": len(table.columns),
                "columns": [
                    {
                        "name": c.name,
                        "data_type": c.data_type,
                        "nullable": c.nullable,
                        "primary_key": c.primary_key,
                        "default": c.default,
                        "comment": c.comment
                    }
                    for c in table.columns
                ],
                "primary_keys": table.primary_keys,
                "foreign_keys": table.foreign_keys,
                "indexes": table.indexes,
                "is_view": table.is_view,
                "analysis": {
                    "relevance_score": table.relevance_score,
                    "category": table.category,
                    "is_large_table": table.is_large_table,
                    "is_system_table": table.is_system_table,
                    "sync_priority": table.sync_priority,
                    "sync_strategy": table.sync_strategy,
                    "keywords_matched": table.keywords_matched
                }
            }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _generate_relevant_tables(self, output_path: Path):
        """生成相关表清单"""
        relevant_tables = [t for t in self.sorted_tables if t.relevance_score > 0]

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# 相关表清单\n\n")
            f.write(f"> 分析时间: {self._get_timestamp()}\n")
            f.write(f"> 疑似相关表数量: {len(relevant_tables)}\n\n")

            # 按分类分组
            categories = defaultdict(list)
            for table in relevant_tables:
                categories[table.category].append(table)

            for category in ['任务管理', '设备/盘架', '存储卷', '文件/数据', '告警/日志', '用户/权限', '系统配置']:
                tables = categories.get(category, [])
                if not tables:
                    continue

                f.write(f"## {category} ({len(tables)} 张)\n\n")

                for table in tables:
                    f.write(f"- `{table.name}`")
                    if table.comment:
                        f.write(f" - {table.comment}")
                    f.write(f" (评分: {table.relevance_score}, 优先级: {table.sync_priority})")
                    if table.is_large_table:
                        f.write(" ⚠️")
                    f.write("\n")

                f.write("\n")

    def _generate_sync_candidates(self, output_path: Path):
        """生成同步候选表"""
        p0_tables = [t for t in self.sorted_tables if t.sync_priority == "P0"]
        p1_tables = [t for t in self.sorted_tables if t.sync_priority == "P1"]
        p2_tables = [t for t in self.sorted_tables if t.sync_priority == "P2"]
        p3_tables = [t for t in self.sorted_tables if t.sync_priority == "P3"]

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# 同步候选表清单\n\n")
            f.write(f"> 分析时间: {self._get_timestamp()}\n\n")

            f.write("## 统计概览\n\n")
            f.write(f"| 优先级 | 数量 | 说明 |\n")
            f.write(f"|--------|------|------|\n")
            f.write(f"| P0 | {len(p0_tables)} | 建议第一批同步 |\n")
            f.write(f"| P1 | {len(p1_tables)} | 第二批同步 |\n")
            f.write(f"| P2 | {len(p2_tables)} | 后续同步 |\n")
            f.write(f"| P3 | {len(p3_tables)} | 暂不同步 |\n")
            f.write("\n")

            # P0
            f.write("## P0: 建议第一批同步\n\n")
            f.write("核心业务表，数据量适中，5分钟同步频率适合。\n\n")
            for table in p0_tables:
                f.write(f"### `{table.name}`\n")
                f.write(f"- 说明: {table.comment or '无'}\n")
                f.write(f"- 字段数: {len(table.columns)}\n")
                f.write(f"- 主键: `{'`, `'.join(table.primary_keys) if table.primary_keys else '无'}`\n")
                if table.sync_strategy:
                    f.write(f"- 同步策略: {table.sync_strategy}\n")
                if table.is_large_table:
                    f.write("- ⚠️ 注意: 可能是大表，需谨慎\n")
                f.write("\n")

            # P1
            f.write("## P1: 第二批同步\n\n")
            for table in p1_tables:
                marker = "⚠️ " if table.is_large_table else "- "
                f.write(f"{marker}`{table.name}` - {table.comment or ''} (评分: {table.relevance_score})\n")
            f.write("\n")

            # P2
            f.write("## P2: 后续同步\n\n")
            for table in p2_tables:
                marker = "⚠️ " if table.is_large_table else "- "
                f.write(f"{marker}`{table.name}` - {table.comment or ''}\n")
            f.write("\n")

            # P3
            large_tables = [t for t in p3_tables if t.is_large_table]
            f.write(f"## P3: 暂不同步 ({len(p3_tables)} 张)\n\n")
            if large_tables:
                f.write("### 疑似大表 (暂不建议全量同步)\n\n")
                for table in large_tables[:20]:
                    f.write(f"- `{table.name}` - {table.comment or '无'}\n")
                if len(large_tables) > 20:
                    f.write(f"\n*...还有 {len(large_tables) - 20} 张*\n")
                f.write("\n")

    def _generate_sync_strategy(self, output_path: Path):
        """生成同步策略建议"""
        p0_tables = [t for t in self.sorted_tables if t.sync_priority == "P0"]
        p1_tables = [t for t in self.sorted_tables if t.sync_priority in ["P0", "P1"]]
        large_tables = [t for t in self.tables.values() if t.is_large_table]

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# 数据同步方案建议\n\n")
            f.write(f"> 文档版本: v1.0\n")
            f.write(f"> 生成时间: {self._get_timestamp()}\n")
            f.write(f"> 数据源: disc_files.sql\n")
            f.write(f"> 目标: 统一光盘库管理平台 Demo\n\n")

            # 执行摘要
            f.write("## 一、执行摘要\n\n")
            f.write("| 指标 | 数值 |\n")
            f.write("|------|------|\n")
            f.write(f"| SQL 表总数 | {len(self.tables)} |\n")
            f.write(f"| P0 候选表 | {len(p0_tables)} |\n")
            f.write(f"| P1 候选表 | {len(p1_tables)} |\n")
            f.write(f"| 疑似大表 | {len(large_tables)} |\n")
            f.write("\n")

            # P0 同步建议
            f.write("## 二、P0 第一批同步表 (核心业务)\n\n")
            f.write("以下表支撑首页统计、任务管理、设备监控、存储卷管理功能：\n\n")

            # 表格形式
            f.write("| 表名 | 说明 | 主键 | 预计数据量 | 同步策略 |\n")
            f.write("|------|------|------|-----------|----------|\n")

            critical_tables = ['tbl_task', 'tbl_disc_lib', 'tbl_slots', 'tbl_magzines',
                             'tbl_user', 'tbl_logical_volume', 'tbl_early_warning',
                             'tbl_task_items', 'tbl_lib_group']

            for name in critical_tables:
                if name in self.tables:
                    t = self.tables[name]
                    f.write(f"| `{t.name}` | {t.comment or ''} | `{'`, `'.join(t.primary_keys)}` | 中等 | 5分钟增量 |\n")

            # 大表处理策略
            f.write("\n## 三、大表处理策略\n\n")
            f.write(f"发现 {len(large_tables)} 张疑似大表，暂不建议第一批全量同步：\n\n")

            f.write("| 表名 | 说明 | 建议处理方式 |\n")
            f.write("|------|------|--------------|\n")

            for table in large_tables[:15]:
                strategy = "按需查询" if "file" in table.name.lower() else "分页拉取"
                f.write(f"| `{table.name}` | {table.comment or '无'} | {strategy} |\n")

            f.write("\n**原因**：单站点文件数据可能几千万，多站点合起来可能几个亿。\n")
            f.write("文件级明细查询和导出放到最后阶段处理。\n\n")

            # 同步频率
            f.write("## 四、同步频率建议\n\n")
            f.write("| 数据类型 | 同步频率 | 理由 |\n")
            f.write("|----------|----------|------|\n")
            f.write("| 任务状态 | 1-5 分钟 | 实时性要求高 |\n")
            f.write("| 设备状态 | 5 分钟 | 状态变化不频繁 |\n")
            f.write("| 容量统计 | 5 分钟 | 定期刷新即可 |\n")
            f.write("| 告警信息 | 1 分钟 | 需要及时通知 |\n")
            f.write("| 文件索引 | 按需/定时 | 数据量大，差异同步 |\n")
            f.write("| 用户权限 | 10 分钟 | 变更不频繁 |\n\n")

            # 增量同步字段
            f.write("## 五、增量同步字段建议\n\n")
            f.write("以下字段适合作为增量同步的游标：\n\n")
            f.write("```sql\n")
            f.write("-- 任务表增量字段\n")
            f.write("WHERE update_time > '{last_sync_time}'\n")
            f.write("\n")
            f.write("-- 设备表增量字段\n")
            f.write("WHERE device_status_changed_at > '{last_sync_time}'\n")
            f.write("\n")
            f.write("-- 日志表增量字段\n")
            f.write("WHERE create_time > '{last_sync_time}'\n")
            f.write("```\n\n")

            # 多站点标识
            f.write("## 六、多站点数据标识\n\n")
            f.write("同步到统一平台时，建议在每条记录中增加：\n\n")
            f.write("```sql\n")
            f.write("-- 建议添加的同步元数据字段\n")
            f.write("source_site_id     VARCHAR(50)  -- 来源站点ID\n")
            f.write("source_db          VARCHAR(100) -- 来源数据库标识\n")
            f.write("source_table       VARCHAR(100) -- 来源表名\n")
            f.write("source_primary_key INT          -- 来源记录主键\n")
            f.write("synced_at          TIMESTAMP    -- 同步时间\n")
            f.write("```\n\n")

            # 下一步
            f.write("## 七、实施建议\n\n")
            f.write("1. **第一阶段（当前）**：\n")
            f.write("   - 确认 P0 表清单\n")
            f.write("   - 设计本地统一平台的数据库 schema\n")
            f.write("   - 规划 staging/mirror 表结构\n")
            f.write("   - 开发增量同步脚本\n\n")
            f.write("2. **第二阶段**：\n")
            f.write("   - 接入任务、设备、存储卷相关表\n")
            f.write("   - 验证同步脚本\n")
            f.write("   - 完善告警机制\n\n")
            f.write("3. **第三阶段**：\n")
            f.write("   - 评估大表处理方案\n")
            f.write("   - 文件级功能按需开发\n")
            f.write("   - 导出功能开发\n\n")

    def _get_timestamp(self) -> str:
        """获取时间戳"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _print_summary(self):
        """打印摘要"""
        print("\n" + "="*60)
        print("分析摘要")
        print("="*60)

        p0 = len([t for t in self.tables.values() if t.sync_priority == "P0"])
        p1 = len([t for t in self.tables.values() if t.sync_priority == "P1"])
        p2 = len([t for t in self.tables.values() if t.sync_priority == "P2"])
        p3 = len([t for t in self.tables.values() if t.sync_priority == "P3"])
        large = len([t for t in self.tables.values() if t.is_large_table])
        relevant = len([t for t in self.tables.values() if t.relevance_score > 0])

        print(f"总表数: {len(self.tables)}")
        print(f"相关表: {relevant}")
        print(f"P0 优先: {p0}")
        print(f"P1 次优先: {p1}")
        print(f"P2 后续: {p2}")
        print(f"P3 暂缓: {p3}")
        print(f"疑似大表: {large}")

        print("\n最值得优先查看的 10 张表:")
        for i, table in enumerate(self.sorted_tables[:10], 1):
            print(f"  {i}. {table.name} (评分: {table.relevance_score}) - {table.category}")

        print("\n疑似大表 (需谨慎处理):")
        for table in self.tables.values():
            if table.is_large_table and table.relevance_score > 20:
                print(f"  - {table.name}")

# ============================================================
# 主程序
# ============================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='分析 disc_files.sql 数据库表结构')
    parser.add_argument('input', help='SQL 文件路径')
    parser.add_argument('--out', default='docs/database-analysis', help='输出目录')

    args = parser.parse_args()

    # 读取 SQL 文件
    sql_path = Path(args.input)
    if not sql_path.exists():
        print(f"错误: 文件不存在: {sql_path}")
        sys.exit(1)

    print(f"读取 SQL 文件: {sql_path}")
    with open(sql_path, 'r', encoding='utf-8', errors='ignore') as f:
        sql_content = f.read()

    print(f"文件大小: {len(sql_content)} 字节")

    # 解析
    print("解析 SQL 结构...")
    parser_obj = SQLParser(sql_content)
    print(f"发现 {len(parser_obj.tables)} 张表")

    # 分析
    print("分析相关性...")
    analyzer = SchemaAnalyzer(parser_obj.tables)
    analyzer.analyze()

    # 生成报告
    print("生成报告...")
    report_gen = ReportGenerator(parser_obj.tables, analyzer)
    report_gen.generate_all(args.out)

    print("\n完成!")

if __name__ == '__main__':
    main()
