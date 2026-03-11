// 信息流面板 Content Script

/**
 * 信息流浮动面板
 * 可拖拽、可调整大小
 */

class InfoStreamPanel {
  constructor() {
    this.panel = null;
    this.isDragging = false;
    this.isResizing = false;
    this.state = {
      x: window.innerWidth - 420,
      y: 20,
      width: 400,
      height: 500,
      minimized: false
    };
    this.items = [];
  }

  /**
   * 初始化面板
   */
  init() {
    this.loadState();
    this.createPanel();
    this.setupDragResize();
    this.setupEvents();
  }

  /**
   * 加载保存的状态
   */
  loadState() {
    chrome.storage.local.get(['panelState'], (result) => {
      if (result.panelState) {
        this.state = { ...this.state, ...result.panelState };
      }
    });
  }

  /**
   * 保存状态
   */
  saveState() {
    chrome.storage.local.set({ panelState: this.state });
  }

  /**
   * 创建面板
   */
  createPanel() {
    // 检查是否已存在
    if (document.getElementById('info-stream-panel')) {
      this.panel = document.getElementById('info-stream-panel');
      return;
    }

    this.panel = document.createElement('div');
    this.panel.id = 'info-stream-panel';
    this.panel.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">
          <span class="panel-icon">📊</span>
          <span class="panel-text">信息流监控</span>
          <span class="panel-status" id="panel-status">已停止</span>
        </div>
        <div class="panel-controls">
          <button class="panel-btn" id="panel-minimize" title="最小化">━</button>
          <button class="panel-btn" id="panel-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="panel-content" id="panel-content">
        <div class="panel-empty">
          <div class="empty-icon">📭</div>
          <div class="empty-text">暂无信息</div>
          <div class="empty-hint">点击"开始监控"开始获取信息</div>
        </div>
      </div>
      <div class="panel-resize-handle"></div>
    `;

    // 应用样式
    this.applyStyles();

    // 添加到页面
    document.body.appendChild(this.panel);

    // 应用状态
    this.updatePosition();
  }

  /**
   * 应用样式
   */
  applyStyles() {
    const style = document.createElement('style');
    style.id = 'info-stream-panel-styles';
    style.textContent = `
      #info-stream-panel {
        position: fixed;
        z-index: 999999;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        overflow: hidden;
        transition: opacity 0.2s;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px 12px 0 0;
        cursor: move;
        user-select: none;
      }

      .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: white;
        font-size: 14px;
        font-weight: 600;
      }

      .panel-status {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.2);
        margin-left: 8px;
      }

      .panel-status.running {
        background: rgba(74, 222, 128, 0.3);
      }

      .panel-controls {
        display: flex;
        gap: 4px;
      }

      .panel-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      }

      .panel-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .panel-content {
        max-height: calc(100vh - 100px);
        overflow-y: auto;
        padding: 12px;
      }

      .panel-content::-webkit-scrollbar {
        width: 6px;
      }

      .panel-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }

      .panel-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }

      .panel-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .panel-empty {
        text-align: center;
        padding: 60px 20px;
        color: #888;
      }

      .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .empty-text {
        font-size: 14px;
        margin-bottom: 8px;
      }

      .empty-hint {
        font-size: 12px;
        color: #666;
      }

      .panel-item {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
        border-left: 3px solid #667eea;
        transition: background 0.2s;
      }

      .panel-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .panel-item-header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        margin-bottom: 8px;
      }

      .panel-item-type {
        font-size: 16px;
      }

      .panel-item-time {
        font-size: 11px;
        color: #888;
      }

      .panel-item-title {
        font-size: 13px;
        font-weight: 500;
        color: #e0e0e0;
        margin-bottom: 8px;
        line-height: 1.4;
      }

      .panel-item-value {
        font-size: 12px;
        color: #a0a0a0;
        margin-bottom: 10px;
        line-height: 1.5;
      }

      .panel-item-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .panel-item-source {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 10px;
        background: rgba(102, 126, 234, 0.2);
        color: #b0b0ff;
      }

      .panel-item-score {
        font-size: 11px;
        color: #fbbf24;
      }

      .panel-item-actions {
        display: flex;
        gap: 8px;
      }

      .panel-item-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: #888;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .panel-item-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #e0e0e0;
      }

      .panel-item-btn.favorite {
        background: rgba(251, 191, 36, 0.2);
        color: #fbbf24;
      }

      .panel-item-btn.favorite:hover {
        background: rgba(251, 191, 36, 0.3);
      }

      .panel-resize-handle {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 20px;
        height: 20px;
        cursor: nwse-resize;
        opacity: 0.5;
      }

      .panel-resize-handle:hover {
        opacity: 1;
      }

      .panel-resize-handle::before {
        content: '';
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 8px;
        height: 2px;
        background: rgba(255, 255, 255, 0.3);
        transform: rotate(45deg);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 设置拖拽和调整大小
   */
  setupDragResize() {
    const header = this.panel.querySelector('.panel-header');
    const resizeHandle = this.panel.querySelector('.panel-resize-handle');

    // 拖拽
    header.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('panel-btn')) return;

      this.isDragging = true;
      this.dragStartX = e.clientX - this.state.x;
      this.dragStartY = e.clientY - this.state.y;

      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.onDragEnd);
    });

    // 调整大小
    resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.isResizing = true;
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;
      this.resizeStartWidth = this.state.width;
      this.resizeStartHeight = this.state.height;

      document.addEventListener('mousemove', this.onResize);
      document.addEventListener('mouseup', this.onResizeEnd);
    });
  }

  onDrag = (e) => {
    if (!this.isDragging) return;

    this.state.x = e.clientX - this.dragStartX;
    this.state.y = e.clientY - this.dragStartY;

    // 边界检查
    this.state.x = Math.max(0, Math.min(window.innerWidth - this.state.width, this.state.x));
    this.state.y = Math.max(0, Math.min(window.innerHeight - 100, this.state.y));

    this.updatePosition();
  }

  onDragEnd = () => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onDrag);
    document.removeEventListener('mouseup', this.onDragEnd);
    this.saveState();
  }

  onResize = (e) => {
    if (!this.isResizing) return;

    const deltaX = e.clientX - this.resizeStartX;
    const deltaY = e.clientY - this.resizeStartY;

    this.state.width = Math.max(300, this.resizeStartWidth + deltaX);
    this.state.height = Math.max(300, this.resizeStartHeight + deltaY);

    this.updatePosition();
  }

  onResizeEnd = () => {
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onResize);
    document.removeEventListener('mouseup', this.onResizeEnd);
    this.saveState();
  }

  /**
   * 更新位置和大小
   */
  updatePosition() {
    this.panel.style.left = this.state.x + 'px';
    this.panel.style.top = this.state.y + 'px';
    this.panel.style.width = this.state.width + 'px';
    this.panel.style.height = this.state.height + 'px';
  }

  /**
   * 设置事件监听
   */
  setupEvents() {
    // 关闭按钮
    this.panel.querySelector('#panel-close').addEventListener('click', () => {
      this.hide();
    });

    // 最小化按钮
    this.panel.querySelector('#panel-minimize').addEventListener('click', () => {
      this.toggleMinimize();
    });
  }

  /**
   * 添加项目
   */
  addItem(item) {
    this.items.unshift(item);

    // 限制数量
    if (this.items.length > 100) {
      this.items = this.items.slice(0, 100);
    }

    this.renderItems();
  }

  /**
   * 渲染项目
   */
  renderItems() {
    const content = this.panel.querySelector('#panel-content');

    if (this.items.length === 0) {
      content.innerHTML = `
        <div class="panel-empty">
          <div class="empty-icon">📭</div>
          <div class="empty-text">暂无信息</div>
          <div class="empty-hint">点击"开始监控"开始获取信息</div>
        </div>
      `;
      return;
    }

    content.innerHTML = this.items.map(item => this.createItemHTML(item)).join('');

    // 绑定事件
    this.bindItemEvents();
  }

  /**
   * 创建项目 HTML
   */
  createItemHTML(item) {
    const typeEmoji = {
      '🎯': 'opportunity',
      '🧠': 'knowledge',
      '📈': 'trend',
      '💡': 'inspiration'
    }[item.type] || 'inspiration';

    return `
      <div class="panel-item" data-id="${item.id}">
        <div class="panel-item-header">
          <span class="panel-item-type">${item.type || '💡'}</span>
          <span class="panel-item-time">${this.formatTime(item.timestamp)}</span>
        </div>
        <div class="panel-item-title">${this.escapeHtml(item.title)}</div>
        ${item.value ? `<div class="panel-item-value">${this.escapeHtml(item.value)}</div>` : ''}
        <div class="panel-item-footer">
          <span class="panel-item-source">${this.getSourceLabel(item.source)}</span>
          <span class="panel-item-score">评分: ${item.score || 'N/A'}/10</span>
        </div>
        <div class="panel-item-actions">
          ${item.url ? `<button class="panel-item-btn" data-action="link">查看原文</button>` : ''}
          <button class="panel-item-btn favorite" data-action="favorite">⭐ 收藏</button>
        </div>
      </div>
    `;
  }

  /**
   * 绑定项目事件
   */
  bindItemEvents() {
    const items = this.panel.querySelectorAll('.panel-item');

    items.forEach(itemEl => {
      const id = itemEl.dataset.id;
      const item = this.items.find(i => i.id === id);

      if (!item) return;

      // 链接按钮
      itemEl.querySelector('[data-action="link"]')?.addEventListener('click', () => {
        if (item.url) {
          chrome.tabs.create({ url: item.url });
        }
      });

      // 收藏按钮
      itemEl.querySelector('[data-action="favorite"]')?.addEventListener('click', async () => {
        await this.addToFavorites(item);
        const btn = itemEl.querySelector('[data-action="favorite"]');
        btn.textContent = '✓ 已收藏';
        setTimeout(() => {
          btn.textContent = '⭐ 收藏';
        }, 2000);
      });
    });
  }

  /**
   * 添加到收藏
   */
  async addToFavorites(item) {
    chrome.runtime.sendMessage({
      action: 'addToFavorites',
      item: item
    });
  }

  /**
   * 更新状态
   */
  setStatus(status) {
    const statusEl = this.panel.querySelector('#panel-status');
    if (status === 'running') {
      statusEl.textContent = '🟢 监控中';
      statusEl.classList.add('running');
    } else {
      statusEl.textContent = '⚪ 已停止';
      statusEl.classList.remove('running');
    }
  }

  /**
   * 显示面板
   */
  show() {
    this.panel.style.display = 'block';
  }

  /**
   * 隐藏面板
   */
  hide() {
    this.panel.style.display = 'none';
  }

  /**
   * 切换最小化
   */
  toggleMinimize() {
    const content = this.panel.querySelector('.panel-content');
    this.state.minimized = !this.state.minimized;

    if (this.state.minimized) {
      content.style.display = 'none';
      this.panel.style.height = 'auto';
    } else {
      content.style.display = 'block';
      this.updatePosition();
    }

    this.saveState();
  }

  /**
   * 工具函数
   */
  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return new Date(timestamp).toLocaleDateString('zh-CN');
  }

  getSourceLabel(source) {
    const labels = {
      jin10: '金十',
      twitter: 'X',
      reddit: 'Reddit'
    };
    return labels[source] || source;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 创建单例
let panelInstance = null;

function getPanel() {
  if (!panelInstance) {
    panelInstance = new InfoStreamPanel();
    panelInstance.init();
  }
  return panelInstance;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InfoStreamPanel, getPanel };
}
