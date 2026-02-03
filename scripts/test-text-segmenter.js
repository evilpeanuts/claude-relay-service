#!/usr/bin/env node

/**
 * 测试文本分段翻译功能
 */

const {
  extractChineseSegments,
  joinSegmentsForTranslation,
  replaceSegmentsWithTranslation,
  smartTranslate
} = require('../src/utils/textSegmenter')

// 模拟翻译函数
async function mockTranslate(text) {
  // 简单模拟：将每行转为大写（实际会调用翻译API）
  return text
    .split('\n')
    .map((line) => `[TRANSLATED: ${line}]`)
    .join('\n')
}

async function runTests() {
  console.log('🧪 测试文本分段翻译功能\n')

  // 测试用例
  const testCases = [
    {
      name: '混合文本（中英文）',
      text: 'Please write a function 来计算斐波那契数列 in Python',
      expected: 'Please write a function [TRANSLATED: 来计算斐波那契数列] in Python'
    },
    {
      name: '多个中文片段',
      text: '你好 world, 这是一个测试 test, 谢谢 thanks',
      expected:
        '[TRANSLATED: 你好] world, [TRANSLATED: 这是一个测试] test, [TRANSLATED: 谢谢] thanks'
    },
    {
      name: '纯英文（无需翻译）',
      text: 'Hello world, this is a test',
      expected: 'Hello world, this is a test'
    },
    {
      name: '纯中文',
      text: '你好，世界！这是一个测试。',
      expected: '[TRANSLATED: 你好，世界！这是一个测试。]'
    },
    {
      name: '代码中的中文注释',
      text: 'function test() { // 这是一个测试函数\n  return true; // 返回真值\n}',
      expected:
        'function test() { // [TRANSLATED: 这是一个测试函数]\n  return true; // [TRANSLATED: 返回真值]\n}'
    }
  ]

  let passCount = 0
  let failCount = 0

  for (const testCase of testCases) {
    console.log(`📝 测试: ${testCase.name}`)
    console.log(`   原文: ${testCase.text}`)

    try {
      // 1. 提取中文片段
      const segments = extractChineseSegments(testCase.text)
      console.log(`   📦 提取到 ${segments.length} 个中文片段:`)
      segments.forEach((seg, i) => {
        console.log(`      ${i + 1}. "${seg.segment}" (位置: ${seg.start}-${seg.end})`)
      })

      if (segments.length === 0) {
        console.log(`   ✅ 无中文，跳过翻译\n`)
        passCount++
        continue
      }

      // 2. 合并为批量翻译文本
      const batchText = joinSegmentsForTranslation(segments)
      console.log(
        `   📄 批量翻译文本:\n${batchText
          .split('\n')
          .map((l) => `      ${l}`)
          .join('\n')}`
      )

      // 3. 模拟翻译
      const translated = await mockTranslate(batchText)
      console.log(
        `   🌐 翻译结果:\n${translated
          .split('\n')
          .map((l) => `      ${l}`)
          .join('\n')}`
      )

      // 4. 回填
      const result = replaceSegmentsWithTranslation(testCase.text, segments, translated)
      console.log(`   ✅ 回填结果: ${result}`)

      // 验证结果
      if (result === testCase.expected) {
        console.log(`   ✅ 测试通过\n`)
        passCount++
      } else {
        console.log(`   ❌ 测试失败`)
        console.log(`   期望: ${testCase.expected}`)
        console.log(`   实际: ${result}\n`)
        failCount++
      }
    } catch (error) {
      console.error(`   ❌ 错误: ${error.message}\n`)
      failCount++
    }
  }

  // 测试 smartTranslate 函数
  console.log('🔄 测试 smartTranslate 函数...')
  const smartText = '请写一个 Python function 来计算 fibonacci numbers'
  console.log(`   原文: ${smartText}`)

  try {
    const result = await smartTranslate(smartText, mockTranslate)
    console.log(`   ✅ 结果: ${result}\n`)
    passCount++
  } catch (error) {
    console.error(`   ❌ 错误: ${error.message}\n`)
    failCount++
  }

  // 统计
  console.log('📊 测试统计:')
  console.log(`   ✅ 通过: ${passCount}`)
  console.log(`   ❌ 失败: ${failCount}`)
  console.log(`   📈 成功率: ${((passCount / (passCount + failCount)) * 100).toFixed(1)}%`)

  // 成本节省估算
  console.log('\n💰 成本节省估算:')
  const mixedText = 'Please write a function 来计算斐波那契数列 in Python'
  const segments = extractChineseSegments(mixedText)
  const chineseLength = segments.reduce((sum, s) => sum + s.segment.length, 0)
  const totalLength = mixedText.length
  const savings = ((1 - chineseLength / totalLength) * 100).toFixed(1)

  console.log(`   示例文本: "${mixedText}"`)
  console.log(`   总长度: ${totalLength} 字符`)
  console.log(`   中文长度: ${chineseLength} 字符`)
  console.log(`   节省: ${savings}% 的翻译成本`)

  process.exit(failCount > 0 ? 1 : 0)
}

runTests().catch((error) => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
