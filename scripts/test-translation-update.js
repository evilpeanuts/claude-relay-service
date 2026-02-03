/**
 * 测试翻译账户更新功能
 * 验证 PUT /admin/translation/accounts/:provider/:accountId 接口
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

// 测试路由是否存在
async function testRouteExists() {
  console.log('\n🔍 测试路由是否存在...')
  const api = getApiClient()

  try {
    // 尝试访问一个不存在的账户ID（应该返回404或其他错误，但不应该是路由不存在）
    await api.put('/admin/translation/accounts/niutrans/test-nonexistent-id', {
      name: '测试账户'
    })
  } catch (error) {
    if (error.response) {
      console.log(`✅ 路由存在，HTTP状态码: ${error.response.status}`)
      if (error.response.status === 404) {
        console.log('   响应信息:', error.response.data)
        if (error.response.data.error === 'Account not found') {
          console.log('   ✓ 这是正常的账户不存在错误，说明路由工作正常')
        } else {
          console.log('   ⚠️  可能是路由未注册，收到的是通用404错误')
        }
      }
    } else {
      console.error('❌ 请求失败:', error.message)
    }
  }
}

// 测试更新已存在的账户
async function testUpdateExistingAccount(provider, accountId) {
  console.log(`\n📝 测试更新 ${provider} 账户: ${accountId}...`)
  const api = getApiClient()

  try {
    // 先获取账户列表，找到一个真实的账户ID
    const listResponse = await api.get(`/admin/translation/accounts/${provider}`)
    console.log(`   找到 ${listResponse.data.length} 个账户`)

    if (listResponse.data.length === 0) {
      console.log('   ℹ️  没有账户可测试，跳过')
      return
    }

    const firstAccount = listResponse.data[0]
    console.log(`   使用账户: ${firstAccount.id} (${firstAccount.name || '未命名'})`)

    // 尝试更新账户名称
    const updateResponse = await api.put(
      `/admin/translation/accounts/${provider}/${firstAccount.id}`,
      {
        name: firstAccount.name || '测试账户',
        description: '测试更新功能'
      }
    )

    console.log('✅ 更新成功')
    console.log('   返回数据:', {
      id: updateResponse.data.id,
      name: updateResponse.data.name,
      description: updateResponse.data.description,
      status: updateResponse.data.status
    })
  } catch (error) {
    console.error('❌ 更新失败:', error.response?.data || error.message)
    if (error.response) {
      console.error('   HTTP状态码:', error.response.status)
      console.error('   响应数据:', error.response.data)
    }
  }
}

// 主测试流程
async function main() {
  console.log('🚀 开始测试翻译账户更新功能...\n')
  console.log(`服务器地址: ${BASE_URL}`)

  // 登录
  await login()

  // 测试路由是否存在
  await testRouteExists()

  // 测试各供应商的更新功能
  const providers = ['niutrans', 'deepl', 'tencent']
  for (const provider of providers) {
    await testUpdateExistingAccount(provider)
  }

  console.log('\n✅ 所有测试完成！')
}

main().catch((error) => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
