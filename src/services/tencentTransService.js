// 腾讯云API签名v3实现
// 本代码基于腾讯云API签名v3文档实现: https://cloud.tencent.com/document/product/213/30654
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

function sha256(message, secret = '', encoding) {
  const hmac = crypto.createHmac('sha256', secret)
  return hmac.update(message).digest(encoding)
}

function getHash(message, encoding = 'hex') {
  const hash = crypto.createHash('sha256')
  return hash.update(message).digest(encoding)
}

function getDate(timestamp) {
  const date = new Date(timestamp * 1000)
  const year = date.getUTCFullYear()
  const month = `0${date.getUTCMonth() + 1}`.slice(-2)
  const day = `0${date.getUTCDate()}`.slice(-2)
  return `${year}-${month}-${day}`
}

async function translateWithTencent(text, accountId = null, sourceLang = 'zh', targetLang = 'en') {
  if (!accountId) {
    throw new Error('Account ID is required')
  }

  // Wrap in try-catch with quota/RPS/error handling
  try {
    const accountData = await redis.get(`translation_account:tencent:${accountId}`)
    const account = JSON.parse(accountData || '{}')
    const { secretId, secretKey, region: accountRegion } = account

    if (!secretId || !secretKey) {
      throw new Error('Tencent credentials not found')
    }

    // Check quota and RPS before processing
    await checkQuota('tencent', accountId, text.length)
    await checkRps('tencent', accountId, account.rateLimit || 5)

    const host = 'tmt.tencentcloudapi.com'
    const service = 'tmt'
    const region = accountRegion || 'ap-beijing' // 使用账户配置的 region，默认为 ap-beijing
    const action = 'TextTranslate'
    const version = '2018-03-21'
    const timestamp = parseInt(String(new Date().getTime() / 1000))
    const date = getDate(timestamp)

    const payload = JSON.stringify({
      SourceText: text,
      Source: sourceLang,
      Target: targetLang,
      ProjectId: 0
    })

    // ************* 步骤 1：拼接规范请求串 *************
    const signedHeaders = 'content-type;host'
    const hashedRequestPayload = getHash(payload)
    const httpRequestMethod = 'POST'
    const canonicalUri = '/'
    const canonicalQueryString = ''
    const canonicalHeaders = `content-type:application/json; charset=utf-8\n` + `host:${host}\n`

    const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${
      canonicalHeaders
    }\n${signedHeaders}\n${hashedRequestPayload}`

    // ************* 步骤 2：拼接待签名字符串 *************
    const algorithm = 'TC3-HMAC-SHA256'
    const hashedCanonicalRequest = getHash(canonicalRequest)
    const credentialScope = `${date}/${service}/` + `tc3_request`
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`

    // ************* 步骤 3：计算签名 *************
    const kDate = sha256(date, `TC3${secretKey}`)
    const kService = sha256(service, kDate)
    const kSigning = sha256('tc3_request', kService)
    const signature = sha256(stringToSign, kSigning, 'hex')

    // ************* 步骤 4：拼接 Authorization *************
    const authorization =
      `${algorithm} ` +
      `Credential=${secretId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`

    // ************* 步骤 5：发送 HTTP 请求 *************
    const response = await axios({
      method: 'POST',
      url: `https://${host}`,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json; charset=utf-8',
        Host: host,
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Version': version,
        'X-TC-Region': region
      },
      data: payload,
      timeout: 30000
    })

    // Check for API error response
    if (response.data.Response.Error) {
      const error = response.data.Response.Error
      if (
        error.Code === 'FailedOperation.NoFreeAmount' ||
        error.Code === 'FailedOperation.ServiceIsolate'
      ) {
        // Set account status to quota exceeded
        const accountKey = `translation_account:tencent:${accountId}`
        const accountCache = await redis.get(accountKey)
        if (accountCache) {
          const accountInfo = JSON.parse(accountCache)
          accountInfo.status = 0 // STATUS_QUOTA_EXCEEDED
          accountInfo.disabledReason = '配额超限或余额不足'
          await redis.set(accountKey, JSON.stringify(accountInfo))
          logger.warn(`Tencent account ${accountId} status set to quota exceeded`)
        }
      }
      throw new Error(`Tencent API Error: ${error.Code} - ${error.Message}`)
    }

    const translatedText = response.data.Response.TargetText

    // Success - record usage and stats
    await incrQuotaUsage('tencent', accountId, account.period, text.length)
    await resetAccountErrors('tencent', accountId)
    await recordTranslation('tencent', accountId, text.length)

    logger.debug(`Tencent translation successful: ${text.length} chars`)
    return translatedText
  } catch (error) {
    logger.error('Tencent translation failed:', error.message)
    await updateAccountError('tencent', accountId, error)
    throw error
  }
}

module.exports = {
  translateWithTencent
}
