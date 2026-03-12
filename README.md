# 信息流监控助手

> Chrome 插件 - 监控金十数据、Reddit，AI 分析价值并推送

## 功能特性

- 🔍 **多源监控** - 金十数据、Reddit 两大信息源
- 🤖 **AI 分析** - 自动判断信息价值（机会/知识/趋势/灵感）
- 📊 **侧边栏面板** - 实时信息流，懒加载翻译
- ⭐ **收藏管理** - 收藏有价值的信息
- 🌐 **多语言翻译** - 支持 GLM/DeepSeek API 翻译
- 🧹 **自动清理** - 每 48 小时清理超过 24 小时的数据

## 项目结构

```
info-stream-monitor/
├── manifest.json       # Chrome 扩展配置
├── background.js       # 后台服务（数据抓取、AI 分析、翻译）
├── sidepanel.html/js   # 侧边栏面板
├── config.html/js      # 配置页面
├── favorites.html/js   # 收藏页面
└── icons/              # 图标
```

## 安装方法

1. 下载本项目
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

## 使用方法

### 1. 配置数据源

点击插件 → "设置"：

**翻译服务：**
- 免费 API（MyMemory）
- GLM API（需要 API Key）
- DeepSeek API（需要 API Key）

**Reddit 配置：**
```
订阅 Subreddit（每行一个）：
r/ethereum 以太坊
r/cryptocurrency 加密货币
r/Anthropic Claude AI
r/OpenAI OpenAI
```

### 2. 开始监控

1. 选择要监控的源（金十/Reddit）
2. 点击"开始"
3. 信息流会实时显示在侧边栏中

### 3. 收藏有价值的信息

点击信息卡片右下角的 "收藏" 按钮保存到收藏夹。

## 技术栈

- Vanilla JavaScript
- Chrome Extension Manifest V3
- Chrome Storage API
- Chrome Side Panel API

## 配置说明

**评分阈值：**
- 面板阈值：5 分（达到此分数才显示）
- 通知阈值：7 分（达到此分数才推送通知）

**存储限制：**
- 最多保存 3000 条数据
- 超过部分从最早删除
- 每 48 小时自动清理超过 24 小时的数据

## 许可证

MIT License
