/**
 * Cassandra Database Client
 * 用于连接和管理Cassandra数据库连接
 */

import { Client, DseClientOptions } from 'cassandra-driver';

// Cassandra配置
const CASSANDRA_CONFIG = {
  contactPoints: process.env.CASSANDRA_CONTACT_POINTS || 'localhost:9042',
  localDataCenter: process.env.CASSANDRA_LOCAL_DC || 'datacenter1',
  keyspace: 'lite_note_analytics',
};

// 单例客户端
let client: Client | null = null;

/**
 * 获取Cassandra客户端实例
 */
export function getCassandraClient(): Client {
  if (!client) {
    const options: DseClientOptions = {
      contactPoints: CASSANDRA_CONFIG.contactPoints.split(','),
      localDataCenter: CASSANDRA_CONFIG.localDataCenter,
      keyspace: CASSANDRA_CONFIG.keyspace,
    };

    client = new Client(options);
  }
  return client;
}

/**
 * 初始化Cassandra连接和Schema
 */
export async function initCassandra(): Promise<void> {
  const client = getCassandraClient();

  try {
    // 连接到Cassandra
    await client.connect();
    console.log('[Cassandra] Connected successfully');

    // 创建Keyspace（如果不存在）
    const createKeyspaceQuery = `
      CREATE KEYSPACE IF NOT EXISTS lite_note_analytics
      WITH REPLICATION = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `;
    await client.execute(createKeyspaceQuery);
    console.log('[Cassandra] Keyspace created/verified');

    // 创建用户行为日志表
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS lite_note_analytics.user_behavior_logs (
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

    // 创建每日聚合统计表（在SQLite中，但这里也创建一个Cassandra版本用于演示）
    const createAggregationTableQuery = `
      CREATE TABLE IF NOT EXISTS lite_note_analytics.daily_aggregated_stats (
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

/**
 * 关闭Cassandra连接
 */
export async function closeCassandra(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
    console.log('[Cassandra] Connection closed');
  }
}

/**
 * 检查Cassandra是否可用
 */
export async function isCassandraAvailable(): Promise<boolean> {
  try {
    const client = getCassandraClient();
    await client.connect();
    return true;
  } catch (error) {
    console.warn('[Cassandra] Connection check failed:', error);
    return false;
  }
}
