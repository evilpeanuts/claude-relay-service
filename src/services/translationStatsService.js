const redisClient = require('../models/redis')

async function recordTranslation(provider, accountId, charCount) {
  const date = new Date().toISOString().split('T')[0]
  const key = `translation_stats:${provider}:${accountId}:${date}`
  const client = redisClient.getClientSafe()
  const pipeline = client.pipeline()
  pipeline.hincrby(key, 'chars', charCount)
  pipeline.hincrby(key, 'calls', 1)
  pipeline.expire(key, 86400 * 365) // 365天过期
  await pipeline.exec()
}

async function getRangeStats(provider, accountId, startDate, endDate) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const stats = []

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().split('T')[0]
    const pattern = accountId
      ? `translation_stats:${provider}:${accountId}:${date}`
      : provider
        ? `translation_stats:${provider}:*:${date}`
        : `translation_stats:*:*:${date}`

    const keys = await redisClient.keys(pattern)
    let dayChars = 0
    let dayCalls = 0

    for (const key of keys) {
      const data = await redisClient.getClient().hgetall(key)
      dayChars += parseInt(data.chars || 0)
      dayCalls += parseInt(data.calls || 0)
    }

    stats.push({ date, chars: dayChars, calls: dayCalls })
  }

  return stats
}

module.exports = { recordTranslation, getRangeStats }
