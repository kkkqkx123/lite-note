/**
 * Cassandra Database Client
 * 用于连接和管理Cassandra数据库连接
 * 特性：连接重试、健康检查、连接池管理、自动重建
 */

import { Client, DseClientOptions, types } from 'cassandra-driver';

// ========================================
// 配置常量
// ========================================
const CASSANDRA_CONFIG = {
  contactPoints: process.env.CASSANDRA_CONTACT_POINTS || 'localhost:9042',
  localDataCenter: process.env.CASSANDRA_LOCAL_DC || 'datacenter1',
  keyspace: 'lite_note_analytics',
  connectTimeout: parseInt(process.env.CASSANDRA_CONNECT_TIMEOUT || '5000', 10),
  requestTimeout: parseInt(process.env.CASSANDRA_REQUEST_TIMEOUT || '12000', 10),
};

// 重试配置
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 初始延迟 1 秒
  maxDelay: 10000, // 最大延迟 10 秒
};

// ========================================
// 客户端状态管理
// ========================================
let client: Client | null = null;
let isConnecting = false;
let lastError: Error | null = null;
let connectionAttempts = 0;

// ========================================
// 工具函数
// ========================================

/**
 * 指数退避延迟
 */
function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelay
  );
  // 添加随机抖动，避免惊群效应
  return delay + Math.random() * 1000;
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建客户端配置
 */
function createClientOptions(): DseClientOptions {
  return {
    contactPoints: CASSANDRA_CONFIG.contactPoints.split(',').map(p => p.trim()),
    localDataCenter: CASSANDRA_CONFIG.localDataCenter,
    keyspace: CASSANDRA_CONFIG.keyspace,
    socketOptions: {
      connectTimeout: CASSANDRA_CONFIG.connectTimeout,
      readTimeout: CASSANDRA_CONFIG.requestTimeout,
    },
    pooling: {
      coreConnectionsPerHost: {
        [types.distance.local]: 2,
        [types.distance.remote]: 1,
      },
    },
  };
}

// ========================================
// 核心连接函数
// ========================================

/**
 * 获取Cassandra客户端实例（带连接重试）
 */
export async function getCassandraClient(): Promise<Client> {
  // 如果客户端已存在且连接正常，直接返回
  if (client) {
    try {
      // 简单验证连接是否可用
      await client.execute('SELECT now() FROM system.local');
      return client;
    } catch {
      // 连接已断开，需要重建
      console.log('[Cassandra] Connection lost, reconnecting...');
      await closeCassandra();
    }
  }

  // 防止并发连接
  if (isConnecting) {
    console.log('[Cassandra] Waiting for existing connection attempt...');
    while (isConnecting) {
      await sleep(100);
    }
    if (client) return client;
  }

  isConnecting = true;

  try {
    // 重试连接
    for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
      try {
        connectionAttempts++;
        console.log(`[Cassandra] Connection attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries}...`);

        const options = createClientOptions();

        // 首次连接时不指定 keyspace，先连接系统 keyspace
        const tempClient = new Client({
          ...options,
          keyspace: undefined,
        });

        await tempClient.connect();

        // 确保 keyspace 存在
        await tempClient.execute(`
          CREATE KEYSPACE IF NOT EXISTS ${CASSANDRA_CONFIG.keyspace}
          WITH REPLICATION = {
            'class': 'SimpleStrategy',
            'replication_factor': 1
          }
        `);

        // 关闭临时连接，使用正式连接
        await tempClient.shutdown();

        // 创建带 keyspace 的正式连接
        client = new Client(options);
        await client.connect();

        lastError = null;
        console.log('[Cassandra] Connected successfully');
        return client;

      } catch (error) {
        lastError = error as Error;
        const delay = getRetryDelay(attempt);
        console.warn(`[Cassandra] Connection attempt ${attempt + 1} failed:`, (error as Error).message);

        if (attempt < RETRY_CONFIG.maxRetries - 1) {
          console.log(`[Cassandra] Retrying in ${Math.round(delay)}ms...`);
          await sleep(delay);
        }
      }
    }

    throw new Error(`Failed to connect after ${RETRY_CONFIG.maxRetries} attempts: ${lastError?.message}`);

  } finally {
    isConnecting = false;
  }
}

/**
 * 同步获取客户端（仅当已知已连接时使用）
 * @deprecated 推荐使用异步版本 getCassandraClient()
 */
export function getCassandraClientSync(): Client {
  if (!client) {
    throw new Error('Cassandra client not initialized. Call getCassandraClient() first.');
  }
  return client;
}

// ========================================
// Schema 初始化
// ========================================

/**
 * 初始化Cassandra连接和Schema
 */
export async function initCassandra(): Promise<void> {
  try {
    const client = await getCassandraClient();

    // 创建用户行为日志表
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${CASSANDRA_CONFIG.keyspace}.user_behavior_logs (
        user_id TEXT,
        timestamp BIGINT,
        note_id TEXT,
        action_type TEXT,
        duration_ms INT,
        device_type TEXT,
        metadata TEXT,
        PRIMARY KEY (user_id, timestamp)
      ) WITH CLUSTERING ORDER BY (timestamp DESC)
    `;
    await client.execute(createTableQuery);
    console.log('[Cassandra] Table user_behavior_logs created/verified');

    // 创建每日聚合统计表（COUNTER 类型用于原子计数）
    const createAggregationTableQuery = `
      CREATE TABLE IF NOT EXISTS ${CASSANDRA_CONFIG.keyspace}.daily_aggregated_stats (
        date TEXT,
        total_views COUNTER,
        total_duration COUNTER,
        mobile_views COUNTER,
        desktop_views COUNTER,
        PRIMARY KEY (date)
      )
    `;
    await client.execute(createAggregationTableQuery);
    console.log('[Cassandra] Table daily_aggregated_stats created/verified');

    console.log('[Cassandra] Schema initialization completed');
  } catch (error) {
    console.error('[Cassandra] Initialization failed:', error);
    throw error;
  }
}

// ========================================
// 连接管理
// ========================================

/**
 * 关闭Cassandra连接
 */
export async function closeCassandra(): Promise<void> {
  if (client) {
    try {
      await client.shutdown();
      console.log('[Cassandra] Connection closed');
    } catch (error) {
      console.warn('[Cassandra] Error during shutdown:', error);
    } finally {
      client = null;
      isConnecting = false;
    }
  }
}

/**
 * 检查Cassandra是否可用（快速检查）
 */
export async function isCassandraAvailable(): Promise<boolean> {
  try {
    const testClient = new Client({
      contactPoints: CASSANDRA_CONFIG.contactPoints.split(',').map(p => p.trim()),
      localDataCenter: CASSANDRA_CONFIG.localDataCenter,
      socketOptions: {
        connectTimeout: 3000, // 快速检查使用短超时
      },
    });

    await testClient.connect();
    await testClient.shutdown();
    return true;
  } catch {
    return false;
  }
}

/**
 * 健康检查（详细状态）
 */
export interface CassandraHealthStatus {
  available: boolean;
  connected: boolean;
  keyspaceReady: boolean;
  tables: {
    userBehaviorLogs: boolean;
    dailyAggregatedStats: boolean;
  };
  connectionAttempts: number;
  lastError: string | null;
  latency: number;
}

export async function checkCassandraHealth(): Promise<CassandraHealthStatus> {
  const startTime = Date.now();
  const status: CassandraHealthStatus = {
    available: false,
    connected: false,
    keyspaceReady: false,
    tables: {
      userBehaviorLogs: false,
      dailyAggregatedStats: false,
    },
    connectionAttempts,
    lastError: lastError?.message || null,
    latency: 0,
  };

  try {
    // 检查是否可用
    status.available = await isCassandraAvailable();

    if (!status.available) {
      return status;
    }

    // 获取客户端
    const c = await getCassandraClient();
    status.connected = true;

    // 检查 Keyspace
    const keyspaceResult = await c.execute(
      'SELECT keyspace_name FROM system_schema.keyspaces WHERE keyspace_name = ?',
      [CASSANDRA_CONFIG.keyspace]
    );
    status.keyspaceReady = keyspaceResult.rowLength > 0;

    if (status.keyspaceReady) {
      // 检查表是否存在
      const tablesResult = await c.execute(
        'SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?',
        [CASSANDRA_CONFIG.keyspace]
      );

      const tables = tablesResult.rows.map(row => row.get('table_name'));
      status.tables.userBehaviorLogs = tables.includes('user_behavior_logs');
      status.tables.dailyAggregatedStats = tables.includes('daily_aggregated_stats');
    }

    status.latency = Date.now() - startTime;
    return status;

  } catch (error) {
    status.lastError = (error as Error).message;
    status.latency = Date.now() - startTime;
    return status;
  }
}

// ========================================
// 数据清理工具
// ========================================

/**
 * 清理测试数据（保留表结构）
 */
export async function cleanupTestData(): Promise<{ success: boolean; deletedRows: number; error?: string }> {
  try {
    const c = await getCassandraClient();

    // 获取当前数据量
    const countResult = await c.execute(
      `SELECT COUNT(*) FROM ${CASSANDRA_CONFIG.keyspace}.user_behavior_logs`
    );
    const count = countResult.rows[0]?.get('count') || 0;

    if (count === 0) {
      return { success: true, deletedRows: 0 };
    }

    // 使用 TRUNCATE 快速清空表（比 DELETE 更高效）
    await c.execute(`TRUNCATE ${CASSANDRA_CONFIG.keyspace}.user_behavior_logs`);
    await c.execute(`TRUNCATE ${CASSANDRA_CONFIG.keyspace}.daily_aggregated_stats`);

    console.log(`[Cassandra] Cleaned up ${count} rows from test data`);
    return { success: true, deletedRows: count };

  } catch (error) {
    console.error('[Cassandra] Cleanup failed:', error);
    return {
      success: false,
      deletedRows: 0,
      error: (error as Error).message,
    };
  }
}

/**
 * 删除 Keyspace（完全重置）
 * ⚠️ 危险操作：会删除所有数据！
 */
export async function dropKeyspace(): Promise<{ success: boolean; error?: string }> {
  try {
    const c = await getCassandraClient();
    await c.execute(`DROP KEYSPACE IF EXISTS ${CASSANDRA_CONFIG.keyspace}`);
    console.log(`[Cassandra] Keyspace ${CASSANDRA_CONFIG.keyspace} dropped`);
    return { success: true };
  } catch (error) {
    console.error('[Cassandra] Drop keyspace failed:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

// ========================================
// 监控指标
// ========================================

/**
 * 获取连接统计信息
 */
export function getConnectionStats(): {
  hasClient: boolean;
  connectionAttempts: number;
  lastError: string | null;
} {
  return {
    hasClient: client !== null,
    connectionAttempts,
    lastError: lastError?.message || null,
  };
}

// ========================================
// 导出配置（供其他模块使用）
// ========================================
export { CASSANDRA_CONFIG };