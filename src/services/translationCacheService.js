const crypto = require('crypto')
const config = require('../../config/config')
const logger = require('../utils/logger')
const redis = require('../models/redis')

class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null
    }
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(key, value)
  }

  clear() {
    this.cache.clear()
  }
}

const memoryCache = new LRUCache(config.translation.cache.maxMemorySize)

function generateCacheKey(text, provider, sourceLang, targetLang) {
  const hash = crypto.createHash('md5').update(text).digest('hex')
  return `translate:${provider}:${sourceLang}:${targetLang}:${hash}`
}

async function getCachedTranslation(text, provider, sourceLang, targetLang) {
  if (!config.translation.cache.enabled) {
    return null
  }
  if (text.length < config.translation.cache.minTextLength) {
    return null
  }

  const cacheKey = generateCacheKey(text, provider, sourceLang, targetLang)

  // 1. 检查当前供应商的内存缓存
  const memCached = memoryCache.get(cacheKey)
  if (memCached) {
    logger.debug(`Translation cache hit (memory): ${cacheKey}`)
    return memCached
  }

  // 2. 检查当前供应商的 Redis 缓存
  try {
    const redisCached = await redis.get(cacheKey)
    if (redisCached) {
      logger.debug(`Translation cache hit (redis): ${cacheKey}`)
      memoryCache.set(cacheKey, redisCached)
      return redisCached
    }
  } catch (error) {
    logger.error('Redis cache read error:', error)
  }

  // 3. 跨供应商查找（如果启用）
  if (config.translation.cache.crossProvider) {
    const providers = ['niutrans', 'deepl', 'tencent'] // 支持的供应商列表
    for (const otherProvider of providers) {
      if (otherProvider === provider) {
        continue
      }

      const fallbackKey = generateCacheKey(text, otherProvider, sourceLang, targetLang)
      try {
        const fallbackCached = await redis.get(fallbackKey)
        if (fallbackCached) {
          logger.debug(`Translation cache hit (cross-provider): ${otherProvider} -> ${provider}`)
          // 直接返回，不复制（节省存储空间）
          memoryCache.set(cacheKey, fallbackCached) // 只缓存到内存
          return fallbackCached
        }
      } catch (error) {
        logger.error('Cross-provider cache read error:', error)
      }
    }
  }

  return null
}

async function setCachedTranslation(text, translatedText, provider, sourceLang, targetLang) {
  if (!config.translation.cache.enabled) {
    return
  }
  if (text.length < config.translation.cache.minTextLength) {
    return
  }

  const cacheKey = generateCacheKey(text, provider, sourceLang, targetLang)

  memoryCache.set(cacheKey, translatedText)

  try {
    await redis.setex(cacheKey, config.translation.cache.ttl, translatedText)
    logger.debug(`Translation cached: ${cacheKey}`)
  } catch (error) {
    logger.error('Redis cache write error:', error)
  }
}

async function clearCache(provider = null) {
  memoryCache.clear()

  try {
    const pattern = provider ? `translate:${provider}:*` : 'translate:*'
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
      logger.info(`Cleared ${keys.length} translation cache entries`)
    }
  } catch (error) {
    logger.error('Clear cache error:', error)
  }
}

module.exports = {
  getCachedTranslation,
  setCachedTranslation,
  clearCache
}
