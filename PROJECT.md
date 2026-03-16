# 信息流监控助手 - 项目文档

> **项目定位**：Chrome 扩展 - 监控 Reddit 等信息源，AI 评分筛选，推送高价值内容

---



**目标**：自动监控信息流，AI 评分筛选，只推送有价值的内容

**技术栈**：
- Chrome Extension Manifest V3
- Service Worker (后台服务)
- Side Panel API (侧边栏)
- Chrome Storage API (数据持久化)
- Reddit 公共 API
- GLM-4-Flash / DeepSeek / MyMemory (翻译)

**文件结构**：
```
info-stream-monitor/
├── manifest.json          # 扩展配置
├── background.js          # 后台服务（核心逻辑）
├── sidepanel.html         # 侧边栏界面
├── sidepanel.js           # 侧边栏逻辑
├── config.html            # 配置页面
├── config.js              # 配置逻辑
├── favorites.html         # 收藏夹页面
├── favorites.js           # 收藏夹逻辑
└── README.md              # 项目说明
```

---

## ✅ 功能清单

### 1. 数据源监控
| 源 | 状态 | 配置 |
|---|------|------|
| **Reddit** | ✅ 启用 | 1 分钟轮询，16 个子版块，每版块 15 条 |
| **金十** | ❌ 暂停 | 30 秒轮询（已禁用） |
| **Twitter** | ❌ 未实现 | 待开发 |

### 2. 智能分类
- 🎯 **机会** - airdrop/空投/free/giveaway
- 🧠 **知识** - tutorial/guide/how to/解释
- 📈 **趋势** - surge/pump/dump/breakout/突破
- 💡 **灵感** - 其他

### 3. 评分系统（评论 > 时效 > 点赞）

```
**Reddit 评分规则**：
基础分：5

评论数（最高权重）
  > 10   → +2
  > 30   → +1
  > 50   → +1
  > 100  → +1
  > 200  → +1

时效性（次权重）
  < 6 小时   → +2
  < 24 小时  → +1

投票数
  > 100  → +1
  > 500  → +1

点赞比例
  > 0.8  → +1

最高分：10
```
- 面板显示：≥5 分
- 推送通知：≥7 分

### 4. 翻译功能
| 提供商 | 状态 | 配置位置 |
|---|------|------|
| GLM-4-Flash | ✅ 使用中 | config.html 配置 API Key |
| DeepSeek | 可选 | config.html 配置 API Key |
| MyMemory | 备用 | 免费，无需配置 |

**优化**：只翻译评分 ≥5 的内容，节省 token

### 5. 数据存储
```
Chrome Storage Local 结构
{
  recentNotifications: [],      // 最近通知（最多 3000 条）
  favorites: [],                // 收藏夹
  stats: {},                    // 统计数据
  redditProcessedIds_v3: {},    // Reddit 已处理 ID
  config: {}                    // 配置
}
```

**去重机制**：
- 基于 ID 去重
- 24 小时自动清理
- 最多保存 1000 个 ID

### 6. 推送机制
- **立即推送**：每翻译成功一条立即推送（不累积）
- **推送锁**：防止竞态条件，确保数据一致性
- **最大容量**：3000 条，超过删除最前面的

---
### 7. 数据清理规则

**自动清理时机**：每 48 小时执行一次

**清理规则**：
1. 删除超过 24 小时的数据
2. 如果超过 3000 条，裁剪到 3000 条（删除最旧的数据）

**ID 去重清理**：
- 24 小时自动清理过期 ID
- 最多保存 1000 个 ID




### 监控规则
1. **轮询频率**：Reddit 1 分钟（使用 chrome.alarms）
2. **每版块数量**：15 条
3. **手动启动**：Chrome 重启后需手动点击开始
4. **网络要求**：Reddit 需要代理/VPN（中国）

### 过滤规则
1. **时间过滤**：只抓取监控开始时间之后的数据（提前5分钟缓冲）
2. **ID 去重**：基于帖子 ID 去重，已处理过的跳过
3. **评分过滤**：评分 < 5 不推送到面板
4. **评分过滤**：评分 < 7 不推送通知

### 停止后再启动
- **从最新开始抓**：只抓取停止后新增的帖子
- **时间过滤**：跳过监控开始时间之前的内容
- **ID 去重**：配合时间过滤，确保不重复抓取

### 数据清理规则
- **自动清理时机**：每 48 小时执行一次
- **数据清理**：删除超过 24 小时的数据
- **容量限制**：超过 3000 条时，裁剪到 3000 条（删除最旧的）
- **ID 去重清理**：24 小时自动清理过期 ID，最多保存 1000 个



## 🛠️ 技术细节

### background.js 核心函数

| 函数 | 功能 |
|---|---|
| `startRedditMonitoring()` | 启动 Reddit 监控 |
| `fetchRedditData()` | 获取 Reddit 数据 |
| `calculateRedditScore()` | 计算 Reddit 评分 |
| `classifyRedditPost()` | 分类帖子 |
| `analyzeAndProcess()` | 分析处理（评分+推送） |
| `addRecentNotification()` | 添加到通知列表（带推送锁） |
| `translateText()` | 翻译文本 |

### 关键代码位置

**评分函数**：background.js 第 778-798 行

**推送锁**：background.js 第 933 行开始

---

## 📊 当前配置

### 监控的 16 个 Subreddit
```
r/IndieHackers, r/SaaS, r/startups, r/Entrepreneur, r/ProductHunt,
r/SideProject, r/BsideProject, r/OpenAI, r/ChatGPT, r/artificial,
r/MachineLearning, r/ethereum, r/cryptocurrency, r/Bitcoin,
r/geopolitics, r/CredibleDefense
```

### 默认配置
```javascript
{
  sources: {
    jin10: false,
    twitter: false,
    reddit: true
  },
  thresholds: {
    notificationScore: 7,
    panelScore: 5
  },
  translate: true,
  translation: {
    provider: 'free',
    apiKey: ''
  }
}
```

---

## 📝 开发历史

### 重要决策记录

| 决策 | 原因 |
|------|------|
| 金十暂停 | 先把 Reddit 跑通 |
| 评分改为 评论>时效>点赞 | 用户要求 |
| 只翻译高分内容 | 节省 token |
| 每版块 15 条 | 1 分钟轮询 |
| 添加推送锁 | 防止累积推送 |

### 已解决的问题
1. **CORS 错误**：添加 host_permissions
2. **停止按钮失效**：添加 isRunning 检查
3. **Reddit 429 限流**：减少 subreddit 数量，增加轮询间隔
4. **累积推送**：添加推送锁机制
5. **Token 浪费**：先评分再翻译

---

## 🚀 待办事项

- [ ] Twitter/X 集成
- [ ] 金十数据源重新启用
- [ ] 更多翻译选项
- [ ] 自定义评分规则
- [ ] 导出数据功能

---

## 📌 快速记忆

**项目一句话**：Chrome 扩展，监控 Reddit，AI 评分筛选，只推高价值内容

**核心数字**：
- 轮询：1 分钟
- 阈值：≥5 推送
- 容量：3000 条
- 子版块：16 个

**核心规则**：评论 > 时效 > 点赞

**数据格式**：
```javascript
{
  id: 'reddit_xxx',
  title: '标题（已翻译）',
  score: 8,
  type: '🎯',
  source: 'reddit',
  timestamp: 1234567890
}
```

---

**最后更新**：2026-03-13
