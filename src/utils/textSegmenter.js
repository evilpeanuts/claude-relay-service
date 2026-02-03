/**
 * 文本分段工具 - 提取中文片段并支持回填
 */

/**
 * 提取文本中的中文片段
 * 新策略：先按空格切割，再匹配包含中文的片段
 * @param {string} text - 原始文本
 * @returns {Array} - [{segment: '中文片段', start: 0, end: 10}, ...]
 */
function extractChineseSegments(text) {
  const segments = []
  let currentPos = 0

  // 按空格切割文本
  const parts = text.split(/(\s+)/) // 保留分隔符（空格）

  for (const part of parts) {
    // 跳过纯空格
    if (/^\s*$/.test(part)) {
      currentPos += part.length
      continue
    }

    // 检查是否包含中文字符
    const hasChinese = /[\u4e00-\u9fa5]/.test(part)

    if (hasChinese && part.trim().length >= 1) {
      // 匹配包含中文的连续字符（中文、数字、字母、中文标点）
      const regex = /[\u4e00-\u9fa5\w，。！？；：""''（）、\-\\/:%@#&*+=]+/g
      let match

      while ((match = regex.exec(part)) !== null) {
        const segment = match[0].trim()
        // 必须包含至少一个中文字符
        if (segment.length >= 1 && /[\u4e00-\u9fa5]/.test(segment)) {
          segments.push({
            segment,
            start: currentPos + match.index,
            end: currentPos + match.index + match[0].length
          })
        }
      }
    }

    currentPos += part.length
  }

  return segments
}

/**
 * 将中文片段合并为批量翻译文本（用换行符分隔）
 * @param {Array} segments - 中文片段数组
 * @returns {string} - 用换行符分隔的文本
 */
function joinSegmentsForTranslation(segments) {
  return segments.map((s) => s.segment).join('\n')
}

/**
 * 将翻译结果回填到原文本
 * @param {string} originalText - 原始文本
 * @param {Array} segments - 中文片段数组
 * @param {string} translatedText - 翻译后的文本（换行符分隔）
 * @returns {string} - 回填后的文本
 */
function replaceSegmentsWithTranslation(originalText, segments, translatedText) {
  const translations = translatedText.split('\n')

  if (translations.length !== segments.length) {
    throw new Error(
      `Translation count mismatch: expected ${segments.length}, got ${translations.length}`
    )
  }

  let result = originalText

  // 从后往前替换，避免索引偏移问题
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const translation = translations[i].trim()

    result = result.substring(0, seg.start) + translation + result.substring(seg.end)
  }

  return result
}

/**
 * 智能翻译文本（只翻译中文部分）
 * @param {string} text - 原始文本
 * @param {Function} translateFn - 翻译函数
 * @param {Object} cacheService - 缓存服务 {get, set}
 * @param {number} maxBatchSize - 单次翻译最大字符数（默认5000）
 * @returns {string} - 翻译后的文本
 */
async function smartTranslate(text, translateFn, cacheService = null, maxBatchSize = 5000) {
  const segments = extractChineseSegments(text)

  // console.log(`[smartTranslate] Found ${segments.length} Chinese segments`)

  if (segments.length === 0) {
    // console.log(`[smartTranslate] No Chinese segments found, returning original text`)
    return text
  }

  // 检查缓存
  const translations = []
  const needTranslate = []

  if (cacheService) {
    console.log(`[smartTranslate] Checking cache for ${segments.length} segments...`)
    for (let i = 0; i < segments.length; i++) {
      const cached = await cacheService.get(segments[i].segment)
      if (cached) {
        translations[i] = cached
      } else {
        needTranslate.push(i)
      }
    }
    console.log(
      `[smartTranslate] Cache hits: ${segments.length - needTranslate.length}/${segments.length}`
    )
  } else {
    needTranslate.push(...segments.map((_, i) => i))
  }

  // 分批翻译未缓存的片段
  if (needTranslate.length > 0) {
    console.log(`[smartTranslate] Translating ${needTranslate.length} uncached segments...`)

    const batches = []
    let currentBatch = []
    let currentSize = 0

    for (const idx of needTranslate) {
      const { segment } = segments[idx]
      const segmentSize = segment.length + 1 // +1 for newline

      if (currentSize + segmentSize > maxBatchSize && currentBatch.length > 0) {
        batches.push(currentBatch)
        currentBatch = []
        currentSize = 0
      }

      currentBatch.push(idx)
      currentSize += segmentSize
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }

    console.log(`[smartTranslate] Split into ${batches.length} batches`)

    for (const batch of batches) {
      const batchText = batch.map((i) => segments[i].segment).join('\n')
      console.log(`[smartTranslate] Translating batch (${batchText.length} chars)`)

      const translatedBatch = await translateFn(batchText)
      const translatedArray = translatedBatch.split('\n')

      for (let j = 0; j < batch.length; j++) {
        const i = batch[j]
        const translated = translatedArray[j].trim()
        translations[i] = translated

        if (cacheService) {
          await cacheService.set(segments[i].segment, translated)
        }
      }
    }
  }

  // 验证翻译结果
  for (let i = 0; i < translations.length; i++) {
    if (!translations[i] || typeof translations[i] !== 'string') {
      console.error(`[smartTranslate] ERROR: Translation ${i} is invalid:`, translations[i])
      throw new Error(`Translation ${i} is not a valid string: ${translations[i]}`)
    }
  }

  const result = replaceSegmentsWithTranslationArray(text, segments, translations)
  console.log(`[smartTranslate] Translation completed, result length: ${result.length} chars`)
  return result
}

/**
 * 将翻译数组回填到原文本
 */
function replaceSegmentsWithTranslationArray(originalText, segments, translations) {
  if (translations.length !== segments.length) {
    throw new Error(
      `Translation count mismatch: expected ${segments.length}, got ${translations.length}`
    )
  }

  let result = originalText

  // 从后往前替换，避免索引偏移
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    const translation = translations[i]

    result = result.substring(0, seg.start) + translation + result.substring(seg.end)
  }

  return result
}

module.exports = {
  extractChineseSegments,
  joinSegmentsForTranslation,
  replaceSegmentsWithTranslation,
  replaceSegmentsWithTranslationArray,
  smartTranslate
}
