/**
 * Cron Jobs for Analytics
 * 定时任务：每日聚合统计数据
 */

import { aggregateDailyStats } from '@/app/actions/analytics'

// 定时任务配置
const CRON_CONFIG = {
  // 每日凌晨00:05执行聚合
  aggregationHour: 0,
  aggregationMinute: 5,
}

let cronInterval: NodeJS.Timeout | null = null

/**
 * 启动定时任务
 */
export function startCronJobs(): void {
  if (cronInterval) {
    console.log('[Cron] Jobs already running')
    return
  }

  console.log('[Cron] Starting cron jobs...')

  // 每分钟检查一次是否需要执行任务
  cronInterval = setInterval(async () => {
    const now = new Date()
    const hour = now.getHours()
    const minute = now.getMinutes()

    // 每日聚合任务（凌晨00:05）
    if (
      hour === CRON_CONFIG.aggregationHour &&
      minute === CRON_CONFIG.aggregationMinute
    ) {
      console.log('[Cron] Running daily aggregation...')
      try {
        const result = await aggregateDailyStats()
        if (result.success) {
          console.log('[Cron] Daily aggregation completed')
        } else {
          console.error('[Cron] Daily aggregation failed:', result.error)
        }
      } catch (error) {
        console.error('[Cron] Daily aggregation error:', error)
      }
    }
  }, 60000) // 每分钟检查一次

  console.log('[Cron] Cron jobs started')
}

/**
 * 停止定时任务
 */
export function stopCronJobs(): void {
  if (cronInterval) {
    clearInterval(cronInterval)
    cronInterval = null
    console.log('[Cron] Cron jobs stopped')
  }
}

/**
 * 手动触发聚合（用于测试）
 */
export async function triggerAggregation(): Promise<void> {
  console.log('[Cron] Manually triggering aggregation...')
  const result = await aggregateDailyStats()
  if (result.success) {
    console.log('[Cron] Aggregation completed')
  } else {
    console.error('[Cron] Aggregation failed:', result.error)
  }
}
