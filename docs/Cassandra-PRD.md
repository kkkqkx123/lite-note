# 产品需求文档 (PRD) - 增量扩展：LiteNote Analytics

**版本**: v1.1 (Analytics Extension)  
**基于**: LiteNote v1.0 PRD  
**日期**: 2023-10-28  
**目标**: 在现有 Next.js + SQLite + LowDB + Keyv 架构基础上，集成 **Docker Cassandra**，实现**海量行为日志存储**与**多维数据分析**功能。

---

## 1. 变更概述

本次更新不重构核心业务逻辑（笔记 CRUD），仅在原有架构上增加**“数据分层”**与**“分析层”**：

- **新增组件**: Docker 容器化 Cassandra 实例。
- **新增功能**: 用户行为埋点、实时日志流、多维数据看板。
- **核心变化**:
  - `SQLite` 从“唯一数据存储”降级为“核心元数据 + 聚合结果存储”。
  - `Cassandra` 接管“细粒度时序日志”存储。
  - `Keyv` 继续负责“高频热点缓存”。

---

## 2. 技术架构变更

### 2.1 基础设施 (Infrastructure)

- **新增依赖**: `docker-compose.yml` 需包含 `cassandra:4.1` 服务。
- **网络**: 确保 Next.js 应用容器/进程能通过 `cassandra` 主机名访问 CQL 端口 (`9042`)。
- **驱动**: 后端引入 `cassandra-driver` npm 包。

### 2.2 数据模型扩展

#### A. Cassandra Schema (列族设计)

**Keyspace**: `lite_note_analytics`  
**Table**: `user_behavior_logs` (宽表结构，按时间排序)

| 字段类型           | 字段名        | 说明                               | 示例值                  |
| :----------------- | :------------ | :--------------------------------- | :---------------------- |
| **Partition Key**  | `user_id`     | 分区键，按用户分片，优化单用户查询 | "usr_123"               |
| **Clustering Key** | `timestamp`   | 聚簇键，自动按时间倒序排列         | 1698776543210           |
| **Column**         | `note_id`     | 关联的笔记 ID                      | "note_abc"              |
| **Column**         | `action_type` | 行为类型 (view, click, scroll)     | "scroll"                |
| **Column**         | `duration_ms` | 停留时长 (毫秒)                    | 5000                    |
| **Column**         | `device_type` | 设备类型 (mobile, desktop)         | "desktop"               |
| **Column**         | `metadata`    | JSON 字符串，存储动态扩展字段      | `{"scroll_depth": 0.8}` |

> **设计理由**: 这种结构支持高效的 `SELECT ... WHERE user_id = ? ORDER BY timestamp DESC` 查询，完美适配“查看某用户历史轨迹”的需求，且写入时无锁。

#### B. SQLite Schema 变更

**新增表**: `daily_aggregated_stats` (用于前端快速读取聚合报表，避免直接扫描 Cassandra)

| 字段名         | 类型    | 说明              |
| :------------- | :------ | :---------------- |
| `date`         | TEXT    | 日期 (YYYY-MM-DD) |
| `total_views`  | INTEGER | 当日总阅读量      |
| `avg_duration` | REAL    | 平均停留时长      |
| `top_device`   | TEXT    | 主要设备类型      |

---

## 3. 功能需求详情

### 3.1 行为埋点系统 (Data Ingestion)

**描述**: 增强现有的“查看笔记”流程，增加后台异步日志记录。

| 功能点       | 详细描述                                           | 逻辑流程                                                                                                                                                                 |
| :----------- | :------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **智能埋点** | 当用户访问 `/note/[id]` 时，前端自动上报行为数据。 | 1. 前端触发 `POST /api/log`。<br>2. **同步路径**: 更新 Keyv 计数 (`views++`)，返回成功。<br>3. **异步路径**: 将详细日志写入 Cassandra (使用 `executeAsync` 或批量写入)。 |
| **模拟刷量** | 管理后台提供“生成测试数据”按钮。                   | 点击后，后端循环调用 Cassandra 插入接口，一次性生成 10,000+ 条不同用户的模拟日志，用于演示高吞吐。                                                                       |
| **动态字段** | 支持记录非结构化数据（如滚动深度）。               | `metadata` 字段存储 JSON，体现 NoSQL 灵活 Schema 优势。                                                                                                                  |

### 3.2 数据分析看板 (Analytics Dashboard)

**描述**: 新增 `/dashboard` 页面，展示基于 Cassandra 数据的可视化图表。

| 功能点           | 详细描述                                             | 数据来源                                                                                                         |
| :--------------- | :--------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **实时趋势图**   | 展示过去 24 小时每小时的访问量波动。                 | 查询 Cassandra: `SELECT count(*) FROM logs WHERE timestamp > now() - 24h GROUP BY hour` (或通过定时任务预计算)。 |
| **设备分布饼图** | 统计 Mobile vs Desktop 的占比。                      | 查询 Cassandra: `SELECT device_type, count(*) FROM logs GROUP BY device_type`.                                   |
| **长尾内容挖掘** | 找出“阅读量大但平均停留时间短”的笔记（可能标题党）。 | 复杂查询：Join `logs` 和 `notes` (在应用层 Join)，利用 Cassandra 快速扫描全表特性。                              |
| **用户轨迹回放** | 输入 User ID，展示该用户的所有操作时间轴。           | 查询 Cassandra: `SELECT action_type, duration_ms, note_id FROM logs WHERE user_id = ? LIMIT 50`.                 |

### 3.3 数据分层聚合 (Aggregation Layer)

**描述**: 解决 Cassandra 查询复杂聚合性能下降的问题，采用“原始数据存 NoSQL，聚合结果存 SQL"策略。

| 功能点       | 详细描述                                                                  | 执行频率                            |
| :----------- | :------------------------------------------------------------------------ | :---------------------------------- |
| **每日快照** | 定时任务将今日 Cassandra 日志汇总，写入 SQLite `daily_aggregated_stats`。 | 每日凌晨 00:05 (Node.js Cron Job)。 |
| **报表加速** | 前端仪表盘优先读取 SQLite 中的聚合数据，仅在需要细节时查 Cassandra。      | 实时 (Dashboard 加载时)。           |

---

## 4. 接口设计变更 (API Changes)

### 4.1 新增接口

- `POST /api/log`
  - **Body**: `{ userId, noteId, actionType, metadata }`
  - **Logic**: 写入 Cassandra (异步)。
  - **Response**: `{ status: 'logged' }` (不阻塞主流程)。

- `GET /api/analytics/trends`
  - **Query**: `?period=24h`
  - **Logic**: 优先查 SQLite 聚合表；若无数据则临时查询 Cassandra。
  - **Response**: `{ data: [{ hour: 10, count: 120 }, ...] }`

- `POST /api/admin/generate-data`
  - **Body**: `{ count: 10000 }`
  - **Logic**: 批量向 Cassandra 插入随机生成的日志。
  - **Response**: `{ generated: 10000 }`

### 4.2 修改接口

- `GET /api/note/:id`
  - **Logic 变更**: 增加 `async` 写入日志步骤。
  - **注意**: 必须确保 Cassandra 写入失败不影响笔记内容的正常返回（Try-Catch 包裹）。

---

## 5. UI/UX 扩展设计

### 5.1 新增页面：`/dashboard`

- **布局**:
  - 顶部：关键指标卡片 (Total Views, Avg Duration, Active Users)。
  - 中部：双栏图表 (左侧：流量趋势折线图；右侧：设备分布饼图)。
  - 底部：最近活跃用户列表 (实时流效果)。
- **交互**:
  - 点击“刷新数据”按钮，强制重新拉取最新 Cassandra 数据。
  - 提供“生成测试数据”悬浮按钮，方便演示高并发场景。

### 5.2 侧边栏增强

- 在原有菜单下增加“数据分析”入口。
- 在笔记详情页底部增加“高级分析”链接，跳转至该笔记的详细行为日志。

---

## 6. 实施计划 (增量阶段)

| 阶段                    | 任务                                                                                                                    | 预计耗时 | 产出物                                       |
| :---------------------- | :---------------------------------------------------------------------------------------------------------------------- | :------- | :------------------------------------------- |
| **Phase 1: 环境搭建**   | 1. 编写 `docker-compose.yml` 添加 Cassandra。<br>2. 安装 `cassandra-driver`。<br>3. 编写初始化脚本创建 Keyspace/Table。 | 2 小时   | 可运行的 Docker 环境，数据库自动建表。       |
| **Phase 2: 埋点接入**   | 1. 修改 `getNote` Server Action，加入异步写日志逻辑。<br>2. 实现 `POST /api/log` 接口。<br>3. 前端埋点代码集成。        | 3 小时   | 用户访问即产生日志，日志持久化到 Cassandra。 |
| **Phase 3: 分析看板**   | 1. 开发 `/dashboard` 页面组件。<br>2. 实现 CQL 查询逻辑 (趋势、分组)。<br>3. 集成 ECharts/Recharts 渲染图表。           | 4 小时   | 可视化的数据分析大屏。                       |
| **Phase 4: 聚合与优化** | 1. 编写定时任务 (Cron) 将数据同步至 SQLite。<br>2. 实现“生成测试数据”功能。<br>3. 压力测试与调优。                      | 3 小时   | 高性能聚合报表，演示用 Mock 数据生成器。     |

---

## 7. 验收标准 (Acceptance Criteria)

1.  **部署验证**: 运行 `docker compose up` 后，Cassandra 自动启动并可连接。
2.  **数据一致性**:
    - 访问笔记后，Keyv 计数立即增加。
    - 1 秒内，Cassandra 中可见对应的详细日志记录。
    - 次日 00:05，SQLite 中出现正确的聚合统计数据。
3.  **性能表现**:
    - 点击“生成 10,000 条数据”，后端处理时间 < 5 秒。
    - 查询任意用户的历史轨迹 (< 50 条记录)，响应时间 < 200ms。
4.  **容错性**: 即使 Cassandra 服务暂时不可用，用户依然可以正常浏览笔记（日志写入失败不阻断主流程）。
5.  **演示效果**: 能够直观展示“海量日志写入”和“多维度分析”的功能，且无需手动配置任何外部数据库。

---

## 8. 风险与应对

- **风险**: Cassandra 首次启动慢或内存占用高。
  - **应对**: 限制 Docker 内存为 512MB，并在初始化脚本中加入健康检查等待。
- **风险**: 生产环境禁止 `ALLOW FILTERING`。
  - **应对**: 本演示项目明确标注为“本地演示”，代码中使用 `ALLOW FILTERING` 以简化查询，但在注释中注明生产环境需建立索引或使用 Materialized View。
- **风险**: 并发写入冲突。
  - **应对**: 利用 Cassandra 的 Append-only 特性，天然支持高并发写入，无需加锁。

---

此增量 PRD 确保了在保持原有项目简单性的前提下，平滑地引入了复杂的 NoSQL 场景，完美契合“混合架构演示”的目标。
