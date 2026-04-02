/**
 * Cassandra Connection Test and Test Data Script
 * 用于测试Cassandra连接并添加测试数据
 */

import { Client } from 'cassandra-driver';

// Cassandra配置
const config = {
  contactPoints: ['localhost:9042'],
  localDataCenter: 'datacenter1',
  keyspace: 'lite_note_analytics',
};

async function testCassandraConnection(): Promise<void> {
  console.log('========================================');
  console.log('Cassandra连接测试');
  console.log('========================================');
  console.log('');

  const client = new Client({
    contactPoints: config.contactPoints,
    localDataCenter: config.localDataCenter,
  });

  try {
    // 1. 连接到Cassandra
    console.log('1. 正在连接到Cassandra...');
    await client.connect();
    console.log('✓ 成功连接到Cassandra');
    console.log('');

    // 2. 创建Keyspace
    console.log('2. 正在创建Keyspace...');
    const createKeyspaceQuery = `
      CREATE KEYSPACE IF NOT EXISTS lite_note_analytics
      WITH REPLICATION = {
        'class': 'SimpleStrategy',
        'replication_factor': 1
      }
    `;
    await client.execute(createKeyspaceQuery);
    console.log('✓ Keyspace创建成功: lite_note_analytics');
    console.log('');

    // 3. 连接到Keyspace
    console.log('3. 正在连接到Keyspace...');
    await client.execute(`USE ${config.keyspace}`);
    console.log('✓ 成功连接到Keyspace');
    console.log('');

    // 4. 创建用户行为日志表
    console.log('4. 正在创建用户行为日志表...');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS user_behavior_logs (
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
    console.log('✓ 表创建成功: user_behavior_logs');
    console.log('');

    // 5. 创建每日聚合统计表
    console.log('5. 正在创建每日聚合统计表...');
    const createAggregationTableQuery = `
      CREATE TABLE IF NOT EXISTS daily_aggregated_stats (
        date TEXT,
        total_views COUNTER,
        total_duration COUNTER,
        mobile_views COUNTER,
        desktop_views COUNTER,
        PRIMARY KEY (date)
      )
    `;
    await client.execute(createAggregationTableQuery);
    console.log('✓ 表创建成功: daily_aggregated_stats');
    console.log('');

    // 6. 添加测试数据到用户行为日志表
    console.log('6. 正在添加测试数据到用户行为日志表...');
    const testUsers = ['user1', 'user2', 'user3'];
    const testActions = ['view', 'edit', 'create', 'delete'];
    const testDevices = ['mobile', 'desktop'];

    for (let i = 0; i < 10; i++) {
      const userId = testUsers[Math.floor(Math.random() * testUsers.length)];
      const actionType = testActions[Math.floor(Math.random() * testActions.length)];
      const deviceType = testDevices[Math.floor(Math.random() * testDevices.length)];
      const timestamp = Date.now() - (i * 1000 * 60 * 60); // 过去几小时的时间戳

      const insertQuery = `
        INSERT INTO user_behavior_logs (
          user_id, timestamp, note_id, action_type, duration_ms, device_type, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        userId,
        timestamp,
        `note_${i + 1}`,
        actionType,
        Math.floor(Math.random() * 60000), // 0-60秒的随机持续时间
        deviceType,
        JSON.stringify({ test: true, index: i }),
      ];

      await client.execute(insertQuery, params, { prepare: true });
    }
    console.log('✓ 成功插入10条测试数据');
    console.log('');

    // 7. 查询并显示测试数据
    console.log('7. 正在查询测试数据...');
    const selectQuery = 'SELECT * FROM user_behavior_logs LIMIT 5';
    const result = await client.execute(selectQuery);

    console.log('查询结果:');
    console.log('----------------------------------------');
    for (const row of result.rows) {
      console.log(`用户: ${row.user_id}`);
      console.log(`时间戳: ${new Date(row.timestamp).toLocaleString('zh-CN')}`);
      console.log(`笔记ID: ${row.note_id}`);
      console.log(`操作类型: ${row.action_type}`);
      console.log(`持续时间: ${row.duration_ms}ms`);
      console.log(`设备类型: ${row.device_type}`);
      console.log('----------------------------------------');
    }
    console.log('');

    // 8. 添加测试数据到每日聚合统计表
    console.log('8. 正在添加测试数据到每日聚合统计表...');
    const today = new Date().toISOString().split('T')[0];

    const updateStatsQuery = `
      UPDATE daily_aggregated_stats
      SET total_views = total_views + 100,
          total_duration = total_duration + 50000,
          mobile_views = mobile_views + 60,
          desktop_views = desktop_views + 40
      WHERE date = ?
    `;

    await client.execute(updateStatsQuery, [today], { prepare: true });
    console.log('✓ 成功更新每日统计数据');
    console.log('');

    // 9. 查询并显示统计数据
    console.log('9. 正在查询统计数据...');
    const statsResult = await client.execute('SELECT * FROM daily_aggregated_stats');

    console.log('统计结果:');
    console.log('----------------------------------------');
    for (const row of statsResult.rows) {
      console.log(`日期: ${row.date}`);
      console.log(`总浏览量: ${row.total_views}`);
      console.log(`总时长(ms): ${row.total_duration}`);
      console.log(`移动端浏览: ${row.mobile_views}`);
      console.log(`桌面端浏览: ${row.desktop_views}`);
      console.log('----------------------------------------');
    }
    console.log('');

    console.log('========================================');
    console.log('✓ 所有测试完成！');
    console.log('========================================');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  } finally {
    await client.shutdown();
    console.log('');
    console.log('连接已关闭');
  }
}

// 运行测试
testCassandraConnection()
  .then(() => {
    console.log('');
    console.log('测试脚本执行成功');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
