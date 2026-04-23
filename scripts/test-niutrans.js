#!/usr/bin/env node

/**
 * 小牛翻译功能测试脚本
 * 用法: node scripts/test-niutrans.js
 */

require('dotenv').config()
const { translateWithNiutrans } = require('../src/services/niutransService')
// const translationCacheService = require('../src/services/translationCacheService')

async function testNiutrans() {
  console.log('🧪 开始测试小牛翻译功能...\n')

  // 测试用例
  const testCases = [
    {
      name: '简单中文句子',
      text: '你好，世界！'
    },
    {
      name: '技术术语',
      text: '请帮我写一个Python函数来计算斐波那契数列'
    },
    {
      name: '长文本',
      text: '人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。该领域的研究包括机器人、语言识别、图像识别、自然语言处理和专家系统等。'
    }
  ]

  let successCount = 0
  let failCount = 0

  for (const testCase of testCases) {
    console.log(`📝 测试: ${testCase.name}`)
    console.log(`   原文: ${testCase.text}`)

    try {
      const startTime = Date.now()
      const translated = await translateWithNiutrans(testCase.text)
      const duration = Date.now() - startTime

      console.log(`   ✅ 译文: ${translated}`)
      console.log(`   ⏱️  耗时: ${duration}ms\n`)
      successCount++
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}\n`)
      failCount++
    }
  }

  // 测试缓存功能
  console.log('🔄 测试缓存功能...')
  // const cacheTestText = '这是一个缓存测试'

  // try {
  //   // 第一次调用（应该调用API）
  //   console.log('   第一次翻译（应该调用API）...')
  //   const start1 = Date.now()
  //   const result1 = await translateWithNiutrans(cacheTestText)
  //   const duration1 = Date.now() - start1
  //   console.log(`   ✅ 结果: ${result1}`)
  //   console.log(`   ⏱️  耗时: ${duration1}ms`)

  //   // 第二次调用（应该命中缓存）
  //   console.log('   第二次翻译（应该命中缓存）...')
  //   const start2 = Date.now()
  //   const result2 = await translateWithNiutrans(cacheTestText)
  //   const duration2 = Date.now() - start2
  //   console.log(`   ✅ 结果: ${result2}`)
  //   console.log(`   ⏱️  耗时: ${duration2}ms`)

  //   if (duration2 < duration1 / 10) {
  //     console.log('   ✅ 缓存生效！第二次调用明显更快\n')
  //   } else {
  //     console.log('   ⚠️  缓存可能未生效\n')
  //   }
  // } catch (error) {
  //   console.error(`   ❌ 缓存测试失败: ${error.message}\n`)
  // }

  // 测试超长文本分块
  console.log('📦 测试超长文本分块...')
  // const longText = '这是一个测试。'.repeat(1000) // 约6000字符

  // try {
  //   console.log(`   文本长度: ${longText.length} 字符`)
  //   const startTime = Date.now()
  //   const translated = await translateWithNiutrans(longText)
  //   const duration = Date.now() - startTime

  //   console.log(`   ✅ 翻译成功`)
  //   console.log(`   ⏱️  耗时: ${duration}ms`)
  //   console.log(`   📊 译文长度: ${translated.length} 字符\n`)
  // } catch (error) {
  //   console.error(`   ❌ 失败: ${error.message}\n`)
  // }

  // 输出统计
  console.log('📊 测试统计:')
  console.log(`   ✅ 成功: ${successCount}`)
  console.log(`   ❌ 失败: ${failCount}`)
  console.log(`   📈 成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`)

  // 输出配置信息
  console.log('\n⚙️  当前配置:')
  // console.log(`   翻译服务: ${process.env.TRANSLATION_PROVIDER || 'deepl'}`)
  console.log(`   源语言: ${process.env.NIUTRANS_SOURCE_LANG || 'zh'}`)
  console.log(`   目标语言: ${process.env.NIUTRANS_TARGET_LANG || 'en'}`)
  console.log(`   缓存启用: ${process.env.TRANSLATION_CACHE_ENABLED !== 'false'}`)

  process.exit(failCount > 0 ? 1 : 0)
}

// 运行测试
testNiutrans().catch((error) => {
  console.error('❌ 测试脚本执行失败:', error)
  process.exit(1)
})
