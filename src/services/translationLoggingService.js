const redis = require('../models/redis')
const logger = require('../utils/logger')
const config = require('../../config/config')

const { formatDateWithTimezone } = require('../utils/dateHelper')

// /**
//  * 翻译日志存储服务
//  *
//  * 存储每次翻译的详细信息，包括：
//  * - 原始文本和翻译结果
//  * - 供应商和账户信息
//  * - 请求的 messages
//  * - 时间戳
//  *
//  * Redis 数据结构：
//  * - translation_log:{logId} - 单条日志详情
//  * - translation_logs - ZSET，按时间戳排序的日志ID列表
//  */

// /**
//  * 保存翻译日志
//  * @param {Object} logData - 日志数据
//  * @param {string} logData.originalText - 原始中文文本
//  * @param {string} logData.translatedText - 翻译后文本
//  * @param {string} logData.provider - 翻译供应商 (deepl/niutrans/tencent)
//  * @param {string} logData.accountId - 账户ID
//  * @param {string} logData.accountName - 账户名称
//  * @param {Array} logData.messages - 请求的 messages
//  * @param {string} logData.sourceLang - 源语言
//  * @param {string} logData.targetLang - 目标语言
//  * @returns {Promise<string>} 日志ID
//  */
// async function saveTranslationLog(logData) {
//   if (!config.translation.logging.enabled) {
//     return null
//   }

//   try {
//     const timestamp = Date.now()
//     const logId = `${timestamp}_${Math.random().toString(36).substring(2, 9)}`

//     const logEntry = {
//       id: logId,
//       originalText: logData.originalText,
//       translatedText: logData.translatedText,
//       provider: logData.provider,
//       accountId: logData.accountId,
//       accountName: logData.accountName || '',
//       sourceLang: logData.sourceLang || 'auto',
//       targetLang: logData.targetLang || 'en',
//       originalMessages: logData.originalMessages || [],
//       transLateMessages: logData.transLateMessages || [],
//       timestamp,
//       timeFormat: formatDateWithTimezone(new Date(timestamp)),
//       createdAt: new Date(timestamp).toISOString(),
//       charCount: logData.originalText ? logData.originalText.length : 0
//     }

//     // 存储日志详情
//     const logKey = `translation_log:${logId}`
//     await redis.set(logKey, JSON.stringify(logEntry), 'EX', config.translation.logging.ttl)

//     // 添加到有序集合（按时间戳排序）
//     await redis.zadd('translation_logs', timestamp, logId)

//     // 限制日志数量（保留最新的 N 条）
//     const { maxLogs } = config.translation.logging
//     const currentCount = await redis.zcard('translation_logs')

//     if (currentCount > maxLogs) {
//       // 删除最旧的日志
//       const removeCount = currentCount - maxLogs
//       const oldLogIds = await redis.zrange('translation_logs', 0, removeCount - 1)

//       for (const oldLogId of oldLogIds) {
//         await redis.del(`translation_log:${oldLogId}`)
//       }

//       await redis.zremrangebyrank('translation_logs', 0, removeCount - 1)
//       logger.debug(`Cleaned up ${removeCount} old translation logs`)
//     }

//     logger.debug(`Translation log saved: ${logId}`)
//     return logId
//   } catch (error) {
//     logger.error('Failed to save translation log:', error)
//     // 不影响主流程，只记录错误
//     return null
//   }
// }

// /**
//  * 获取翻译日志列表
//  * @param {Object} options - 查询选项
//  * @param {number} options.page - 页码（从1开始）
//  * @param {number} options.pageSize - 每页数量
//  * @param {string} options.provider - 筛选供应商
//  * @param {number} options.startTime - 开始时间戳
//  * @param {number} options.endTime - 结束时间戳
//  * @returns {Promise<Object>} { logs, total, page, pageSize }
//  */
// async function getTranslationLogs(options = {}) {
//   try {
//     const page = options.page || 1
//     const pageSize = options.pageSize || 50
//     const startTime = options.startTime || 0
//     const endTime = options.endTime || Date.now()

//     // 获取时间范围内的日志ID
//     const logIds = await redis.zrevrangebyscore(
//       'translation_logs',
//       endTime,
//       startTime,
//       'LIMIT',
//       (page - 1) * pageSize,
//       pageSize
//     )

//     // 获取总数
//     const total = await redis.zcount('translation_logs', startTime, endTime)

//     // 批量获取日志详情
//     const logs = []
//     for (const logId of logIds) {
//       const logData = await redis.get(`translation_log:${logId}`)
//       if (logData) {
//         const logInfo = JSON.parse(logData)

//         // 如果指定了供应商筛选
//         if (!options.provider || logInfo.provider === options.provider) {
//           logs.push(logInfo)
//         }
//       }
//     }

//     return {
//       logs,
//       total,
//       page,
//       pageSize
//     }
//   } catch (error) {
//     logger.error('Failed to get translation logs:', error)
//     return {
//       logs: [],
//       total: 0,
//       page: 1,
//       pageSize: 50
//     }
//   }
// }

// /**
//  * 获取单条翻译日志
//  * @param {string} logId - 日志ID
//  * @returns {Promise<Object|null>} 日志详情
//  */
// async function getTranslationLog(logId) {
//   try {
//     const logData = await redis.get(`translation_log:${logId}`)
//     return logData ? JSON.parse(logData) : null
//   } catch (error) {
//     logger.error(`Failed to get translation log ${logId}:`, error)
//     return null
//   }
// }

// /**
//  * 删除翻译日志
//  * @param {string} logId - 日志ID
//  * @returns {Promise<boolean>} 是否成功
//  */
// async function deleteTranslationLog(logId) {
//   try {
//     await redis.del(`translation_log:${logId}`)
//     await redis.zrem('translation_logs', logId)
//     logger.info(`Translation log deleted: ${logId}`)
//     return true
//   } catch (error) {
//     logger.error(`Failed to delete translation log ${logId}:`, error)
//     return false
//   }
// }

// /**
//  * 清空所有翻译日志
//  * @returns {Promise<number>} 删除的日志数量
//  */
// async function clearAllTranslationLogs() {
//   try {
//     const logIds = await redis.zrange('translation_logs', 0, -1)
//     let count = 0

//     for (const logId of logIds) {
//       await redis.del(`translation_log:${logId}`)
//       count++
//     }

//     await redis.del('translation_logs')
//     logger.info(`Cleared ${count} translation logs`)
//     return count
//   } catch (error) {
//     logger.error('Failed to clear translation logs:', error)
//     return 0
//   }
// }

// /**
//  * 获取翻译日志统计
//  * @returns {Promise<Object>} 统计信息
//  */
// async function getTranslationLogStats() {
//   try {
//     const total = await redis.zcard('translation_logs')

//     // 获取最近的日志以计算统计
//     const recentLogIds = await redis.zrevrange('translation_logs', 0, 99)

//     const stats = {
//       total,
//       byProvider: {},
//       totalChars: 0,
//       avgCharsPerLog: 0
//     }

//     for (const logId of recentLogIds) {
//       const logData = await redis.get(`translation_log:${logId}`)
//       if (logData) {
//         const logInfo = JSON.parse(logData)
//         stats.byProvider[logInfo.provider] = (stats.byProvider[logInfo.provider] || 0) + 1
//         stats.totalChars += logInfo.charCount || 0
//       }
//     }

//     if (recentLogIds.length > 0) {
//       stats.avgCharsPerLog = Math.round(stats.totalChars / recentLogIds.length)
//     }

//     return stats
//   } catch (error) {
//     logger.error('Failed to get translation log stats:', error)
//     return {
//       total: 0,
//       byProvider: {},
//       totalChars: 0,
//       avgCharsPerLog: 0
//     }
//   }
// }

// module.exports = {
//   saveTranslationLog,
//   getTranslationLogs,
//   getTranslationLog,
//   deleteTranslationLog,
//   clearAllTranslationLogs,
//   getTranslationLogStats
// }

/**
 * 翻译日志存储服务
 *
 * 存储每次翻译的详细信息，包括：
 * - 原始文本和翻译结果
 * - 供应商和账户信息
 * - 请求的 messages
 * - 时间戳
 *
 * Redis 数据结构：
 * - translation_log:{logId} - 单条日志详情
 * - translation_logs - ZSET，按时间戳排序的日志ID列表
 */

/**
 * 保存翻译日志
 * @param {Object} logData - 日志数据
 * @param {string} logData.originalText - 原始中文文本
 * @param {string} logData.translatedText - 翻译后文本
 * @param {string} logData.provider - 翻译供应商 (deepl/niutrans/tencent)
 * @param {string} logData.accountId - 账户ID
 * @param {string} logData.accountName - 账户名称
 * @param {Array} logData.messages - 请求的 messages
 * @param {string} logData.sourceLang - 源语言
 * @param {string} logData.targetLang - 目标语言
 * @returns {Promise<string>} 日志ID
 */
async function saveTranslationLog(logData) {
  if (!config.translation?.logging?.enabled) {
    return null
  }

  try {
    const timestamp = Date.now()
    const logId = `${timestamp}_${Math.random().toString(36).substring(2, 9)}`

    const logEntry = {
      id: logId,
      originalText: logData.originalText,
      translatedText: logData.translatedText,
      provider: logData.provider,
      accountId: logData.accountId,
      accountName: logData.accountName || '',
      sourceLang: logData.sourceLang || 'auto',
      targetLang: logData.targetLang || 'en',
      originalMessages: logData.originalMessages || [],
      transLateMessages: logData.transLateMessages || [],
      timestamp,
      timeFormat: formatDateWithTimezone(new Date(timestamp)),
      createdAt: new Date(timestamp).toISOString(),
      charCount: logData.originalText ? logData.originalText.length : 0
    }

    // 使用 redisClient 的方法来存储
    const success = await redis.saveTranslationLog(logEntry)

    if (success) {
      logger.debug(`Translation log saved: ${logId}`)
      return logId
    } else {
      logger.error('Failed to save translation log via RedisClient')
      return null
    }
  } catch (error) {
    logger.error('Failed to save translation log:', error)
    // 不影响主流程，只记录错误
    return null
  }
}

/**
 * 获取翻译日志列表
 * @param {Object} options - 查询选项
 * @param {number} options.page - 页码（从1开始）
 * @param {number} options.pageSize - 每页数量
 * @param {string} options.provider - 筛选供应商
 * @param {number} options.startTime - 开始时间戳
 * @param {number} options.endTime - 结束时间戳
 * @returns {Promise<Object>} { logs, total, page, pageSize }
 */
async function getTranslationLogs(options = {}) {
  try {
    const result = await redis.getTranslationLogs(options)
    return result
  } catch (error) {
    logger.error('Failed to get translation logs:', error)
    return {
      logs: [],
      total: 0,
      page: 1,
      pageSize: 50
    }
  }
}

/**
 * 搜索翻译日志
 * @param {Object} options - 搜索选项
 * @param {string} options.query - 搜索关键词
 * @param {string} options.field - 搜索字段（all/text/source/target/provider）
 * @param {number} options.page - 页码
 * @param {number} options.pageSize - 每页数量
 * @returns {Promise<Object>} 搜索结果
 */
async function searchTranslationLogs(options = {}) {
  try {
    return await redis.searchTranslationLogs(options)
  } catch (error) {
    logger.error('Failed to search translation logs:', error)
    return {
      logs: [],
      total: 0,
      page: 1,
      pageSize: 50,
      totalPages: 0
    }
  }
}

/**
 * 获取单条翻译日志
 * @param {string} logId - 日志ID
 * @returns {Promise<Object|null>} 日志详情
 */
async function getTranslationLog(logId) {
  try {
    return await redis.getTranslationLog(logId)
  } catch (error) {
    logger.error(`Failed to get translation log ${logId}:`, error)
    return null
  }
}

/**
 * 删除翻译日志
 * @param {string} logId - 日志ID
 * @returns {Promise<boolean>} 是否成功
 */
async function deleteTranslationLog(logId) {
  try {
    return await redis.deleteTranslationLog(logId)
  } catch (error) {
    logger.error(`Failed to delete translation log ${logId}:`, error)
    return false
  }
}

/**
 * 批量删除翻译日志
 * @param {string[]} logIds - 日志ID数组
 * @returns {Promise<number>} 删除的日志数量
 */
async function batchDeleteTranslationLogs(logIds) {
  try {
    return await redis.batchDeleteTranslationLogs(logIds)
  } catch (error) {
    logger.error('Failed to batch delete translation logs:', error)
    return 0
  }
}

/**
 * 清空所有翻译日志
 * @returns {Promise<number>} 删除的日志数量
 */
async function clearAllTranslationLogs() {
  try {
    return await redis.clearAllTranslationLogs()
  } catch (error) {
    logger.error('Failed to clear translation logs:', error)
    return 0
  }
}

/**
 * 获取翻译日志统计
 * @returns {Promise<Object>} 统计信息
 */
async function getTranslationLogStats() {
  try {
    return await redis.getTranslationLogStats()
  } catch (error) {
    logger.error('Failed to get translation log stats:', error)
    return {
      total: 0,
      byProvider: {},
      totalChars: 0,
      avgCharsPerLog: 0
    }
  }
}

/**
 * 获取今日翻译统计
 * @returns {Promise<Object>} 今日统计
 */
async function getTodayTranslationStats() {
  try {
    return await redis.getTodayTranslationStats()
  } catch (error) {
    logger.error('Failed to get today translation stats:', error)
    return {
      total: 0,
      byProvider: {},
      totalChars: 0,
      avgCharsPerLog: 0
    }
  }
}

/**
 * 导出翻译日志（用于备份）
 * @returns {Promise<Object[]>} 所有日志
 */
async function exportTranslationLogs() {
  try {
    return await redis.exportTranslationLogs()
  } catch (error) {
    logger.error('Failed to export translation logs:', error)
    return []
  }
}

/**
 * 导入翻译日志
 * @param {Object[]} logs - 日志数组
 * @returns {Promise<number>} 导入的日志数量
 */
async function importTranslationLogs(logs) {
  try {
    return await redis.importTranslationLogs(logs)
  } catch (error) {
    logger.error('Failed to import translation logs:', error)
    return 0
  }
}

module.exports = {
  saveTranslationLog,
  getTranslationLogs,
  searchTranslationLogs,
  getTranslationLog,
  deleteTranslationLog,
  batchDeleteTranslationLogs,
  clearAllTranslationLogs,
  getTranslationLogStats,
  getTodayTranslationStats,
  exportTranslationLogs,
  importTranslationLogs
}
