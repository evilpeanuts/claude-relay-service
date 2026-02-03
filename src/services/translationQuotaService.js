// src/services/translationQuotaService.js
const redis = require('../models/redis')
// const config = require('../../config/config')
const logger = require('../utils/logger')

/**
 * Calculate cycle start and end dates for an account
 * @param {Object} account - Account object with optional cycleStartDay and cycleEndDay
 * @param {Date} referenceDate - Reference date (defaults to now)
 * @returns {Object} { startDate, endDate } - ISO date strings
 */
function calculateCycleDates(account, referenceDate = new Date()) {
  const period = account.period || 'month'

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Day period: return single day
  if (period === 'day') {
    return { startDate: formatDate(referenceDate), endDate: formatDate(referenceDate) }
  }

  // Month period without custom cycle: return calendar month
  if (!account.cycleStartDay || !account.cycleEndDay) {
    const year = referenceDate.getFullYear()
    const month = referenceDate.getMonth()
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0) // Last day of month
    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    }
  }

  // Month period with custom cycle
  const { cycleStartDay } = account
  const { cycleEndDay } = account
  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth()
  const refDay = referenceDate.getDate()

  // Determine current cycle boundaries
  let cycleStartDate, cycleEndDate

  if (refDay >= cycleStartDay) {
    // We're in or after the start day of current month's cycle
    // Cycle: current month cycleStartDay to next month cycleEndDay
    cycleStartDate = new Date(refYear, refMonth, cycleStartDay)
    cycleEndDate = new Date(refYear, refMonth + 1, cycleEndDay)
  } else {
    // We're before the start day, so we're still in previous cycle
    // Cycle: previous month cycleStartDay to current month cycleEndDay
    cycleStartDate = new Date(refYear, refMonth - 1, cycleStartDay)
    cycleEndDate = new Date(refYear, refMonth, cycleEndDay)
  }

  // Handle edge cases (e.g., Feb 31 -> Feb 28/29)
  // JavaScript Date automatically adjusts invalid dates
  return {
    startDate: formatDate(cycleStartDate),
    endDate: formatDate(cycleEndDate)
  }
}

/**
 * Aggregate daily stats for a date range
 * @param {string} provider - Provider name
 * @param {string} accountId - Account ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} { chars, calls } - Aggregated stats
 */
async function aggregateStatsForCycle(provider, accountId, startDate, endDate) {
  const client = redis.getClientSafe()
  let totalChars = 0
  let totalCalls = 0

  // Parse dates
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Collect all keys for the date range
  const keys = []
  const currentDate = new Date(start)
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const statsKey = `translation_stats:${provider}:${accountId}:${dateStr}`
    keys.push(statsKey)
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Use pipeline to batch all HGETALL operations for better performance
  const pipeline = client.pipeline()
  keys.forEach((key) => pipeline.hgetall(key))
  const results = await pipeline.exec()

  // Aggregate stats from all results
  results.forEach(([err, statsData]) => {
    if (!err && statsData) {
      totalChars += parseInt(statsData.chars || 0)
      totalCalls += parseInt(statsData.calls || 0)
    }
  })

  return { chars: totalChars, calls: totalCalls }
}

async function getQuotaUsage(provider, accountId, period, account = null) {
  // If account has stored custom cycle dates, use aggregateStatsForCycle
  if (account && account.cycleStart && account.cycleEnd && period === 'month') {
    const stats = await aggregateStatsForCycle(
      provider,
      accountId,
      account.cycleStart,
      account.cycleEnd
    )
    return stats.chars
  }

  // Legacy: If account has custom cycle config with day numbers, use aggregateStatsForCycle
  if (account && account.cycleStartDay && account.cycleEndDay && period === 'month') {
    const { startDate, endDate } = calculateCycleDates(account)
    const stats = await aggregateStatsForCycle(provider, accountId, startDate, endDate)
    return stats.chars
  }

  // Otherwise, use existing quota hash logic (backward compatible)
  const quotaKey = `translation_quota:${provider}:${accountId}`
  const now = new Date()
  let currentPeriod
  if (period === 'day') {
    currentPeriod = now.toISOString().split('T')[0]
  } else {
    // month
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    currentPeriod = `${year}-${month}`
  }
  const client = redis.getClientSafe()
  const usageStr = await client.hget(quotaKey, currentPeriod)
  return parseInt(usageStr || '0')
}

async function incrQuotaUsage(provider, accountId, period, charCount) {
  const quotaKey = `translation_quota:${provider}:${accountId}`
  const now = new Date()
  let currentPeriod
  if (period === 'day') {
    currentPeriod = now.toISOString().split('T')[0]
  } else {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    currentPeriod = `${year}-${month}`
  }
  const client = redis.getClientSafe()
  await client.hincrby(quotaKey, currentPeriod, charCount)
  const expireSeconds = period === 'day' ? 172800 : 3456000 // 2d or 40d
  await client.expire(quotaKey, expireSeconds)
}

async function checkQuota(provider, accountId, charCount) {
  const accountData = await redis.get(`translation_account:${provider}:${accountId}`)
  if (!accountData) {
    throw new Error('Account not found')
  }
  const account = JSON.parse(accountData)
  if (!account.enabled) {
    throw new Error(`Account disabled: ${account.disabledReason || 'Unknown'}`)
  }
  const usage = await getQuotaUsage(provider, accountId, account.period)
  if (usage + charCount > account.quota) {
    throw new Error(`Quota exceeded: ${usage}/${account.quota} chars`)
  }
}

async function checkRps(provider, accountId, maxRps) {
  if (maxRps <= 0) {
    return
  }
  const client = redis.getClientSafe()
  const windowKey = `rps:${provider}:${accountId}`
  const now = Math.floor(Date.now() / 1000)
  await client.zremrangebyscore(windowKey, '-inf', now - 1)
  const count = await client.zcard(windowKey)
  if (count >= maxRps) {
    throw new Error(`RPS exceeded: ${count}/${maxRps}`)
  }
  await client.zadd(windowKey, now, now.toString())
  await client.expire(windowKey, 2)
}

async function updateAccountError(provider, accountId, error) {
  const accountKey = `translation_account:${provider}:${accountId}`
  const accountData = await redis.get(accountKey)
  const account = JSON.parse(accountData)
  account.consecutiveErrors = (account.consecutiveErrors || 0) + 1
  if (account.consecutiveErrors >= 3) {
    account.status = 0 // STATUS_DISABLED
    account.enabled = false
    account.disabledReason = '连续3次API调用错误，已自动禁用'
    logger.warn(`Auto-disabled ${provider} account ${accountId}: ${error.message}`)
  }
  await redis.set(accountKey, JSON.stringify(account))
}

async function resetAccountErrors(provider, accountId) {
  const accountKey = `translation_account:${provider}:${accountId}`
  const accountData = await redis.get(accountKey)
  const account = JSON.parse(accountData)
  account.consecutiveErrors = 0
  account.lastSuccess = Date.now()
  await redis.set(accountKey, JSON.stringify(account))
}

async function setAccountStatus(provider, accountId, status, enabled, reason = '') {
  const accountKey = `translation_account:${provider}:${accountId}`
  const accountData = await redis.get(accountKey)
  if (!accountData) {
    throw new Error('Account not found')
  }
  const account = JSON.parse(accountData)
  account.status = status || 1
  account.enabled = enabled
  account.disabledReason = reason
  account.consecutiveErrors = enabled ? 0 : account.consecutiveErrors || 0
  await redis.set(accountKey, JSON.stringify(account))
}

async function getAvailableAccountId(provider) {
  const pattern = `translation_account:${provider}:*`
  const keys = await redis.keys(pattern)
  if (keys.length === 0) {
    return null
  }
  const accounts = []
  for (const key of keys) {
    const accountData = await redis.get(key)
    const account = JSON.parse(accountData)
    if (account.enabled !== false) {
      // only enabled
      const usage = await getQuotaUsage(provider, account.id || key.split(':')[2], account.period)
      if (usage < account.quota) {
        accounts.push(key.split(':')[2])
      }
    }
  }
  if (accounts.length === 0) {
    return null
  }
  return accounts[Math.floor(Math.random() * accounts.length)]
}

module.exports = {
  getQuotaUsage,
  incrQuotaUsage,
  checkQuota,
  checkRps,
  updateAccountError,
  resetAccountErrors,
  setAccountStatus,
  getAvailableAccountId,
  calculateCycleDates,
  aggregateStatsForCycle
}
