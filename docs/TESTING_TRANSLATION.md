# 翻译功能测试指南

## 快速测试方法

### 方法1: 使用 Node.js 测试脚本（推荐）

这是最简单的测试方法，会自动测试多个场景：

```bash
# 1. 确保已配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加小牛翻译配置

# 2. 运行测试脚本
npm run test:niutrans
```

测试脚本会自动测试：
- ✅ 简单中文句子翻译
- ✅ 技术术语翻译
- ✅ 长文本翻译
- ✅ 缓存功能验证
- ✅ 超长文本分块处理

### 方法2: 使用 API 测试（需要运行服务）

#### 步骤1: 启动服务

```bash
npm run dev
```

#### 步骤2: 运行 API 测试

**Linux/Mac:**
```bash
# 编辑脚本，替换 API_KEY
nano scripts/test-translation-api.sh

# 运行测试
bash scripts/test-translation-api.sh
```

**Windows:**
```cmd
REM 编辑脚本，替换 API_KEY
notepad scripts\test-translation-api.bat

REM 运行测试
scripts\test-translation-api.bat
```

### 方法3: 手动 curl 测试

```bash
# 替换 YOUR_API_KEY 为实际的 API Key
curl -X POST "http://localhost:3000/api/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
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
  }'
```

## 环境变量配置

在 `.env` 文件中添加以下配置：

```bash
# 启用翻译功能
TRANSLATION_ENABLED=true

# 选择翻译服务商
TRANSLATION_PROVIDER=niutrans

# 小牛翻译凭据
# NIUTRANS_APP_ID=your_app_id_here
# NIUTRANS_API_KEY=your_api_key_here
NIUTRANS_SOURCE_LANG=zh
NIUTRANS_TARGET_LANG=en

# 缓存配置（可选）
TRANSLATION_CACHE_ENABLED=true
TRANSLATION_CACHE_TTL=86400
```

## 验证翻译是否生效

### 1. 查看日志

```bash
# 实时查看日志
tail -f logs/claude-relay-*.log | grep -i translation

# 查看缓存命中情况
tail -f logs/claude-relay-*.log | grep "cache hit"
```

### 2. 检查翻译效果

发送中文请求后，检查：
- ✅ 请求被正确翻译成英文
- ✅ Claude 返回的响应正常
- ✅ 第二次相同请求速度明显更快（缓存生效）

### 3. 性能指标

- **首次翻译**: 500-2000ms（调用 API）
- **缓存命中**: < 10ms（Redis）或 < 1ms（内存）
- **超长文本**: 每5000字符约500ms

## 常见问题排查

### 问题1: 翻译不生效

**检查清单:**
- [ ] `TRANSLATION_ENABLED=true` 已设置
- [ ] `TRANSLATION_PROVIDER=niutrans` 已设置
- [ ] `NIUTRANS_APP_ID` 和 `NIUTRANS_API_KEY` 正确
- [ ] 服务已重启

**验证方法:**
```bash
# 查看环境变量
node -e "require('dotenv').config(); console.log(process.env.TRANSLATION_ENABLED)"
```

### 问题2: API 调用失败

**可能原因:**
- 小牛翻译账户余额不足
- API Key 错误
- 网络连接问题

**验证方法:**
```bash
# 运行测试脚本查看详细错误
npm run test:niutrans
```

### 问题3: 缓存未生效

**检查清单:**
- [ ] `TRANSLATION_CACHE_ENABLED=true` 已设置
- [ ] Redis 连接正常
- [ ] 文本长度 >= `TRANSLATION_CACHE_MIN_TEXT_LENGTH`

**验证方法:**
```bash
# 检查 Redis 连接
redis-cli ping

# 查看缓存键
redis-cli keys "translate:*"
```

## 测试用例示例

### 测试1: 简单对话
```json
{
  "messages": [
    {
      "role": "user",
      "content": "你好，今天天气怎么样？"
    }
  ]
}
```

### 测试2: 技术问题
```json
{
  "messages": [
    {
      "role": "user",
      "content": "请解释一下什么是 Docker 容器化技术"
    }
  ]
}
```

### 测试3: 代码请求
```json
{
  "messages": [
    {
      "role": "user",
      "content": "请写一个 JavaScript 函数来实现防抖功能"
    }
  ]
}
```

### 测试4: 多轮对话
```json
{
  "messages": [
    {
      "role": "user",
      "content": "什么是机器学习？"
    },
    {
      "role": "assistant",
      "content": "Machine learning is..."
    },
    {
      "role": "user",
      "content": "能举个例子吗？"
    }
  ]
}
```

## 性能测试

### 测试缓存效果

```bash
# 第一次请求（应该较慢）
time curl -X POST "http://localhost:3000/api/v1/messages" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'

# 第二次相同请求（应该很快）
time curl -X POST "http://localhost:3000/api/v1/messages" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'
```

### 测试超长文本

```bash
# 生成超长文本（约10000字符）
npm run test:niutrans
# 查看日志中的 "测试超长文本分块" 部分
```

## 下一步

测试通过后，可以：
1. 集成到生产环境
2. 配置监控和告警
3. 优化缓存策略
4. 添加更多语言支持

详细文档请参考: [NIUTRANS_INTEGRATION.md](./NIUTRANS_INTEGRATION.md)
