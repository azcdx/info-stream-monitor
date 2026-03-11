// Reddit 真实数据抓取代码片段
// 请将以下代码插入到 background.js

// 1. 在文件顶部（第 50 行左右）添加：
/*
const redditProcessedIds = new Set();
*/

// 2. 替换 fetchRedditData 函数（第 338 行附近）：
async function fetchRedditData(config) {
  try {
    console.log('[Reddit] 获取真实数据...');

    const subreddits = config.reddit?.subreddits || ['r/ethereum', 'r/cryptocurrency', 'r/defi'];

    for (const subreddit of subreddits) {
      const url = 'https://www.reddit.com/' + subreddit + '/hot.json?limit=5';

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.log('[Reddit] ' + subreddit + ' 失败: ' + response.status);
          continue;
        }

        const data = await response.json();
        const posts = data.data?.children || [];

        console.log('[Reddit] ' + subreddit + ' 获取到 ' + posts.length + ' 条');

        for (const post of posts) {
          const redditData = post.data;

          const item = {
            id: 'reddit_' + redditData.id,
            title: redditData.title,
            content: redditData.selftext || redditData.url || '',
            type: classifyRedditPost(redditData),
            score: calculateRedditScore(redditData),
            time: redditData.created_utc * 1000,
            source: 'reddit',
            url: 'https://www.reddit.com' + redditData.permalink,
            subreddit: subreddit,
            author: redditData.author,
            value: extractRedditValue(redditData)
          };

          if (redditProcessedIds.has(item.id)) {
            continue;
          }

          redditProcessedIds.add(item.id);

          if (redditProcessedIds.size > 500) {
            const oldIds = Array.from(redditProcessedIds).slice(0, 250);
            oldIds.forEach(id => redditProcessedIds.delete(id));
          }

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

// 3. 添加辅助函数：
function classifyRedditPost(post) {
  const text = ((post.title || '') + ' ' + (post.selftext || '')).toLowerCase();
  if (text.includes('airdrop') || text.includes('空投')) return '🎯';
  if (text.includes('tutorial') || text.includes('guide')) return '🧠';
  if (text.includes('surge') || text.includes('pump')) return '📈';
  return '💡';
}

function calculateRedditScore(post) {
  let score = 5;
  score += Math.floor((post.upvote_ratio || 0.5) * 2);
  if (post.score > 100) score += 2;
  if (post.num_comments > 50) score += 1;
  const hoursOld = (Date.now() / 1000 - post.created_utc) / 3600;
  if (hoursOld < 6) score += 1;
  return Math.min(10, score);
}

function extractRedditValue(post) {
  if (post.selftext) return post.selftext.substring(0, 150) + '...';
  return '来自 ' + (post.subreddit_name || post.subreddit) + ' 的帖子，' + post.num_comments + ' 条评论。';
}

// 4. 替换 startRedditMonitoring 函数：
function startRedditMonitoring(config) {
  console.log('[Reddit] 启动监控，subreddits:', config.reddit?.subreddits);
  fetchRedditData(config);
  fetchIntervals.reddit = setInterval(() => fetchRedditData(config), 300000);
}
