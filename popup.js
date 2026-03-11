// 信息流监控助手 - 弹窗脚本

// DOM 元素
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const configBtn = document.getElementById('config-btn');
const favoritesBtn = document.getElementById('favorites-btn');
const totalCountEl = document.getElementById('total-count');
const valuableCountEl = document.getElementById('valuable-count');
const favoriteCountEl = document.getElementById('favorite-count');
const recentListEl = document.getElementById('recent-list');

// 源复选框
const jin10Checkbox = document.getElementById('jin10');
const twitterCheckbox = document.getElementById('twitter');
const redditCheckbox = document.getElementById('reddit');

// 折叠状态（监控源和统计默认折叠）
const foldedSections = {
  sources: true,
  stats: true,
  recent: false
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', init);

// 初始化
async function init() {
  // 加载配置
  await loadConfig();

  // 更新状态
  await updateStatus();

  // 加载统计数据
  await loadStats();

  // 加载最近通知
  await loadRecent();

  // 绑定事件
  bindEvents();

  // 应用折叠状态
  applyFoldedState();
}

// 应用折叠状态
function applyFoldedState() {
  Object.keys(foldedSections).forEach(section => {
    const body = document.getElementById(section + '-body');
    const indicator = document.querySelector('#' + section + '-toggle .fold-indicator');

    if (foldedSections[section]) {
      body.classList.remove('expanded');
      indicator.classList.remove('expanded');
    } else {
      body.classList.add('expanded');
      indicator.classList.add('expanded');
    }
  });
}

// 加载配置
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['config'], (result) => {
      const config = result.config || {};
      const sources = config.sources || {
        jin10: true,
        twitter: false,
        reddit: false
      };

      jin10Checkbox.checked = sources.jin10;
      twitterCheckbox.checked = sources.twitter;
      redditCheckbox.checked = sources.reddit;

      resolve();
    });
  });
}

// 更新状态
async function updateStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isRunning'], (result) => {
      if (result.isRunning) {
        statusEl.textContent = '🟢 监控中';
        statusEl.className = 'status running';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
      } else {
        statusEl.textContent = '⚪ 已停止';
        statusEl.className = 'status stopped';
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
      }
      resolve();
    });
  });
}

// 加载统计数据
async function loadStats() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['stats'], (result) => {
      const stats = result.stats || {
        total: 0,
        valuable: 0,
        favorite: 0
      };

      totalCountEl.textContent = stats.total;
      valuableCountEl.textContent = stats.valuable;
      favoriteCountEl.textContent = stats.favorite;

      resolve();
    });
  });
}

// 加载最近通知
async function loadRecent() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['recentNotifications'], (result) => {
      const recent = result.recentNotifications || [];

      if (recent.length === 0) {
        recentListEl.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
            <div>暂无通知</div>
          </div>
        `;
        resolve();
        return;
      }

      recentListEl.innerHTML = recent.slice(0, 20).map(item => `
        <div class="recent-item" data-id="${item.id}">
          <div class="recent-header">
            <span class="recent-type">${item.type || '💡'}</span>
            <span class="recent-source">${getSourceLabel(item.source)}</span>
            <span class="recent-time">${formatTime(item.timestamp)}</span>
          </div>
          <div class="recent-title">${escapeHtml(item.title)}</div>
          ${item.value ? `<div class="recent-value">${escapeHtml(item.value)}</div>` : ''}
          <div class="recent-footer">
            <span class="recent-score">评分: ${item.score || 'N/A'}/10</span>
            <div class="recent-actions">
              ${item.url ? `<button class="recent-btn recent-btn-link" data-url="${escapeHtml(item.url)}">查看原文</button>` : ''}
              <button class="recent-btn recent-btn-fav" data-id="${item.id}">⭐ 收藏</button>
            </div>
          </div>
        </div>
      `).join('');

      // 绑定事件
      bindRecentItemEvents();

      resolve();
    });
  });
}

// 绑定通知项事件
function bindRecentItemEvents() {
  // 查看原文按钮
  recentListEl.querySelectorAll('.recent-btn-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      if (url) {
        chrome.tabs.create({ url: url });
      }
    });
  });

  // 收藏按钮
  recentListEl.querySelectorAll('.recent-btn-fav').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;

      // 获取通知项
      const result = await chrome.storage.local.get(['recentNotifications']);
      const recent = result.recentNotifications || [];
      const item = recent.find(i => i.id === id);

      if (item) {
        // 添加到收藏
        chrome.runtime.sendMessage({
          action: 'addToFavorites',
          item: item
        }, (response) => {
          if (response && response.success) {
            btn.textContent = '✓ 已收藏';
            setTimeout(() => {
              btn.textContent = '⭐ 收藏';
            }, 2000);
          }
        });
      }
    });
  });
}

// 绑定事件
function bindEvents() {
  // 开始监控
  startBtn.addEventListener('click', () => {
    startMonitoring();
  });

  // 停止监控
  stopBtn.addEventListener('click', () => {
    stopMonitoring();
  });

  // 配置按钮
  configBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'config.html' });
  });

  // 收藏夹按钮
  favoritesBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'favorites.html' });
  });

  // 源复选框变化
  jin10Checkbox.addEventListener('change', saveConfig);
  twitterCheckbox.addEventListener('change', saveConfig);
  redditCheckbox.addEventListener('change', saveConfig);

  // 折叠/展开
  document.getElementById('sources-toggle').addEventListener('click', () => {
    toggleSection('sources');
  });

  document.getElementById('stats-toggle').addEventListener('click', () => {
    toggleSection('stats');
  });

  document.getElementById('recent-toggle').addEventListener('click', () => {
    toggleSection('recent');
  });
}

// 折叠/展开部分
function toggleSection(section) {
  const body = document.getElementById(section + '-body');
  const indicator = document.querySelector('#' + section + '-toggle .fold-indicator');

  foldedSections[section] = !foldedSections[section];

  if (foldedSections[section]) {
    body.classList.remove('expanded');
    indicator.classList.remove('expanded');
  } else {
    body.classList.add('expanded');
    indicator.classList.add('expanded');
  }
}

// 保存配置
async function saveConfig() {
  const sources = {
    jin10: jin10Checkbox.checked,
    twitter: twitterCheckbox.checked,
    reddit: redditCheckbox.checked
  };

  // 更新 config.sources
  const result = await chrome.storage.local.get(['config']);
  const config = result.config || {};
  config.sources = sources;
  await chrome.storage.local.set({ config });

  // 通知 background 更新
  chrome.runtime.sendMessage({
    action: 'updateConfig',
    sources: sources
  });
}

// 开始监控
function startMonitoring() {
  const sources = {
    jin10: jin10Checkbox.checked,
    twitter: twitterCheckbox.checked,
    reddit: redditCheckbox.checked
  };

  // 检查是否至少选择了一个源
  if (!sources.jin10 && !sources.twitter && !sources.reddit) {
    alert('请至少选择一个监控源');
    return;
  }

  chrome.runtime.sendMessage({
    action: 'startMonitoring',
    sources: sources
  }, (response) => {
    if (response && response.success) {
      updateStatus();
    } else if (response && response.error) {
      alert('启动失败：' + response.error);
    }
  });
}

// 停止监控
function stopMonitoring() {
  chrome.runtime.sendMessage({
    action: 'stopMonitoring'
  }, (response) => {
    if (response && response.success) {
      updateStatus();
    }
  });
}

// 获取来源标签
function getSourceLabel(source) {
  const labels = {
    jin10: '金十',
    twitter: 'X',
    reddit: 'Reddit'
  };
  return labels[source] || source;
}

// 格式化时间
function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return Math.floor(diff / 60000) + '分钟前';
  } else if (diff < 86400000) {
    return Math.floor(diff / 3600000) + '小时前';
  } else {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  }
}

// HTML 转义
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.isRunning) {
      updateStatus();
    }
    if (changes.stats) {
      loadStats();
    }
    if (changes.recentNotifications) {
      loadRecent();
    }
  }
});
