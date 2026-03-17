// Updated translation account management with status/quota support
const express = require('express')
const router = express.Router()
const redis = require('../../models/redis')
const crypto = require('crypto')
const config = require('../../../config/config')
const logger = require('../../../src/utils/logger')
const { clearCache } = require('../../services/translationCacheService')

// 状态常量
const STATUS_NORMAL = 1 // 正常
const STATUS_QUOTA_EXCEEDED = 0 // 限额

// 获取供应商的所有账户 (带quota/status)
router.get('/translation/accounts/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const pattern = `translation_account:${provider}:*`
    const keys = await redis.keys(pattern)
    const {
      getQuotaUsage,
      calculateCycleDates,
      aggregateStatsForCycle
    } = require('../../services/translationQuotaService')

    const accounts = []
    for (const key of keys) {
      const data = await redis.get(key)
      const id = key.split(':')[2]
      const account = JSON.parse(data)
      account.id = id

      // 直接从 Redis 读取 status（数字类型），如果不存在则默认为 1（正常）
      if (account.status === undefined || account.status === null) {
        account.status = STATUS_NORMAL
      }

      // Use stored cycle dates if available, otherwise calculate from day numbers (backward compatibility)
      if (!account.cycleStart || !account.cycleEnd) {
        const cycleDates = calculateCycleDates(account)
        account.cycleStart = cycleDates.startDate
        account.cycleEnd = cycleDates.endDate
      }

      // 获取按配置周期计算的字符数使用量和调用次数
      let usage = 0
      let calls = 0

      if (account.cycleStart && account.cycleEnd && account.period === 'month') {
        // Use custom cycle aggregation with stored dates
        const stats = await aggregateStatsForCycle(
          provider,
          id,
          account.cycleStart,
          account.cycleEnd
        )
        usage = stats.chars
        calls = stats.calls
      } else if (account.cycleStartDay && account.cycleEndDay && account.period === 'month') {
        // Legacy: Use custom cycle with day numbers (backward compatibility)
        const stats = await aggregateStatsForCycle(
          provider,
          id,
          account.cycleStart,
          account.cycleEnd
        )
        usage = stats.chars
        calls = stats.calls
      } else {
        // Use existing logic for backward compatibility
        usage = await getQuotaUsage(provider, id, account.period || 'month', account)

        // Calculate calls using existing method
        const { getRangeStats } = require('../../services/translationStatsService')
        const stats = await getRangeStats(provider, id, account.cycleStart, account.cycleEnd)
        calls = stats.reduce((sum, day) => sum + (day.calls || 0), 0)
      }

      const quota = account.quota || 50000
      account.usage = usage // 当前周期使用量
      account.calls = calls // 当前周期调用次数
      account.quotaPct = Math.round((usage / quota) * 100)
      accounts.push(account)
    }

    res.json(accounts)
  } catch (error) {
    logger.error(`❌ Failed to get translation accounts for ${req.params.provider}:`, error)
    res.status(500).json({ error: error.message })
  }
})

// 添加账户 (带默认quota/period/rps/region)
router.post('/translation/accounts/:provider', async (req, res) => {
  try {
    const { provider } = req.params
    const {
      name,
      description,
      appId,
      apiKey,
      secretId,
      secretKey,
      quota,
      period,
      rps,
      region,
      cycleStart,
      cycleEnd
    } = req.body

    // 验证provider的有效性
    if (!['niutrans', 'deepl', 'tencent'].includes(provider)) {
      return res
        .status(400)
        .json({ error: 'Invalid provider. Must be "niutrans", "deepl" or "tencent"' })
    }

    // 验证name字段
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Account name is required' })
    }

    let creds
    if (provider === 'niutrans') {
      if (!appId || !apiKey) {
        return res.status(400).json({ error: 'appId and apiKey are required' })
      }
      creds = { appId, apiKey }
    } else if (provider === 'deepl') {
      if (!apiKey) {
        return res.status(400).json({ error: 'apiKey is required' })
      }
      creds = { apiKey }
    } else if (provider === 'tencent') {
      if (!secretId || !secretKey) {
        return res.status(400).json({ error: 'secretId and secretKey are required' })
      }
      creds = { secretId, secretKey }
    }

    // 验证quota的有效性
    if (quota !== undefined && (typeof quota !== 'number' || quota < 0)) {
      return res.status(400).json({ error: 'Quota must be a positive number' })
    }

    // 验证period的有效性
    if (period && !['day', 'month'].includes(period)) {
      return res.status(400).json({ error: 'Period must be "day" or "month"' })
    }

    // 验证rps的有效性
    if (rps !== undefined && (typeof rps !== 'number' || rps < 0)) {
      return res.status(400).json({ error: 'RPS must be a positive number' })
    }

    // 验证自定义周期配置
    if (cycleStart !== undefined || cycleEnd !== undefined) {
      // Both must be provided together
      if (cycleStart === undefined || cycleEnd === undefined) {
        return res.status(400).json({ error: 'cycleStart and cycleEnd must be provided together' })
      }

      // Only valid for month period
      const effectivePeriod = period || 'month'
      if (effectivePeriod !== 'month') {
        return res.status(400).json({ error: 'Custom cycle is only supported for month period' })
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(cycleStart) || !dateRegex.test(cycleEnd)) {
        return res
          .status(400)
          .json({ error: 'cycleStart and cycleEnd must be valid dates in YYYY-MM-DD format' })
      }

      // Validate dates are valid
      const startDate = new Date(cycleStart)
      const endDate = new Date(cycleEnd)
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'cycleStart and cycleEnd must be valid dates' })
      }

      // Validate end date is after start date
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'cycleEnd must be after cycleStart' })
      }
    }

    const providerConfig = config.translation[provider]
    const accountId =
      provider === 'niutrans' ? appId : provider === 'tencent' ? secretId : crypto.randomUUID()
    // const accountId = crypto.randomUUID() // 所有provider统一使用UUID

    const accountData = {
      ...creds,
      id: accountId,
      name: name.trim(),
      description: description?.trim() || '',
      enabled: true,
      status: STATUS_NORMAL, // 新账户默认状态为 1（正常）
      consecutiveErrors: 0,
      disabledReason: '',
      lastSuccess: 0,
      usage: 0, // 初始化usage为0
      quota: quota || providerConfig.charLimit,
      period: period || providerConfig.limitPeriod,
      rps:
        rps !== undefined
          ? rps
          : ['niutrans', 'tencent'].includes(provider)
            ? providerConfig.rateLimit
            : 0,
      region: region?.trim() || '' // 添加 region 字段，默认为空字符串
    }

    // Add custom cycle configuration if provided
    if (cycleStart !== undefined && cycleEnd !== undefined) {
      accountData.cycleStart = cycleStart
      accountData.cycleEnd = cycleEnd
    }

    const key = `translation_account:${provider}:${accountId}`
    await redis.set(key, JSON.stringify(accountData))

    // 为新账户添加quotaPct字段（与列表接口保持一致）
    const responseData = {
      ...accountData,
      quotaPct: 0 // 新账户usage为0，quotaPct也为0
    }

    logger.success(`📝 Created new translation account: ${provider}:${accountId} (${name})`)
    res.json(responseData)
  } catch (error) {
    logger.error(`❌ Failed to create translation account for ${req.params.provider}:`, error)
    res.status(500).json({ error: error.message })
  }
})

// 更新账户状态 (激活/禁用)
router.patch('/translation/accounts/:provider/:accountId/status', async (req, res) => {
  try {
    const { provider, accountId } = req.params
    const { status, enabled, reason } = req.body
    await require('../../services/translationQuotaService').setAccountStatus(
      provider,
      accountId,
      status,
      enabled,
      reason || ''
    )
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 更新账户信息
router.put('/translation/accounts/:provider/:accountId', async (req, res) => {
  try {
    const { provider, accountId } = req.params
    const {
      name,
      description,
      appId,
      apiKey,
      secretId,
      secretKey,
      quota,
      period,
      rps,
      region,
      cycleStart,
      cycleEnd
    } = req.body

    const key = `translation_account:${provider}:${accountId}`
    const accountData = await redis.get(key)

    if (!accountData) {
      return res.status(404).json({ error: 'Account not found' })
    }

    const account = JSON.parse(accountData)

    // 更新基本字段
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Account name cannot be empty' })
      }
      account.name = name.trim()
    }

    if (description !== undefined) {
      account.description = description?.trim() || ''
    }

    // 更新凭据字段
    if (provider === 'niutrans') {
      if (appId !== undefined) {
        if (typeof appId !== 'string' || appId.trim().length === 0) {
          return res.status(400).json({ error: 'App ID cannot be empty' })
        }
        account.appId = appId.trim()
      }
      if (apiKey !== undefined) {
        if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
          return res.status(400).json({ error: 'API Key cannot be empty' })
        }
        account.apiKey = apiKey.trim()
      }
    } else if (provider === 'deepl') {
      if (apiKey !== undefined) {
        if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
          return res.status(400).json({ error: 'API Key cannot be empty' })
        }
        account.apiKey = apiKey.trim()
      }
    } else if (provider === 'tencent') {
      if (secretId !== undefined) {
        if (typeof secretId !== 'string' || secretId.trim().length === 0) {
          return res.status(400).json({ error: 'Secret ID cannot be empty' })
        }
        account.secretId = secretId.trim()
      }
      if (secretKey !== undefined) {
        if (typeof secretKey !== 'string' || secretKey.trim().length === 0) {
          return res.status(400).json({ error: 'Secret Key cannot be empty' })
        }
        account.secretKey = secretKey.trim()
      }
    }

    // 更新配额设置
    if (quota !== undefined) {
      if (typeof quota !== 'number' || quota < 0) {
        return res.status(400).json({ error: 'Quota must be a positive number' })
      }
      account.quota = quota
    }

    if (period !== undefined) {
      if (!['day', 'month'].includes(period)) {
        return res.status(400).json({ error: 'Period must be "day" or "month"' })
      }
      account.period = period
    }

    if (rps !== undefined) {
      if (typeof rps !== 'number' || rps < 0) {
        return res.status(400).json({ error: 'RPS must be a positive number' })
      }
      account.rps = rps
    }

    // 更新 region 字段
    if (region !== undefined) {
      account.region = region?.trim() || ''
    }

    // 验证并更新自定义周期配置
    if (cycleStart !== undefined || cycleEnd !== undefined) {
      // Both must be provided together
      if (cycleStart === undefined || cycleEnd === undefined) {
        return res.status(400).json({ error: 'cycleStart and cycleEnd must be provided together' })
      }

      // Only valid for month period
      const effectivePeriod = period !== undefined ? period : account.period || 'month'
      if (effectivePeriod !== 'month') {
        return res.status(400).json({ error: 'Custom cycle is only supported for month period' })
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(cycleStart) || !dateRegex.test(cycleEnd)) {
        return res
          .status(400)
          .json({ error: 'cycleStart and cycleEnd must be valid dates in YYYY-MM-DD format' })
      }

      // Validate dates are valid
      const startDate = new Date(cycleStart)
      const endDate = new Date(cycleEnd)
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'cycleStart and cycleEnd must be valid dates' })
      }

      // Validate end date is after start date
      if (endDate <= startDate) {
        return res.status(400).json({ error: 'cycleEnd must be after cycleStart' })
      }

      account.cycleStart = cycleStart
      account.cycleEnd = cycleEnd
    }

    // 保存更新后的账户数据
    await redis.set(key, JSON.stringify(account))

    // 从 Redis 读取 status（数字类型），如果不存在则默认为 1（正常）
    const status =
      account.status !== undefined && account.status !== null ? account.status : STATUS_NORMAL
    const usage = account.usage ?? 0
    const quotaPct = Math.round((usage / (account.quota || 50000)) * 100)

    const responseData = {
      ...account,
      status,
      quotaPct
    }

    logger.success(`✏️ Updated translation account: ${provider}:${accountId} (${account.name})`)
    res.json(responseData)
  } catch (error) {
    logger.error(
      `❌ Failed to update translation account ${req.params.provider}:${req.params.accountId}:`,
      error
    )
    res.status(500).json({ error: error.message })
  }
})

router.post('/translation/accounts/active/:provider/:accountId', async (req, res) => {
  try {
    const { provider, accountId } = req.params
    const key = `translation_account:${provider}:${accountId}`

    const accountData = await redis.get(key)

    if (!accountData) {
      return res.status(404).json({ error: 'Account not found' })
    }
    const account = JSON.parse(accountData)
    account.status = STATUS_NORMAL
    account.enabled = true
    account.disabledReason = ''
    await redis.set(key, JSON.stringify(account))

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 删除账户
router.delete('/translation/accounts/:provider/:accountId', async (req, res) => {
  try {
    const { provider, accountId } = req.params
    const key = `translation_account:${provider}:${accountId}`
    await redis.del(key)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 清除翻译缓存、日志、统计、配额（保留账户数据）
router.delete('/translation/cache', async (req, res) => {
  try {
    await clearCache()

    const extraPatterns = ['translation_log:*', 'translation_quota:*', 'translation_stats:*']
    let totalDeleted = 0
    for (const pattern of extraPatterns) {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
        totalDeleted += keys.length
      }
    }

    // 清除翻译日志的 ZSET 索引（translation_logs 不匹配 translation_log:* 通配符）
    const zsetDeleted = await redis.del('translation_logs')
    if (zsetDeleted > 0) {
      totalDeleted += zsetDeleted
    }
    if (totalDeleted > 0) {
      logger.info(`Cleared ${totalDeleted} translation log/quota/stats entries`)
    }

    res.json({ success: true, message: 'Translation cache cleared' })
  } catch (error) {
    logger.error('Clear translation cache error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
