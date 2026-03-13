// 信息流监控助手 - 后台服务（持久化版本）

// ============ 状态管理 ============
let isRunning = false;
let isStarting = false; // 是否正在启动中
let fetchIntervals = {};
let lastMonitorTime = 0; // 上次监控开始时间
let lastMonitorStopTime = 0; // 上次监控停止时间

// 已处理ID的存储键
const STORAGE_KEYS = {
  PROCESSED_IDS: 'processedIds_v3',
  REDDIT_PROCESSED_IDS: 'redditProcessedIds_v3',
  LAST_MONITOR_TIME: 'lastMonitorTime',
  LAST_MONITOR_STOP_TIME: 'lastMonitorStopTime'
};

// 加载已处理的ID（带时间戳）
async function loadProcessedIds(key) {
  try {
    const result = await chrome.storage.local.get([key]);
    const data = result[key] || {};
    return new Map(Object.entries(data));
  } catch (error) {
    console.error('[加载ID] 失败:', error);
    return new Map();
  }
}

// 保存已 processedId（带时间戳）
async function saveProcessedIds(key, idMap) {
  try {
    const data = Object.fromEntries(idMap.entries());
    await chrome.storage.local.set({ [key]: data });
  } catch (error) {
    console.error('[保存ID] 失败:', error);
  }
}

// 检查并添加已处理的ID（带时间戳）
async function addProcessedId(key, id, timestamp = Date.now()) {
  let idMap;
  if (key === STORAGE_KEYS.REDDIT_PROCESSED_IDS) {
    idMap = redditProcessedIds;
  } else {
    idMap = processedIds;
  }

  // 先检查是否已存在
  if (idMap.has(id)) {
    return false; // 已处理过
  }

  // 添加ID和时间戳
  idMap.set(id, timestamp);

  // 清理24小时前的旧数据
  const oneDayAgo = timestamp - 24 * 60 * 60 * 1000;
  for (const [savedId, time] of idMap.entries()) {
    if (time < oneDayAgo) {
      idMap.delete(savedId);
    }
  }

  // 限制最大数量
  if (idMap.size > 1000) {
    const sortedIds = Array.from(idMap.entries()).sort((a, b) => b[1] - a[1]);
    const toRemove = sortedIds.slice(500);
    toRemove.forEach(([savedId, time]) => idMap.delete(savedId));
  }

  // 异步保存到存储（不阻塞）
  saveProcessedIds(key, idMap);

  return true; // 新添加的
}

// 初始化时加载已处理的ID（带时间戳）
let processedIds = new Map();
let redditProcessedIds = new Map();

async function initializeProcessedIds() {
  console.log('[初始化] 加载已处理的ID...');
  processedIds = await loadProcessedIds(STORAGE_KEYS.PROCESSED_IDS);
  redditProcessedIds = await loadProcessedIds(STORAGE_KEYS.REDDIT_PROCESSED_IDS);
  
  // 启动时清理24小时前的数据
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  
  let jin10Cleaned = 0;
  for (const [id, time] of processedIds.entries()) {
    if (time < oneDayAgo) {
      processedIds.delete(id);
      jin10Cleaned++;
    }
  }
  
  let redditCleaned = 0;
  for (const [id, time] of redditProcessedIds.entries()) {
    if (time < oneDayAgo) {
      redditProcessedIds.delete(id);
      redditCleaned++;
    }
  }
  
  // 保存清理后的数据
  await saveProcessedIds(STORAGE_KEYS.PROCESSED_IDS, processedIds);
  await saveProcessedIds(STORAGE_KEYS.REDDIT_PROCESSED_IDS, redditProcessedIds);
  
  console.log('[初始化] 已加载', processedIds.size, '个金十ID（清理了', jin10Cleaned, '个旧数据）');
  console.log('[初始化] 已加载', redditProcessedIds.size, '个Reddit ID（清理了', redditCleaned, '个旧数据）');
}

// 默认配置
const defaultConfig = {
  sources: {
    jin10: true,
    twitter: false,
    reddit: true  // 默认开启 Reddit 监控
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
  translate: true,  // 是否翻译内容
  translation: {
    provider: 'free',
    apiKey: ''
  }
};

// 点击扩展图标时打开侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('信息流监控助手已安装');

  // 先加载已处理的ID
  await initializeProcessedIds();

  // 启动定时清理任务（每48小时执行一次）
  startPeriodicCleanup();

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

    case 'translateItem':
      translateItem(request.item)
        .then(translated => sendResponse({ success: true, translated }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'clearProcessedIds':
      clearProcessedIds()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      sendResponse({ success: false, error: '未知操作' });
  }

  return true;
});

// ============ 监控控制 ============
async function startMonitoring(sources) {
  console.log('[监控] ========== 开始启动流程 ==========');
  console.log('[监控] 请求的源:', sources);

  // 防止重复启动
  if (isRunning || isStarting) {
    console.log('[监控] 已在运行或启动中，跳过');
    return true;
  }

  isStarting = true;

  try {
    // 先更新状态为运行中
    isRunning = true;
    await chrome.storage.local.set({ isRunning: true });
    console.log('[监控] 状态已设置为运行中');

    // 获取当前配置
    const result = await chrome.storage.local.get(['config']);
    const config = result.config || defaultConfig;
    console.log('[监控] 当前配置:', JSON.stringify(config));

    // 更新源配置
    if (sources) {
      config.sources = { ...config.sources, ...sources };
    }

    // 检查是否至少有一个源
    if (!config.sources.jin10 && !config.sources.twitter && !config.sources.reddit) {
      throw new Error('请至少选择一个监控源');
    }

    console.log('[监控] 配置检查通过，开始启动...');

    // 清除已有的定时器
    clearAllFetchIntervals();

    // 先立即抓取一次数据（获取停止期间的新帖子）
    console.log('[监控] 立即抓取一次，获取停止期间的新数据...');
    try {
      if (config.sources.jin10) {
        console.log('[监控] 抓取金十数据...');
        await fetchJin10Data(config);
        console.log('[监控] 金十数据抓取完成');
      }
      if (config.sources.reddit) {
        console.log('[监控] 抓取 Reddit 数据...');
        await fetchRedditData(config);
        console.log('[监控] Reddit 数据抓取完成');
      }
    } catch (error) {
      console.error('[监控] 立即抓取失败，继续启动:', error);
    }

    // 检查是否被停止了
    if (!isRunning) {
      console.log('[监控] 启动过程中被停止，取消启动');
      isStarting = false;
      return false;
    }

    // 抓取完成后，再记录监控开始时间（用于后续过滤）
    lastMonitorTime = Date.now();
    await chrome.storage.local.set({ [STORAGE_KEYS.LAST_MONITOR_TIME]: lastMonitorTime });
    console.log('[监控] 记录开始时间:', new Date(lastMonitorTime).toLocaleString());

    // 启动各个源的定时监控
    if (config.sources.jin10) {
      console.log('[监控] 启动金十定时监控');
      startJin10Monitoring(config);
    }

    if (config.sources.twitter) {
      console.log('[监控] 启动 Twitter 监控');
      startTwitterMonitoring(config);
    }

    if (config.sources.reddit) {
      console.log('[监控] 启动 Reddit 定时监控');
      startRedditMonitoring(config);
    }

    isStarting = false;
    console.log('[监控] ========== 监控已启动 ==========');
    return true;

  } catch (error) {
    console.error('启动监控失败:', error);
    throw error;
  }
}

async function stopMonitoring() {
  console.log('[监控] ========== 停止监控 ==========');

  // 先设置状态为停止，阻止正在进行的抓取
  isRunning = false;
  isStarting = false;

  // 清除所有定时器
  clearAllFetchIntervals();
  console.log('[监控] 已清除定时器');

  // 保存停止时间
  lastMonitorStopTime = Date.now();
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_MONITOR_STOP_TIME]: lastMonitorStopTime });
  console.log('[监控] 记录停止时间:', new Date(lastMonitorStopTime).toLocaleString());

  // 更新存储状态
  await chrome.storage.local.set({ isRunning: false });

  console.log('[监控] ========== 监控已停止 ==========');
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

async function fetchJin10Data(config) {
  // 检查是否还在运行
  if (!isRunning && !isStarting) {
    console.log('[金十] 监控已停止，跳过抓取');
    return;
  }

  try {
    console.log('[金十] 获取数据...');

    // 获取金十快讯数据
    const response = await fetch('https://www.jin10.com/static/timeline.json');
    if (!response.ok) {
      console.log('[金十] 获取失败:', response.status);
      return;
    }

    const data = await response.json();
    const items = data?.data?.item || data || [];

    console.log('[金十] 获取到', items.length, '条数据');

    // 处理最新数据（取前10条）
    for (const item of items.slice(0, 10)) {
      // 检查是否还在运行
      if (!isRunning && !isStarting) {
        console.log('[金十] 监控已停止，中断处理');
        break;
      }

      const id = 'jin10_' + (item.id || item._id || Date.now() + Math.random());
      const itemTime = item.time || item.created_at || Date.now();

      // 跳过监控开始时间之前的旧数据
      const fiveMinutesAgo = lastMonitorTime - 300000;

      if (lastMonitorTime > 0 && itemTime < fiveMinutesAgo) {
        console.log('[金十] 跳过旧数据:', (item.title || item.content || '').substring(0, 30));
        continue;
      }

      // 检查是否已处理过
      const isNew = await addProcessedId(STORAGE_KEYS.PROCESSED_IDS, id);
      if (!isNew) {
        continue;
      }

      // 构建数据项
      const dataItem = {
        id: id,
        title: item.title || item.content || item.data?.content || '',
        content: item.content || item.data?.content || '',
        type: classifyJin10Post(item),
        score: calculateJin10Score(item),
        time: itemTime,
        source: 'jin10',
        url: item.url || item.link || `https://www.jin10.com/detail/${item.id}`,
        value: item.content || item.data?.content || ''
      };

      console.log('[金十] 新数据:', dataItem.title.substring(0, 30));

      // 分析和处理
      await analyzeAndProcess(dataItem);
    }

  } catch (error) {
    console.error('[金十] 获取数据失败:', error);
  }
}

// 分类金十帖子
function classifyJin10Post(item) {
  const text = (item.title + ' ' + (item.content || '')).toLowerCase();

  if (text.includes('降息') || text.includes('加息') || text.includes('利率') || text.includes('fed') || text.includes('美联储')) {
    return '📈';
  } else if (text.includes('etf') || text.includes('基金') || text.includes('上市')) {
    return '🎯';
  } else if (text.includes('突发') || text.includes('快讯') || text.includes('重要')) {
    return '💡';
  }

  return '💡';
}

// 计算金十帖子评分
function calculateJin10Score(item) {
  let score = 5;

  const text = (item.title + ' ' + (item.content || '')).toLowerCase();

  // 重要关键词加分
  if (text.includes('突发') || text.includes('重要')) score += 2;
  if (text.includes('美联储') || text.includes('fed')) score += 1;
  if (text.includes('etf') || text.includes('比特币')) score += 1;

  return Math.min(10, score);
}


// 翻译缓存
const translationCache = new Map();

// ============ 翻译工具 ============
async function translateText(text, from = 'en', to = 'zh') {
  if (!text) return '';

  // 如果已经是中文，直接返回
  const chineseRegex = /[\u4e00-\u9fa5]/;
  if (chineseRegex.test(text) && text.match(/[\u4e00-\u9fa5]/g).length > text.length / 4) {
    return text;
  }

  // 检查缓存
  const cacheKey = text.substring(0, 100);
  if (translationCache.has(cacheKey)) {
    console.log('[翻译] 使用缓存');
    return translationCache.get(cacheKey);
  }

  try {
    // 获取翻译配置
    const result = await chrome.storage.local.get(['config']);
    const config = result.config || {};
    const translation = config.translation || { provider: 'free', apiKey: '' };

    // Debug: 打印配置信息
    console.log('[翻译] 当前配置:', {
      provider: translation.provider,
      hasApiKey: !!translation.apiKey,
      apiKeyLength: translation.apiKey?.length || 0
    });

    let translated = '';

    if (translation.provider === 'glm') {
      translated = await translateWithGLM(text, translation.apiKey);
    } else if (translation.provider === 'deepseek') {
      translated = await translateWithDeepSeek(text, translation.apiKey);
    } else {
      translated = await translateWithFree(text, from, to);
    }

    // 缓存结果
    if (translated && translated !== text) {
      translationCache.set(cacheKey, translated);
      if (translationCache.size > 200) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
      }
    }

    return translated || text;

  } catch (error) {
    console.error('[翻译] 失败:', error.message);
    return text;
  }
}

// GLM 翻译
async function translateWithGLM(text, apiKey) {
  if (!apiKey) {
    console.warn('[GLM] 未配置 API Key，使用原文');
    return text;
  }

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          { role: 'user', content: 'Translate to Chinese (only return the translation, no explanation):\n\n' + text.substring(0, 500) }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]?.message?.content) {
      console.log('[GLM] 翻译成功');
      return data.choices[0].message.content.trim();
    } else {
      console.warn('[GLM] 返回格式异常:', data);
      return text;
    }
  } catch (error) {
    console.error('[GLM] 请求失败:', error.message);
    return text;
  }
}

// DeepSeek 翻译
async function translateWithDeepSeek(text, apiKey) {
  if (!apiKey) {
    console.warn('[DeepSeek] 未配置 API Key，使用原文');
    return text;
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: 'Translate to Chinese (only return the translation, no explanation):\n\n' + text.substring(0, 500) }
        ],
        temperature: 0.3
      })
    });

    const data = await response.json();
    if (data.choices && data.choices[0]?.message?.content) {
      console.log('[DeepSeek] 翻译成功');
      return data.choices[0].message.content.trim();
    } else {
      console.warn('[DeepSeek] 返回格式异常:', data);
      return text;
    }
  } catch (error) {
    console.error('[DeepSeek] 请求失败:', error.message);
    return text;
  }
}

// 免费 API 翻译
async function translateWithFree(text, from = 'en', to = 'zh') {
  try {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.substring(0, 300)) + '&langpair=' + from + '|' + to;
    const response = await fetch(url);
    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      console.log('[免费API] 翻译成功');
      return data.responseData.translatedText;
    } else if (data.responseStatus === 429) {
      console.warn('[免费API] 配额用完');
      return text;
    } else {
      console.warn('[免费API] 返回异常:', data.responseStatus);
      return text;
    }
  } catch (error) {
    console.error('[免费API] 失败:', error.message);
    return text;
  }
}

// 翻译单项（用于懒翻译）
async function translateItem(item) {
  try {
    const translated = {
      title: await translateText(item.title || ''),
      value: await translateText(item.value || '')
    };
    return translated;
  } catch (error) {
    console.error('[翻译单项] 失败:', error.message);
    return { title: item.title, value: item.value };
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

  // 每2分钟执行一次
  fetchIntervals.reddit = setInterval(() => {
    console.log('[Reddit] 定时触发 -', new Date().toLocaleTimeString());
    fetchRedditData(config);
  }, 60000);

  console.log('[Reddit] 监控已启动，每2分钟检查一次新内容');
}

async function fetchRedditData(config) {
  // 检查是否还在运行
  if (!isRunning && !isStarting) {
    console.log('[Reddit] 监控已停止，跳过抓取');
    return;
  }

  try {
    console.log('[Reddit] 获取真实数据...');

    const subreddits = (config.reddit?.subreddits?.length > 0)
      ? config.reddit.subreddits
      : ['r/ethereum', 'r/cryptocurrency', 'r/defi'];
    console.log('[Reddit] 监控的 subreddits:', subreddits);

    const shouldTranslate = config.translate !== false;

    for (const subreddit of subreddits) {
      // 检查是否还在运行
      if (!isRunning && !isStarting) {
        console.log('[Reddit] 监控已停止，中断抓取');
        break;
      }

      // 请求间隔，避免触发速率限制
      if (subreddits.indexOf(subreddit) > 0) {
        console.log('[Reddit] 等待 2 秒后请求下一个 subreddit...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 使用 new.json 获取最新帖子，而不是 hot.json
      const url = 'https://www.reddit.com/' + subreddit + '/new.json?limit=15';
      console.log('[Reddit] 正在获取:', url);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 429) {
            console.log('[Reddit] ' + subreddit + ' 触发速率限制，等待 5 秒...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          console.log('[Reddit] ' + subreddit + ' 失败: ' + response.status);
          continue;
        }

        const data = await response.json();
        const posts = data.data?.children || [];

        console.log('[Reddit] ' + subreddit + ' 获取到 ' + posts.length + ' 条帖子');

        for (const post of posts) {
          // 检查是否还在运行
          if (!isRunning && !isStarting) {
            console.log('[Reddit] 监控已停止，中断处理');
            break;
          }

          const redditData = post.data;

          // 跳过监控开始时间之前的旧数据（防止长时间停止后重复抓取）
          const postTimeMs = redditData.created_utc * 1000;
          const fiveMinutesAgo = lastMonitorTime - 300000;

          if (lastMonitorTime > 0 && postTimeMs < fiveMinutesAgo) {
            console.log('[Reddit] 跳过旧数据:', redditData.title.substring(0, 30));
            continue;
          }

          // 先计算评分，不翻译
          const rawScore = calculateRedditScore(redditData);

          console.log('[Reddit] 数据:', {
            title: redditData.title.substring(0, 30),
            author: redditData.author,
            num_comments: redditData.num_comments,
            score: rawScore
          });

          // 检查是否已处理过（使用持久化的ID检查）
          const itemId = 'reddit_' + redditData.id;
          const isNew = await addProcessedId(STORAGE_KEYS.REDDIT_PROCESSED_IDS, itemId);
          if (!isNew) {
            console.log('[Reddit] 已处理过，跳过:', itemId);
            continue;
          }

          // 获取配置检查面板阈值
          const configResult = await chrome.storage.local.get(['config']);
          const panelThreshold = configResult.config?.thresholds?.panelScore || 5;

          // 只有评分达到阈值才翻译
          let translatedTitle = redditData.title;
          let translatedContent = redditData.selftext || redditData.url || '';

          if (rawScore >= panelThreshold && shouldTranslate) {
            console.log('[Reddit] 评分', rawScore, '达标，开始翻译...');
            translatedTitle = await translateText(redditData.title);
            if (redditData.selftext) {
              translatedContent = await translateText(redditData.selftext);
            }
            console.log('[Reddit] 翻译完成');
          }

          const item = {
            id: itemId,
            title: translatedTitle,
            content: translatedContent,
            type: classifyRedditPost(redditData),
            score: rawScore,
            time: redditData.created_utc * 1000,
            source: 'reddit',
            url: 'https://www.reddit.com' + redditData.permalink,
            subreddit: subreddit,
            author: redditData.author,
            num_comments: redditData.num_comments || 0,
            value: extractRedditValue(redditData, translatedContent)
          };

          console.log('[Reddit] 新帖子:', item.title);

          // 分析和处理
          await analyzeAndProcess(item);
        }

      } catch (error) {
        console.error('[Reddit] ' + subreddit + ' 错误: ' + error.message);
      }
    }

    console.log('[Reddit] 本轮检查完成 -', new Date().toLocaleTimeString());

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

  // 1. 评论数（最高优先级）- 讨论活跃度
  if (post.num_comments > 10) score += 2;
  if (post.num_comments > 30) score += 1;
  if (post.num_comments > 50) score += 1;
  if (post.num_comments > 100) score += 1;
  if (post.num_comments > 200) score += 1;

  // 2. 新鲜度（第二优先级）- 信息时效性
  const hoursOld = (Date.now() / 1000 - post.created_utc) / 3600;
  if (hoursOld < 6) score += 2;
  else if (hoursOld < 24) score += 1;

  // 3. 投票数（第三优先级）- 社区认可度
  if (post.score > 100) score += 1;
  if (post.score > 500) score += 1;

  // 4. 点赞比例（最低优先级）- 正面评价
  const upvoteRatio = post.upvote_ratio || 0.5;
  if (upvoteRatio > 0.8) score += 1;

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
    // 检查是否仍在运行
    if (!isRunning) {
      console.log('[处理] 监控已停止，跳过处理');
      return;
    }

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
      console.log('[处理] 评分', processedItem.score, '达到面板阈值', config.thresholds.panelScore, '✅ 添加到列表');
      // 更新统计
      await updateStats('total');

      if (processedItem.score >= config.thresholds.notificationScore) {
        console.log('[处理] 评分达到通知阈值');
        // 通知功能已禁用
        // await sendNotification(processedItem);
        await updateStats('valuable');
      }

      // 添加到最近通知
      await addRecentNotification(processedItem);
      console.log('[处理] 已添加到最近通知');
    } else {
      console.log('[处理] 评分', processedItem.score, '低于面板阈值', config.thresholds.panelScore, '❌ 跳过');
    }

  } catch (error) {
    console.error('分析处理失败:', error);
  }
}

// ============ 通知和存储 ============
// Chrome 通知功能已禁用
// async function sendNotification(item) {
//   // 检查静默时段
//   if (await isQuietHours()) {
//     console.log('静默时段，跳过通知');
//     return;
//   }
//
//   // 创建 Chrome 通知
//   const notificationId = item.id;
//
//   chrome.notifications.create(notificationId, {
//     type: 'basic',
//     iconUrl: chrome.runtime.getURL('icons/icon.svg'),
//     title: `${item.type} ${getSourceLabel(item.source)}`,
//     message: `${item.title}\n评分: ${item.score}/10`,
//     priority: 2,
//     requireInteraction: false
//   }, (notificationId) => {
//     if (chrome.runtime.lastError) {
//       console.error('通知创建失败:', chrome.runtime.lastError);
//     } else {
//       console.log('通知已发送:', notificationId);
//     }
//   });
// }

// ============ 定期清理 ============
let cleanupTimer = null;

function startPeriodicCleanup() {
  // 每48小时执行一次清理（48 * 60 * 60 * 1000 = 172800000 毫秒）
  const cleanupInterval = 48 * 60 * 60 * 1000;

  // 启动时先执行一次清理（删除超过24小时的数据）
  cleanOldData();

  // 设置定时器
  cleanupTimer = setInterval(() => {
    cleanOldData();
  }, cleanupInterval);

  console.log('[清理] 定时任务已启动，每48小时清理一次');
}

async function cleanOldData() {
  try {
    console.log('[清理] 开始清理超过24小时的数据...');

    const result = await chrome.storage.local.get(['recentNotifications']);
    let recent = result.recentNotifications || [];

    // 删除超过24小时的数据
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const beforeCount = recent.length;

    recent = recent.filter(item => {
      return item.timestamp && item.timestamp > oneDayAgo;
    });

    const afterCount = recent.length;
    const cleanedCount = beforeCount - afterCount;

    if (cleanedCount > 0) {
      await chrome.storage.local.set({ recentNotifications: recent });
      console.log(`[清理] 删除了 ${cleanedCount} 条超过24小时的数据`);
    } else {
      console.log('[清理] 没有需要清理的数据');
    }

  } catch (error) {
    console.error('[清理] 失败:', error);
  }
}

// ============ 通知和存储 ============
async function addRecentNotification(item) {
  const result = await chrome.storage.local.get(['recentNotifications']);
  let recent = result.recentNotifications || [];

  // 去重：检查是否已存在相同 id
  const existingIndex = recent.findIndex(r => r.id === item.id);
  if (existingIndex !== -1) {
    // 已存在，直接返回，不重复添加
    console.log('[去重] 数据已存在，跳过:', item.id);
    return;
  }

  // 添加到开头
  recent.unshift(item);

  // 每天最多显示 3000 条数据
  recent = recent.slice(0, 3000);

  await chrome.storage.local.set({ recentNotifications: recent });
  console.log('[存储] 已添加到通知列表，当前数量:', recent.length);
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

// ============ 清理已处理的ID ============
async function clearProcessedIds() {
  console.log('[清理] 清空所有已处理的ID');

  // 清空内存
  processedIds.clear();
  redditProcessedIds.clear();

  // 清空存储
  await chrome.storage.local.remove([
    STORAGE_KEYS.PROCESSED_IDS,
    STORAGE_KEYS.REDDIT_PROCESSED_IDS
  ]);

  console.log('[清理] 已清空，重新开始');
  return true;
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

console.log('信息流监控助手后台服务已加载（持久化版本）');
