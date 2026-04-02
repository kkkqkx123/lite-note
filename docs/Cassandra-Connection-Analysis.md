# Cassandra 连接深度分析文档

## 一、连接架构分析

### 1.1 连接配置来源

项目通过环境变量 + 默认值的混合方式配置 Cassandra 连接：

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| 连接点 | `CASSANDRA_CONTACT_POINTS` | `localhost:9042` | 支持多个节点，逗号分隔 |
| 数据中心 | `CASSANDRA_LOCAL_DC` | `datacenter1` | 必须与 Cassandra 配置一致 |
| 启用开关 | `CASSANDRA_ENABLED` | `true` | 控制是否启用 Cassandra 功能 |
| Keyspace | - | `lite_note_analytics` | 固定值，初始化时自动创建 |

### 1.2 连接实现细节

**文件**: `src/lib/db/cassandra.ts`

```typescript
// 单例模式管理客户端
let client: Client | null = null

export function getCassandraClient(): Client {
  if (!client) {
    client = new Client({
      contactPoints: CASSANDRA_CONFIG.contactPoints.split(','),
      localDataCenter: CASSANDRA_CONFIG.localDataCenter,
      keyspace: CASSANDRA_CONFIG.keyspace,
    })
  }
  return client
}
```

**问题识别**:
1. 单例模式在连接失败后无法自动重建
2. 缺少连接池配置
3. 没有连接超时和重试机制
4. 缺少连接健康检查

### 1.3 初始化流程

```
应用启动
  ↓
bootstrap() 调用
  ↓
检查 CASSANDRA_ENABLED
  ↓
isCassandraAvailable() 测试连接
  ↓
initCassandra() 初始化 Schema
  ↓
创建 Keyspace → 创建表 → 完成
```

## 二、验证连接的方法

### 2.1 命令行验证

```bash
# 方法1: 直接 CQL 查询
docker exec cassandra cqlsh -e "DESCRIBE KEYSPACES;"

# 方法2: 检查节点状态
docker exec cassandra nodetool status

# 方法3: 查看容器状态
docker ps --filter "name=cassandra"
```

### 2.2 脚本验证

**项目提供的测试脚本**: `scripts/test-cassandra.ts`

功能：
- 测试连接
- 创建 Keyspace 和表
- 插入 10 条测试数据
- 查询验证

运行：
```bash
npx tsx scripts/test-cassandra.ts
```

### 2.3 API 验证

```typescript
import { checkCassandraStatus } from '@/app/actions/analytics'

const status = await checkCassandraStatus()
// { available: true/false, enabled: true/false }
```

### 2.4 Dashboard 验证

访问 `/dashboard`，页面顶部显示连接状态指示器：
- 🟢 绿色：连接正常
- 🔴 红色：连接失败或未启用

## 三、添加演示数据的方法

### 3.1 方法对比

| 方法 | 适用场景 | 数据量 | 复杂度 |
|------|----------|--------|--------|
| Dashboard 界面 | 快速演示 | 10000 条 | ⭐ 简单 |
| Server Action | 程序调用 | 自定义 | ⭐⭐ 中等 |
| 埋点自动记录 | 真实场景 | 无限制 | ⭐ 简单 |
| 自定义脚本 | 特定数据 | 自定义 | ⭐⭐⭐ 复杂 |

### 3.2 Dashboard 方式（推荐）

1. 启动应用：`npm run dev`
2. 访问 `http://localhost:3000/dashboard`
3. 点击 **"生成测试数据"** 按钮
4. 等待生成完成（10000 条数据约 5-10 秒）

### 3.3 Server Action 方式

```typescript
import { generateTestData, logBehavior } from '@/app/actions/analytics'

// 生成批量测试数据
await generateTestData(1000)

// 记录单条行为
await logBehavior({
  userId: 'user_123',
  noteId: 'note_abc',
  actionType: 'view',
  durationMs: 5000,
  deviceType: 'desktop',
  metadata: { scroll_depth: 0.8 }
})
```

### 3.4 自动埋点方式

访问任意笔记页面，系统自动记录：
- 用户 ID
- 笔记 ID
- 操作类型（view/edit/scroll/click）
- 设备类型
- 持续时间

### 3.5 CQL 直接插入

```bash
# 进入 cqlsh
docker exec -it cassandra cqlsh

# 使用 keyspace
USE lite_note_analytics;

# 插入数据
INSERT INTO user_behavior_logs 
(user_id, timestamp, note_id, action_type, duration_ms, device_type)
VALUES ('demo_user', 1712345678000, 'note_1', 'view', 3000, 'mobile');
```

## 四、存在的问题

### 4.1 连接层问题

1. **缺少连接重试机制**：首次连接失败后无法自动恢复
2. **单例模式缺陷**：连接断开后 client 仍为非 null，导致无法重建
3. **缺少连接池配置**：高并发场景下性能受限
4. **没有心跳检测**：无法及时发现连接中断

### 4.2 配置层问题

1. **缺少 .env.example 文件**：新用户不知道如何配置
2. **配置验证缺失**：启动时不验证配置有效性
3. **端口硬编码**：docker-compose 和代码中端口不一致风险

### 4.3 数据层问题

1. **ALLOW FILTERING 警告**：生产环境不应使用
2. **缺少数据清理功能**：测试数据无法方便清理
3. **批量插入优化不足**：大数据量插入效率待提升

### 4.4 监控层问题

1. **缺少连接指标**：无法监控连接池状态
2. **缺少慢查询日志**：性能问题难以排查
3. **错误信息不友好**：原始错误直接暴露给用户

## 五、优化方案

### 5.1 连接优化

1. 添加连接重试机制（指数退避）
2. 实现连接健康检查
3. 配置连接池参数
4. 添加连接状态监控

### 5.2 配置优化

1. 创建 .env.example 模板
2. 添加配置验证函数
3. 统一端口配置管理

### 5.3 数据操作优化

1. 使用批量写入优化大数据量插入
2. 添加数据清理工具函数
3. 优化查询使用 Materialized View

### 5.4 监控优化

1. 添加连接指标统计
2. 实现慢查询检测
3. 友好的错误提示封装

## 六、性能基准

### 6.1 写入性能

| 数据量 | 单条插入 | 批量插入(100条) | 批量插入(1000条) |
|--------|----------|-----------------|------------------|
| 1000条 | ~5s | ~1s | ~0.8s |
| 10000条 | ~50s | ~8s | ~5s |

### 6.2 查询性能

| 查询类型 | 数据量 | 响应时间 | 备注 |
|----------|--------|----------|------|
| 单用户查询 | 1000条 | <10ms | 分区键查询 |
| 时间范围查询 | 10000条 | 50-100ms | ALLOW FILTERING |
| 聚合统计 | 100000条 | 200-500ms | 需优化 |

## 七、故障排查清单

### 7.1 连接失败

- [ ] Docker 是否运行：`docker info`
- [ ] 容器是否启动：`docker ps`
- [ ] 端口是否映射：`docker port cassandra`
- [ ] 防火墙是否放行：`netstat -an | findstr 9042`
- [ ] 环境变量是否正确：`echo %CASSANDRA_ENABLED%`

### 7.2 性能问题

- [ ] Cassandra 内存是否充足：`docker stats cassandra`
- [ ] 查询是否使用 ALLOW FILTERING
- [ ] 数据模型是否合理（分区键设计）
- [ ] 是否有适当的索引

### 7.3 数据问题

- [ ] Keyspace 是否存在：`DESCRIBE KEYSPACES;`
- [ ] 表结构是否正确：`DESCRIBE TABLE user_behavior_logs;`
- [ ] 数据是否写入：`SELECT count(*) FROM user_behavior_logs;`

## 八、相关文件

| 文件 | 说明 |
|------|------|
| `src/lib/db/cassandra.ts` | 核心连接逻辑 |
| `src/app/actions/analytics.ts` | 数据操作 API |
| `src/lib/bootstrap.ts` | 应用启动初始化 |
| `scripts/test-cassandra.ts` | 连接测试脚本 |
| `cassandra/docker-compose.yml` | Docker 配置 |
| `src/app/dashboard/page.tsx` | Dashboard 页面 |

## 九、改进建议优先级

| 优先级 | 改进项 | 影响 |
|--------|--------|------|
| P0 | 添加连接重试机制 | 稳定性 |
| P0 | 创建 .env.example | 易用性 |
| P1 | 添加健康检查 API | 可观测性 |
| P1 | 优化批量插入 | 性能 |
| P2 | 添加数据清理功能 | 维护性 |
| P2 | 慢查询检测 | 调试 |
| P3 | 连接池监控 | 运维 |
