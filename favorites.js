// 收藏页面脚本

// DOM 元素
const favoritesContainer = document.getElementById('favorites-container');
const totalFavoritesEl = document.getElementById('total-favorites');
const filterBtns = document.querySelectorAll('.filter-btn');

// 当前筛选
let currentFilter = 'all';

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', init);

// 初始化
async function init() {
  // 加载收藏
  await loadFavorites();

  // 绑定事件
  bindEvents();
}

// 绑定事件
function bindEvents() {
  // 筛选按钮
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // 更新按钮状态
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 更新筛选
      currentFilter = btn.dataset.source;
      loadFavorites();
    });
  });
}

// 加载收藏
async function loadFavorites() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getFavorites'
    });

    if (response && response.success) {
      const favorites = response.favorites || [];

      // 更新统计
      totalFavoritesEl.textContent = `共 ${favorites.length} 条`;

      // 筛选
      const filtered = currentFilter === 'all'
        ? favorites
        : favorites.filter(f => f.source === currentFilter);

      // 按来源和日期分组
      const grouped = groupBySourceAndDate(filtered);

      // 渲染
      renderFavorites(grouped);
    }

  } catch (error) {
    console.error('加载收藏失败:', error);
  }
}

// 按来源和日期分组
function groupBySourceAndDate(favorites) {
  const grouped = {};

  favorites.forEach(item => {
    const source = item.source;
    const date = new Date(item.timestamp).toLocaleDateString('zh-CN');

    if (!grouped[source]) {
      grouped[source] = {};
    }

    if (!grouped[source][date]) {
      grouped[source][date] = [];
    }

    grouped[source][date].push(item);
  });

  return grouped;
}

// 渲染收藏列表
function renderFavorites(grouped) {
  const sources = Object.keys(grouped);

  if (sources.length === 0) {
    favoritesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>还没有收藏任何信息</p>
      </div>
    `;
    return;
  }

  let html = '';

  sources.forEach(source => {
    const sourceLabel = getSourceLabel(source);
    const dates = Object.keys(grouped[source]);

    html += `<div class="section-title">${sourceLabel}</div>`;

    dates.forEach(date => {
      const items = grouped[source][date];

      items.forEach(item => {
        html += createCard(item);
      });
    });
  });

  favoritesContainer.innerHTML = `<div class="favorites-grid">${html}</div>`;

  // 绑定卡片事件
  bindCardEvents();
}

// 创建卡片 HTML
function createCard(item) {
  return `
    <div class="favorite-card" data-id="${item.id}">
      <div class="card-header">
        <span class="card-type">${item.type || '💡'}</span>
        <span class="card-source">${getSourceLabel(item.source)}</span>
      </div>
      <div class="card-title">${escapeHtml(item.title)}</div>
      ${item.value ? `<div class="card-value">${escapeHtml(item.value)}</div>` : ''}
      <div class="card-meta">
        <div class="card-score">
          <span>评分：</span>
          <span>${item.score || 'N/A'}/10</span>
        </div>
        <div class="card-actions">
          ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" class="action-btn btn-link">查看原文</a>` : ''}
          <button class="action-btn btn-remove" data-id="${item.id}">取消收藏</button>
        </div>
      </div>
      <div style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
        ${new Date(item.timestamp).toLocaleString('zh-CN')}
      </div>
    </div>
  `;
}

// 绑定卡片事件
function bindCardEvents() {
  // 取消收藏按钮
  const removeBtns = document.querySelectorAll('.btn-remove');
  removeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;

      if (confirm('确定要取消收藏吗？')) {
        const response = await chrome.runtime.sendMessage({
          action: 'removeFavorite',
          id: id
        });

        if (response && response.success) {
          // 重新加载
          await loadFavorites();
        }
      }
    });
  });
}

// 获取来源标签
function getSourceLabel(source) {
  const labels = {
    jin10: '金十数据',
    twitter: 'X/Twitter',
    reddit: 'Reddit'
  };
  return labels[source] || source;
}

// HTML 转义
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 监听存储变化（实时更新）
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.favorites) {
    loadFavorites();
  }
});
