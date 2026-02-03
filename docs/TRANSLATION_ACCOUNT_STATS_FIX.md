# 翻译账户统计修复说明

## 修改目的

修改 `/admin/translation/accounts/:provider` 接口，使其返回的字符数（chars）和调用次数（calls）基于账户配置的周期（day/month）进行统计，而不是显示固定的 `usage` 字段。

## 问题背景

之前的实现存在以下问题：

1. **字符数不准确**: 接口返回账户对象中存储的 `usage` 字段，该字段可能是历史遗留值，不准确
2. **缺少调用次数**: 未返回当前周期的调用次数
3. **周期未显示**: 用户无法知道统计数据对应的周期
4. **性能问题**: 前端需要为每个账户单独查询统计数据，导致大量 API 请求

## 修改内容

### 1. 后端接口修改 (`src/routes/admin/translationAccounts.js`)

**修改前**:
```javascript
// 直接读取账户对象中的 usage 字段
const usage = account.usage ?? 0
account.quotaPct = Math.round((usage / quota) * 100)
```

**修改后**:
```javascript
// 1. 从 translation_quota Redis Hash 中读取当前周期的字符数
const usage = await getQuotaUsage(provider, id, account.period || 'month')

// 2. 从 translation_stats 中读取当前周期的调用次数
let calls = 0
const now = new Date()
if (account.period === 'day') {
  // 按天：只查询今天的数据
  const startDate = now.toISOString().split('T')[0]
  const endDate = startDate
  const stats = await getRangeStats(provider, id, startDate, endDate)
  calls = stats.reduce((sum, day) => sum + (day.calls || 0), 0)
} else {
  // 按月：查询本月的数据
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const startDate = `${year}-${month}-01`
  const endDate = now.toISOString().split('T')[0]
  const stats = await getRangeStats(provider, id, startDate, endDate)
  calls = stats.reduce((sum, day) => sum + (day.calls || 0), 0)
}

// 3. 添加到返回对象
account.usage = usage // 当前周期使用量
account.calls = calls // 当前周期调用次数
account.quotaPct = Math.round((usage / quota) * 100)
```

**数据源说明**:

- **字符数** (`usage`): 从 Redis Hash `translation_quota:${provider}:${accountId}` 读取
  - 按天配置: 读取 key 为今天日期 (`2026-01-17`) 的值
  - 按月配置: 读取 key 为当前年月 (`2026-01`) 的值

- **调用次数** (`calls`): 从 Redis Hash `translation_stats:${provider}:${accountId}:${date}` 累加
  - 按天配置: 只累加今天的数据
  - 按月配置: 累加本月所有天的数据

### 2. 前端页面修改 (`web/admin-spa/src/views/TranslationStatsView.vue`)

**修改前**:
```javascript
// 为每个账户单独请求统计数据（N+1 查询问题）
for (const account of accounts.value[provider]) {
  const statsRes = await apiClient.get('/admin/translation/stats/range', {
    params: { provider, accountId: account.id, startDate, endDate }
  })
  account.stats = statsRes.reduce(/* ... */)
}
```

**修改后**:
```javascript
// 直接使用接口返回的 usage 和 calls 字段
for (const account of accounts.value[provider]) {
  account.stats = {
    chars: account.usage || 0,
    calls: account.calls || 0
  }
}
```

**界面优化**:
- 表头修改: `字符数` → `字符数（当前周期）`
- 表头修改: `调用次数` → `调用次数（当前周期）`
- 新增列: `配额周期` 显示 "按天" 或 "按月"

## 性能优化

### 优化前
- API 请求数: `1 + N × M`（N 个 provider，每个有 M 个账户）
- 示例: 3 个 provider，每个 5 个账户 → `1 + 3 × 5 = 16` 个请求

### 优化后
- API 请求数: `1 + N`（N 个 provider）
- 示例: 3 个 provider → `1 + 3 = 4` 个请求
- **性能提升**: 75% 请求减少（示例场景）

## 数据一致性

修改后的统计数据与限额控制使用相同的数据源（`translation_quota` Redis Hash），确保：

1. **额度使用** 显示的字符数与 **字符数（当前周期）** 一致
2. 当配额用尽时，状态会正确显示为 "限额"
3. 周期重置时（每天 00:00 或每月 1 日），统计数据会正确归零

## Redis 数据结构说明

### 配额数据 (`translation_quota`)
```
Key: translation_quota:niutrans:${accountId}
Type: Hash
Fields:
  - 2026-01-17: 12500    # 按天配置时的字段
  - 2026-01: 350000      # 按月配置时的字段
TTL: 2 天（按天）/ 40 天（按月）
```

### 统计数据 (`translation_stats`)
```
Key: translation_stats:niutrans:${accountId}:2026-01-17
Type: Hash
Fields:
  - chars: 12500         # 当天翻译的总字符数
  - calls: 45            # 当天的总调用次数
TTL: 365 天
```

## 测试验证

### 1. 验证字符数统计

**按天账户**:
```bash
# 1. 检查 Redis 中的配额数据
redis-cli HGET "translation_quota:niutrans:${accountId}" "2026-01-17"

# 2. 检查统计数据
redis-cli HGETALL "translation_stats:niutrans:${accountId}:2026-01-17"

# 3. 调用接口查看返回值
curl http://localhost:3000/admin/translation/accounts/niutrans
```

**按月账户**:
```bash
# 1. 检查 Redis 中的配额数据
redis-cli HGET "translation_quota:niutrans:${accountId}" "2026-01"

# 2. 检查本月所有统计数据
redis-cli KEYS "translation_stats:niutrans:${accountId}:2026-01-*"

# 3. 调用接口查看返回值
curl http://localhost:3000/admin/translation/accounts/niutrans
```

### 2. 验证调用次数统计

执行翻译请求后，验证 `calls` 字段是否正确递增：

```bash
# 执行翻译请求（使用测试脚本）
node scripts/test-translation-api.sh

# 查看统计数据
redis-cli HGETALL "translation_stats:niutrans:${accountId}:2026-01-17"
# 预期输出: chars 和 calls 字段都应该增加
```

### 3. 验证周期切换

**按天账户** - 跨日测试:
1. 记录今天（2026-01-17）的字符数和调用次数
2. 等待到明天（2026-01-18）或手动调整系统时间
3. 验证统计数据是否归零

**按月账户** - 跨月测试:
1. 记录本月（2026-01）的统计数据
2. 切换到下月（2026-02）
3. 验证统计数据是否归零

## 注意事项

1. **历史数据兼容**: 旧账户如果没有 `period` 字段，默认使用 `month`（按月）
2. **Redis 键过期**: 配额数据会自动过期清理，不会无限增长
3. **并发安全**: 使用 `HINCRBY` 原子操作，保证并发场景下的数据准确性
4. **时区问题**: 统计基于服务器本地时间，确保服务器时区正确配置

## 回滚方案

如果出现问题，可以回滚到之前的实现：

```bash
# 1. 恢复旧代码
git checkout HEAD~1 -- src/routes/admin/translationAccounts.js
git checkout HEAD~1 -- web/admin-spa/src/views/TranslationStatsView.vue

# 2. 重启服务
npm restart

# 3. 重新构建前端
cd web/admin-spa && npm run build
```

## 相关文件

- `src/routes/admin/translationAccounts.js` - 账户管理路由
- `src/services/translationQuotaService.js` - 配额管理服务
- `src/services/translationStatsService.js` - 统计数据服务
- `web/admin-spa/src/views/TranslationStatsView.vue` - 前端统计页面
