// 数据管理工具 - 导出/导入配置和收藏到 Markdown 文件

// 导出配置到 Markdown
function exportConfigToMarkdown(config) {
  const date = new Date().toISOString().slice(0, 10);
  let md = `# Reddit 订阅配置\n\n`;
  md += `> 导出时间: ${date}\n\n`;
  md += `## 订阅列表\n\n`;
  md += `| 序号 | Subreddit |\n`;
  md += `|------|-----------|\n`;

  const subreddits = config.reddit?.subreddits || [];
  subreddits.forEach((sub, index) => {
    md += `| ${index + 1} | \`${sub}\` |\n`;
  });

  md += `\n**共 ${subreddits.length} 个订阅**\n`;
  return md;
}

// 导出收藏到 Markdown
function exportFavoritesToMarkdown(favorites) {
  const date = new Date().toISOString().slice(0, 10);
  let md = `# 收藏夹\n\n`;
  md += `> 导出时间: ${date}\n\n`;
  md += `**共 ${favorites.length} 条收藏**\n\n`;

  if (favorites.length === 0) {
    md += `暂无收藏\n`;
    return md;
  }

  // 按来源分组
  const grouped = {};
  favorites.forEach(item => {
    const source = item.source || 'unknown';
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push(item);
  });

  for (const [source, items] of Object.entries(grouped)) {
    const sourceLabel = getSourceLabel(source);
    md += `## ${sourceLabel}\n\n`;
    items.forEach((item, index) => {
      const time = item.timestamp ? new Date(item.timestamp).toLocaleString('zh-CN') : '未知时间';
      md += `### ${index + 1}. ${item.title}\n\n`;
      if (item.url) md += `- **链接**: ${item.url}\n`;
      if (item.score) md += `- **评分**: ${item.score}/10\n`;
      if (item.subreddit) md += `- **来源**: ${item.subreddit}\n`;
      md += `- **时间**: ${time}\n`;
      if (item.id) md += `- **ID**: \`${item.id}\`\n`;
      md += `\n`;
    });
    md += `\n`;
  }

  return md;
}

// 从 Markdown 导入配置
function importConfigFromMarkdown(md) {
  const lines = md.split('\n');
  const subreddits = [];

  for (const line of lines) {
    // 匹配 | 1 | `r/ethereum` | 格式
    const match = line.match(/\|\s*\d+\s*\|\s*`([^`]+)`\s*\|/);
    if (match) {
      subreddits.push(match[1]);
    }
  }

  return subreddits;
}

// 下载文件
function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 读取文件
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, 'UTF-8');
  });
}

// 获取来源标签
function getSourceLabel(source) {
  const labels = { jin10: '金十', twitter: '推特', reddit: '红迪' };
  return labels[source] || source;
}

// ============ 导出功能 ============

// 导出配置
async function exportConfig() {
  const result = await chrome.storage.local.get(['config']);
  const config = result.config || {};
  const md = exportConfigToMarkdown(config);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(md, `subreddits_${date}.md`);
}

// 导出收藏
async function exportFavorites() {
  const result = await chrome.storage.local.get(['favorites']);
  const favorites = result.favorites || [];
  const md = exportFavoritesToMarkdown(favorites);
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(md, `favorites_${date}.md`);
}

// 导出全部
async function exportAll() {
  const result = await chrome.storage.local.get(['config', 'favorites']);
  const config = result.config || {};
  const favorites = result.favorites || [];
  const date = new Date().toISOString().slice(0, 10);

  let md = `# 信息流监控助手 - 数据备份\n\n`;
  md += `> 导出时间: ${date}\n\n`;
  md += `---\n\n`;
  md += exportConfigToMarkdown(config);
  md += `\n---\n\n`;
  md += exportFavoritesToMarkdown(favorites);

  downloadFile(md, `backup_${date}.md`);
}

// ============ 导入功能 ============

// 导入配置
async function importConfig(file) {
  try {
    const md = await readFile(file);
    const subreddits = importConfigFromMarkdown(md);

    if (subreddits.length === 0) {
      throw new Error('未找到订阅配置，请检查文件格式');
    }

    const result = await chrome.storage.local.get(['config']);
    const config = result.config || {};
    config.reddit = config.reddit || {};
    config.reddit.subreddits = subreddits;
    await chrome.storage.local.set({ config });

    return { success: true, count: subreddits.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 导入收藏
async function importFavorites(file) {
  try {
    const md = await readFile(file);
    // 简化版：从markdown中解析收藏比较复杂
    // 建议使用 JSON 格式导入收藏
    throw new Error('收藏导入请使用 JSON 格式');
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ JSON 格式支持 ============

// 导出为 JSON（更方便程序处理）
async function exportToJSON() {
  const result = await chrome.storage.local.get(['config', 'favorites', 'stats']);
  const date = new Date().toISOString().slice(0, 10);
  const data = {
    exportDate: date,
    config: result.config || {},
    favorites: result.favorites || [],
    stats: result.stats || { total: 0, valuable: 0, favorite: 0 }
  };
  downloadFile(JSON.stringify(data, null, 2), `backup_${date}.json`);
}

// 从 JSON 导入
async function importFromJSON(file) {
  try {
    const content = await readFile(file);
    const data = JSON.parse(content);

    if (data.config) await chrome.storage.local.set({ config: data.config });
    if (data.favorites) await chrome.storage.local.set({ favorites: data.favorites });
    if (data.stats) await chrome.storage.local.set({ stats: data.stats });

    return {
      success: true,
      favoritesCount: data.favorites?.length || 0,
      subredditsCount: data.config?.reddit?.subreddits?.length || 0
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
