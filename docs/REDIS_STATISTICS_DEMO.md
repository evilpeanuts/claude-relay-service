# Redis 统计功能使用示例

本文档展示如何使用 Redis 实现统计功能，基于 claude-relay-service 项目的实际实现。

## 核心概念

### 1. 数据结构选择

Redis 提供多种数据结构，统计功能主要使用：

- **Hash (HSET/HINCRBY)**: 存储结构化计数器，如 `{requests: 100, tokens: 5000}`
- **Sorted Set (ZADD/ZINCRBY)**: 排序统计，如费用排行榜
- **String (INCR/INCRBY)**: 简单计数器
- **List (LPUSH/RPUSH)**: 时间序列数据

### 2. 统计维度

本项目实现了多维度统计：

- **时间维度**: 总计、每日、每月、每小时、每分钟
- **对象维度**: API Key、账户、模型
- **指标维度**: 请求数、Token 数（输入/输出/缓存）、费用

## 实现示例

### 示例 1: 基础计数器（使用 Hash）

```javascript
const Redis = require('ioredis')
const redis = new Redis({
  host: 'localhost',
  port: 6379
})

// 记录 API Key 使用统计
async function recordApiKeyUsage(apiKeyId, inputTokens, outputTokens) {
  const key = `usage:${apiKeyId}`
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const dailyKey = `usage:daily:${apiKeyId}:${today}`

  // 使用 Pipeline 批量执行（性能优化）
  const pipeline = redis.pipeline()

  // 总计统计
  pipeline.hincrby(key, 'totalRequests', 1)
  pipeline.hincrby(key, 'totalInputTokens', inputTokens)
  pipeline.hincrby(key, 'totalOutputTokens', outputTokens)

  // 每日统计
  pipeline.hincrby(dailyKey, 'requests', 1)
  pipeline.hincrby(dailyKey, 'inputTokens', inputTokens)
  pipeline.hincrby(dailyKey, 'outputTokens', outputTokens)

  // 设置过期时间（32天后自动删除）
  pipeline.expire(dailyKey, 86400 * 32)

  await pipeline.exec()
  console.log(`✅ 记录成功: API Key ${apiKeyId}`)
}

// 查询统计数据
async function getApiKeyStats(apiKeyId) {
  const key = `usage:${apiKeyId}`
  const today = new Date().toISOString().split('T')[0]
  const dailyKey = `usage:daily:${apiKeyId}:${today}`

  const [total, daily] = await Promise.all([
    redis.hgetall(key),
    redis.hgetall(dailyKey)
  ])

  return {
    total: {
      requests: parseInt(total.totalRequests) || 0,
      inputTokens: parseInt(total.totalInputTokens) || 0,
      outputTokens: parseInt(total.totalOutputTokens) || 0
    },
    today: {
      requests: parseInt(daily.requests) || 0,
      inputTokens: parseInt(daily.inputTokens) || 0,
      outputTokens: parseInt(daily.outputTokens) || 0
    }
  }
}

// 使用示例
async function demo1() {
  const apiKeyId = 'key_123'

  // 记录3次请求
  await recordApiKeyUsage(apiKeyId, 1000, 500)
  await recordApiKeyUsage(apiKeyId, 2000, 800)
  await recordApiKeyUsage(apiKeyId, 1500, 600)

  // 查询统计
  const stats = await getApiKeyStats(apiKeyId)
  console.log('统计结果:', JSON.stringify(stats, null, 2))
  /*
  输出:
  {
    "total": {
      "requests": 3,
      "inputTokens": 4500,
      "outputTokens": 1900
    },
    "today": {
      "requests": 3,
      "inputTokens": 4500,
      "outputTokens": 1900
    }
  }
  */
}
```

### 示例 2: 多维度统计（按模型分类）

```javascript
// 记录按模型分类的统计
async function recordModelUsage(apiKeyId, model, inputTokens, outputTokens) {
  const today = new Date().toISOString().split('T')[0]

  // API Key + 模型 + 日期
  const keyModelDaily = `usage:${apiKeyId}:model:daily:${model}:${today}`

  // 全局模型统计
  const modelDaily = `usage:model:daily:${model}:${today}`

  const pipeline = redis.pipeline()

  // API Key 级别的模型统计
  pipeline.hincrby(keyModelDaily, 'requests', 1)
  pipeline.hincrby(keyModelDaily, 'inputTokens', inputTokens)
  pipeline.hincrby(keyModelDaily, 'outputTokens', outputTokens)
  pipeline.expire(keyModelDaily, 86400 * 32)

  // 全局模型统计
  pipeline.hincrby(modelDaily, 'requests', 1)
  pipeline.hincrby(modelDaily, 'inputTokens', inputTokens)
  pipeline.hincrby(modelDaily, 'outputTokens', outputTokens)
  pipeline.expire(modelDaily, 86400 * 32)

  await pipeline.exec()
}

// 查询某个 API Key 使用了哪些模型
async function getApiKeyModelStats(apiKeyId) {
  const today = new Date().toISOString().split('T')[0]
  const pattern = `usage:${apiKeyId}:model:daily:*:${today}`

  const keys = await redis.keys(pattern)
  const stats = []

  for (const key of keys) {
    // 从 key 中提取模型名: usage:{keyId}:model:daily:{model}:{date}
    const match = key.match(/usage:[^:]+:model:daily:([^:]+):/)
    if (match) {
      const model = match[1]
      const data = await redis.hgetall(key)
      stats.push({
        model,
        requests: parseInt(data.requests) || 0,
        inputTokens: parseInt(data.inputTokens) || 0,
        outputTokens: parseInt(data.outputTokens) || 0
      })
    }
  }

  return stats
}

// 使用示例
async function demo2() {
  const apiKeyId = 'key_123'

  // 记录不同模型的使用
  await recordModelUsage(apiKeyId, 'claude-3-5-sonnet', 1000, 500)
  await recordModelUsage(apiKeyId, 'claude-3-5-sonnet', 2000, 800)
  await recordModelUsage(apiKeyId, 'claude-3-opus', 3000, 1200)

  // 查询统计
  const stats = await getApiKeyModelStats(apiKeyId)
  console.log('模型统计:', JSON.stringify(stats, null, 2))
  /*
  输出:
  [
    {
      "model": "claude-3-5-sonnet",
      "requests": 2,
      "inputTokens": 3000,
      "outputTokens": 1300
    },
    {
      "model": "claude-3-opus",
      "requests": 1,
      "inputTokens": 3000,
      "outputTokens": 1200
    }
  ]
  */
}
```

### 示例 3: 费用统计（使用 String + Hash）

```javascript
// 记录费用
async function recordCost(apiKeyId, cost) {
  const today = new Date().toISOString().split('T')[0]
  const dailyCostKey = `cost:daily:${apiKeyId}:${today}`
  const totalCostKey = `cost:total:${apiKeyId}`

  const pipeline = redis.pipeline()

  // 每日费用（使用 String 类型，INCRBYFLOAT 支持浮点数）
  pipeline.incrbyfloat(dailyCostKey, cost)
  pipeline.expire(dailyCostKey, 86400 * 32)

  // 总费用
  pipeline.incrbyfloat(totalCostKey, cost)

  await pipeline.exec()
}

// 查询费用
async function getCostStats(apiKeyId) {
  const today = new Date().toISOString().split('T')[0]
  const dailyCostKey = `cost:daily:${apiKeyId}:${today}`
  const totalCostKey = `cost:total:${apiKeyId}`

  const [dailyCost, totalCost] = await Promise.all([
    redis.get(dailyCostKey),
    redis.get(totalCostKey)
  ])

  return {
    dailyCost: parseFloat(dailyCost) || 0,
    totalCost: parseFloat(totalCost) || 0
  }
}

// 使用示例
async function demo3() {
  const apiKeyId = 'key_123'

  // 记录费用
  await recordCost(apiKeyId, 0.05)
  await recordCost(apiKeyId, 0.12)
  await recordCost(apiKeyId, 0.08)

  // 查询统计
  const stats = await getCostStats(apiKeyId)
  console.log('费用统计:', stats)
  /*
  输出:
  {
    dailyCost: 0.25,
    totalCost: 0.25
  }
  */
}
```

### 示例 4: 速率限制（时间窗口计数）

```javascript
// 速率限制：每分钟最多 10 个请求
async function checkRateLimit(apiKeyId, maxRequests = 10, windowSeconds = 60) {
  const now = Date.now()
  const windowStart = now - windowSeconds * 1000

  const key = `rate_limit:${apiKeyId}`

  // 使用 Sorted Set 存储请求时间戳
  const pipeline = redis.pipeline()

  // 1. 删除窗口外的旧数据
  pipeline.zremrangebyscore(key, 0, windowStart)

  // 2. 添加当前请求
  pipeline.zadd(key, now, `${now}-${Math.random()}`)

  // 3. 统计窗口内的请求数
  pipeline.zcard(key)

  // 4. 设置过期时间
  pipeline.expire(key, windowSeconds * 2)

  const results = await pipeline.exec()
  const count = results[2][1] // zcard 的结果

  if (count > maxRequests) {
    throw new Error(`速率限制: 每${windowSeconds}秒最多${maxRequests}个请求`)
  }

  return {
    allowed: true,
    count,
    remaining: maxRequests - count
  }
}

// 使用示例
async function demo4() {
  const apiKeyId = 'key_123'

  try {
    // 模拟 12 个请求
    for (let i = 0; i < 12; i++) {
      const result = await checkRateLimit(apiKeyId, 10, 60)
      console.log(`请求 ${i + 1}: 允许, 剩余 ${result.remaining}`)
    }
  } catch (error) {
    console.error('❌', error.message)
  }
  /*
  输出:
  请求 1: 允许, 剩余 9
  请求 2: 允许, 剩余 8
  ...
  请求 10: 允许, 剩余 0
  ❌ 速率限制: 每60秒最多10个请求
  */
}
```

### 示例 5: 实时指标（滑动窗口）

```javascript
// 记录系统级实时指标（每分钟）
async function recordSystemMetrics(requests, tokens) {
  const minuteTimestamp = Math.floor(Date.now() / 60000)
  const key = `system:metrics:minute:${minuteTimestamp}`

  const pipeline = redis.pipeline()
  pipeline.hincrby(key, 'requests', requests)
  pipeline.hincrby(key, 'tokens', tokens)

  // 保留 5 分钟的数据（可配置）
  pipeline.expire(key, 5 * 60)

  await pipeline.exec()
}

// 获取最近 N 分钟的指标
async function getRecentMetrics(minutes = 5) {
  const now = Date.now()
  const keys = []

  for (let i = 0; i < minutes; i++) {
    const minuteTimestamp = Math.floor((now - i * 60000) / 60000)
    keys.push(`system:metrics:minute:${minuteTimestamp}`)
  }

  const pipeline = redis.pipeline()
  keys.forEach(key => pipeline.hgetall(key))

  const results = await pipeline.exec()

  let totalRequests = 0
  let totalTokens = 0

  results.forEach(([err, data]) => {
    if (!err && data) {
      totalRequests += parseInt(data.requests) || 0
      totalTokens += parseInt(data.tokens) || 0
    }
  })

  return {
    window: `${minutes} 分钟`,
    totalRequests,
    totalTokens,
    avgRequestsPerMinute: (totalRequests / minutes).toFixed(2),
    avgTokensPerMinute: (totalTokens / minutes).toFixed(2)
  }
}

// 使用示例
async function demo5() {
  // 模拟记录 5 分钟的数据
  for (let i = 0; i < 5; i++) {
    await recordSystemMetrics(100, 50000)
    console.log(`记录第 ${i + 1} 分钟的指标`)
  }

  // 查询最近 5 分钟的指标
  const metrics = await getRecentMetrics(5)
  console.log('实时指标:', JSON.stringify(metrics, null, 2))
  /*
  输出:
  {
    "window": "5 分钟",
    "totalRequests": 500,
    "totalTokens": 250000,
    "avgRequestsPerMinute": "100.00",
    "avgTokensPerMinute": "50000.00"
  }
  */
}
```

### 示例 6: 排行榜（Sorted Set）

```javascript
// 费用排行榜
async function updateCostRanking(apiKeyId, totalCost) {
  const key = 'ranking:cost:total'

  // 使用 ZADD 更新分数（费用）
  await redis.zadd(key, totalCost, apiKeyId)
}

// 获取费用 Top N
async function getTopCostKeys(limit = 10) {
  const key = 'ranking:cost:total'

  // ZREVRANGE 获取分数最高的成员（降序）
  const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES')

  const ranking = []
  for (let i = 0; i < results.length; i += 2) {
    ranking.push({
      apiKeyId: results[i],
      totalCost: parseFloat(results[i + 1])
    })
  }

  return ranking
}

// 使用示例
async function demo6() {
  // 更新多个 API Key 的费用
  await updateCostRanking('key_001', 125.50)
  await updateCostRanking('key_002', 89.30)
  await updateCostRanking('key_003', 210.75)
  await updateCostRanking('key_004', 45.20)
  await updateCostRanking('key_005', 178.90)

  // 获取 Top 3
  const top3 = await getTopCostKeys(3)
  console.log('费用 Top 3:', JSON.stringify(top3, null, 2))
  /*
  输出:
  [
    { "apiKeyId": "key_003", "totalCost": 210.75 },
    { "apiKeyId": "key_005", "totalCost": 178.9 },
    { "apiKeyId": "key_001", "totalCost": 125.5 }
  ]
  */
}
```

## 性能优化技巧

### 1. 使用 Pipeline 批量操作

```javascript
// ❌ 不好的做法：多次网络往返
await redis.hincrby(key, 'field1', 1)
await redis.hincrby(key, 'field2', 2)
await redis.hincrby(key, 'field3', 3)

// ✅ 好的做法：使用 Pipeline
const pipeline = redis.pipeline()
pipeline.hincrby(key, 'field1', 1)
pipeline.hincrby(key, 'field2', 2)
pipeline.hincrby(key, 'field3', 3)
await pipeline.exec()
```

### 2. 设置合理的过期时间

```javascript
// 每日数据保留 32 天
await redis.expire(dailyKey, 86400 * 32)

// 每小时数据保留 7 天
await redis.expire(hourlyKey, 86400 * 7)

// 实时指标保留 5 分钟
await redis.expire(metricsKey, 5 * 60)
```

### 3. 使用 SCAN 代替 KEYS

```javascript
// ❌ 不好的做法：KEYS 会阻塞 Redis
const keys = await redis.keys('usage:*')

// ✅ 好的做法：使用 SCAN 迭代
let cursor = '0'
const keys = []
do {
  const [newCursor, batch] = await redis.scan(cursor, 'MATCH', 'usage:*', 'COUNT', 100)
  cursor = newCursor
  keys.push(...batch)
} while (cursor !== '0')
```

### 4. 批量获取数据

```javascript
// ❌ 不好的做法：循环查询
const stats = []
for (const keyId of keyIds) {
  const data = await redis.hgetall(`usage:${keyId}`)
  stats.push(data)
}

// ✅ 好的做法：使用 Pipeline
const pipeline = redis.pipeline()
keyIds.forEach(keyId => pipeline.hgetall(`usage:${keyId}`))
const results = await pipeline.exec()
const stats = results.map(([err, data]) => data)
```

## 完整运行示例

```javascript
// 运行所有示例
async function runAllDemos() {
  console.log('=== 示例 1: 基础计数器 ===')
  await demo1()

  console.log('\n=== 示例 2: 多维度统计 ===')
  await demo2()

  console.log('\n=== 示例 3: 费用统计 ===')
  await demo3()

  console.log('\n=== 示例 4: 速率限制 ===')
  await demo4()

  console.log('\n=== 示例 5: 实时指标 ===')
  await demo5()

  console.log('\n=== 示例 6: 排行榜 ===')
  await demo6()

  // 关闭连接
  await redis.quit()
}

// 执行
runAllDemos().catch(console.error)
```

## 关键要点总结

1. **选择合适的数据结构**
   - Hash: 结构化计数器（多字段）
   - String: 简单计数器（单值）
   - Sorted Set: 排序、排行榜、时间窗口
   - List: 时间序列、历史记录

2. **多维度统计**
   - 时间维度：总计、日、月、小时、分钟
   - 对象维度：用户、API Key、账户、模型
   - 指标维度：请求数、Token、费用

3. **性能优化**
   - 使用 Pipeline 批量操作
   - 设置合理的过期时间
   - 使用 SCAN 代替 KEYS
   - 批量获取数据

4. **数据一致性**
   - 使用 Pipeline 保证原子性
   - 合理设置过期时间避免数据泄漏
   - 定期清理过期数据

5. **可扩展性**
   - 键名设计要有层次结构
   - 支持按不同维度查询
   - 预留扩展字段

## 参考资料

- [Redis 官方文档](https://redis.io/docs/)
- [ioredis 客户端文档](https://github.com/redis/ioredis)
- 项目源码: `src/models/redis.js`, `src/services/apiKeyService.js`
