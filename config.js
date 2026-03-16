// 配置页面脚本

// DOM 元素
const redditSubredditsInput = document.getElementById('reddit-subreddits');
const translateProviderSelect = document.getElementById('translate-provider');
const translateApiKeyInput = document.getElementById('translate-api-key');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

// 同步配置元素
const syncEnabledSelect = document.getElementById('sync-enabled');
const syncUserIdInput = document.getElementById('sync-user-id');
const syncUrlInput = document.getElementById('sync-url');
const syncKeyInput = document.getElementById('sync-key');
const syncMergeBtn = document.getElementById('sync-merge-btn');

// 导入/导出按钮
const exportMdBtn = document.getElementById('export-md-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const exportFavBtn = document.getElementById('export-fav-btn');
const exportAllBtn = document.getElementById('export-all-btn');
const importFileInput = document.getElementById('import-file');
const selectFileBtn = document.getElementById('select-file-btn');
const importArea = document.getElementById('import-area');

// 统计元素
const subredditCountEl = document.getElementById('subreddit-count');
const importStatsEl = document.getElementById('import-stats');
const importSubredditCountEl = document.getElementById('import-subreddit-count');
const importFavCountEl = document.getElementById('import-fav-count');

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', init);

// 初始化
async function init() {
  await loadConfig();
  bindEvents();
}

// 加载配置
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['config']);
    const config = result.config || {};

    // Reddit 配置
    if (config.reddit) {
      if (config.reddit.subredditsRaw) {
        redditSubredditsInput.value = config.reddit.subredditsRaw;
      } else if (config.reddit.subreddits?.length > 0) {
        redditSubredditsInput.value = config.reddit.subreddits.join('\n');
      }
      updateSubredditCount(config.reddit.subreddits?.length || 0);
    }

    // 翻译配置
    if (config.translation) {
      translateProviderSelect.value = config.translation.provider || 'free';
      translateApiKeyInput.value = config.translation.apiKey || '';
    }

    // 同步配置
    if (config.sync) {
      syncEnabledSelect.value = config.sync.enabled ? 'true' : 'false';
      syncUserIdInput.value = config.sync.userId || '';
      syncUrlInput.value = config.sync.url || '';
      syncKeyInput.value = config.sync.key || '';
    }

  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 更新订阅数量显示
function updateSubredditCount(count) {
  subredditCountEl.textContent = count;
}

// 绑定事件
function bindEvents() {
  saveBtn.addEventListener('click', saveConfig);
  cancelBtn.addEventListener('click', () => window.close());

  // 同步按钮
  syncMergeBtn.addEventListener('click', onSyncMerge);

  // 导出按钮
  exportMdBtn.addEventListener('click', onExportMarkdown);
  exportJsonBtn.addEventListener('click', onExportJSON);
  exportFavBtn.addEventListener('click', onExportFavorites);
  exportAllBtn.addEventListener('click', onExportAll);

  // 导入按钮
  selectFileBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', onImportFile);

  // 拖拽导入
  importArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    importArea.classList.add('dragover');
  });
  importArea.addEventListener('dragleave', () => {
    importArea.classList.remove('dragover');
  });
  importArea.addEventListener('drop', (e) => {
    e.preventDefault();
    importArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  });

  // 监听输入变化，更新统计
  redditSubredditsInput.addEventListener('input', () => {
    const count = parseTextarea(redditSubredditsInput.value).length;
    updateSubredditCount(count);
  });
}

// 保存配置
async function saveConfig() {
  try {
    const redditSubreddits = parseTextarea(redditSubredditsInput.value);
    const translateProvider = translateProviderSelect.value;
    const translateApiKey = translateApiKeyInput.value.trim();

    if ((translateProvider === 'glm' || translateProvider === 'deepseek') && !translateApiKey) {
      alert('请填写 API Key');
      return;
    }

    // 验证同步配置
    const syncEnabled = syncEnabledSelect.value === 'true';
    if (syncEnabled) {
      const syncUserId = syncUserIdInput.value.trim();
      const syncUrl = syncUrlInput.value.trim();
      const syncKey = syncKeyInput.value.trim();

      if (!syncUserId || !syncUrl || !syncKey) {
        alert('启用同步时，请填写完整的 Supabase 配置');
        return;
      }
    }

    const result = await chrome.storage.local.get(['config']);
    const config = result.config || {};

    config.reddit = {
      ...config.reddit,
      subreddits: redditSubreddits,
      subredditsRaw: redditSubredditsInput.value
    };
    config.translation = { provider: translateProvider, apiKey: translateApiKey };
    config.sync = {
      enabled: syncEnabled,
      userId: syncUserIdInput.value.trim(),
      url: syncUrlInput.value.trim(),
      key: syncKeyInput.value.trim()
    };

    await chrome.storage.local.set({ config });

    chrome.runtime.sendMessage({
      action: 'updateConfig',
      sources: config.sources
    });

    alert('配置已保存！');
    
    // 如果启用同步，上传到云端
    if (syncEnabled) {
      chrome.runtime.sendMessage({ action: 'syncUpload', favorites: [], records: [] });
    }

  } catch (error) {
    console.error('保存配置失败:', error);
    alert('保存失败：' + error.message);
  }
}

// 解析文本域内容为数组
function parseTextarea(text) {
  if (!text) return [];
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      const parts = trimmed.split(/\s+/);
      return parts[0];
    })
    .filter(line => line.length > 0);
}

// ============ 导出功能 ============

async function onExportMarkdown() {
  try {
    const result = await chrome.storage.local.get(['config']);
    const md = exportConfigToMarkdown(result.config || {});
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(md, `subreddits_${date}.md`);
    alert('配置已导出！保存到 data/ 目录并提交到 git 即可。');
  } catch (error) {
    alert('导出失败：' + error.message);
  }
}

async function onExportJSON() {
  try {
    await exportToJSON();
    alert('配置已导出为 JSON！');
  } catch (error) {
    alert('导出失败：' + error.message);
  }
}

async function onExportFavorites() {
  try {
    const result = await chrome.storage.local.get(['favorites']);
    const md = exportFavoritesToMarkdown(result.favorites || []);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(md, `favorites_${date}.md`);
    alert('收藏已导出！');
  } catch (error) {
    alert('导出失败：' + error.message);
  }
}

async function onExportAll() {
  try {
    await exportAll();
    alert('全部数据已导出！');
  } catch (error) {
    alert('导出失败：' + error.message);
  }
}

// ============ 导入功能 ============

function onImportFile(e) {
  const file = e.target.files[0];
  if (file) {
    handleImportFile(file);
  }
}

async function handleImportFile(file) {
  const filename = file.name.toLowerCase();
  const ext = filename.slice(filename.lastIndexOf('.'));

  try {
    if (ext === '.md') {
      // Markdown 导入（仅配置）
      const result = await importConfig(file);
      if (result.success) {
        alert(`成功导入 ${result.count} 个订阅！`);
        await loadConfig();
      } else {
        alert('导入失败：' + result.error);
      }
    } else if (ext === '.json') {
      // JSON 导入（全部）
      const result = await importFromJSON(file);
      if (result.success) {
        alert(`导入成功！\n订阅: ${result.subredditsCount} 个\n收藏: ${result.favoritesCount} 条`);
        await loadConfig();
        showImportStats(result.subredditsCount, result.favoritesCount);
      } else {
        alert('导入失败：' + result.error);
      }
    } else {
      alert('不支持的文件格式，请使用 .md 或 .json');
    }
  } catch (error) {
    alert('导入失败：' + error.message);
  }

  // 清空文件选择
  importFileInput.value = '';
}

function showImportStats(subreddits, favorites) {
  importSubredditCountEl.textContent = subreddits;
  importFavCountEl.textContent = favorites;
  importStatsEl.style.display = 'flex';
}


// ============ 云端同步功能 ============

// 手动触发同步
async function onSyncMerge() {
  const result = await chrome.storage.local.get(['config']);
  const config = result.config || {};

  if (!config.sync || !config.sync.enabled) {
    alert('请先启用云端同步');
    return;
  }

  syncMergeBtn.disabled = true;
  syncMergeBtn.textContent = '同步中...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'syncMerge'
    });

    if (response && response.success) {
      alert('同步成功！\n' + response.message);
      await loadConfig();
    } else {
      alert('同步失败：' + (response?.error || '未知错误'));
    }

  } catch (error) {
    console.error('同步失败:', error);
    alert('同步失败：' + error.message);
  } finally {
    syncMergeBtn.disabled = false;
    syncMergeBtn.textContent = '从云端同步';
  }
}
