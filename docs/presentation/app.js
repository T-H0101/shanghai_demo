// ========================================
// 统一平台方案展示 - 应用逻辑
// ========================================

// 初始化 Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#1f2937',
    primaryBorderColor: '#3b82f6',
    lineColor: '#6b7280',
    secondaryColor: '#f3f4f6',
    tertiaryColor: '#f9fafb'
  },
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true
  }
});

// 文档路径配置
const DOCS_BASE = '../';
const DOCS_MAP = {
  overview: 'project-next-phase-summary.md',
  architecture: 'architecture/system-architecture.md',
  sync: 'architecture/sync-flow.md',
  scope: 'database-analysis/sync-candidates.md',
  'large-table': 'architecture/large-table-strategy.md',
  'id-strategy': 'architecture/id-strategy.md'
};

// 截图路径
const SCREENSHOTS = {
  dashboard: '../screenshots/dashboard.png',
  tasks: '../screenshots/tasks.png',
  racks: '../screenshots/racks.png',
  restore: '../screenshots/racks.png'  // 使用 racks 作为数据恢复占位图
};

// 缓存加载的文档
const docCache = {};

// 配置 marked
marked.setOptions({
  gfm: true,
  breaks: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

// 自定义渲染器处理 mermaid
const renderer = new marked.Renderer();
renderer.code = function(code, language) {
  if (language === 'mermaid') {
    return `<div class="mermaid">${code}</div>`;
  }
  const lang = language || '';
  const highlighted = lang && hljs.getLanguage(lang)
    ? hljs.highlight(code, { language: lang }).value
    : hljs.highlightAuto(code).value;
  return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
};
marked.use({ renderer });

// 加载文档
async function loadDoc(path) {
  if (docCache[path]) {
    return docCache[path];
  }

  try {
    const response = await fetch(DOCS_BASE + path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    docCache[path] = text;
    return text;
  } catch (error) {
    console.warn(`无法加载文档: ${path}`, error);
    return `# 文档未找到\n\n无法加载 ${path}，请确认文件存在。`;
  }
}

// 渲染 Markdown
function renderMarkdown(md) {
  return marked.parse(md);
}

// 渲染 Mermaid 图表
async function renderMermaid() {
  const mermaidElements = document.querySelectorAll('.mermaid');
  for (let i = 0; i < mermaidElements.length; i++) {
    const element = mermaidElements[i];
    const id = `mermaid-${i}`;
    try {
      const { svg } = await mermaid.render(id, element.textContent);
      element.innerHTML = svg;
    } catch (error) {
      console.error('Mermaid 渲染错误:', error);
      element.innerHTML = `<div class="mermaid-error">图表渲染失败: ${error.message}</div>`;
    }
  }
}

// 生成静态内容
function generateStaticContent(section) {
  switch (section) {
    case 'overview':
      return generateOverviewContent();
    case 'demo':
      return generateDemoContent();
    case 'roadmap':
      return generateRoadmapContent();
    default:
      return '<div class="loading">加载中...</div>';
  }
}

// 项目概览静态内容
function generateOverviewContent() {
  return `
    <div class="static-content">
      <h2>为什么做统一平台？</h2>
      <div class="card-grid">
        <div class="card">
          <h3><span class="card-icon">🎯</span> 多站点管理痛点</h3>
          <p>各站点独立运维，数据分散，无法统一监控和汇总分析。</p>
        </div>
        <div class="card">
          <h3><span class="card-icon">📊</span> 数据孤岛问题</h3>
          <p>站点间数据无法互通，跨站点查询和统计困难。</p>
        </div>
        <div class="card">
          <h3><span class="card-icon">⚡</span> 运维效率低</h3>
          <p>需要登录多个系统操作，切换成本高，容易出错。</p>
        </div>
        <div class="card">
          <h3><span class="card-icon">🔒</span> 统一管控需求</h3>
          <p>需要统一的权限管理、审计日志和告警通知。</p>
        </div>
      </div>
    </div>

    <div class="static-content">
      <h2>当前Demo已完成内容</h2>
      <table>
        <thead>
          <tr><th>模块</th><th>功能</th><th>状态</th></tr>
        </thead>
        <tbody>
          <tr><td>首页/控制台</td><td>站点统计、任务统计、设备统计、告警统计</td><td><span class="status-badge success">已完成</span></td></tr>
          <tr><td>任务管理</td><td>任务列表、详情、流程进度、多线程封包、SM3校验</td><td><span class="status-badge success">已完成</span></td></tr>
          <tr><td>盘架管理</td><td>设备列表、盘位视图、盘笼移位、设备模式</td><td><span class="status-badge success">已完成</span></td></tr>
          <tr><td>站点管理</td><td>站点列表、站点详情、站点切换</td><td><span class="status-badge success">已完成</span></td></tr>
          <tr><td>用户权限</td><td>用户列表、角色管理、权限配置</td><td><span class="status-badge success">已完成</span></td></tr>
          <tr><td>数据恢复</td><td>存储浏览、文件选择、恢复配置、恢复日志</td><td><span class="status-badge success">已完成</span></td></tr>
          <tr><td>审计日志</td><td>操作日志、错误码检索、导出功能</td><td><span class="status-badge success">已完成</span></td></tr>
          <tr><td>系统设置</td><td>告警配置、阈值设置、登录锁定、权限同步</td><td><span class="status-badge success">已完成</span></td></tr>
        </tbody>
      </table>
    </div>

    <div class="static-content">
      <h2>P0 核心同步范围</h2>
      <p>第一阶段聚焦 10 张核心业务表，覆盖首页统计和主要管理功能：</p>
      <table>
        <thead>
          <tr><th>表名</th><th>说明</th><th>同步频率</th></tr>
        </thead>
        <tbody>
          <tr><td>tbl_task</td><td>任务主表</td><td>5分钟</td></tr>
          <tr><td>tbl_disc_lib</td><td>设备信息表</td><td>5分钟</td></tr>
          <tr><td>tbl_slots</td><td>盘位/介质表</td><td>5分钟</td></tr>
          <tr><td>tbl_early_warning</td><td>告警信息表</td><td>1分钟</td></tr>
          <tr><td>tbl_magzines</td><td>盘笼/托盘表</td><td>5分钟</td></tr>
          <tr><td>tbl_drivers</td><td>光驱信息表</td><td>5分钟</td></tr>
          <tr><td>tbl_hd_info</td><td>硬盘信息表</td><td>5分钟</td></tr>
          <tr><td>tbl_logical_volume</td><td>存储卷表</td><td>5分钟</td></tr>
          <tr><td>tbl_lib_group</td><td>设备分组表</td><td>10分钟</td></tr>
          <tr><td>tbl_user</td><td>用户表</td><td>10分钟</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

// Demo截图内容
function generateDemoContent() {
  const screenshotItems = [
    { key: 'dashboard', name: '首页/控制台', desc: '站点汇总统计、任务状态、设备在线率、告警监控' },
    { key: 'tasks', name: '任务管理', desc: '任务列表、流程进度、多线程封包、SM3校验状态' },
    { key: 'racks', name: '盘架管理', desc: '设备状态、盘位视图、盘笼移位、设备模式控制' },
    { key: 'restore', name: '数据恢复', desc: '存储浏览、文件选择、恢复配置、进度跟踪' }
  ];

  let html = '<div class="screenshot-grid">';

  screenshotItems.forEach(item => {
    const imgSrc = SCREENSHOTS[item.key];
    html += `
      <div class="screenshot-item">
        <img src="${imgSrc}" alt="${item.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22250%22><rect fill=%22%23f3f4f6%22 width=%22400%22 height=%22250%22/><text x=%22200%22 y=%22130%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2214%22>${item.name}截图</text></svg>'">
        <div class="screenshot-caption">
          <strong>${item.name}</strong><br>
          <span style="color:var(--text-secondary)">${item.desc}</span>
        </div>
      </div>
    `;
  });

  html += '</div>';
  html += `
    <div class="static-content" style="margin-top:24px">
      <h3>截图说明</h3>
      <p>以上截图来自当前 Demo 演示系统，展示了统一平台的核心功能页面。所有页面已完成 UI 开发，使用 Mock 数据进行演示。</p>
      <p>后续接入真实数据库后，这些页面将显示真实的多站点汇总数据。</p>
    </div>
  `;

  return html;
}

// 下一阶段计划
function generateRoadmapContent() {
  return `
    <div class="static-content">
      <h2>实施路线图</h2>
      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-title">环境准备</div>
          <div class="step-desc">搭建 PostgreSQL<br>创建同步表</div>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-title">同步服务</div>
          <div class="step-desc">增量同步<br>分页初始化</div>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-title">API 对接</div>
          <div class="step-desc">替换 Mock<br>数据联动</div>
        </div>
        <div class="step">
          <div class="step-number">4</div>
          <div class="step-title">验证上线</div>
          <div class="step-desc">功能验证<br>性能测试</div>
        </div>
      </div>
    </div>

    <div class="static-content">
      <h2>Phase 1: 环境准备</h2>
      <table>
        <thead>
          <tr><th>任务</th><th>说明</th><th>优先级</th></tr>
        </thead>
        <tbody>
          <tr><td>PostgreSQL 17 安装</td><td>搭建统一中心库</td><td><span class="status-badge info">P0</span></td></tr>
          <tr><td>创建 sync_sites 表</td><td>站点配置表</td><td><span class="status-badge info">P0</span></td></tr>
          <tr><td>创建 sync_config 表</td><td>同步配置表</td><td><span class="status-badge info">P0</span></td></tr>
          <tr><td>创建 unified_* 表</td><td>统一数据表（含溯源字段）</td><td><span class="status-badge info">P0</span></td></tr>
        </tbody>
      </table>
    </div>

    <div class="static-content">
      <h2>Phase 2: 同步服务开发</h2>
      <table>
        <thead>
          <tr><th>任务</th><th>说明</th><th>优先级</th></tr>
        </thead>
        <tbody>
          <tr><td>增量同步脚本</td><td>基于 last_sync_time 游标</td><td><span class="status-badge info">P0</span></td></tr>
          <tr><td>分页初始化</td><td>首次全量同步（每页10000条）</td><td><span class="status-badge info">P0</span></td></tr>
          <tr><td>错误重试机制</td><td>3次重试，30秒间隔</td><td><span class="status-badge info">P0</span></td></tr>
          <tr><td>同步监控告警</td><td>同步失败通知</td><td><span class="status-badge warning">P1</span></td></tr>
        </tbody>
      </table>
    </div>

    <div class="static-content">
      <h2>Phase 3: 前端对接</h2>
      <table>
        <thead>
          <tr><th>任务</th><th>说明</th><th>优先级</th></tr>
        </thead>
        <tbody>
          <tr><td>API 层替换</td><td>Mock → 真实 API</td><td><span class="status-badge info">P0</span></td></tr>
          <tr><td>站点筛选</td><td>前端列表增加站点下拉</td><td><span class="status-badge info">P0</span></td></tr>
          <tr><td>溯源字段显示</td><td>数据来源标识</td><td><span class="status-badge warning">P1</span></td></tr>
          <tr><td>同步状态展示</td><td>站点同步状态指示器</td><td><span class="status-badge warning">P1</span></td></tr>
        </tbody>
      </table>
    </div>

    <div class="static-content">
      <h2>P0 Backlog</h2>
      <ul>
        <li>搭建 PostgreSQL 环境</li>
        <li>创建统一平台数据库 schema</li>
        <li>实现任务表增量同步（tbl_task）</li>
        <li>实现设备表增量同步（tbl_disc_lib）</li>
        <li>实现告警表增量同步（tbl_early_warning）</li>
        <li>实现盘位表增量同步（tbl_slots）</li>
        <li>前端 API 层替换</li>
        <li>站点筛选功能</li>
        <li>集成测试与验证</li>
      </ul>
    </div>

    <div class="static-content">
      <h2>未来规划</h2>
      <ul>
        <li><strong>P1</strong>: 接入 P1 表（关联业务表：光盘、加电、刻录统计）</li>
        <li><strong>P2</strong>: 文件索引服务（Elasticsearch）、异步导出功能</li>
        <li><strong>P3</strong>: 流式预览、分布式存储</li>
      </ul>
    </div>
  `;
}

// 加载内容
async function loadContent(section) {
  const element = document.getElementById(`content-${section}`);
  if (!element) return;

  // 静态内容
  if (['overview', 'demo', 'roadmap'].includes(section)) {
    element.innerHTML = generateStaticContent(section);
    return;
  }

  // 从文档加载
  const docPath = DOCS_MAP[section];
  if (docPath) {
    element.innerHTML = '<div class="loading">加载中...</div>';

    try {
      const md = await loadDoc(docPath);
      element.innerHTML = renderMarkdown(md);

      // 渲染 Mermaid 图表
      await renderMermaid();

      // 代码高亮
      document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    } catch (error) {
      element.innerHTML = `<p style="color:var(--danger-color)">加载失败: ${error.message}</p>`;
    }
  }
}

// 主题切换
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);

  // 更新 Mermaid 主题
  const isDark = next === 'dark';
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'base',
    themeVariables: isDark ? {
      primaryColor: '#238636',
      primaryTextColor: '#c9d1d9',
      primaryBorderColor: '#238636',
      lineColor: '#8b949e',
      secondaryColor: '#161b22',
      tertiaryColor: '#0d1117'
    } : {
      primaryColor: '#3b82f6',
      primaryTextColor: '#1f2937',
      primaryBorderColor: '#3b82f6',
      lineColor: '#6b7280',
      secondaryColor: '#f3f4f6',
      tertiaryColor: '#f9fafb'
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true
    }
  });

  // 保存偏好
  localStorage.setItem('theme', next);

  // 更新图标
  document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 恢复主题
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeIcon').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  // 初始化 Mermaid
  mermaid.initialize({
    startOnLoad: false,
    theme: savedTheme === 'dark' ? 'dark' : 'base'
  });

  // 导航点击
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;

      // 更新导航状态
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // 更新内容显示
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${section}`).classList.add('active');

      // 加载内容
      loadContent(section);
    });
  });

  // 主题切换
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);

  // 加载首页
  loadContent('overview');
});