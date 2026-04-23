const axios = require('axios')
const crypto = require('crypto')
const logger = require('../utils/logger')
// const { setCachedTranslation } = require('./translationCacheService')
const {
  checkQuota,
  checkRps,
  resetAccountErrors,
  incrQuotaUsage,
  updateAccountError
} = require('./translationQuotaService')
const { recordTranslation } = require('./translationStatsService')
const redis = require('../models/redis')

const NIUTRANS_API_URL = 'https://api.niutrans.com/v2/text/translate'
const MAX_TEXT_LENGTH = 5000

// 硬编码语言配置
const SOURCE_LANG = 'zh'
const TARGET_LANG = 'en'

function generateAuthStr(params) {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')

  return crypto.createHash('md5').update(sortedParams).digest('hex')
}

function splitText(text, maxLength = MAX_TEXT_LENGTH) {
  const chunks = []
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength))
  }
  return chunks
}

async function translateWithNiutrans(text, accountId = null, sourceLang = null, targetLang = null) {
  const from = sourceLang || SOURCE_LANG
  const to = targetLang || TARGET_LANG

  // 获取账户凭据（只从 Redis 获取）
  if (!accountId) {
    throw new Error('Account ID is required')
  }

  const accountData = await redis.get(`translation_account:niutrans:${accountId}`)
  const account = JSON.parse(accountData || '{}')
  const { appId, apiKey } = account

  if (!appId || !apiKey) {
    throw new Error('Niutrans credentials not found')
  }

  // Wrap in try-catch with quota/RPS/error handling
  try {
    await checkQuota('niutrans', accountId, text.length)
    await checkRps('niutrans', accountId, account.rateLimit || 10)

    const chunks = splitText(text)
    const results = []

    for (const chunk of chunks) {
      const timestamp = Date.now().toString()
      const params = {
        apikey: apiKey,
        appId,
        from,
        to,
        srcText: chunk,
        timestamp
      }

      const authStr = generateAuthStr(params)
      delete params.apikey

      const response = await axios.post(
        NIUTRANS_API_URL,
        new URLSearchParams({
          ...params,
          authStr
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 150000
        }
      )

      if (response.data.errorCode) {
        if (response.data.errorCode === 10003) {
          // 配额超限或余额不足，更新账户状态为限额
          const accountKey = `translation_account:niutrans:${accountId}`
          const accountCache = await redis.get(accountKey)
          if (accountCache) {
            const accountInfo = JSON.parse(accountCache)
            accountInfo.enabled = false
            accountInfo.status = 0 // STATUS_QUOTA_EXCEEDED
            accountInfo.disabledReason = '配额超限或余额不足'
            await redis.set(accountKey, JSON.stringify(accountInfo))
            logger.warn(`Niutrans account ${accountId} status set to quota exceeded (10003)`)
          }
          throw new Error(`Niutrans quota exceeded: ${response.data.errorMsg || 'No message'}`)
        }
        throw new Error(
          `Niutrans API errorCode: ${response.data.errorCode || 'Unknown error'} , ${response.data.errorMsg || 'No message'}`
        )
      }
      results.push(response.data.tgtText)
      logger.debug(`Niutrans translation chunk successful: ${chunk.length} chars`)
    }

    const translatedText = results.join('')

    // Success: update stats
    await incrQuotaUsage('niutrans', accountId, account.period, text.length)
    await resetAccountErrors('niutrans', accountId)
    await recordTranslation('niutrans', accountId, text.length)

    return translatedText
  } catch (error) {
    logger.error('Niutrans translation failed:', error.message)
    await updateAccountError('niutrans', accountId, error)
    throw error
  }
}

module.exports = {
  translateWithNiutrans
}
