const fs = require('fs');

// 读取模板
let html = fs.readFileSync('presentation.html', 'utf8');

// 读取截图
const images = {
  dashboard: fs.readFileSync('../screenshots/dashboard.png', 'base64'),
  tasks: fs.readFileSync('../screenshots/tasks.png', 'base64'),
  racks: fs.readFileSync('../screenshots/racks.png', 'base64'),
  sites: fs.readFileSync('../screenshots/sites.png', 'base64')
};

// 替换图片占位符
html = html
  .replace('DASHBOARD_BASE64', images.dashboard)
  .replace('TASKS_BASE64', images.tasks)
  .replace('RACKS_BASE64', images.racks)
  .replace('SITES_BASE64', images.sites);

// 输出到项目根目录
const outputPath = '/Users/tian/Desktop/上海/统一平台方案汇报.html';
fs.writeFileSync(outputPath, html);

console.log('生成完成:', outputPath);
console.log('文件大小:', (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2), 'MB');

// 验证
const content = fs.readFileSync(outputPath, 'utf8');
const imgCount = (content.match(/data:image\/png;base64,/g) || []).length;
console.log('图片数量:', imgCount);