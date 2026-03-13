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

// 折叠状态
const foldedSections = { sources: true, stats: true, recent: false };

// 懒加载状态
let currentOffset = 0;
const pageSize = 30;
let allRecentData = [];
let isLoadingMore = false;

// 翻译状态
const translatedItems = new Set();
let isTranslating = false;

// 检测是否为中文
function isChineseText(text) {
  if (!text) return false;
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
  return chineseChars && chineseChars.length > text.length / 5;
}

// 懒翻译处理
async function processLazyTranslation() {
  if (isTranslating) return;

  const itemsNeedingTranslation = recentListEl.querySelectorAll('.recent-item[data-needs-translate="true"]');

  for (const itemEl of itemsNeedingTranslation) {
    const id = itemEl.dataset.id;
    if (translatedItems.has(id)) continue;

    isTranslating = true;

    try {
      const item = allRecentData.find(d => d.id === id);
      if (!item) continue;

      const response = await chrome.runtime.sendMessage({
        action: 'translateItem',
        item: { title: item.title, value: '' }
      });

      if (response?.success) {
        const titleLinkEl = itemEl.querySelector('.recent-title a');
        if (titleLinkEl && response.translated.title) {
          titleLinkEl.textContent = response.translated.title;
        }
        itemEl.dataset.needsTranslate = 'false';
        translatedItems.add(id);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('[懒翻译] 失败:', error);
    }

    isTranslating = false;
  }
}

// 初始化
async function init() {
  await loadConfig();
  await updateStatus();
  await loadStats();
  await loadRecent();
  bindEvents();
  applyFoldedState();
  bindScrollLoad();
}

document.addEventListener('DOMContentLoaded', init);

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
  const result = await chrome.storage.local.get(['config']);
  const config = result.config || {};
  const sources = config.sources || { jin10: true, twitter: false, reddit: false };
  jin10Checkbox.checked = sources.jin10;
  twitterCheckbox.checked = sources.twitter;
  redditCheckbox.checked = sources.reddit;
}

// 更新状态
async function updateStatus() {
  const result = await chrome.storage.local.get(['isRunning']);
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
}

// 加载统计数据
async function loadStats() {
  const result = await chrome.storage.local.get(['stats']);
  const stats = result.stats || { total: 0, valuable: 0, favorite: 0 };
  totalCountEl.textContent = stats.total;
  valuableCountEl.textContent = stats.valuable;
  favoriteCountEl.textContent = stats.favorite;
}

// 加载最近通知
async function loadRecent() {
  const result = await chrome.storage.local.get(['recentNotifications']);
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
    return;
  }

  allRecentData = recent;
  currentOffset = 0;
  recentListEl.innerHTML = '';
  renderRecentItems();
}

// 渲染通知项 - HN 风格
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

  const itemsHtml = itemsToRender.map(item => {
    const titleEscaped = escapeHtml(item.title);
    const needsTranslate = !isChineseText(titleEscaped);
    const scoreDisplay = item.score ? `${item.score}/10` : 'N/A';
    const timeAgo = formatTime(item.timestamp);
    const subredditText = item.subreddit || '';
    const commentCount = item.num_comments || 0;
    const sourceLabel = getSourceLabel(item.source);

    const metaParts = [scoreDisplay, sourceLabel];
    if (subredditText) metaParts.push(subredditText);
    if (timeAgo) metaParts.push(timeAgo);
    metaParts.push(`${commentCount}评论`);

    return `
      <div class="recent-item" data-id="${item.id}" data-needs-translate="${needsTranslate ? 'true' : 'false'}">
        <div class="recent-title-row">
          <div class="recent-title">
            ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank">${titleEscaped}</a>` : titleEscaped}
          </div>
          <button class="fav-btn" data-id="${item.id}" title="收藏">收藏</button>
        </div>
        <div class="recent-meta">${metaParts.join(' • ')}</div>
      </div>
    `;
  }).join('');

  if (currentOffset === 0) {
    recentListEl.innerHTML = itemsHtml;
  } else {
    recentListEl.insertAdjacentHTML('beforeend', itemsHtml);
  }

  currentOffset = endIndex;
  bindRecentItemEvents();
  setTimeout(() => processLazyTranslation(), 500);
  updateLoadMoreButton();
}

// 更新加载更多提示
function updateLoadMoreButton() {
  const oldHint = recentListEl.querySelector('.load-more-hint');
  if (oldHint) oldHint.remove();

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

    if (scrollTop + clientHeight >= scrollHeight - 50 && currentOffset < allRecentData.length) {
      isLoadingMore = true;
      renderRecentItems();
      isLoadingMore = false;
    }
  });
}

// 绑定通知项事件
function bindRecentItemEvents() {
  recentListEl.querySelectorAll('.fav-btn:not(.bound)').forEach(btn => {
    btn.classList.add('bound');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const result = await chrome.storage.local.get(['favorites']);
      let favorites = result.favorites || [];
      const existingIndex = favorites.findIndex(f => f.id === id);

      if (existingIndex === -1) {
        const item = allRecentData.find(i => i.id === id);
        if (item) {
          favorites.push(item);
          await chrome.storage.local.set({ favorites });
          btn.classList.add('favorited');
          btn.textContent = '✓';
          loadStats();
        }
      } else {
        favorites = favorites.filter(f => f.id !== id);
        await chrome.storage.local.set({ favorites });
        btn.classList.remove('favorited');
        btn.textContent = '收藏';
        loadStats();
      }
    });
  });

  // 标记已收藏
  chrome.storage.local.get(['favorites'], (result) => {
    const favorites = result.favorites || [];
    recentListEl.querySelectorAll('.fav-btn').forEach(btn => {
      if (favorites.some(f => f.id === btn.dataset.id)) {
        btn.classList.add('favorited');
        btn.textContent = '✓';
      }
    });
  });
}

// 绑定事件
function bindEvents() {
  startBtn.addEventListener('click', startMonitoring);
  stopBtn.addEventListener('click', stopMonitoring);
  configBtn.addEventListener('click', () => chrome.tabs.create({ url: 'config.html' }));
  favoritesBtn.addEventListener('click', () => chrome.tabs.create({ url: 'favorites.html' }));
  jin10Checkbox.addEventListener('change', saveConfig);
  twitterCheckbox.addEventListener('change', saveConfig);
  redditCheckbox.addEventListener('change', saveConfig);
  document.getElementById('sources-toggle').addEventListener('click', () => toggleSection('sources'));
  document.getElementById('stats-toggle').addEventListener('click', () => toggleSection('stats'));
  document.getElementById('recent-toggle').addEventListener('click', () => toggleSection('recent'));
}

// 折叠/展开
function toggleSection(section) {
  const body = document.getElementById(section + '-body');
  const indicator = document.querySelector('#' + section + '-toggle .fold-indicator');
  foldedSections[section] = !foldedSections[section];
  body.classList.toggle('expanded', !foldedSections[section]);
  indicator.classList.toggle('expanded', !foldedSections[section]);
}

// 保存配置
async function saveConfig() {
  const sources = {
    jin10: jin10Checkbox.checked,
    twitter: twitterCheckbox.checked,
    reddit: redditCheckbox.checked
  };
  const result = await chrome.storage.local.get(['config']);
  const config = result.config || {};
  config.sources = sources;
  await chrome.storage.local.set({ config });
  chrome.runtime.sendMessage({ action: 'updateConfig', sources });
}

// 获取当前选择的源
function getSelectedSources() {
  return {
    jin10: jin10Checkbox.checked,
    twitter: twitterCheckbox.checked,
    reddit: redditCheckbox.checked
  };
}

// 开始监控
function startMonitoring() {
  const sources = getSelectedSources();
  if (!sources.jin10 && !sources.twitter && !sources.reddit) {
    alert('请至少选择一个监控源');
    return;
  }
  chrome.runtime.sendMessage({ action: 'startMonitoring', sources }, (response) => {
    if (response?.success) {
      updateStatus();
    } else if (response?.error) {
      alert('启动失败：' + response.error);
    }
  });
}

// 停止监控
function stopMonitoring() {
  chrome.runtime.sendMessage({ action: 'stopMonitoring' }, (response) => {
    if (response?.success) updateStatus();
  });
}

// 获取来源标签
function getSourceLabel(source) {
  const labels = { jin10: '金十', twitter: '推特', reddit: '红迪' };
  return labels[source] || source;
}

// 格式化时间
function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  return new Date(timestamp).toLocaleDateString('zh-CN');
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
    if (changes.isRunning) updateStatus();
    if (changes.stats) loadStats();
    if (changes.recentNotifications) loadRecent();
  }
});
