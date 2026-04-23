/**
 * 翻译统计管理路由
 */

const express = require('express')
const router = express.Router()
const { authenticateAdmin } = require('../middleware/auth')
const translationStatsService = require('../services/translationStatsService')

// 获取全局统计
router.get('/stats/global', authenticateAdmin, async (req, res) => {
  try {
    const { date } = req.query
    const stats = await translationStatsService.getGlobalStats(date)
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取供应商统计
router.get('/stats/provider/:provider', authenticateAdmin, async (req, res) => {
  try {
    const { provider } = req.params
    const { date } = req.query
    const stats = await translationStatsService.getProviderStats(provider, date)
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取账户统计
router.get('/stats/account/:provider/:accountId', authenticateAdmin, async (req, res) => {
  try {
    const { provider, accountId } = req.params
    const { date } = req.query
    const stats = await translationStatsService.getAccountStats(provider, accountId, date)
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取所有账户统计
router.get('/stats/accounts/:provider', authenticateAdmin, async (req, res) => {
  try {
    const { provider } = req.params
    const { date } = req.query
    const stats = await translationStatsService.getAllAccountsStats(provider, date)
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// 获取日期范围统计
router.get('/stats/range', authenticateAdmin, async (req, res) => {
  try {
    const { provider, accountId, startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' })
    }

    const stats = await translationStatsService.getRangeStats(
      provider || null,
      accountId || null,
      startDate,
      endDate
    )
    res.json(stats)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
