# 信息流监控助手

> Chrome 插件 - 监控金十数据、X/Twitter、Reddit，AI 分析价值并推送

## 功能特性

- 🔍 **多源监控** - 金十数据、X/Twitter、Reddit 三大信息源
- 🤖 **AI 分析** - 自动判断信息价值（机会/知识/趋势/灵感）
- 📊 **实时面板** - 浮动信息流面板，可拖拽、缩放
- 🔔 **智能推送** - 高价值信息立即通知
- ⭐ **收藏管理** - 按来源/日期分类收藏
- 📥 **配置导入** - JSON 格式批量导入配置

## 安装方法

1. 克隆或下载本项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

## 使用方法

### 1. 配置数据源

点击插件图标 → "配置数据源"：

**X/Twitter 配置：**
```
关注博主（每行一个）：
@VitalikButerin
@balajis

关键词（每行一个）：
#airdrop
#RWA
#DeFi
```

**Reddit 配置：**
```
订阅 Subreddit（每行一个）：
r/ethereum
r/cryptocurrency
r/defi
```

**JSON 导入：**
```json
{
  "twitter": {
    "users": ["@VitalikButerin"],
    "keywords": ["#airdrop"]
  },
  "reddit": {
    "subreddits": ["r/ethereum"]
  }
}
```

### 2. 开始监控

1. 选择要监控的源（金十/X/Reddit）
2. 点击"开始监控"
3. 信息流会实时显示在面板中

### 3. 收藏有价值的信息

点击信息卡片右下角的 ⭐ 按钮收藏，自动保存到收藏夹。

### 4. 查看收藏

点击"打开收藏夹"查看所有收藏的信息，按来源和日期分类。

## 文件结构

```
info-stream-monitor/
├── manifest.json       # Chrome 扩展配置
├── background.js       # 后台服务（数据抓取、AI 分析）
├── popup.html/js       # 主界面
├── config.html/js      # 配置页面
├── favorites.html/js   # 收藏页面
├── api/                # 数据源接口
├── utils/              # 工具函数
├── favorites/          # 收藏文件存储
└── icons/              # 图标
```

## 开发计划

- [x] MVP - 金十数据源
- [ ] X/Twitter 数据源
- [ ] Reddit 数据源
- [ ] AI 分析完善
- [ ] 信息流面板
- [ ] 收藏功能优化

## 技术栈

- Vanilla JavaScript
- Chrome Extension Manifest V3
- Chrome Storage API
- Chrome Notifications API

## 注意事项

1. **MVP 阶段** - 目前只实现了金十数据源的基础框架
2. **需要配置** - 使用前需要配置 LLM API 才能进行 AI 分析
3. **API 限制** - Twitter 和 Reddit 需要处理 API 限制

## 许可证

MIT License
