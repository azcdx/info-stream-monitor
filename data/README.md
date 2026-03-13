# 数据存储目录

此目录用于存储订阅配置和收藏数据，可通过 git 同步。

## 文件说明

| 文件 | 说明 | 格式 |
|------|------|------|
| `subreddits.md` | Reddit 订阅列表 | Markdown 表格 |
| `favorites.md` | 收藏内容 | Markdown |
| `backup_YYYY-MM-DD.json` | 完整备份 | JSON |

## 使用方法

### 1. 导出数据
在配置页面点击导出按钮，文件会下载到本地，然后手动移动到 `data/` 目录。

### 2. 提交到 Git
```bash
git add data/
git commit -m "更新订阅配置"
git push
```

### 3. 其他设备同步
```bash
git pull
# 然后在配置页面点击"从文件加载"导入
```

## 格式说明

### subreddits.md 格式
```markdown
| 序号 | Subreddit |
|------|-----------|
| 1 | `r/ethereum` |
| 2 | `r/cryptocurrency` |
```

### JSON 格式（完整备份）
```json
{
  "exportDate": "2026-03-13",
  "config": {
    "reddit": {
      "subreddits": ["r/ethereum", "r/cryptocurrency"]
    }
  },
  "favorites": [
    {
      "id": "reddit_xxx",
      "title": "帖子标题",
      "url": "https://...",
      "score": 8
    }
  ]
}
```
