# Reddit 集成指南

## 步骤 1: 加载 Reddit 模块

在 `background.js` 顶部添加：

```javascript
// 加载 Reddit 数据源模块
// 注意：需要将 api/reddit.js 的代码复制到 background.js 中
// 或者使用 import（如果支持）
```

## 步骤 2: 替换 fetchRedditData 函数

找到 `background.js` 中的：
```javascript
async function fetchRedditData(config) {
  // TODO: 实现
}
```

替换为 `api/reddit.js` 中的完整代码。

## 步骤 3: 修改 startRedditMonitoring 函数

找到：
```javascript
function startRedditMonitoring(config) {
  console.log('启动 Reddit 监控');
  // TODO: 实现 Reddit 数据抓取
}
```

替换为：
```javascript
function startRedditMonitoring(config) {
  console.log('启动 Reddit 监控');

  // 立即执行一次
  fetchRedditData(config);

  // 每5分钟执行一次
  fetchIntervals.reddit = setInterval(() => {
    fetchRedditData(config);
  }, 300000);
}

// Reddit 处理的ID集合
const redditProcessedIds = new Set();
```

## 步骤 4: 复制 Reddit 相关函数

将 `api/reddit.js` 中的以下函数复制到 `background.js`：

- `fetchRedditData(config)` - 完整替换
- `classifyRedditPost(post)` - 分类帖子
- `calculateRedditScore(post)` - 计算评分
- `extractRedditValue(post)` - 提取价值说明

---

## 快速集成（推荐）

直接把 `api/reddit.js` 的代码合并到 `background.js` 中。

需要我帮你自动合并吗？
