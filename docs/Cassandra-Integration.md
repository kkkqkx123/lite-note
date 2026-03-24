# Cassandra 集成指南

## 概述

本项目已成功集成Cassandra数据库，实现了海量行为日志存储与多维数据分析功能。

## 架构变更

### 数据分层策略

- **SQLite**: 核心元数据 + 聚合结果存储
- **Cassandra**: 细粒度时序日志存储
- **Keyv**: 高频热点缓存

### 新增功能

1. **行为埋点系统**: 用户访问笔记时自动记录行为日志
2. **数据分析看板**: `/dashboard` 页面展示多维度分析数据
3. **数据分层聚合**: 定时任务将Cassandra数据聚合到SQLite

## 快速启动

### 方式一：使用启动脚本（推荐）

```bash
# Windows
start-with-cassandra.bat

# Linux/Mac
chmod +x start-with-cassandra.sh
./start-with-cassandra.sh
```

### 方式二：手动启动

1. 启动Cassandra容器

```bash
cd cassandra
docker-compose up -d
```

2. 等待Cassandra启动（约30秒）

3. 启动Next.js应用

```bash
npm run dev
```

## 环境配置

创建 `.env` 文件（参考 `.env.example`）：

```env
# Cassandra连接点
CASSANDRA_CONTACT_POINTS=localhost:9042

# 本地数据中心名称
CASSANDRA_LOCAL_DC=datacenter1

# 是否启用Cassandra
CASSANDRA_ENABLED=true
```

## 数据模型

### Cassandra Schema

```cql
-- Keyspace
CREATE KEYSPACE lite_note_analytics
WITH REPLICATION = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
};

-- 用户行为日志表
CREATE TABLE user_behavior_logs (
  user_id TEXT,
  timestamp BIGINT,
  note_id TEXT,
  action_type TEXT,
  duration_ms INT,
  device_type TEXT,
  metadata TEXT,
  PRIMARY KEY (user_id, timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC);
```

### SQLite Schema

```sql
-- 每日聚合统计表
CREATE TABLE daily_aggregated_stats (
  date TEXT PRIMARY KEY,
  total_views INTEGER DEFAULT 0,
  avg_duration REAL DEFAULT 0,
  top_device TEXT DEFAULT 'unknown',
  mobile_views INTEGER DEFAULT 0,
  desktop_views INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);
```

## API接口

### 记录行为日志

```typescript
import { logBehavior } from '@/app/actions/analytics'

await logBehavior({
  userId: 'user_123',
  noteId: 'note_abc',
  actionType: 'view',
  durationMs: 5000,
  deviceType: 'desktop',
  metadata: { scroll_depth: 0.8 }
})
```

### 获取趋势数据

```typescript
import { getTrends } from '@/app/actions/analytics'

const result = await getTrends()
// result.data: [{ hour: 10, count: 120 }, ...]
```

### 获取设备分布

```typescript
import { getDeviceDistribution } from '@/app/actions/analytics'

const result = await getDeviceDistribution()
// result.data: [{ device_type: 'mobile', count: 100, percentage: 60.5 }, ...]
```

### 生成测试数据

```typescript
import { generateTestData } from '@/app/actions/analytics'

const result = await generateTestData(10000)
// 生成10000条测试数据
```

## 定时任务

系统会在每日凌晨00:05自动执行数据聚合任务，将当日的Cassandra日志汇总到SQLite。

也可以手动触发：

```typescript
import { aggregateDailyStats } from '@/app/actions/analytics'

await aggregateDailyStats()
```

## Dashboard功能

访问 `/dashboard` 页面可以查看：

- **关键指标卡片**: 总阅读量、平均每小时阅读量、主要设备
- **流量趋势图**: 过去24小时每小时的访问量
- **设备分布饼图**: Mobile/Desktop/Tablet占比
- **最近活跃记录**: 最新的20条行为日志

Dashboard还提供以下操作：

- **刷新数据**: 重新拉取最新数据
- **执行聚合**: 手动触发聚合任务
- **生成测试数据**: 一键生成10000条测试数据

## 性能优化

### 写入优化

- 使用异步写入，不阻塞主流程
- Cassandra天然支持高并发写入，无需加锁

### 查询优化

- 优先从SQLite读取聚合数据
- 仅在需要细节时查询Cassandra
- 使用 `ALLOW FILTERING` 简化查询（仅用于演示，生产环境需优化）

### 容错设计

- Cassandra写入失败不影响笔记正常浏览
- Cassandra不可用时自动降级，禁用分析功能

## 注意事项

1. **首次启动**: Cassandra首次启动较慢，需等待约30秒
2. **内存限制**: Docker配置中已限制Cassandra内存为1GB
3. **生产环境**: 避免使用 `ALLOW FILTERING`，应建立索引或使用Materialized View
4. **数据清理**: 测试数据可通过Cassandra CQL命令清理

## 故障排查

### Cassandra无法连接

1. 检查Docker是否运行: `docker ps`
2. 检查Cassandra状态: `cd cassandra && docker-compose ps`
3. 查看Cassandra日志: `cd cassandra && docker-compose logs`

### Dashboard无数据

1. 检查Cassandra连接状态（Dashboard顶部状态指示器）
2. 点击"生成测试数据"按钮生成测试数据
3. 访问笔记详情页触发埋点

### 性能问题

1. 减少测试数据量
2. 增加Docker内存限制
3. 使用聚合数据而非实时查询

## 技术栈

- **Next.js 16**: App Router + Server Actions
- **Cassandra 4.1**: 时序数据库
- **cassandra-driver**: Node.js客户端
- **SQLite**: 元数据存储
- **LowDB**: 文档存储
- **Keyv**: KV缓存

## 相关文档

- [Cassandra PRD](./Cassandra-PRD.md)
- [Cassandra Docker配置](../cassandra/README.md)
