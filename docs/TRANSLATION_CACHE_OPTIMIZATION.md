# 翻译优化方案：片段级缓存

## 问题

原始实现中，分割后的中文片段（用 `\n` 连接）会被整体缓存：
- ❌ 不同组合无法复用缓存
- ❌ 例如："你好\n世界" 和 "你好\n测试" 无法共享 "你好" 的翻译

## 优化方案

### 1. 片段级缓存

**原理：** 对每个中文片段单独缓存，而不是缓存整个批量文本。

**示例：**

```javascript
// 原文本
const text = "Please write a function 来计算斐波那契数列 in Python"

// 提取中文片段
segments = ["来计算斐波那契数列"]

// 片段级缓存
cache["来计算斐波那契数列"] = "to calculate Fibonacci sequence"

// 下次遇到相同片段，直接命中缓存
const text2 = "如何 来计算斐波那契数列 using recursion"
// "来计算斐波那契数列" 直接从缓存获取，无需调用 API
```

### 2. 工作流程

```
原文本
  ↓
提取中文片段 ["片段1", "片段2", "片段3"]
  ↓
逐个检查缓存
  ├─ 片段1: 缓存命中 ✅
  ├─ 片段2: 缓存未命中 ❌
  └─ 片段3: 缓存命中 ✅
  ↓
批量翻译未命中的片段 ["片段2"]
  ↓
缓存新翻译的片段
  ↓
回填所有翻译结果
  ↓
返回完整翻译文本
```

### 3. 代码实现

```javascript
// src/utils/textSegmenter.js
async function smartTranslate(text, translateFn, cacheService) {
  const segments = extractChineseSegments(text)
  const translations = []
  const needTranslate = []

  // 逐个检查缓存
  for (let i = 0; i < segments.length; i++) {
    const cached = await cacheService.get(segments[i].segment)
    if (cached) {
      translations[i] = cached // 缓存命中
    } else {
      needTranslate.push(i) // 需要翻译
    }
  }

  // 批量翻译未缓存的片段
  if (needTranslate.length > 0) {
    const batchText = needTranslate.map((i) => segments[i].segment).join('\n')
    const translatedBatch = await translateFn(batchText)
    const translatedArray = translatedBatch.split('\n')

    // 缓存单个片段
    for (let j = 0; j < needTranslate.length; j++) {
      const i = needTranslate[j]
      translations[i] = translatedArray[j]
      await cacheService.set(segments[i].segment, translatedArray[j])
    }
  }

  return replaceSegmentsWithTranslationArray(text, segments, translations)
}
```

## 优化效果

### 成本节省

| 场景 | 原方案 | 优化方案 | 节省 |
|------|--------|----------|------|
| 混合文本 | 翻译全文 | 只翻译中文 | 50-80% |
| 重复片段 | 每次翻译 | 缓存复用 | 90%+ |
| 系统提示词 | 每次翻译 | 首次后缓存 | 99%+ |

### 示例对比

**场景1: 混合文本**
```
原文: "Please write a function 来计算斐波那契数列 in Python"
- 原方案: 翻译 52 字符
- 优化方案: 翻译 9 字符（只翻译中文）
- 节省: 82.7%
```

**场景2: 重复片段**
```
请求1: "请写一个 Python 函数"
请求2: "请写一个 JavaScript 函数"
- 原方案: 翻译 2 次
- 优化方案: "请写一个" 缓存复用，只翻译 1 次
- 节省: 50%
```

**场景3: 系统提示词**
```
每次请求都包含相同的系统提示词（如 "你是一个AI助手"）
- 原方案: 每次翻译
- 优化方案: 首次翻译后永久缓存
- 节省: 99%+
```

## 缓存策略

### Redis 缓存键格式

```
translate:{provider}:{sourceLang}:{targetLang}:{md5(segment)}
```

**示例：**
```
translate:niutrans:zh:en:5d41402abc4b2a76b9719d911017c592
```

### 缓存配置

```bash
# .env
TRANSLATION_CACHE_ENABLED=true
TRANSLATION_CACHE_TTL=86400  # 24小时
TRANSLATION_CACHE_MAX_MEMORY_SIZE=100  # LRU内存缓存100条
TRANSLATION_CACHE_MIN_TEXT_LENGTH=2  # 最小缓存长度2字符
```

## 性能指标

### 响应时间

| 操作 | 时间 |
|------|------|
| 内存缓存命中 | < 1ms |
| Redis 缓存命中 | < 10ms |
| API 调用 | 500-2000ms |

### 缓存命中率

| 场景 | 预期命中率 |
|------|-----------|
| 系统提示词 | 99%+ |
| 常用短语 | 80-90% |
| 技术术语 | 70-80% |
| 随机文本 | 20-30% |

## 监控和调试

### 查看缓存统计

```bash
# 查看缓存键
redis-cli keys "translate:*"

# 查看缓存命中日志
tail -f logs/claude-relay-*.log | grep "cache hit"
```

### 测试缓存效果

```bash
# 运行测试脚本
npm run test:text-segmenter

# 查看成本节省估算
```

## 注意事项

1. **片段粒度**: 当前按标点符号分割，可根据需要调整
2. **缓存失效**: 修改翻译配置后需清理缓存
3. **内存占用**: LRU 缓存限制大小，避免内存溢出
4. **并发安全**: Redis 操作原子性保证并发安全

## 后续优化

1. **智能分片**: 根据语义而非标点分割
2. **预热缓存**: 启动时加载常用翻译
3. **缓存预测**: 预测可能需要的翻译并提前缓存
4. **压缩存储**: 对长文本翻译结果压缩存储
