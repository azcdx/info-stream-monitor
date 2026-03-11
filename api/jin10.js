// 金十数据抓取模块

/**
 * 金十数据源
 * 负责抓取金十快讯数据
 */

class Jin10DataSource {
  constructor() {
    this.name = 'jin10';
    this.label = '金十数据';
    this.baseUrl = 'https://www.jin10.com';
    this.ws = null;
    this.lastItems = new Map(); // 去重
  }

  /**
   * 启动数据源
   * @param {Function} onNewData - 新数据回调
   * @param {Object} config - 配置
   */
  async start(onNewData, config = {}) {
    console.log('[金十数据] 启动中...');

    // 尝试 WebSocket 连接（实时）
    this.connectWebSocket(onNewData, config);

    // 同时使用 HTTP 轮询作为备份
    this.startPolling(onNewData, config);
  }

  /**
   * 停止数据源
   */
  stop() {
    console.log('[金十数据] 停止');

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * 连接 WebSocket
   */
  connectWebSocket(onNewData, config) {
    try {
      // 金十 WebSocket 地址（需要从页面抓取）
      // 这里使用模拟数据作为示例
      console.log('[金十数据] WebSocket 连接中...');

      // TODO: 实际实现需要：
      // 1. 访问金十页面获取 WebSocket 地址
      // 2. 连接 WebSocket
      // 3. 监听消息

    } catch (error) {
      console.error('[金十数据] WebSocket 连接失败:', error);
    }
  }

  /**
   * HTTP 轮询（备份方案）
   */
  startPolling(onNewData, config) {
    const interval = config.pollingInterval || 30000; // 30秒

    this.pollingTimer = setInterval(async () => {
      try {
        const items = await this.fetchFlashData();
        items.forEach(item => {
          if (this.isNewItem(item)) {
            onNewData(item);
          }
        });
      } catch (error) {
        console.error('[金十数据] 轮询失败:', error);
      }
    }, interval);

    // 立即执行一次
    this.fetchFlashData().then(items => {
      items.forEach(item => {
        if (this.isNewItem(item)) {
          onNewData(item);
        }
      });
    });
  }

  /**
   * 获取快讯数据（HTTP 方式）
   */
  async fetchFlashData() {
    try {
      // 方法1：尝试金十 API
      const response = await fetch('https://www.jin10.com/static/timeline.json');
      if (response.ok) {
        const data = await response.json();
        return this.formatData(data);
      }
    } catch (error) {
      console.log('[金十数据] API 获取失败，尝试页面抓取');
    }

    // 方法2：页面抓取（通过背景页面）
    return this.fetchFromPage();
  }

  /**
   * 从页面抓取数据
   */
  async fetchFromPage() {
    // 由于 CORS 限制，需要通过 background.js 代理
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'fetchJin10Data'
      }, (response) => {
        if (response && response.success) {
          resolve(this.formatData(response.data));
        } else {
          reject(new Error('获取数据失败'));
        }
      });
    });
  }

  /**
   * 格式化数据
   */
  formatData(rawData) {
    if (!rawData) return [];

    // 根据实际数据格式调整
    if (Array.isArray(rawData)) {
      return rawData.map(item => ({
        id: item.id || item._id || Date.now(),
        title: item.title || item.content || item.data?.content,
        content: item.content || item.data?.content,
        time: item.time || item.created_at || item.pub_time,
        source: 'jin10',
        url: item.url || item.link || `https://www.jin10.com/detail/${item.id}`,
        categories: item.tags || item.categories || []
      }));
    }

    return [];
  }

  /**
   * 判断是否是新数据
   */
  isNewItem(item) {
    const key = item.id || item.title;
    if (this.lastItems.has(key)) {
      return false;
    }
    this.lastItems.set(key, Date.now());

    // 清理旧数据（1小时前）
    const oneHourAgo = Date.now() - 3600000;
    for (const [k, v] of this.lastItems.entries()) {
      if (v < oneHourAgo) {
        this.lastItems.delete(k);
      }
    }

    return true;
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stop();
    this.lastItems.clear();
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Jin10DataSource;
}
