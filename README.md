# 信息流监控助手

> Chrome 插件 - 监控 Reddit，AI 分析价值并推送

## 功能特性

- 🔍 **多源监控** - Reddit 信息源
- 🤖 **AI 分析** - 自动判断信息价值（机会/知识/趋势/灵感）
- 📊 **侧边栏面板** - HN 风格信息流，懒加载翻译
- ⭐ **收藏管理** - 收藏有价值的信息
- 🌐 **多语言翻译** - 支持 GLM/DeepSeek API 翻译
- 💾 **数据同步** - 支持 Markdown/JSON 导出导入，Git 同步

## 项目结构

```
info-stream-monitor/
├── manifest.json       # Chrome 扩展配置
├── background.js       # 后台服务（数据抓取、AI 分析、翻译）
├── sidepanel.html/js   # 侧边栏面板
├── config.html/js      # 配置页面
├── favorites.html/js   # 收藏页面
├── data_manager.js     # 数据导入导出工具
├── data/               # 数据存储目录（Git 同步）
│   ├── subreddits.md   # 订阅配置
│   ├── favorites.md    # 收藏数据
│   └── README.md       # 格式说明
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
r/OpenAI OpenAI
```

### 2. 开始监控

1. 选择要监控的源（Reddit）
2. 点击"开始"
3. 信息流会实时显示在侧边栏中

### 3. 收藏有价值的信息

点击信息卡片右侧的 "收藏" 按钮保存到收藏夹。

## 数据同步（Git）

### 导出数据

在配置页面：
1. 点击 "导出配置" → 保存到 `data/subreddits.md`
2. 点击 "导出收藏" → 保存到 `data/favorites.md`
3. 或点击 "全部备份" → 保存为 `data/backup_YYYY-MM-DD.json`

### 同步到 Git

```bash
git add data/
git commit -m "更新订阅配置"
git push
```

### 其他设备恢复

```bash
git pull
# 在配置页面点击"选择文件"导入
```

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

## 许可证

MIT License
