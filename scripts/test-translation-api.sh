#!/bin/bash

# 小牛翻译 API 测试脚本
# 用法: ./scripts/test-translation-api.sh

# 配置
API_URL="http://localhost:3000"
API_KEY="your_api_key_here"  # 替换为你的 API Key

echo "🧪 测试翻译功能..."
echo ""

# 测试1: 简单中文消息
echo "📝 测试1: 简单中文消息"
curl -X POST "${API_URL}/api/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "你好，请用一句话介绍你自己"
      }
    ]
  }' | jq .

echo ""
echo "---"
echo ""

# 测试2: 技术问题
echo "📝 测试2: 技术问题"
curl -X POST "${API_URL}/api/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 200,
    "messages": [
      {
        "role": "user",
        "content": "请写一个Python函数来计算斐波那契数列"
      }
    ]
  }' | jq .

echo ""
echo "✅ 测试完成"
