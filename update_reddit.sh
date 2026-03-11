#!/bin/bash
# Reddit 真实数据集成脚本

echo "开始集成 Reddit 真实数据抓取..."

# 备份原文件
cp background.js background.js.backup2
echo "已备份到 background.js.backup2"

# 提示用户手动添加代码
echo ""
echo "============================================="
echo "请手动完成以下步骤："
echo "============================================="
echo ""
echo "1. 打开 background.js"
echo ""
echo "2. 在第 50 行附近添加："
echo "   const redditProcessedIds = new Set();"
echo ""
echo "3. 找到 fetchRedditData 函数（大约 338 行），完全替换为 REDDIT_CODE.txt 中的内容"
echo ""
echo "4. 在 fetchTwitterData 函数后面添加以下函数："
echo ""
echo "function classifyRedditPost(post) { ... }"
echo "function calculateRedditScore(post) { ... }"
echo "function extractRedditValue(post) { ... }"
echo ""
echo "5. 找到 startRedditMonitoring 函数，替换为 REDDIT_CODE.txt 中的版本"
echo ""
echo "============================================="
echo ""
echo "或者直接复制 REDDIT_CODE.txt 中的所有代码，添加到 background.js"
echo ""
