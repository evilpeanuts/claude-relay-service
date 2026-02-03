// src/services/deeplService.js
const deepl = require('deepl-node')
const config = require('../../config/config')
const logger = require('../utils/logger')
const redis = require('../models/redis')
const { recordTranslation } = require('./translationStatsService')
const translationQuotaService = require('./translationQuotaService')

/**
 * DeepL 翻译服务
 * 注意：缓存检查由 translateMiddleware 统一处理，此服务只负责实际翻译和统计记录
 */
async function translateWithDeepL(text, accountId, sourceLang = 'auto', targetLang = null) {
  const targetLangActual = targetLang || config.translation.deepl.targetLang
  try {
    // 获取账户信息
    const accountData = await redis.get(`translation_account:deepl:${accountId}`)
    const account = JSON.parse(accountData || '{}')
    const { apiKey } = account

    if (!apiKey) {
      throw new Error('DeepL credentials not found')
    }

    // 检查配额（不检查缓存，由 middleware 处理）
    await translationQuotaService.checkQuota('deepl', accountId, text.length)

    // 调用 DeepL API
    const translator = new deepl.Translator(apiKey)
    const result = await translator.translateText(text, null, targetLangActual)

    // 记录使用统计（始终记录，无论是否使用缓存）
    await translationQuotaService.resetAccountErrors('deepl', accountId)
    await translationQuotaService.incrQuotaUsage('deepl', accountId, account.period, text.length)
    await recordTranslation('deepl', accountId, text.length)

    logger.info(`DeepL translation successful: ${text.length} chars`)
    return result.text
  } catch (error) {
    if (error.message.includes('Quota exceeded')) {
      const accountKey = `translation_account:deepl:${accountId}`
      const accountCache = await redis.get(accountKey)
      if (accountCache) {
        const accountInfo = JSON.parse(accountCache)
        accountInfo.enabled = false
        accountInfo.status = 0 // STATUS_QUOTA_EXCEEDED
        accountInfo.disabledReason = '配额超限或余额不足'
        await redis.set(accountKey, JSON.stringify(accountInfo))
        logger.warn(`DeepL account ${accountId} status set to quota exceeded`)
        throw new Error(`DeepL quota exceeded: ${error.message}`)
      }
    }
    logger.error('DeepL translation failed:', error.message)
    await translationQuotaService.updateAccountError('deepl', accountId, error)
    throw error
  }
}

module.exports = { translateWithDeepL }
