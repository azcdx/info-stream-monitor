// 信息流监控助手 - 侧边栏脚本

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

// 懒加载状态
let currentOffset = 0;
const pageSize = 30;
let allRecentData = [];
let isLoadingMore = false;

// 翻译状态
const translatedItems = new Set(); // 已翻译的 ID
let translationQueue = []; // 翻译队列
let isTranslating = false; // 是否正在翻译

// 检测是否为中文（简单判断：中文字符占比）
function isChineseText(text) {
  if (!text) return false;
  const chineseRegex = /[\u4e00-\u9fa5]/;
  const chineseChars = text.match(chineseRegex);
  if (!chineseChars) return false;
  return chineseChars.length > text.length / 5; // 中文占 20% 以上认为是已翻译
}

// 懒翻译处理
async function processLazyTranslation() {
  if (isTranslating) return;

  const itemsNeedingTranslation = recentListEl.querySelectorAll('.recent-item[data-needs-translate="true"]');

  for (const itemEl of itemsNeedingTranslation) {
    const id = itemEl.dataset.id;
    if (translatedItems.has(id)) continue; // 已翻译过，跳过

    isTranslating = true;

    try {
      // 获取原始数据
      const item = allRecentData.find(d => d.id === id);
      if (!item) continue;

      // 发送翻译请求
      const response = await chrome.runtime.sendMessage({
        action: 'translateItem',
        item: {
          title: item.title,
          value: ''
        }
      });

      if (response && response.success) {
        // 更新显示
        const titleEl = itemEl.querySelector('.recent-title');

        if (titleEl && response.translated.title) {
          titleEl.textContent = response.translated.title;
        }

        // 标记为已翻译
        itemEl.dataset.needsTranslate = 'false';
        translatedItems.add(id);
      }

      // 翻译间隔，避免 API 限制
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error('[懒翻译] 失败:', error);
    }

    isTranslating = false;
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', init);

// 初始化
async function init() {
  console.log('[前端] ========== sidepanel.js 已加载 ==========');

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

  // 绑定滚动加载
  bindScrollLoad();
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
  console.log('[前端] 更新状态...');
  return new Promise((resolve) => {
    chrome.storage.local.get(['isRunning'], (result) => {
      console.log('[前端] 当前运行状态:', result.isRunning);
      if (result.isRunning) {
        statusEl.textContent = '🟢 监控中';
        statusEl.className = 'status running';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        console.log('[前端] 状态已更新：监控中');
      } else {
        statusEl.textContent = '⚪ 已停止';
        statusEl.className = 'status stopped';
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        console.log('[前端] 状态已更新：已停止');
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
async function loadRecent(append = false) {
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
        allRecentData = [];
        currentOffset = 0;
        resolve();
        return;
      }

      // 保存所有数据
      allRecentData = recent;

      // 如果不是追加模式，重置偏移量
      if (!append) {
        currentOffset = 0;
        recentListEl.innerHTML = '';
      }

      // 渲染第一批数据
      renderRecentItems();

      resolve();
    });
  });
}

// 渲染通知项（懒加载）
function renderRecentItems() {
  const endIndex = Math.min(currentOffset + pageSize, allRecentData.length);
  const itemsToRender = allRecentData.slice(currentOffset, endIndex);

  if (itemsToRender.length === 0 && currentOffset === 0) {
    recentListEl.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
        <div>暂无通知</div>
      </div>
    `;
    return;
  }

  // 生成 HTML
  const itemsHtml = itemsToRender.map(item => {
    const titleEscaped = escapeHtml(item.title);
    const needsTranslate = !isChineseText(titleEscaped);
    const titleHtml = item.url
      ? `<a href="${escapeHtml(item.url)}" class="recent-title-link" data-id="${item.id}">${titleEscaped}</a>`
      : `<span class="recent-title">${titleEscaped}</span>`;

    return `
    <div class="recent-item" data-id="${item.id}" data-needs-translate="${needsTranslate ? 'true' : 'false'}">
      ${titleHtml}
      <div class="recent-meta">
        <span class="recent-source">${getSourceLabel(item.source)}${item.subreddit ? '/' + item.subreddit : ''}</span>
        ${item.num_comments ? `<span class="recent-comments">${item.num_comments} 评论</span>` : ''}
        <span class="recent-score">${item.score || 'N/A'}/10</span>
        <div class="recent-actions">
          <button class="recent-btn" data-id="${item.id}">收藏</button>
        </div>
      </div>
    </div>
    `;
  }).join('');

  // 添加到列表
  if (currentOffset === 0) {
    recentListEl.innerHTML = itemsHtml;
  } else {
    recentListEl.insertAdjacentHTML('beforeend', itemsHtml);
  }

  // 更新偏移量
  currentOffset = endIndex;

  // 绑定事件
  bindRecentItemEvents();

  // 触发懒翻译
  setTimeout(() => processLazyTranslation(), 500);

  // 检查是否还有更多数据
  updateLoadMoreButton();
}

// 更新"加载更多"按钮状态
function updateLoadMoreButton() {
  // 移除旧的加载提示
  const oldHint = recentListEl.querySelector('.load-more-hint');
  if (oldHint) {
    oldHint.remove();
  }

  // 如果还有更多数据，显示提示
  if (currentOffset < allRecentData.length) {
    const hint = document.createElement('div');
    hint.className = 'load-more-hint';
    hint.textContent = `还有 ${allRecentData.length - currentOffset} 条，滚动加载更多`;
    hint.style.cssText = 'text-align: center; padding: 12px; color: #888; font-size: 13px;';
    recentListEl.appendChild(hint);
  } else if (allRecentData.length > 0) {
    const hint = document.createElement('div');
    hint.className = 'load-more-hint';
    hint.textContent = '已加载全部';
    hint.style.cssText = 'text-align: center; padding: 12px; color: #888; font-size: 13px;';
    recentListEl.appendChild(hint);
  }
}

// 绑定滚动加载
function bindScrollLoad() {
  recentListEl.addEventListener('scroll', () => {
    if (isLoadingMore) return;

    const scrollTop = recentListEl.scrollTop;
    const scrollHeight = recentListEl.scrollHeight;
    const clientHeight = recentListEl.clientHeight;

    // 滚动到底部附近时加载更多
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      if (currentOffset < allRecentData.length) {
        isLoadingMore = true;
        renderRecentItems();
        isLoadingMore = false;
      }
    }
  });
}

// 绑定通知项事件
function bindRecentItemEvents() {
  // 标题链接点击处理
  recentListEl.querySelectorAll('.recent-title-link:not(.bound)').forEach(link => {
    link.classList.add('bound');
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const url = link.getAttribute('href');
      if (url) {
        chrome.tabs.create({ url: url });
      }
    });
  });

  // 收藏按钮
  recentListEl.querySelectorAll('.recent-btn:not(.bound)').forEach(btn => {
    btn.classList.add('bound');
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
            btn.textContent = '✓';
            setTimeout(() => {
              btn.textContent = '收藏';
            }, 2000);
          }
        });
      }
    });
  });
}

// 绑定事件
function bindEvents() {
  console.log('[前端] 绑定事件监听器...');
  console.log('[前端] startBtn:', startBtn);
  console.log('[前端] stopBtn:', stopBtn);

  // 开始监控
  startBtn.addEventListener('click', () => {
    console.log('[前端] startBtn 被点击!');
    startMonitoring();
  });

  // 停止监控
  stopBtn.addEventListener('click', () => {
    console.log('[前端] stopBtn 被点击!');
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
  console.log('[前端] 点击开始监控按钮');

  const sources = {
    jin10: jin10Checkbox.checked,
    twitter: twitterCheckbox.checked,
    reddit: redditCheckbox.checked
  };

  console.log('[前端] 选中的源:', sources);

  // 检查是否至少选择了一个源
  if (!sources.jin10 && !sources.twitter && !sources.reddit) {
    alert('请至少选择一个监控源');
    return;
  }

  console.log('[前端] 发送启动消息到 background');
  chrome.runtime.sendMessage({
    action: 'startMonitoring',
    sources: sources
  }, (response) => {
    console.log('[前端] 收到响应:', response);
    console.log('[前端] response.success:', response?.success);
    console.log('[前端] response.error:', response?.error);
    if (response && response.success) {
      console.log('[前端] 启动成功，更新状态');
      updateStatus();
    } else if (response && response.error) {
      console.error('[前端] 启动失败:', response.error);
      alert('启动失败：' + response.error);
    } else {
      console.error('[前端] 未知响应:', response);
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
    twitter: '推特',
    reddit: '红迪'
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
