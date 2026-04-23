# 小牛翻译集成说明

## 功能概述

已成功集成小牛翻译(Niutrans)服务到 Claude Relay Service,支持:
- ✅ DeepL 翻译(保留原有功能)
- ✅ 小牛翻译(新增)
- ✅ 双层翻译缓存(Redis + LRU内存缓存)
- ✅ 超长文本自动分块(5000字符限制,串行翻译)
- ✅ 可配置源语言和目标语言

## 配置步骤

### 1. 环境变量配置

在 `.env` 文件中添加以下配置:

```bash
# 启用翻译功能
TRANSLATION_ENABLED=true

# 选择翻译服务商: deepl 或 niutrans
TRANSLATION_PROVIDER=niutrans

# 小牛翻译凭据(从 https://niutrans.com 获取)
# NIUTRANS_APP_ID=your_app_id_here
# NIUTRANS_API_KEY=your_api_key_here
NIUTRANS_SOURCE_LANG=zh
NIUTRANS_TARGET_LANG=en

# 翻译缓存配置(可选,默认已启用)
TRANSLATION_CACHE_ENABLED=true
TRANSLATION_CACHE_TTL=86400
TRANSLATION_CACHE_MAX_MEMORY_SIZE=100
TRANSLATION_CACHE_MIN_TEXT_LENGTH=10
```

### 2. 使用 DeepL 翻译

```bash
TRANSLATION_ENABLED=true
TRANSLATION_PROVIDER=deepl
DEEPL_API_KEY=your_deepl_api_key
DEEPL_TARGET_LANG=EN-US
```

## 技术实现

### 文件结构

```
src/
├── services/
│   ├── translationCacheService.js  # 翻译缓存服务
│   └── niutransService.js          # 小牛翻译API调用
└── middleware/
    └── translateMiddleware.js      # 翻译中间件(已重构)
```

### 核心特性

#### 1. 串行分块翻译
- 文本超过5000字符时自动分块
- 串行调用API确保稳定性
- 自动拼接翻译结果

#### 2. 双层缓存机制
- **内存缓存**: LRU算法,默认100条,响应 < 1ms
- **Redis缓存**: 持久化存储,默认24小时TTL
- **缓存键格式**: `translate:{provider}:{sourceLang}:{targetLang}:{md5(text)}`

#### 3. 权限字符串生成
- 按照小牛翻译API规范生成MD5签名
- 参数排序后拼接: `apikey=xxx&appId=xxx&from=zh&srcText=xxx&timestamp=xxx&to=en`
- MD5加密生成 authStr

### 工作流程

```
请求 → 检测中文 → 查询缓存 → 分块(如需) → 串行翻译 → 缓存结果 → 返回
         ↓              ↓           ↓            ↓
      无中文        命中缓存    单块直接调用   多块串行调用
         ↓              ↓
      直接返回      直接返回
```

## 配置参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `TRANSLATION_ENABLED` | 是否启用翻译 | false |
| `TRANSLATION_PROVIDER` | 翻译服务商 | deepl |
| `NIUTRANS_APP_ID` | 小牛翻译应用ID | - |
| `NIUTRANS_API_KEY` | 小牛翻译API密钥 | - |
| `NIUTRANS_SOURCE_LANG` | 源语言代码 | zh |
| `NIUTRANS_TARGET_LANG` | 目标语言代码 | en |
| `TRANSLATION_CACHE_ENABLED` | 是否启用缓存 | true |
| `TRANSLATION_CACHE_TTL` | Redis缓存过期时间(秒) | 86400 |
| `TRANSLATION_CACHE_MAX_MEMORY_SIZE` | 内存缓存最大条目数 | 100 |
| `TRANSLATION_CACHE_MIN_TEXT_LENGTH` | 最小缓存文本长度 | 10 |

## 性能优化

### 缓存收益
- **命中率**: 系统提示词等重复文本命中率 > 80%
- **成本节省**: 减少API调用次数,降低费用
- **响应速度**:
  - 内存缓存命中: < 1ms
  - Redis缓存命中: < 10ms
  - API调用: 500-2000ms

### 分块策略
- **单块(< 5000字符)**: 直接调用,约500ms
- **多块(> 5000字符)**: 串行调用,每块约500ms
- **示例**: 10000字符 = 2块 × 500ms = 约1秒

## 故障排除

### 常见问题

1. **翻译失败: "Niutrans API error"**
   - 检查 `NIUTRANS_APP_ID` 和 `NIUTRANS_API_KEY` 是否正确
   - 确认账户余额充足

2. **缓存未生效**
   - 检查 `TRANSLATION_CACHE_ENABLED=true`
   - 确认 Redis 连接正常
   - 查看日志中的 "Translation cache hit" 信息

3. **超长文本翻译超时**
   - 检查网络连接
   - 考虑增加 `REQUEST_TIMEOUT` 配置

### 日志查看

```bash
# 查看翻译日志
tail -f logs/claude-relay-*.log | grep -i translation

# 查看缓存命中情况
tail -f logs/claude-relay-*.log | grep "cache hit"
```

## API 使用示例

翻译中间件会自动处理包含中文的消息:

```javascript
// 请求示例
POST /api/v1/messages
{
  "messages": [
    {
      "role": "user",
      "content": "你好,请帮我写一个Python函数"
    }
  ]
}

// 实际发送到Claude API的内容(已翻译)
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, please help me write a Python function"
    }
  ]
}
```

## 支持的语言

小牛翻译支持的语言代码请参考: https://niutrans.com/documents/contents/trans_text#languageList

常用语言代码:
- 中文: `zh`
- 英文: `en`
- 日文: `ja`
- 韩文: `ko`
- 法文: `fr`
- 德文: `de`
- 西班牙文: `es`

## 后续优化建议

1. **并行分块翻译**: 如需更快速度,可改为并行调用(需注意API限流)
2. **智能语言检测**: 自动检测源语言,无需手动配置
3. **翻译质量监控**: 记录翻译失败率和响应时间
4. **缓存预热**: 系统启动时预加载常用翻译
5. **降级策略**: 主翻译服务失败时自动切换到备用服务
