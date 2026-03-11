// Reddit 数据抓取模块

/**
 * Reddit 真实数据抓取
 * 使用 Reddit 公开 JSON API
 */

class RedditDataSource {
  constructor() {
    this.name = 'reddit';
    this.label = 'Reddit';
    this.baseUrl = 'https://www.reddit.com';
    this.processedIds = new Set();
  }

  /**
   * 启动数据源
   */
  async start(onNewData, config = {}) {
    const subreddits = config.subreddits || ['r/ethereum', 'r/cryptocurrency', 'r/defi'];

    console.log('[Reddit] 监控 subreddits:', subreddits);

    // 立即执行一次
    await this.fetchData(subreddits, onNewData);

    // 每5分钟执行一次
    this.interval = setInterval(async () => {
      await this.fetchData(subreddits, onNewData);
    }, 300000);
  }

  /**
   * 抓取数据
   */
  async fetchData(subreddits, onNewData) {
    for (const subreddit of subreddits) {
      try {
        const url = `${this.baseUrl}/${subreddit}/hot.json?limit=5`;
        console.log(`[Reddit] 获取 ${subreddit}...`);

        const response = await fetch(url);
        if (!response.ok) {
          console.log(`[Reddit] ${subreddit} 失败: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const posts = data.data?.children || [];

        for (const post of posts) {
          const item = this.formatPost(post, subreddit);

          if (this.isNewItem(item)) {
            onNewData(item);
          }
        }

      } catch (error) {
        console.error(`[Reddit] ${subreddit} 错误:`, error.message);
      }
    }
  }

  /**
   * 格式化帖子数据
   */
  formatPost(post, subreddit) {
    const data = post.data;

    return {
      id: 'reddit_' + data.id,
      title: data.title,
      content: data.selftext || data.url || '',
      type: this.classifyPost(data),
      score: this.calculateScore(data),
      time: data.created_utc * 1000,
      source: 'reddit',
      url: `${this.baseUrl}${data.permalink}`,
      subreddit: subreddit,
      author: data.author,
      value: this.extractValue(data)
    };
  }

  /**
   * 分类帖子
   */
  classifyPost(data) {
    const text = ((data.title || '') + ' ' + (data.selftext || '')).toLowerCase();

    if (text.includes('airdrop') || text.includes('空投') || text.includes('free')) {
      return '🎯';
    }
    if (text.includes('tutorial') || text.includes('guide') || text.includes('how to')) {
      return '🧠';
    }
    if (text.includes('surge') || text.includes('pump') || text.includes('突破')) {
      return '📈';
    }
    return '💡';
  }

  /**
   * 计算评分
   */
  calculateScore(data) {
    let score = 5;

    const upvoteRatio = data.upvote_ratio || 0.5;
    score += Math.floor(upvoteRatio * 2);

    if (data.score > 100) score += 2;
    if (data.num_comments > 50) score += 1;

    const hoursOld = (Date.now() / 1000 - data.created_utc) / 3600;
    if (hoursOld < 6) score += 1;

    return Math.min(10, score);
  }

  /**
   * 提取价值说明
   */
  extractValue(data) {
    const selftext = data.selftext || '';
    if (selftext) {
      return selftext.substring(0, 150) + '...';
    }
    return `来自 ${data.subreddit_name || data.subreddit} 的帖子，${data.num_comments} 条评论。`;
  }

  /**
   * 判断是否新数据
   */
  isNewItem(item) {
    if (this.processedIds.has(item.id)) {
      return false;
    }
    this.processedIds.add(item.id);

    if (this.processedIds.size > 500) {
      const oldIds = Array.from(this.processedIds).slice(0, 250);
      oldIds.forEach(id => this.processedIds.delete(id));
    }

    return true;
  }

  /**
   * 停止
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RedditDataSource;
}
