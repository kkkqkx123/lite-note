/**
 * 测试趋势数据查询
 */

import { generateTestData, getAccurateTrends } from '../src/app/actions/analytics'

async function runTest(): Promise<void> {
  console.log('========================================')
  console.log('测试趋势数据查询')
  console.log('========================================')
  console.log()

  // 1. 生成测试数据（过去24小时内）
  console.log('1. 生成50条测试数据（过去24小时内）...')
  const genResult = await generateTestData(50)
  console.log(`   结果: ${genResult.success ? '✅' : '❌'}`)
  if (genResult.success) {
    console.log(`   生成数量: ${genResult.generated}`)
    console.log(`   耗时: ${genResult.duration}ms`)
  } else {
    console.log(`   错误: ${genResult.error}`)
  }
  console.log()

  // 2. 查询趋势数据
  console.log('2. 查询过去24小时的趋势数据...')
  const trendResult = await getAccurateTrends()
  console.log(`   结果: ${trendResult.success ? '✅' : '❌'}`)
  if (trendResult.success) {
    console.log(`   总记录数: ${trendResult.totalCount}`)
    console.log(`   数据点数: ${trendResult.data?.length}`)
    if (trendResult.data) {
      const nonZero = trendResult.data.filter(d => d.count > 0)
      console.log(`   有数据的点: ${nonZero.length}`)
      if (nonZero.length > 0) {
        console.log(`   有数据的小时: ${nonZero.map(d => d.hour).join(', ')}`)
      }
    }
  } else {
    console.log(`   错误: ${trendResult.error}`)
  }
  console.log()

  // 3. 再次生成数据（模拟刷新后的情况）
  console.log('3. 再次生成50条测试数据...')
  const genResult2 = await generateTestData(50)
  console.log(`   结果: ${genResult2.success ? '✅' : '❌'}`)
  console.log()

  // 4. 再次查询趋势数据
  console.log('4. 再次查询趋势数据...')
  const trendResult2 = await getAccurateTrends()
  console.log(`   结果: ${trendResult2.success ? '✅' : '❌'}`)
  if (trendResult2.success) {
    console.log(`   总记录数: ${trendResult2.totalCount}`)
    console.log(`   与上次记录数差异: ${(trendResult2.totalCount || 0) - (trendResult.totalCount || 0)}`)
  }
  console.log()

  console.log('========================================')
  console.log('测试完成')
  console.log('========================================')
}

runTest()
  .then(() => {
    console.log('')
    console.log('测试成功')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('测试失败:', error)
    process.exit(1)
  })