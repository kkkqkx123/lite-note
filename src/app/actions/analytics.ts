/**
 * Analytics Server Actions
 * 数据分析相关的服务端操作
 */

'use server'

import { getCassandraClient, isCassandraAvailable } from '@/lib/db/cassandra'
import { sqlite } from '@/lib/db/sqlite'
import { kv } from '@/lib/db/kv'
import type {
  LogBehaviorInput,
  UserBehaviorLog,
  DailyAggregatedStats,
  TrendDataPoint,
  DeviceDistribution,
  UserTrack,
  ActionType,
  DeviceType,
} from '@/lib/types/analytics'
import { generateUUID } from '@/lib/utils/uuid'

// Cassandra是否启用
const CASSANDRA_ENABLED = process.env.CASSANDRA_ENABLED !== 'false'

/**
 * 记录用户行为日志
 */
export async function logBehavior(input: LogBehaviorInput): Promise<{
  success: boolean
  error?: string
}> {
  try {
    // 构建日志对象
    const log: UserBehaviorLog = {
      user_id: input.userId,
      timestamp: Date.now(),
      note_id: input.noteId,
      action_type: input.actionType,
      duration_ms: input.durationMs,
      device_type: input.deviceType || 'desktop',
      metadata: input.metadata,
    }

    // 同步更新Keyv计数（快速响应）
    if (input.noteId && input.actionType === 'view') {
      await kv.incr(`note:${input.noteId}:views`)
    }

    // 异步写入Cassandra（不阻塞主流程）
    if (CASSANDRA_ENABLED) {
      writeToCassandra(log).catch((error) => {
        console.error('[Analytics] Failed to write to Cassandra:', error)
      })
    }

    return { success: true }
  } catch (error) {
    console.error('[Analytics] logBehavior error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 异步写入Cassandra
 */
async function writeToCassandra(log: UserBehaviorLog): Promise<void> {
  const client = getCassandraClient()

  const query = `
    INSERT INTO lite_note_analytics.user_behavior_logs
    (user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `

  const params = [
    log.user_id,
    log.timestamp,
    log.note_id || null,
    log.action_type,
    log.duration_ms || null,
    log.device_type,
    log.metadata ? JSON.stringify(log.metadata) : null,
  ]

  await client.execute(query, params, { prepare: true })
}

/**
 * 获取用户轨迹
 */
export async function getUserTracks(
  userId: string,
  limit: number = 50
): Promise<{
  success: boolean
  data?: UserTrack[]
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: [] }
    }

    const client = getCassandraClient()
    const query = `
      SELECT timestamp, action_type, note_id, duration_ms, metadata
      FROM lite_note_analytics.user_behavior_logs
      WHERE user_id = ?
      LIMIT ?
    `

    const result = await client.execute(query, [userId, limit], { prepare: true })

    const tracks: UserTrack[] = result.rows.map((row) => ({
      timestamp: row.get('timestamp'),
      action_type: row.get('action_type'),
      note_id: row.get('note_id'),
      duration_ms: row.get('duration_ms'),
      metadata: row.get('metadata') ? JSON.parse(row.get('metadata')) : undefined,
    }))

    return { success: true, data: tracks }
  } catch (error) {
    console.error('[Analytics] getUserTracks error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取趋势数据（过去24小时）
 */
export async function getTrends(): Promise<{
  success: boolean
  data?: TrendDataPoint[]
  error?: string
}> {
  try {
    // 优先从SQLite读取聚合数据
    const today = new Date().toISOString().split('T')[0]
    const cachedStats = sqlite.get<DailyAggregatedStats>(
      'SELECT * FROM daily_aggregated_stats WHERE date = ?',
      [today]
    )

    if (cachedStats) {
      // 如果有缓存数据，返回模拟的小时趋势
      const trends: TrendDataPoint[] = []
      for (let i = 0; i < 24; i++) {
        trends.push({
          hour: i,
          count: Math.floor((cachedStats.total_views / 24) * (0.5 + Math.random())),
        })
      }
      return { success: true, data: trends }
    }

    // 如果没有缓存，从Cassandra查询
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: [] }
    }

    const client = getCassandraClient()
    const now = Date.now()
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

    // 注意：生产环境应避免ALLOW FILTERING，这里仅用于演示
    const query = `
      SELECT timestamp
      FROM lite_note_analytics.user_behavior_logs
      WHERE timestamp >= ?
      ALLOW FILTERING
    `

    const result = await client.execute(query, [twentyFourHoursAgo], { prepare: true })

    // 按小时分组统计
    const hourCounts: Record<number, number> = {}
    result.rows.forEach((row) => {
      const timestamp = row.get('timestamp') as number
      const hour = new Date(timestamp).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const trends: TrendDataPoint[] = []
    for (let i = 0; i < 24; i++) {
      trends.push({
        hour: i,
        count: hourCounts[i] || 0,
      })
    }

    return { success: true, data: trends }
  } catch (error) {
    console.error('[Analytics] getTrends error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取设备分布
 */
export async function getDeviceDistribution(): Promise<{
  success: boolean
  data?: DeviceDistribution[]
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: [] }
    }

    const client = getCassandraClient()

    // 注意：生产环境应避免ALLOW FILTERING，这里仅用于演示
    const query = `
      SELECT device_type
      FROM lite_note_analytics.user_behavior_logs
      ALLOW FILTERING
    `

    const result = await client.execute(query)

    // 统计设备类型
    const deviceCounts: Record<string, number> = {}
    let total = 0
    result.rows.forEach((row) => {
      const deviceType = row.get('device_type') as string
      deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1
      total++
    })

    const distribution: DeviceDistribution[] = Object.entries(deviceCounts).map(
      ([device_type, count]) => ({
        device_type,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      })
    )

    return { success: true, data: distribution }
  } catch (error) {
    console.error('[Analytics] getDeviceDistribution error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取最近的行为日志
 */
export async function getRecentLogs(limit: number = 20): Promise<{
  success: boolean
  data?: UserBehaviorLog[]
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: [] }
    }

    const client = getCassandraClient()

    // 注意：生产环境应使用Materialized View或其他优化方案
    const query = `
      SELECT user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata
      FROM lite_note_analytics.user_behavior_logs
      LIMIT ?
      ALLOW FILTERING
    `

    const result = await client.execute(query, [limit])

    const logs: UserBehaviorLog[] = result.rows.map((row) => ({
      user_id: row.get('user_id'),
      timestamp: row.get('timestamp'),
      note_id: row.get('note_id'),
      action_type: row.get('action_type'),
      duration_ms: row.get('duration_ms'),
      device_type: row.get('device_type'),
      metadata: row.get('metadata') ? JSON.parse(row.get('metadata')) : undefined,
    }))

    return { success: true, data: logs }
  } catch (error) {
    console.error('[Analytics] getRecentLogs error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 生成测试数据
 */
export async function generateTestData(count: number = 10000): Promise<{
  success: boolean
  generated?: number
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return {
        success: false,
        error: 'Cassandra is not enabled',
      }
    }

    const client = getCassandraClient()
    const actionTypes: ActionType[] = ['view', 'click', 'scroll', 'edit']
    const deviceTypes: DeviceType[] = ['mobile', 'desktop', 'tablet']

    // 批量插入
    const queries: Array<{ query: string; params: unknown[] }> = []

    for (let i = 0; i < count; i++) {
      const userId = `test_user_${Math.floor(Math.random() * 100)}`
      const noteId = `test_note_${Math.floor(Math.random() * 50)}`
      const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)]
      const deviceType = deviceTypes[Math.floor(Math.random() * deviceTypes.length)]
      const timestamp = Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000) // 过去7天内
      const durationMs = Math.floor(Math.random() * 10000)

      queries.push({
        query: `
          INSERT INTO lite_note_analytics.user_behavior_logs
          (user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          userId,
          timestamp,
          noteId,
          actionType,
          durationMs,
          deviceType,
          JSON.stringify({ test: true, batch: i }),
        ],
      })
    }

    // 批量执行
    await client.batch(queries, { prepare: true })

    return { success: true, generated: count }
  } catch (error) {
    console.error('[Analytics] generateTestData error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 聚合每日统计数据（定时任务调用）
 */
export async function aggregateDailyStats(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true }
    }

    const client = getCassandraClient()
    const today = new Date().toISOString().split('T')[0]
    const startOfToday = new Date(today).getTime()
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1

    // 查询今日所有日志
    const query = `
      SELECT duration_ms, device_type
      FROM lite_note_analytics.user_behavior_logs
      WHERE timestamp >= ? AND timestamp <= ?
      ALLOW FILTERING
    `

    const result = await client.execute(query, [startOfToday, endOfToday])

    // 计算统计数据
    let totalViews = 0
    let totalDuration = 0
    let mobileViews = 0
    let desktopViews = 0

    result.rows.forEach((row) => {
      totalViews++
      const duration = row.get('duration_ms') as number
      if (duration) totalDuration += duration

      const deviceType = row.get('device_type') as string
      if (deviceType === 'mobile') mobileViews++
      else if (deviceType === 'desktop') desktopViews++
    })

    const avgDuration = totalViews > 0 ? totalDuration / totalViews : 0
    const topDevice = mobileViews > desktopViews ? 'mobile' : 'desktop'

    // 写入SQLite
    sqlite.run(
      `
      INSERT OR REPLACE INTO daily_aggregated_stats
      (date, total_views, avg_duration, top_device, mobile_views, desktop_views, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [today, totalViews, avgDuration, topDevice, mobileViews, desktopViews, Date.now()]
    )

    console.log(`[Analytics] Aggregated stats for ${today}: ${totalViews} views`)
    return { success: true }
  } catch (error) {
    console.error('[Analytics] aggregateDailyStats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 检查Cassandra连接状态
 */
export async function checkCassandraStatus(): Promise<{
  available: boolean
  enabled: boolean
}> {
  const available = CASSANDRA_ENABLED ? await isCassandraAvailable() : false
  return {
    available,
    enabled: CASSANDRA_ENABLED,
  }
}
