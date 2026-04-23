// const deepl = require('deepl-node')
const config = require('../../config/config')
const logger = require('../utils/logger')
const { translateWithNiutrans } = require('../services/niutransService')
const { translateWithTencent } = require('../services/tencentTransService')
const { translateWithDeepL } = require('../services/deeplService')
const {
  getCachedTranslation,
  setCachedTranslation
} = require('../services/translationCacheService')
const { getAvailableAccountId } = require('../services/translationQuotaService')
const {
  extractChineseSegments,
  replaceSegmentsWithTranslationArray
} = require('../utils/textSegmenter')
const { saveTranslationLog } = require('../services/translationLoggingService')
// const redis = require('../models/redis')

/**
 * 检测文本是否包含中文（优化版）
 */
function containsChinese(text) {
  if (!text || text.length < 2) {
    return false
  }
  const segments = extractChineseSegments(text)
  return segments.length > 0
}

/**
 * 批量翻译中间件（跨消息缓存优化）
 */
async function translateMiddleware(req, res, next) {
  logger.info('🌐 Translation middleware activated:${}', config.translation.enabled)
  if (!config.translation.enabled) {
    return next()
  }

  try {
    const { messages } = req.body
    if (!messages || !Array.isArray(messages)) {
      return next()
    }

    const savedMessages = JSON.parse(JSON.stringify(messages)) // 深拷贝，避免修改原始数据

    // 1. 收集所有中文片段
    const allSegments = []
    const segmentMap = [] // [{msgIdx, isArray, arrayIdx, text, segments}]

    for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
      const { content } = messages[msgIdx]
      if (!content) {
        continue
      }

      if (typeof content === 'string') {
        if (containsChinese(content)) {
          const segments = extractChineseSegments(content)
          segments.forEach((seg) => allSegments.push(seg.segment))
          segmentMap.push({ msgIdx, isArray: false, text: content, segments })
        }
      } else if (Array.isArray(content)) {
        content.forEach((item, arrayIdx) => {
          if (item.type === 'text' && containsChinese(item.text)) {
            const segments = extractChineseSegments(item.text)
            segments.forEach((seg) => allSegments.push(seg.segment))
            segmentMap.push({ msgIdx, isArray: true, arrayIdx, text: item.text, segments })
          }
        })
      }
    }

    if (allSegments.length === 0) {
      return next()
    }

    // logger.info(
    //   `📝 Found ${allSegments.length} Chinese segments across ${messages.length} messages`
    // )

    // 2. 批量检查缓存 - 直接从 Redis 获取可用账户
    const redis = require('../models/redis')

    // 尝试从所有 provider 中获取可用账户（优先级：tencent > deepl > niutrans）
    const providers = ['tencent', 'deepl', 'niutrans']
    let accountId = null
    let provider = null
    let account = null

    for (const p of providers) {
      const id = await getAvailableAccountId(p)
      if (id) {
        accountId = id
        provider = p
        // 从 Redis 获取账户数据
        const accountKey = `translation_account:${p}:${id}`
        const accountData = await redis.get(accountKey)
        account = accountData ? JSON.parse(accountData) : null
        if (account) {
          break
        }
      }
    }

    // 如果没有找到可用账户，抛出错误
    if (!accountId || !provider || !account) {
      throw new Error('No available translation account found')
    }

    // 从账户配置中获取语言设置，如果没有则使用默认值
    let sourceLang, targetLang
    if (provider === 'deepl') {
      sourceLang = 'auto'
      targetLang = account.targetLang || config.translation.deepl?.targetLang || 'EN-US'
    } else if (provider === 'tencent') {
      sourceLang = account.sourceLang || config.translation.tencent?.sourceLang || 'auto'
      targetLang = account.targetLang || config.translation.tencent?.targetLang || 'en'
    } else {
      // niutrans
      sourceLang = account.sourceLang || config.translation.niutrans?.sourceLang || 'zh'
      targetLang = account.targetLang || config.translation.niutrans?.targetLang || 'en'
    }

    logger.info(
      `🌐 Using translation provider: ${provider}, account: ${accountId}, ${sourceLang} -> ${targetLang}`
    )

    const translations = []
    const needTranslate = []

    for (let i = 0; i < allSegments.length; i++) {
      const cached = await getCachedTranslation(allSegments[i], provider, sourceLang, targetLang)
      if (cached) {
        translations[i] = cached
      } else {
        needTranslate.push(i)
      }
    }

    logger.info(`💾 Cache hits: ${allSegments.length - needTranslate.length}/${allSegments.length}`)

    // 3. 分批翻译未缓存的片段（5000字符限制 + 去重优化）
    if (needTranslate.length > 0) {
      // 3.1 对未缓存的片段进行去重
      const uniqueSegments = new Map() // segment -> [indices]
      for (const idx of needTranslate) {
        const segment = allSegments[idx]
        if (!uniqueSegments.has(segment)) {
          uniqueSegments.set(segment, [])
        }
        uniqueSegments.get(segment).push(idx)
      }

      const uniqueSegmentTexts = Array.from(uniqueSegments.keys())
      const duplicateCount = needTranslate.length - uniqueSegmentTexts.length

      logger.info(
        `🔄 Translating ${uniqueSegmentTexts.length} unique segments (${duplicateCount} duplicates removed, saving ${duplicateCount} API calls)`
      )

      // 3.2 分批处理唯一片段
      const batches = []
      let currentBatch = []
      let currentSize = 0

      for (let i = 0; i < uniqueSegmentTexts.length; i++) {
        const segment = uniqueSegmentTexts[i]
        const segmentSize = segment.length + 1

        if (currentSize + segmentSize > 5000 && currentBatch.length > 0) {
          batches.push(currentBatch)
          currentBatch = []
          currentSize = 0
        }

        currentBatch.push(i)
        currentSize += segmentSize
      }

      if (currentBatch.length > 0) {
        batches.push(currentBatch)
      }

      logger.info(
        `📦 Processing ${uniqueSegmentTexts.length} segments in ${batches.length} batches`
      )

      const translateFn = async (batchText) => {
        switch (provider) {
          case 'deepl':
            return await translateWithDeepL(batchText, accountId, sourceLang, targetLang)
          case 'niutrans':
            return await translateWithNiutrans(batchText, accountId, sourceLang, targetLang)
          case 'tencent':
            return await translateWithTencent(batchText, accountId, sourceLang, targetLang)
          default:
            throw new Error(`Unsupported translation provider: ${provider}`)
        }
      }

      // 3.3 翻译唯一片段
      const uniqueTranslations = new Map() // segment -> translation
      for (const batch of batches) {
        const batchText = batch.map((i) => uniqueSegmentTexts[i]).join('\n')
        const translatedBatch = await translateFn(batchText)

        const translatedArray = translatedBatch.split('\n')

        for (let j = 0; j < batch.length; j++) {
          const segmentIdx = batch[j]
          const originalSegment = uniqueSegmentTexts[segmentIdx]
          const translated = translatedArray[j].trim()

          uniqueTranslations.set(originalSegment, translated)
          logger.debug(`Translated segment: ${originalSegment} -> ${translated}`)
          await setCachedTranslation(originalSegment, translated, provider, sourceLang, targetLang)
        }
      }

      // 3.4 回填所有索引位置的翻译（包括重复的）
      for (const [segment, indices] of uniqueSegments.entries()) {
        const translated = uniqueTranslations.get(segment)
        for (const idx of indices) {
          translations[idx] = translated
        }
      }
    }

    // 4. 回填翻译结果到原消息
    let translationIdx = 0
    for (const map of segmentMap) {
      const segmentTranslations = translations.slice(
        translationIdx,
        translationIdx + map.segments.length
      )
      translationIdx += map.segments.length

      const translatedText = replaceSegmentsWithTranslationArray(
        map.text,
        map.segments,
        segmentTranslations
      )

      if (map.isArray) {
        messages[map.msgIdx].content[map.arrayIdx].text = translatedText
      } else {
        messages[map.msgIdx].content = translatedText
      }
    }

    // 5. 保存翻译日志（如果启用）
    if (config.translation.logging.enabled && needTranslate.length > 0) {
      try {
        // 使用之前已获取的账户数据
        await saveTranslationLog({
          originalText: allSegments.join('\n'),
          translatedText: translations.join('\n'),
          provider,
          accountId,
          accountName: account.name || '',
          transLateMessages: req.body.messages,
          originalMessages: savedMessages,
          sourceLang,
          targetLang
        })
      } catch (logError) {
        // 日志保存失败不影响主流程
        logger.error('Failed to save translation log:', logError)
      }
    }

    logger.info('✅ Messages translated to English')
    next()
  } catch (error) {
    logger.error('Translation middleware error:', error)
    return res.status(503).json({
      error: 'Translation middleware error',
      message: `Translation middleware error. Service temporarily unavailable.Message: ${error.message}`,
      details: error.message
    })
  }
}

module.exports = { translateMiddleware, translateWithDeepL, translateWithTencent }
