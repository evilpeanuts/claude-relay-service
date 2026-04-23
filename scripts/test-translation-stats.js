/**
 * 测试翻译统计功能
 * 用于验证翻译统计查询接口是否正常工作
 */

const axios = require('axios')

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

let authToken = ''

// 登录获取token
async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/admin/login`, {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    })
    authToken = response.data.token
    console.log('✅ 登录成功')
    return authToken
  } catch (error) {
    console.error('❌ 登录失败:', error.response?.data || error.message)
    process.exit(1)
  }
}

// 获取API客户端
function getApiClient() {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  })
}

// 测试全局统计（所有供应商）
async function testGlobalStats() {
  console.log('\n📊 测试全局统计（所有供应商）...')
  const api = getApiClient()

  try {
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const endDate = new Date().toISOString().split('T')[0]

    const response = await api.get('/admin/translation/stats/range', {
      params: { startDate, endDate }
    })

    console.log('✅ 全局统计查询成功')
    console.log('   日期范围:', startDate, '到', endDate)

    const totalChars = response.data.reduce((sum, day) => sum + (day.chars || 0), 0)
    const totalCalls = response.data.reduce((sum, day) => sum + (day.calls || 0), 0)

    console.log('   总字符数:', totalChars)
    console.log('   总调用次数:', totalCalls)
    console.log('   统计天数:', response.data.length)

    return { totalChars, totalCalls }
  } catch (error) {
    console.error('❌ 全局统计查询失败:', error.response?.data || error.message)
    return null
  }
}

// 测试单个供应商统计
async function testProviderStats(provider) {
  console.log(`\n📈 测试 ${provider} 供应商统计...`)
  const api = getApiClient()

  try {
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const endDate = new Date().toISOString().split('T')[0]

    const response = await api.get('/admin/translation/stats/range', {
      params: { provider, startDate, endDate }
    })

    console.log(`✅ ${provider} 供应商统计查询成功`)

    const totalChars = response.data.reduce((sum, day) => sum + (day.chars || 0), 0)
    const totalCalls = response.data.reduce((sum, day) => sum + (day.calls || 0), 0)

    console.log('   总字符数:', totalChars)
    console.log('   总调用次数:', totalCalls)

    return { totalChars, totalCalls }
  } catch (error) {
    console.error(`❌ ${provider} 供应商统计查询失败:`, error.response?.data || error.message)
    return null
  }
}

// 测试账户列表和统计
async function testAccountsWithStats(provider) {
  console.log(`\n👥 测试 ${provider} 账户列表和统计...`)
  const api = getApiClient()

  try {
    // 获取账户列表
    const accountsRes = await api.get(`/admin/translation/accounts/${provider}`)
    console.log(`✅ 获取 ${provider} 账户列表成功，共 ${accountsRes.data.length} 个账户`)

    if (accountsRes.data.length === 0) {
      console.log('   ℹ️  暂无账户')
      return
    }

    // 为每个账户获取统计
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const endDate = new Date().toISOString().split('T')[0]

    for (const account of accountsRes.data) {
      console.log(`\n   账户: ${account.id}`)
      console.log(`   状态: ${account.status}`)
      console.log(
        `   额度: ${account.usage || 0} / ${account.quota || 50000} (${account.quotaPct || 0}%)`
      )

      // 获取账户统计
      const statsRes = await api.get('/admin/translation/stats/range', {
        params: {
          provider,
          accountId: account.id,
          startDate,
          endDate
        }
      })

      const totalChars = statsRes.data.reduce((sum, day) => sum + (day.chars || 0), 0)
      const totalCalls = statsRes.data.reduce((sum, day) => sum + (day.calls || 0), 0)

      console.log(`   统计（${startDate} 到 ${endDate}）:`)
      console.log(`     字符数: ${totalChars}`)
      console.log(`     调用次数: ${totalCalls}`)
    }
  } catch (error) {
    console.error(`❌ ${provider} 账户查询失败:`, error.response?.data || error.message)
  }
}

// 主测试流程
async function main() {
  console.log('🚀 开始测试翻译统计功能...\n')

  // 登录
  await login()

  // 测试全局统计
  await testGlobalStats()

  // 测试各供应商统计
  const providers = ['niutrans', 'deepl', 'tencent']
  for (const provider of providers) {
    await testProviderStats(provider)
    await testAccountsWithStats(provider)
  }

  console.log('\n✅ 所有测试完成！')
}

main().catch((error) => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
