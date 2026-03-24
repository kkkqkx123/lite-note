/**
 * Application Bootstrap
 * 应用启动时的初始化逻辑
 */

import { initCassandra, isCassandraAvailable } from '@/lib/db/cassandra'
import { startCronJobs } from '@/lib/cron'

let initialized = false

/**
 * 初始化应用
 */
export async function bootstrap(): Promise<void> {
  if (initialized) {
    return
  }

  console.log('[Bootstrap] Initializing application...')

  // 检查Cassandra是否启用
  const cassandraEnabled = process.env.CASSANDRA_ENABLED !== 'false'

  if (cassandraEnabled) {
    // 初始化Cassandra连接和Schema
    try {
      const available = await isCassandraAvailable()
      if (available) {
        await initCassandra()
        console.log('[Bootstrap] Cassandra initialized successfully')
      } else {
        console.warn(
          '[Bootstrap] Cassandra is not available, analytics features will be disabled'
        )
      }
    } catch (error) {
      console.error('[Bootstrap] Failed to initialize Cassandra:', error)
      console.warn(
        '[Bootstrap] Continuing without Cassandra, analytics features will be disabled'
      )
    }
  } else {
    console.log('[Bootstrap] Cassandra is disabled by configuration')
  }

  // 启动定时任务
  startCronJobs()

  initialized = true
  console.log('[Bootstrap] Application initialized')
}

/**
 * 关闭应用
 */
export async function shutdown(): Promise<void> {
  console.log('[Bootstrap] Shutting down application...')

  // 停止定时任务
  const { stopCronJobs } = await import('@/lib/cron')
  stopCronJobs()

  // 关闭Cassandra连接
  const { closeCassandra } = await import('@/lib/db/cassandra')
  await closeCassandra()

  console.log('[Bootstrap] Application shutdown complete')
}
