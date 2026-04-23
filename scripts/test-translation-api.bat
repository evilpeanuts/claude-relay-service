@echo off
REM 小牛翻译 API 测试脚本 (Windows)
REM 用法: scripts\test-translation-api.bat

REM 配置
set API_URL=http://localhost:3000
set API_KEY=your_api_key_here

echo 🧪 测试翻译功能...
echo.

echo 📝 测试1: 简单中文消息
curl -X POST "%API_URL%/api/v1/messages" ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: %API_KEY%" ^
  -H "anthropic-version: 2023-06-01" ^
  -d "{\"model\":\"claude-3-5-sonnet-20241022\",\"max_tokens\":100,\"messages\":[{\"role\":\"user\",\"content\":\"你好，请用一句话介绍你自己\"}]}"

echo.
echo ---
echo.

echo 📝 测试2: 技术问题
curl -X POST "%API_URL%/api/v1/messages" ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: %API_KEY%" ^
  -H "anthropic-version: 2023-06-01" ^
  -d "{\"model\":\"claude-3-5-sonnet-20241022\",\"max_tokens\":200,\"messages\":[{\"role\":\"user\",\"content\":\"请写一个Python函数来计算斐波那契数列\"}]}"

echo.
echo ✅ 测试完成
