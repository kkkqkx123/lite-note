/**
 * Cassandra 数据种子脚本
 * 用于插入演示数据，独立于应用代码
 * 
 * 使用方法:
 *   npx tsx scripts/seed-cassandra.ts [数量]
 * 
 * 示例:
 *   npx tsx scripts/seed-cassandra.ts 1000    # 插入1000条
 *   npx tsx scripts/seed-cassandra.ts         # 默认插入500条
 */

import { getCassandraClient, isCassandraAvailable } from '../src/lib/db/cassandra'

// 配置
const DEFAULT_COUNT = 500
const BATCH_SIZE = 50 // 每批插入数量，避免 batch too large

// 模拟数据生成器
const ACTION_TYPES = ['view', 'click', 'scroll', 'edit', 'create', 'delete'] as const
const DEVICE_TYPES = ['mobile', 'desktop', 'tablet'] as const
const USER_IDS = Array.from({ length: 50 }, (_, i) => `user_${String(i + 1).padStart(3, '0')}`)
const NOTE_IDS = Array.from({ length: 100 }, (_, i) => `note_${String(i + 1).padStart(4, '0')}`)

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 生成单条记录
 */
function generateRecord(index: number, timestampOffset: number = 0) {
  const now = Date.now()
  // 在过去7天内随机分布
  const timestamp = now - randomInt(0, 7 * 24 * 60 * 60 * 1000) - timestampOffset

  return {
    user_id: randomChoice(USER_IDS),
    timestamp,
    note_id: randomChoice(NOTE_IDS),
    action_type: randomChoice(ACTION_TYPES),
    duration_ms: randomInt(1000, 60000),
    device_type: randomChoice(DEVICE_TYPES),
    metadata: JSON.stringify({
      seed: true,
      index,
      version: '1.0',
    }),
  }
}

/**
 * 批量插入数据
 */
async function insertBatch(
  client: ReturnType<typeof getCassandraClient> extends Promise<infer T> ? T : never,
  records: ReturnType<typeof generateRecord>[]
): Promise<void> {
  const queries = records.map((record) => ({
    query: `
      INSERT INTO lite_note_analytics.user_behavior_logs
      (user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    params: [
      record.user_id,
      record.timestamp,
      record.note_id,
      record.action_type,
      record.duration_ms,
      record.device_type,
      record.metadata,
    ],
  }))

  await client.batch(queries, { prepare: true })
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const count = args[0] ? parseInt(args[0], 10) : DEFAULT_COUNT

  if (isNaN(count) || count <= 0) {
    console.error('❌ 错误: 数量必须是正整数')
    process.exit(1)
  }

  console.log('========================================')
  console.log('Cassandra 数据种子脚本')
  console.log('========================================')
  console.log()
  console.log(`目标数量: ${count} 条`)
  console.log(`批次大小: ${BATCH_SIZE} 条`)
  console.log()

  // 检查连接
  console.log('1. 检查 Cassandra 连接...')
  const available = await isCassandraAvailable()
  if (!available) {
    console.error('❌ Cassandra 不可用，请检查:')
    console.error('   - Docker 容器是否运行: docker ps')
    console.error('   - 端口 9042 是否可访问')
    process.exit(1)
  }
  console.log('   ✅ Cassandra 可用')
  console.log()

  // 获取客户端
  console.log('2. 连接 Cassandra...')
  const client = await getCassandraClient()
  console.log('   ✅ 连接成功')
  console.log()

  // 生成并插入数据
  console.log('3. 生成并插入数据...')
  const startTime = Date.now()
  const batches = Math.ceil(count / BATCH_SIZE)
  let inserted = 0
  let failed = 0

  for (let i = 0; i < batches; i++) {
    const batchCount = Math.min(BATCH_SIZE, count - inserted)
    const records = Array.from({ length: batchCount }, (_, j) =>
      generateRecord(inserted + j, i) // 使用 i 作为微小偏移避免时间戳冲突
    )

    try {
      await insertBatch(client, records)
      inserted += batchCount
      process.stdout.write(`\r   进度: ${inserted}/${count} (${Math.round((inserted / count) * 100)}%)`)
    } catch (error) {
      failed += batchCount
      console.error(`\n   ⚠️  批次 ${i + 1}/${batches} 失败:`, (error as Error).message)
    }

    // 小延迟避免过载
    if (i < batches - 1) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  const duration = Date.now() - startTime
  console.log()
  console.log()

  // 验证
  console.log('4. 验证插入结果...')
  const countResult = await client.execute(
    'SELECT COUNT(*) FROM lite_note_analytics.user_behavior_logs'
  )
  const totalRows = countResult.rows[0].get('count')
  console.log(`   表中总记录数: ${totalRows}`)
  console.log()

  // 统计
  console.log('========================================')
  console.log('插入完成')
  console.log('========================================')
  console.log(`成功: ${inserted} 条`)
  console.log(`失败: ${failed} 条`)
  console.log(`耗时: ${duration}ms`)
  console.log(`速度: ${Math.round((inserted / duration) * 1000)} 条/秒`)
  console.log()

  if (failed > 0) {
    process.exit(1)
  }
}

// 运行
main().catch((error) => {
  console.error('❌ 脚本执行失败:', error)
  process.exit(1)
})
