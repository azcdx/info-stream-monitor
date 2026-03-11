// 配置页面脚本

// DOM 元素
const twitterUsersInput = document.getElementById('twitter-users');
const twitterKeywordsInput = document.getElementById('twitter-keywords');
const redditSubredditsInput = document.getElementById('reddit-subreddits');
const importJsonInput = document.getElementById('import-json');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', init);

// 初始化
async function init() {
  // 加载当前配置
  await loadConfig();

  // 绑定事件
  bindEvents();
}

// 加载配置
async function loadConfig() {
  try {
    const result = await chrome.storage.local.get(['config']);
    const config = result.config || {};

    // Twitter 配置
    if (config.twitter) {
      if (config.twitter.users && config.twitter.users.length > 0) {
        twitterUsersInput.value = config.twitter.users.join('\n');
      }
      if (config.twitter.keywords && config.twitter.keywords.length > 0) {
        twitterKeywordsInput.value = config.twitter.keywords.join('\n');
      }
    }

    // Reddit 配置
    if (config.reddit) {
      if (config.reddit.subreddits && config.reddit.subreddits.length > 0) {
        redditSubredditsInput.value = config.reddit.subreddits.join('\n');
      }
    }

  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 绑定事件
function bindEvents() {
  // 保存配置
  saveBtn.addEventListener('click', saveConfig);

  // 返回
  cancelBtn.addEventListener('click', () => {
    window.close();
  });

  // 导入配置
  importBtn.addEventListener('click', importConfig);

  // 导出配置
  exportBtn.addEventListener('click', exportConfig);
}

// 保存配置
async function saveConfig() {
  try {
    // 获取输入值
    const twitterUsers = parseTextarea(twitterUsersInput.value);
    const twitterKeywords = parseTextarea(twitterKeywordsInput.value);
    const redditSubreddits = parseTextarea(redditSubredditsInput.value);

    // 获取当前配置
    const result = await chrome.storage.local.get(['config']);
    const config = result.config || {};

    // 更新配置
    config.twitter = {
      ...config.twitter,
      users: twitterUsers,
      keywords: twitterKeywords
    };

    config.reddit = {
      ...config.reddit,
      subreddits: redditSubreddits
    };

    // 保存到存储
    await chrome.storage.local.set({ config });

    // 显示成功提示
    alert('配置已保存！');

    // 通知 background 更新
    chrome.runtime.sendMessage({
      action: 'updateConfig',
      sources: config.sources
    });

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
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// 导入配置
async function importConfig() {
  const jsonString = importJsonInput.value.trim();

  if (!jsonString) {
    alert('请输入 JSON 配置');
    return;
  }

  try {
    // 发送到 background 处理
    const response = await chrome.runtime.sendMessage({
      action: 'importConfig',
      json: jsonString
    });

    if (response && response.success) {
      alert('配置已导入！');
      // 重新加载配置
      await loadConfig();
      // 清空导入框
      importJsonInput.value = '';
    } else {
      alert('导入失败：' + (response?.error || '未知错误'));
    }

  } catch (error) {
    console.error('导入配置失败:', error);
    alert('导入失败：' + error.message);
  }
}

// 导出配置
async function exportConfig() {
  try {
    // 从 background 获取配置
    const response = await chrome.runtime.sendMessage({
      action: 'exportConfig'
    });

    if (response && response.success) {
      // 转换为 JSON 字符串
      const jsonString = JSON.stringify(response.config, null, 2);

      // 显示在导入框中
      importJsonInput.value = jsonString;

      // 复制到剪贴板
      await navigator.clipboard.writeText(jsonString);

      alert('配置已导出并复制到剪贴板！');
    } else {
      alert('导出失败：' + (response?.error || '未知错误'));
    }

  } catch (error) {
    console.error('导出配置失败:', error);
    alert('导出失败：' + error.message);
  }
}
