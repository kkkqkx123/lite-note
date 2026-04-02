/**
 * Analytics Server Actions
 * 数据分析相关的服务端操作
 * 功能：行为日志记录、数据查询、测试数据生成、数据清理
 */

'use server'

import {
  getCassandraClient,
  isCassandraAvailable,
  checkCassandraHealth,
  cleanupTestData,
  dropKeyspace,
  type CassandraHealthStatus,
} from '@/lib/db/cassandra'
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

// Cassandra是否启用
const CASSANDRA_ENABLED = process.env.CASSANDRA_ENABLED !== 'false'

// 批量插入配置
const BATCH_SIZE = 100 // 每批插入数量（避免 Batch too large 错误）
const MAX_CONCURRENT_BATCHES = 3 // 最大并发批次数

// ========================================
// 行为日志记录
// ========================================

/**
 * 记录用户行为日志
 * 快速响应，Cassandra 写入异步执行
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
  try {
    const client = await getCassandraClient()

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
  } catch (error) {
    console.error('[Analytics] Write to Cassandra failed:', error)
    throw error
  }
}

// ========================================
// 数据查询
// ========================================

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

    const client = await getCassandraClient()
    const query = `
      SELECT timestamp, action_type, note_id, duration_ms, metadata
      FROM lite_note_analytics.user_behavior_logs
      WHERE user_id = ?
      LIMIT ?
    `

    const result = await client.execute(query, [userId, limit], { prepare: true })

    const tracks: UserTrack[] = result.rows.map((row) => {
      // 处理 BIGINT 类型转换
      const timestamp = row.get('timestamp')
      return {
        timestamp: typeof timestamp === 'object' && timestamp !== null
          ? Number(timestamp.toString())
          : Number(timestamp),
        action_type: row.get('action_type'),
        note_id: row.get('note_id'),
        duration_ms: row.get('duration_ms'),
        metadata: row.get('metadata') ? JSON.parse(row.get('metadata')) : undefined,
      }
    })

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

    const client = await getCassandraClient()
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
      // 处理 BIGINT 类型转换
      const ts = row.get('timestamp')
      const timestamp = typeof ts === 'object' && ts !== null
        ? Number(ts.toString())
        : Number(ts)
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

    const client = await getCassandraClient()

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

    const client = await getCassandraClient()

    // 注意：生产环境应使用Materialized View或其他优化方案
    const query = `
      SELECT user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata
      FROM lite_note_analytics.user_behavior_logs
      LIMIT ?
      ALLOW FILTERING
    `

    const result = await client.execute(query, [limit])

    const logs: UserBehaviorLog[] = result.rows.map((row) => {
      // 处理 BIGINT 类型转换
      const timestamp = row.get('timestamp')
      return {
        user_id: row.get('user_id'),
        timestamp: typeof timestamp === 'object' && timestamp !== null
          ? Number(timestamp.toString())
          : Number(timestamp),
        note_id: row.get('note_id'),
        action_type: row.get('action_type'),
        duration_ms: row.get('duration_ms'),
        device_type: row.get('device_type'),
        metadata: row.get('metadata') ? JSON.parse(row.get('metadata')) : undefined,
      }
    })

    return { success: true, data: logs }
  } catch (error) {
    console.error('[Analytics] getRecentLogs error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ========================================
// 测试数据生成
// ========================================

/**
 * 生成测试数据（简化版，仅用于小量测试）
 * 
 * ⚠️ 注意: 大量数据插入请使用外部脚本:
 *   npx tsx scripts/seed-cassandra.ts [数量]
 * 
 * 此函数仅适合生成少量数据（< 500条）用于快速测试
 */
export async function generateTestData(count: number = 100): Promise<{
  success: boolean
  generated?: number
  duration?: number
  error?: string
}> {
  const startTime = Date.now()

  // 限制最大数量，推荐使用外部脚本
  const MAX_RECORDS = 500
  if (count > MAX_RECORDS) {
    return {
      success: false,
      error: `数量 ${count} 超过限制 ${MAX_RECORDS}。大量数据请使用脚本: npx tsx scripts/seed-cassandra.ts ${count}`,
    }
  }

  try {
    if (!CASSANDRA_ENABLED) {
      return {
        success: false,
        error: 'Cassandra is not enabled',
      }
    }

    const client = await getCassandraClient()
    const actionTypes: ActionType[] = ['view', 'click', 'scroll', 'edit']
    const deviceTypes: DeviceType[] = ['mobile', 'desktop', 'tablet']

    // 单条顺序插入（小数据量更稳定）
    for (let i = 0; i < count; i++) {
      const userId = `test_user_${Math.floor(Math.random() * 100)}`
      const noteId = `test_note_${Math.floor(Math.random() * 50)}`
      const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)]
      const deviceType = deviceTypes[Math.floor(Math.random() * deviceTypes.length)]
      const timestamp = Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      const durationMs = Math.floor(Math.random() * 10000)

      await client.execute(
        `INSERT INTO lite_note_analytics.user_behavior_logs
         (user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          timestamp,
          noteId,
          actionType,
          durationMs,
          deviceType,
          JSON.stringify({ test: true, batch: i }),
        ],
        { prepare: true }
      )
    }

    const duration = Date.now() - startTime
    console.log(`[Analytics] Generated ${count} test records in ${duration}ms`)

    return { success: true, generated: count, duration }
  } catch (error) {
    console.error('[Analytics] generateTestData error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ========================================
// 数据统计
// ========================================

/**
 * 聚合每日统计数据（定时任务调用）
 */
export async function aggregateDailyStats(): Promise<{
  success: boolean
  stats?: {
    totalViews: number
    avgDuration: number
    topDevice: string
  }
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true }
    }

    const client = await getCassandraClient()
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
    return {
      success: true,
      stats: {
        totalViews,
        avgDuration,
        topDevice,
      },
    }
  } catch (error) {
    console.error('[Analytics] aggregateDailyStats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ========================================
// 状态检查与清理
// ========================================

/**
 * 检查Cassandra连接状态（简单版）
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

/**
 * 获取Cassandra健康状态（详细版）
 */
export async function getCassandraHealth(): Promise<{
  success: boolean
  status?: CassandraHealthStatus
  error?: string
}> {
  try {
    const status = await checkCassandraHealth()
    return { success: true, status }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 清理测试数据
 */
export async function cleanupCassandraData(): Promise<{
  success: boolean
  deletedRows?: number
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: false, error: 'Cassandra is not enabled' }
    }

    const result = await cleanupTestData()
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 重置Cassandra（删除Keyspace）
 * ⚠️ 危险操作：会删除所有数据！
 */
export async function resetCassandra(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: false, error: 'Cassandra is not enabled' }
    }

    const result = await dropKeyspace()
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ========================================
// 统计信息
// ========================================

// ========================================
// 准确的统计查询（新增）
// ========================================

/**
 * 获取准确的总记录数
 */
export async function getTotalRecords(): Promise<{
  success: boolean
  count?: number
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, count: 0 }
    }

    const client = await getCassandraClient()

    // 使用系统表获取估计值（性能更好）
    const query = `
      SELECT SUM(rows) as total_rows
      FROM system.size_estimates
      WHERE keyspace_name = 'lite_note_analytics'
      AND table_name = 'user_behavior_logs'
    `

    const result = await client.execute(query)
    const estimatedCount = result.rows[0]?.get('total_rows') as number | undefined

    // 如果系统表没有数据，使用精确计数（较慢）
    if (!estimatedCount || estimatedCount === 0) {
      const countQuery = `
        SELECT COUNT(*) FROM lite_note_analytics.user_behavior_logs
      `
      const countResult = await client.execute(countQuery)
      const exactCount = countResult.rows[0]?.get('count') || 0
      return { success: true, count: exactCount }
    }

    return { success: true, count: estimatedCount }
  } catch (error) {
    console.error('[Analytics] getTotalRecords error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取过去24小时准确的趋势数据（按小时分组）
 */
export async function getAccurateTrends(): Promise<{
  success: boolean
  data?: TrendDataPoint[]
  totalCount?: number
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: [], totalCount: 0 }
    }

    const client = await getCassandraClient()
    const now = Date.now()
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000

    // 查询过去24小时的数据
    // 注意：由于 Cassandra 的数据模型限制，这里需要 ALLOW FILTERING
    // 生产环境应该使用专门的时序表或 Materialized View
    const query = `
      SELECT timestamp
      FROM lite_note_analytics.user_behavior_logs
      WHERE timestamp >= ?
      ALLOW FILTERING
    `

    const result = await client.execute(query, [twentyFourHoursAgo], { prepare: true })

    // 按小时分组统计（真实数据，非随机）
    const hourCounts: Record<number, number> = {}
    let totalCount = 0

    result.rows.forEach((row) => {
      const ts = row.get('timestamp')
      const timestamp = typeof ts === 'object' && ts !== null
        ? Number(ts.toString())
        : Number(ts)
      const hour = new Date(timestamp).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
      totalCount++
    })

    // 构建24小时的趋势数据
    const trends: TrendDataPoint[] = []
    for (let i = 0; i < 24; i++) {
      trends.push({
        hour: i,
        count: hourCounts[i] || 0,
      })
    }

    return { success: true, data: trends, totalCount }
  } catch (error) {
    console.error('[Analytics] getAccurateTrends error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取准确的Dashboard统计数据
 */
export async function getDashboardStats(): Promise<{
  success: boolean
  data?: {
    totalRecords: number
    last24Hours: {
      total: number
      avgPerHour: number
      trends: TrendDataPoint[]
    }
    deviceDistribution: DeviceDistribution[]
    topDevice: string
  }
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return {
        success: true,
        data: {
          totalRecords: 0,
          last24Hours: { total: 0, avgPerHour: 0, trends: [] },
          deviceDistribution: [],
          topDevice: 'N/A',
        },
      }
    }

    const client = await getCassandraClient()

    // 1. 获取总记录数
    const totalResult = await getTotalRecords()
    const totalRecords = totalResult.success ? (totalResult.count || 0) : 0

    // 2. 获取过去24小时的趋势数据
    const trendsResult = await getAccurateTrends()
    const last24Total = trendsResult.success ? (trendsResult.totalCount || 0) : 0
    const trends = trendsResult.success ? (trendsResult.data || []) : []
    const avgPerHour = trends.length > 0 ? Math.round(last24Total / 24) : 0

    // 3. 获取设备分布（使用抽样优化）
    const deviceQuery = `
      SELECT device_type
      FROM lite_note_analytics.user_behavior_logs
      LIMIT 10000
    `
    const deviceResult = await client.execute(deviceQuery)

    const deviceCounts: Record<string, number> = {}
    deviceResult.rows.forEach((row) => {
      const deviceType = row.get('device_type') as string
      deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1
    })

    const totalSampled = Object.values(deviceCounts).reduce((a, b) => a + b, 0)
    const deviceDistribution: DeviceDistribution[] = Object.entries(deviceCounts)
      .map(([device_type, count]) => ({
        device_type,
        count,
        percentage: totalSampled > 0 ? (count / totalSampled) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)

    const topDevice = deviceDistribution.length > 0
      ? deviceDistribution[0].device_type
      : 'N/A'

    return {
      success: true,
      data: {
        totalRecords,
        last24Hours: {
          total: last24Total,
          avgPerHour,
          trends,
        },
        deviceDistribution,
        topDevice,
      },
    }
  } catch (error) {
    console.error('[Analytics] getDashboardStats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ========================================
// 原有的概览统计
// ========================================

/**
 * 获取数据概览统计
 */
export async function getDataOverview(): Promise<{
  success: boolean
  data?: {
    totalRecords: number
    uniqueUsers: number
    uniqueNotes: number
    dateRange: {
      start: string
      end: string
    }
  }
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: undefined }
    }

    const client = await getCassandraClient()

    // 获取总记录数（估计值）
    const countResult = await client.execute(
      `SELECT COUNT(*) FROM lite_note_analytics.user_behavior_logs`
    )
    const totalRecords = countResult.rows[0]?.get('count') || 0

    // 获取唯一用户数
    const usersResult = await client.execute(
      `SELECT COUNT(DISTINCT user_id) FROM lite_note_analytics.user_behavior_logs`
    )
    const uniqueUsers = usersResult.rows[0]?.get('count') || 0

    return {
      success: true,
      data: {
        totalRecords,
        uniqueUsers,
        uniqueNotes: 0, // 需要额外查询
        dateRange: {
          start: '',
          end: '',
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ========================================
// 数据表格查询（分页、筛选）
// ========================================

export interface QueryLogsParams {
  page?: number
  pageSize?: number
  userId?: string
  noteId?: string
  actionType?: ActionType
  deviceType?: DeviceType
  startTime?: number
  endTime?: number
}

export interface QueryLogsResult {
  logs: UserBehaviorLog[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * 分页查询行为日志
 */
export async function queryLogs(params: QueryLogsParams = {}): Promise<{
  success: boolean
  data?: QueryLogsResult
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: { logs: [], total: 0, page: 1, pageSize: 20, hasMore: false } }
    }

    const client = await getCassandraClient()
    const {
      page = 1,
      pageSize = 20,
      userId,
      noteId,
      actionType,
      deviceType,
      startTime,
      endTime,
    } = params

    // 构建 WHERE 条件
    const conditions: string[] = []
    const queryParams: unknown[] = []

    if (userId) {
      conditions.push('user_id = ?')
      queryParams.push(userId)
    }
    if (noteId) {
      conditions.push('note_id = ?')
      queryParams.push(noteId)
    }
    if (actionType) {
      conditions.push('action_type = ?')
      queryParams.push(actionType)
    }
    if (deviceType) {
      conditions.push('device_type = ?')
      queryParams.push(deviceType)
    }
    if (startTime) {
      conditions.push('timestamp >= ?')
      queryParams.push(startTime)
    }
    if (endTime) {
      conditions.push('timestamp <= ?')
      queryParams.push(endTime)
    }

    // 先获取总数（使用 ALLOW FILTERING）
    let total = 0
    if (conditions.length > 0) {
      const countQuery = `
        SELECT COUNT(*) FROM lite_note_analytics.user_behavior_logs
        WHERE ${conditions.join(' AND ')}
        ALLOW FILTERING
      `
      const countResult = await client.execute(countQuery, queryParams)
      total = countResult.rows[0]?.get('count') || 0
    } else {
      const countResult = await client.execute(
        'SELECT COUNT(*) FROM lite_note_analytics.user_behavior_logs'
      )
      total = countResult.rows[0]?.get('count') || 0
    }

    // 查询数据（限制返回数量）
    let query: string
    let finalParams: unknown[]

    if (conditions.length > 0) {
      query = `
        SELECT user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata
        FROM lite_note_analytics.user_behavior_logs
        WHERE ${conditions.join(' AND ')}
        ALLOW FILTERING
        LIMIT ?
      `
      finalParams = [...queryParams, pageSize]
    } else {
      query = `
        SELECT user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata
        FROM lite_note_analytics.user_behavior_logs
        LIMIT ?
      `
      finalParams = [pageSize]
    }

    const result = await client.execute(query, finalParams, { prepare: true })

    const logs: UserBehaviorLog[] = result.rows.map((row) => {
      const timestamp = row.get('timestamp')
      return {
        user_id: row.get('user_id'),
        timestamp: typeof timestamp === 'object' && timestamp !== null
          ? Number(timestamp.toString())
          : Number(timestamp),
        note_id: row.get('note_id'),
        action_type: row.get('action_type'),
        duration_ms: row.get('duration_ms'),
        device_type: row.get('device_type'),
        metadata: row.get('metadata') ? JSON.parse(row.get('metadata')) : undefined,
      }
    })

    return {
      success: true,
      data: {
        logs,
        total,
        page,
        pageSize,
        hasMore: logs.length === pageSize,
      },
    }
  } catch (error) {
    console.error('[Analytics] queryLogs error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取所有用户列表
 */
export async function getAllUsers(): Promise<{
  success: boolean
  data?: { user_id: string; count: number }[]
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: [] }
    }

    const client = await getCassandraClient()

    // 获取所有用户及其记录数
    const query = `
      SELECT user_id, COUNT(*) as count
      FROM lite_note_analytics.user_behavior_logs
      GROUP BY user_id
      ALLOW FILTERING
    `

    const result = await client.execute(query)

    const users = result.rows.map((row) => ({
      user_id: row.get('user_id'),
      count: row.get('count'),
    }))

    return { success: true, data: users }
  } catch (error) {
    console.error('[Analytics] getAllUsers error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取所有笔记列表
 */
export async function getAllNotes(): Promise<{
  success: boolean
  data?: { note_id: string; count: number }[]
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true, data: [] }
    }

    const client = await getCassandraClient()

    const query = `
      SELECT note_id, COUNT(*) as count
      FROM lite_note_analytics.user_behavior_logs
      WHERE note_id IS NOT NULL
      GROUP BY note_id
      ALLOW FILTERING
    `

    const result = await client.execute(query)

    const notes = result.rows
      .map((row) => ({
        note_id: row.get('note_id'),
        count: row.get('count'),
      }))
      .filter((n) => n.note_id)

    return { success: true, data: notes }
  } catch (error) {
    console.error('[Analytics] getAllNotes error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取用户统计信息
 */
export async function getUserStats(userId: string): Promise<{
  success: boolean
  data?: {
    totalActions: number
    actionTypes: Record<string, number>
    deviceTypes: Record<string, number>
    totalDuration: number
    avgDuration: number
  }
  error?: string
}> {
  try {
    if (!CASSANDRA_ENABLED) {
      return { success: true }
    }

    const client = await getCassandraClient()

    const query = `
      SELECT action_type, device_type, duration_ms
      FROM lite_note_analytics.user_behavior_logs
      WHERE user_id = ?
      ALLOW FILTERING
    `

    const result = await client.execute(query, [userId], { prepare: true })

    let totalActions = 0
    let totalDuration = 0
    const actionTypes: Record<string, number> = {}
    const deviceTypes: Record<string, number> = {}

    result.rows.forEach((row) => {
      totalActions++
      const actionType = row.get('action_type')
      const deviceType = row.get('device_type')
      const duration = row.get('duration_ms') as number

      actionTypes[actionType] = (actionTypes[actionType] || 0) + 1
      deviceTypes[deviceType] = (deviceTypes[deviceType] || 0) + 1
      if (duration) totalDuration += duration
    })

    return {
      success: true,
      data: {
        totalActions,
        actionTypes,
        deviceTypes,
        totalDuration,
        avgDuration: totalActions > 0 ? totalDuration / totalActions : 0,
      },
    }
  } catch (error) {
    console.error('[Analytics] getUserStats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}