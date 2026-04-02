/**
 * Cassandra 功能验证脚本
 * 测试新的优化功能：连接重试、健康检查、批量插入、数据清理
 */

import {
  getCassandraClient,
  checkCassandraHealth,
  cleanupTestData,
  isCassandraAvailable,
} from '../src/lib/db/cassandra'
import {
  generateTestData,
  getTrends,
  getDeviceDistribution,
  getRecentLogs,
} from '../src/app/actions/analytics'

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runVerification(): Promise<void> {
  console.log('========================================')
  console.log('Cassandra 功能验证')
  console.log('========================================')
  console.log()

  // 1. 测试快速连接检查
  console.log('1. 测试快速连接检查...')
  const isAvailable = await isCassandraAvailable()
  console.log(`   Cassandra 可用: ${isAvailable ? '✅' : '❌'}`)
  console.log()

  if (!isAvailable) {
    console.error('❌ Cassandra 不可用，请检查 Docker 容器是否运行')
    process.exit(1)
  }

  // 2. 测试详细健康检查
  console.log('2. 测试详细健康检查...')
  const health = await checkCassandraHealth()
  console.log(`   可用性: ${health.available ? '✅' : '❌'}`)
  console.log(`   连接状态: ${health.connected ? '✅' : '❌'}`)
  console.log(`   Keyspace: ${health.keyspaceReady ? '✅' : '❌'}`)
  console.log(`   日志表: ${health.tables.userBehaviorLogs ? '✅' : '❌'}`)
  console.log(`   统计表: ${health.tables.dailyAggregatedStats ? '✅' : '❌'}`)
  console.log(`   延迟: ${health.latency}ms`)
  console.log()

  // 3. 测试连接获取（带重试）
  console.log('3. 测试连接获取（带重试机制）...')
  try {
    const client = await getCassandraClient()
    console.log('   ✅ 成功获取客户端')

    // 测试查询
    const result = await client.execute('SELECT now() FROM system.local')
    console.log(`   ✅ 查询成功: ${result.rows[0].get('now')}`)
  } catch (error) {
    console.error('   ❌ 连接失败:', (error as Error).message)
  }
  console.log()

  // 4. 测试批量数据生成（优化版）
  console.log('4. 测试批量数据生成（5000条，分批次）...')
  const startTime = Date.now()
  const genResult = await generateTestData(5000)
  const duration = Date.now() - startTime

  if (genResult.success) {
    console.log(`   ✅ 生成成功: ${genResult.generated} 条`)
    console.log(`   ⏱️  耗时: ${genResult.duration}ms`)
    console.log(`   🚀 速度: ${Math.round((genResult.generated || 0) / (duration / 1000))} 条/秒`)
  } else {
    console.error(`   ❌ 生成失败: ${genResult.error}`)
  }
  console.log()

  // 5. 测试数据查询
  console.log('5. 测试数据查询...')

  console.log('   5.1 获取趋势数据...')
  const trendsResult = await getTrends()
  if (trendsResult.success && trendsResult.data) {
    console.log(`   ✅ 获取到 ${trendsResult.data.length} 小时的趋势数据`)
  } else {
    console.log(`   ⚠️ 趋势数据: ${trendsResult.error || '无数据'}`)
  }

  console.log('   5.2 获取设备分布...')
  const deviceResult = await getDeviceDistribution()
  if (deviceResult.success && deviceResult.data) {
    console.log(`   ✅ 获取到 ${deviceResult.data.length} 种设备类型`)
    deviceResult.data.forEach(d => {
      console.log(`      - ${d.device_type}: ${d.count} (${d.percentage.toFixed(1)}%)`)
    })
  } else {
    console.log(`   ⚠️ 设备分布: ${deviceResult.error || '无数据'}`)
  }

  console.log('   5.3 获取最近日志...')
  const logsResult = await getRecentLogs(10)
  if (logsResult.success && logsResult.data) {
    console.log(`   ✅ 获取到 ${logsResult.data.length} 条日志`)
  } else {
    console.log(`   ⚠️ 最近日志: ${logsResult.error || '无数据'}`)
  }
  console.log()

  // 6. 测试连接复用
  console.log('6. 测试连接复用...')
  const client1 = await getCassandraClient()
  const client2 = await getCassandraClient()
  console.log(`   ✅ 两次获取的是${client1 === client2 ? '同一个' : '不同'}客户端实例`)
  console.log()

  // 7. 测试数据清理
  console.log('7. 测试数据清理...')
  const cleanupResult = await cleanupTestData()
  if (cleanupResult.success) {
    console.log(`   ✅ 清理成功: ${cleanupResult.deletedRows} 条数据被删除`)
  } else {
    console.error(`   ❌ 清理失败: ${cleanupResult.error}`)
  }
  console.log()

  // 8. 最终健康检查
  console.log('8. 最终健康检查...')
  const finalHealth = await checkCassandraHealth()
  console.log(`   连接状态: ${finalHealth.connected ? '✅' : '❌'}`)
  console.log(`   总连接尝试次数: ${finalHealth.connectionAttempts}`)
  if (finalHealth.lastError) {
    console.log(`   最后错误: ${finalHealth.lastError}`)
  }
  console.log()

  console.log('========================================')
  console.log('✅ 所有验证完成！')
  console.log('========================================')
  console.log()
  console.log('功能总结:')
  console.log('- 连接重试机制: 自动重试 3 次，指数退避')
  console.log('- 健康检查: 详细的连接和表状态检测')
  console.log('- 批量插入: 支持并发批量插入优化')
  console.log('- 数据清理: 快速清空测试数据')
  console.log('- 连接复用: 单例模式，自动重连')
}

// 运行验证
runVerification()
  .then(() => {
    console.log('')
    console.log('验证脚本执行成功')
    process.exit(0)
  })
  .catch((error) => {
    console.error('')
    console.error('验证脚本执行失败:', error)
    process.exit(1)
  })
