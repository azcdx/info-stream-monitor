// 信息流监控助手 - 后台服务

// ============ 状态管理 ============
let isRunning = false;
let monitoringInterval = null;
let fetchIntervals = {};

// 默认配置
const defaultConfig = {
  sources: {
    jin10: true,
    twitter: false,
    reddit: false
  },
  jin10: {
    categories: ['加密货币', '宏观', '科技']
  },
  twitter: {
    users: [],
    keywords: []
  },
  reddit: {
    subreddits: ['r/ethereum', 'r/cryptocurrency', 'r/defi']
  },
  thresholds: {
    notificationScore: 7,
    panelScore: 5
  },
  quietHours: {
    enabled: false,
    start: '23:00',
    end: '08:00'
  },
  translate: true  // 是否翻译内容
};

// 模拟数据集（用于测试）
const mockDataItems = [
  {
    title: '美联储暗示6月可能降息',
    content: '美联储最新会议纪要显示，6月降息可能性增加，市场预期发生转变...',
    type: '📈',
    score: 8
  },
  {
    title: '以太坊Layer2交易量突破新高',
    content: 'Arbitrum和Optimism网络日活动地址数创新高，显示L2采用率持续上升...',
    type: '🎯',
    score: 7
  },
  {
    title: '比特币矿工算力连续三个月增长',
    content: 'BTC网络难度调整显示出矿工信心恢复，长期持有者地址数量增加...',
    type: '📈',
    score: 6
  },
  {
    title: 'Solana推出手机Saga新版本',
    content: '移动端体验优化，集成Web3功能，用户增长加速...',
    type: '💡',
    score: 5
  },
  {
    title: '美SEC推迟多个以太坊ETF决策',
    content: '监管不确定性增加，市场等待更多明确信号...',
    type: '📈',
    score: 7
  },
  {
    title: 'DeFi总锁仓量回升至500亿美元',
    content: '主要协议TVL增长，显示DeFi市场开始复苏...',
    type: '🎯',
    score: 6
  }
];

let mockDataIndex = 0;

// Reddit 已处理的ID集合
const redditProcessedIds = new Set();

// 点击扩展图标时打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('信息流监控助手已安装');

  // 初始化存储
  chrome.storage.local.get([
    'config', 'isRunning', 'stats', 'favorites', 'recentNotifications'
  ], (result) => {
    if (!result.config) {
      chrome.storage.local.set({ config: defaultConfig });
    }
    if (!result.stats) {
      chrome.storage.local.set({
        stats: { total: 0, valuable: 0, favorite: 0 }
      });
    }
    if (!result.favorites) {
      chrome.storage.local.set({ favorites: [] });
    }
    if (!result.recentNotifications) {
      chrome.storage.local.set({ recentNotifications: [] });
    }

    // 恢复监控状态（如果之前是运行中的）
    if (result.isRunning) {
      startMonitoring(result.config?.sources || defaultConfig.sources);
    }
  });
});

// ============ 消息处理 ============
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('收到消息:', request);

  switch (request.action) {
    case 'startMonitoring':
      startMonitoring(request.sources)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'stopMonitoring':
      stopMonitoring()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'updateConfig':
      updateConfig(request.sources)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'addToFavorites':
      addFavorite(request.item)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'getFavorites':
      getFavorites()
        .then(favorites => sendResponse({ success: true, favorites }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'removeFavorite':
      removeFavorite(request.id)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'importConfig':
      importConfig(request.json)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'exportConfig':
      exportConfig()
        .then(config => sendResponse({ success: true, config }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ success: false, error: '未知操作' });
  }

  return true;
});

// ============ 监控控制 ============
async function startMonitoring(sources) {
  console.log('开始监控:', sources);

  // 防止重复启动
  if (isRunning) {
    console.log('已在运行中，跳过');
    return true;
  }

  try {
    // 获取当前配置
    const result = await chrome.storage.local.get(['config']);
    const config = result.config || defaultConfig;
    console.log('当前配置:', JSON.stringify(config));

    // 更新源配置
    if (sources) {
      config.sources = { ...config.sources, ...sources };
    }

    // 检查是否至少有一个源
    if (!config.sources.jin10 && !config.sources.twitter && !config.sources.reddit) {
      throw new Error('请至少选择一个监控源');
    }

    // 清除已有的定时器
    clearAllFetchIntervals();

    // 启动各个源的监控
    if (config.sources.jin10) {
      console.log('启动金十监控');
      startJin10Monitoring(config);
    }

    if (config.sources.twitter) {
      console.log('启动 Twitter 监控');
      startTwitterMonitoring(config);
    }

    if (config.sources.reddit) {
      console.log('启动 Reddit 监控');
      startRedditMonitoring(config);
    }

    // 更新状态
    isRunning = true;
    await chrome.storage.local.set({ isRunning: true });

    console.log('监控已启动');
    return true;

  } catch (error) {
    console.error('启动监控失败:', error);
    throw error;
  }
}

async function stopMonitoring() {
  console.log('停止监控');

  // 清除所有定时器
  clearAllFetchIntervals();

  // 更新状态
  isRunning = false;
  await chrome.storage.local.set({ isRunning: false });

  console.log('监控已停止');
  return true;
}

function clearAllFetchIntervals() {
  Object.keys(fetchIntervals).forEach(key => {
    if (fetchIntervals[key]) {
      clearInterval(fetchIntervals[key]);
      delete fetchIntervals[key];
    }
  });
}

async function updateConfig(sources) {
  const result = await chrome.storage.local.get(['config']);
  const config = result.config || defaultConfig;

  config.sources = { ...config.sources, ...sources };
  await chrome.storage.local.set({ config });

  console.log('配置已更新:', config.sources);

  // 如果正在运行，重启监控
  if (isRunning) {
    await stopMonitoring();
    await startMonitoring(config.sources);
  }

  return true;
}

// ============ 金十数据监控 ============
function startJin10Monitoring(config) {
  console.log('启动金十数据监控');

  // 立即执行一次
  fetchJin10Data(config);

  // 每30秒执行一次
  fetchIntervals.jin10 = setInterval(() => {
    fetchJin10Data(config);
  }, 30000);
}

// 已处理的ID集合（去重）
const processedIds = new Set();

async function fetchJin10Data(config) {
  try {
    console.log('获取金十数据...');

    // 获取不同的模拟数据
    const mockId = 'jin10_' + Date.now() + '_' + mockDataIndex;
    const dataItem = mockDataItems[mockDataIndex];

    const mockData = {
      id: mockId,
      title: dataItem.title,
      content: dataItem.content,
      type: dataItem.type,
      score: dataItem.score,
      time: Date.now(),
      source: 'jin10',
      url: 'https://www.jin10.com/',
      value: dataItem.content
    };

    // 循环使用不同的模拟数据
    mockDataIndex = (mockDataIndex + 1) % mockDataItems.length;

    // 检查是否已处理过
    if (processedIds.has(mockId)) {
      console.log('已处理过，跳过');
      return;
    }

    processedIds.add(mockId);

    // 清理旧ID
    if (processedIds.size > 1000) {
      const oldIds = Array.from(processedIds).slice(0, 500);
      oldIds.forEach(id => processedIds.delete(id));
    }

    // 分析数据
    await analyzeAndProcess(mockData);

  } catch (error) {
    console.error('获取金十数据失败:', error);
  }
}

// ============ Twitter 监控 ============
function startTwitterMonitoring(config) {
  console.log('启动 Twitter 监控');
  // TODO: 实现 Twitter 数据抓取
}

async function fetchTwitterData(config) {
  // TODO: 实现
}

// ============ 翻译工具 ============
async function translateText(text, from = 'en', to = 'zh') {
  if (!text) return '';

  // 如果已经是中文，直接返回
  const chineseRegex = /[\u4e00-\u9fa5]/;
  if (chineseRegex.test(text) && text.match(/[\u4e00-\u9fa5]/g).length > text.length / 4) {
    return text;
  }

  try {
    // 使用免费的 MyMemory 翻译 API
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    return text;
  } catch (error) {
    console.error('[翻译] 失败:', error.message);
    return text;
  }
}

// ============ Reddit 监控 ============
function startRedditMonitoring(config) {
  const subreddits = (config.reddit?.subreddits?.length > 0)
    ? config.reddit.subreddits
    : ['r/ethereum', 'r/cryptocurrency', 'r/defi'];
  console.log('[Reddit] 启动监控，subreddits:', subreddits);

  // 立即执行一次
  fetchRedditData(config);

  // 每5分钟执行一次
  fetchIntervals.reddit = setInterval(() => {
    fetchRedditData(config);
  }, 300000);
}

async function fetchRedditData(config) {
  try {
    console.log('[Reddit] 获取真实数据...');

    const subreddits = (config.reddit?.subreddits?.length > 0)
      ? config.reddit.subreddits
      : ['r/ethereum', 'r/cryptocurrency', 'r/defi'];
    console.log('[Reddit] 监控的 subreddits:', subreddits);

    const shouldTranslate = config.translate !== false;

    for (const subreddit of subreddits) {
      const url = 'https://www.reddit.com/' + subreddit + '/hot.json?limit=5';
      console.log('[Reddit] 正在获取:', url);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.log('[Reddit] ' + subreddit + ' 失败: ' + response.status);
          continue;
        }

        const data = await response.json();
        const posts = data.data?.children || [];

        console.log('[Reddit] ' + subreddit + ' 获取到 ' + posts.length + ' 条帖子');

        for (const post of posts) {
          const redditData = post.data;

          // 翻译标题和内容
          let translatedTitle = redditData.title;
          let translatedContent = redditData.selftext || redditData.url || '';

          if (shouldTranslate) {
            console.log('[Reddit] 正在翻译...');
            translatedTitle = await translateText(redditData.title);
            if (redditData.selftext) {
              translatedContent = await translateText(redditData.selftext);
            }
            console.log('[Reddit] 翻译完成');
          }

          const item = {
            id: 'reddit_' + redditData.id,
            title: translatedTitle,
            content: translatedContent,
            type: classifyRedditPost(redditData),
            score: calculateRedditScore(redditData),
            time: redditData.created_utc * 1000,
            source: 'reddit',
            url: 'https://www.reddit.com' + redditData.permalink,
            subreddit: subreddit,
            author: redditData.author,
            value: extractRedditValue(redditData, translatedContent)
          };

          console.log('[Reddit] 帖子:', item.title, '评分:', item.score, '类型:', item.type);

          // 检查是否已处理过
          if (redditProcessedIds.has(item.id)) {
            console.log('[Reddit] 已处理过，跳过:', item.id);
            continue;
          }

          redditProcessedIds.add(item.id);

          // 清理旧ID
          if (redditProcessedIds.size > 500) {
            const oldIds = Array.from(redditProcessedIds).slice(0, 250);
            oldIds.forEach(id => redditProcessedIds.delete(id));
          }

          // 分析和处理
          await analyzeAndProcess(item);
        }

      } catch (error) {
        console.error('[Reddit] ' + subreddit + ' 错误: ' + error.message);
      }
    }

  } catch (error) {
    console.error('[Reddit] 获取失败:', error);
  }
}

// 分类 Reddit 帖子
function classifyRedditPost(post) {
  const title = (post.title || '').toLowerCase();
  const selftext = (post.selftext || '').toLowerCase();
  const text = title + ' ' + selftext;

  if (text.includes('airdrop') || text.includes('空投') || text.includes('free') || text.includes('giveaway')) {
    return '🎯';
  } else if (text.includes('tutorial') || text.includes('guide') || text.includes('how to') || text.includes('解释')) {
    return '🧠';
  } else if (text.includes('surge') || text.includes('pump') || text.includes('dump') || text.includes('breakout') || text.includes('突破')) {
    return '📈';
  }

  return '💡';
}

// 计算 Reddit 评分
function calculateRedditScore(post) {
  let score = 5;

  const upvoteRatio = post.upvote_ratio || 0.5;
  score += Math.floor(upvoteRatio * 2);

  if (post.score > 100) score += 2;
  if (post.score > 500) score += 1;

  if (post.num_comments > 50) score += 1;
  if (post.num_comments > 200) score += 1;

  const hoursOld = (Date.now() / 1000 - post.created_utc) / 3600;
  if (hoursOld < 6) score += 1;
  if (hoursOld < 24) score += 1;

  return Math.min(10, score);
}

// 提取 Reddit 价值说明
function extractRedditValue(post, translatedContent) {
  if (translatedContent) {
    return translatedContent.substring(0, 150) + '...';
  }
  return '来自 ' + (post.subreddit_name || post.subreddit) + ' 的帖子，' + post.num_comments + ' 条评论。';
}

// ============ AI 分析和处理 ============
async function analyzeAndProcess(item) {
  try {
    console.log('[处理] 项目:', item.title, '评分:', item.score, '来源:', item.source);

    // 获取配置
    const result = await chrome.storage.local.get(['config']);
    const config = result.config || defaultConfig;

    // 直接使用数据中的类型和评分（模拟数据已包含）
    const processedItem = {
      id: item.id,
      ...item,
      timestamp: Date.now()
    };

    // 判断是否需要处理
    if (processedItem.score >= config.thresholds.panelScore) {
      console.log('[处理] 评分达到面板阈值，添加到列表');
      // 更新统计
      await updateStats('total');

      if (processedItem.score >= config.thresholds.notificationScore) {
        console.log('[处理] 评分达到通知阈值，发送通知');
        // 发送通知
        await sendNotification(processedItem);
        await updateStats('valuable');
      }

      // 添加到最近通知
      await addRecentNotification(processedItem);
      console.log('[处理] 已添加到最近通知');
    } else {
      console.log('[处理] 评分未达到面板阈值，跳过');
    }

  } catch (error) {
    console.error('分析处理失败:', error);
  }
}

// ============ 通知和存储 ============
async function sendNotification(item) {
  // 检查静默时段
  if (await isQuietHours()) {
    console.log('静默时段，跳过通知');
    return;
  }

  // 创建 Chrome 通知
  const notificationId = item.id;

  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon.svg'),
    title: `${item.type} ${getSourceLabel(item.source)}`,
    message: `${item.title}\n评分: ${item.score}/10`,
    priority: 2,
    requireInteraction: false
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error('通知创建失败:', chrome.runtime.lastError);
    } else {
      console.log('通知已发送:', notificationId);
    }
  });
}

async function addRecentNotification(item) {
  const result = await chrome.storage.local.get(['recentNotifications']);
  let recent = result.recentNotifications || [];

  // 添加到开头
  recent.unshift(item);

  // 只保留最近50条
  recent = recent.slice(0, 50);

  await chrome.storage.local.set({ recentNotifications: recent });
}

async function updateStats(type) {
  const result = await chrome.storage.local.get(['stats']);
  const stats = result.stats || { total: 0, valuable: 0, favorite: 0 };

  if (type === 'total') {
    stats.total++;
  } else if (type === 'valuable') {
    stats.valuable++;
  } else if (type === 'favorite') {
    stats.favorite++;
  }

  await chrome.storage.local.set({ stats });
  console.log('[统计] 更新:', stats);
}

// ============ 收藏管理 ============
async function addFavorite(item) {
  const result = await chrome.storage.local.get(['favorites']);
  let favorites = result.favorites || [];

  // 检查是否已存在
  if (favorites.find(f => f.id === item.id)) {
    throw new Error('已收藏');
  }

  // 添加收藏
  favorites.push(item);

  await chrome.storage.local.set({ favorites });
  await updateStats('favorite');

  console.log('已收藏:', item.title);
  return true;
}

async function getFavorites() {
  const result = await chrome.storage.local.get(['favorites']);
  return result.favorites || [];
}

async function removeFavorite(id) {
  const result = await chrome.storage.local.get(['favorites']);
  let favorites = result.favorites || [];

  favorites = favorites.filter(f => f.id !== id);

  await chrome.storage.local.set({ favorites });

  console.log('已取消收藏:', id);
  return true;
}

// ============ 配置导入导出 ============
async function importConfig(jsonString) {
  try {
    const config = JSON.parse(jsonString);

    // 验证格式
    if (!config.twitter && !config.reddit && !config.jin10) {
      throw new Error('配置格式错误');
    }

    // 合并到当前配置
    const result = await chrome.storage.local.get(['config']);
    const currentConfig = result.config || defaultConfig;

    const newConfig = {
      ...currentConfig,
      twitter: { ...currentConfig.twitter, ...config.twitter },
      reddit: { ...currentConfig.reddit, ...config.reddit },
      jin10: { ...currentConfig.jin10, ...config.jin10 }
    };

    await chrome.storage.local.set({ config: newConfig });

    console.log('配置已导入');
    return true;

  } catch (error) {
    console.error('导入配置失败:', error);
    throw new Error('配置格式错误，请检查 JSON');
  }
}

async function exportConfig() {
  const result = await chrome.storage.local.get(['config']);
  const config = result.config || defaultConfig;

  return {
    twitter: config.twitter,
    reddit: config.reddit,
    jin10: config.jin10
  };
}

// ============ 工具函数 ============
function getSourceLabel(source) {
  const labels = {
    jin10: '金十',
    twitter: '推特',
    reddit: '红迪'
  };
  return labels[source] || source;
}

async function isQuietHours() {
  const result = await chrome.storage.local.get(['config']);
  const config = result.config || defaultConfig;

  if (!config.quietHours.enabled) {
    return false;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return currentTime >= config.quietHours.start || currentTime <= config.quietHours.end;
}

console.log('信息流监控助手后台服务已加载');
