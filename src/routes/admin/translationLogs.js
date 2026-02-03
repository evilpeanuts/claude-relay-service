const express = require('express')
const router = express.Router()
const {
  getTranslationLogs,
  getTranslationLog,
  deleteTranslationLog,
  clearAllTranslationLogs,
  getTranslationLogStats
} = require('../../services/translationLoggingService')
const logger = require('../../utils/logger')

/**
 * 获取翻译日志列表
 * GET /admin/translation-logs
 * Query params:
 *   - page: 页码（默认1）
 *   - pageSize: 每页数量（默认50）
 *   - provider: 筛选供应商 (deepl/niutrans/tencent)
 *   - startTime: 开始时间戳
 *   - endTime: 结束时间戳
 */
router.get('/', async (req, res) => {
  try {
    const { page, pageSize, provider, startTime, endTime } = req.query

    const result = await getTranslationLogs({
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 50,
      provider,
      startTime: startTime ? parseInt(startTime) : undefined,
      endTime: endTime ? parseInt(endTime) : undefined
    })

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error('Get translation logs error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get translation logs',
      message: error.message
    })
  }
})

/**
 * 获取单条翻译日志
 * GET /admin/translation-logs/:logId
 */
router.get('/:logId', async (req, res) => {
  try {
    const { logId } = req.params
    const log = await getTranslationLog(logId)

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Translation log not found'
      })
    }

    res.json({
      success: true,
      data: log
    })
  } catch (error) {
    logger.error('Get translation log error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get translation log',
      message: error.message
    })
  }
})

/**
 * 删除翻译日志
 * DELETE /admin/translation-logs/:logId
 */
router.delete('/:logId', async (req, res) => {
  try {
    const { logId } = req.params
    const success = await deleteTranslationLog(logId)

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Failed to delete translation log'
      })
    }

    res.json({
      success: true,
      message: 'Translation log deleted successfully'
    })
  } catch (error) {
    logger.error('Delete translation log error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete translation log',
      message: error.message
    })
  }
})

/**
 * 清空所有翻译日志
 * DELETE /admin/translation-logs
 */
router.delete('/', async (req, res) => {
  try {
    const count = await clearAllTranslationLogs()

    res.json({
      success: true,
      message: `Cleared ${count} translation logs`
    })
  } catch (error) {
    logger.error('Clear translation logs error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear translation logs',
      message: error.message
    })
  }
})

/**
 * 获取翻译日志统计
 * GET /admin/translation-logs/stats
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await getTranslationLogStats()

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    logger.error('Get translation log stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get translation log stats',
      message: error.message
    })
  }
})

module.exports = router
