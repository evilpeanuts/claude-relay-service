/**
 * 测试新的文本分段器匹配规则
 */

const { extractChineseSegments } = require('../src/utils/textSegmenter')

console.log('🧪 测试新的文本分段器（先按空格切割）\n')

const testCases = [
  {
    name: '纯中文',
    text: '这是一个测试'
  },
  {
    name: '中英混合（空格分隔）',
    text: 'Hello 世界 World'
  },
  {
    name: '中英混合（无空格）',
    text: 'API密钥'
  },
  {
    name: '中文+数字',
    text: '支持20万字符'
  },
  {
    name: '中文+符号',
    text: '免费/每日'
  },
  {
    name: '复杂混合（空格分隔）',
    text: '这是 API 测试 和 一些 data 数据'
  },
  {
    name: '完整句子',
    text: '这是一个API测试，支持20万字符！请访问 https://example.com 查看详情。'
  },
  {
    name: '纯英文',
    text: 'Hello World'
  },
  {
    name: 'Claude Code场景',
    text: 'I will use the Read tool to read the file 你好世界.js and check its contents.'
  },
  {
    name: '多段中文（空格分隔）',
    text: '欢迎使用 我们的服务 提供最好的体验'
  }
]

testCases.forEach(({ name, text }) => {
  console.log(`\n📝 测试: ${name}`)
  console.log(`原文: "${text}"`)

  const segments = extractChineseSegments(text)

  if (segments.length === 0) {
    console.log('结果: ❌ 未找到中文片段')
  } else {
    console.log(`结果: ✅ 找到 ${segments.length} 个中文片段:`)
    segments.forEach((seg, idx) => {
      console.log(`  [${idx + 1}] "${seg.segment}" (位置: ${seg.start}-${seg.end})`)
    })
  }
})

console.log('\n\n🔍 对比旧规则差异:')
console.log('- 旧规则: "Hello 世界 World" → 整体匹配 "Hello 世界 World"')
console.log('- 新规则: "Hello 世界 World" → 只匹配 "世界"')
console.log('\n- 旧规则: "API密钥" → 整体匹配 "API密钥"')
console.log('- 新规则: "API密钥" → 只匹配 "API密钥"（无空格不切割）')
