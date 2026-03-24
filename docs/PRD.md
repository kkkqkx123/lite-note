# 产品需求文档 (PRD): "LiteNote" 轻量级全栈笔记系统

| 版本 | 日期 | 修改人 | 备注 |
| :--- | :--- | :--- | :--- |
| v1.0 | 2023-10-27 | AI Architect | 初始版本：基于 Next.js + SQLite + KV + Document 的本地演示项目 |

---

## 1. 项目概述
**LiteNote** 是一个专注于“快速记录”与“知识关联”的本地化笔记应用。
本项目旨在演示 **混合数据库架构** 在 Web 开发中的实际应用：
*   **SQLite**: 作为核心业务库，管理用户、笔记元数据及关系。
*   **Document (LowDB)**: 存储非结构化的笔记正文，体现文档型数据库的灵活性。
*   **KV (LevelDB via Keyv)**: 处理高频读写（如阅读计数、缓存），体现键值存储的高性能。

**核心目标**：在无需外部服务（如 Docker/Redis Server）的情况下，通过 Next.js 实现一个功能完整、逻辑清晰、数据持久化的全栈应用。

---

## 2. 技术架构规范

### 2.1 前端
*   **框架**: Next.js 14+ (App Router)
*   **UI 组件库**: Tailwind CSS + Shadcn/UI (用于快速构建美观界面)
*   **状态管理**: React Query (可选，或直接使用 Server Actions)
*   **Markdown 渲染**: `react-markdown` + `remark-gfm`

### 2.2 后端 (Server-Side / App Router)
*   **运行时**: Node.js (Next.js 内置)
*   **ORM/SQL**: `better-sqlite3` (同步操作，高性能，单文件)
*   **文档存储**: `lowdb` (基于 JSON 文件的微型数据库)
*   **KV 缓存**: `keyv` + `@keyv/file` (或 `levelup`)，将缓存持久化为本地 JSON 文件，模拟 Redis 行为。

### 2.3 数据存储布局 (本地文件系统)
```text
/data
├── app.db              # SQLite 主数据库 (索引、元数据)
├── cache.json          # KV 缓存文件 (热度、会话)
└── docs/               # 文档目录
    ├── {note_id}.json  # 每篇笔记对应一个 JSON 文件 (正文内容)
```

---

## 3. 功能需求列表

### 3.1 核心功能模块

#### 模块 A：笔记管理 (CRUD)
| 功能点 | 详细描述 | 涉及数据库 | 优先级 |
| :--- | :--- | :--- | :--- |
| **创建笔记** | 输入标题、正文（支持 Markdown）。保存时：<br>1. SQLite 插入元数据。<br>2. LowDB 写入 JSON 文件。<br>3. 初始化 KV 计数为 0。 | SQLite, LowDB, KV | P0 |
| **编辑笔记** | 更新标题和正文。仅更新对应 JSON 文件和 SQLite 字段，不重建 KV 计数。 | SQLite, LowDB | P0 |
| **删除笔记** | 物理删除 SQLite 记录、JSON 文件，并清理相关 KV 缓存。 | All | P0 |
| **列表展示** | 显示所有笔记列表，支持按时间倒序排列、搜索标题。 | SQLite | P0 |

#### 模块 B：内容详情与交互
| 功能点 | 详细描述 | 涉及数据库 | 优先级 |
| :--- | :--- | :--- | :--- |
| **查看笔记** | 进入详情页，渲染 Markdown 内容。 | LowDB | P0 |
| **阅读量统计** | 每次访问详情页，自动增加 `note:{id}:views` 计数。 | KV | P0 |
| **热榜展示** | 首页侧边栏展示“最近热门 Top 5"，直接从 KV 读取排序结果，无需扫描 SQLite。 | KV | P1 |

#### 模块 C：标签与分类
| 功能点 | 详细描述 | 涉及数据库 | 优先级 |
| :--- | :--- | :--- | :--- |
| **标签管理** | 创建笔记时添加标签（逗号分隔）。<br>支持按标签筛选笔记列表。 | SQLite | P1 |

---

## 4. 数据库模型设计 (Schema)

### 4.1 SQLite Schema (`schema.prisma` 或 SQL)
**表名**: `notes`
| 字段名 | 类型 | 约束 | 说明 |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | PK, Unique | UUID 格式 |
| `title` | TEXT | Not Null | 笔记标题 |
| `tags` | TEXT | Default '' | 逗号分隔的标签字符串 |
| `created_at` | INTEGER | Not Null | Unix Timestamp |
| `updated_at` | INTEGER | Not Null | Unix Timestamp |

### 4.2 LowDB Structure (JSON File)
**文件名**: `docs/{id}.json`
```json
{
  "id": "uuid-xxx",
  "content": "# 标题\n这是笔记内容...",
  "metadata": {
    "word_count": 120,
    "last_edited_by": "system",
    "custom_fields": {} // 可扩展的动态字段
  }
}
```

### 4.3 KV Structure (Keyv/File)
**Key**: `note:{id}:views` -> **Value**: Integer (计数)
**Key**: `hot_notes:top5` -> **Value**: Array of IDs (定期预计算缓存，可选优化)

---

## 5. 接口与逻辑流程设计

### 5.1 创建笔记流程
1.  **前端**: 提交表单 `{ title, content, tags }`。
2.  **Server Action**:
    *   生成 `id`。
    *   **Step 1 (SQLite)**: `INSERT INTO notes ...`
    *   **Step 2 (LowDB)**: 实例化 `lowdb` 适配器，写入 `docs/${id}.json`。
    *   **Step 3 (KV)**: `cache.set('note:${id}:views', 0)`。
3.  **返回**: 重定向至 `/note/${id}`。

### 5.2 查看笔记流程 (含缓存优化)
1.  **前端**: 请求 `/note/${id}`。
2.  **Server Action**:
    *   **Step 1 (KV Check)**: 检查 `cache.get('note:${id}')`。若存在且未过期，直接返回（模拟缓存命中）。
        *   *注：演示中可故意设置极短 TTL 以触发冷启动对比，或为了简单起见，仅用 KV 存计数，正文仍查文件但加锁。*
    *   **Step 2 (Read Content)**: 读取 `docs/${id}.json` (LowDB)。
    *   **Step 3 (Update Count)**: `cache.incr('note:${id}:views')`。
    *   **Step 4 (Return)**: 组装数据返回前端渲染。

### 5.3 获取热榜流程
1.  **前端**: 请求 API `/api/hot-notes`。
2.  **Server Action**:
    *   遍历 KV 中所有 `note:*:views` 键。
    *   提取 Value，按数值降序排序。
    *   取前 5 个 ID。
    *   根据 ID 从 SQLite 获取标题供展示。
    *   *优化*: 为避免全表扫描，可维护一个 `hot_notes_cache` 键，定时任务更新。

---

## 6. UI/UX 设计指南

### 6.1 页面布局
*   **左侧导航栏**:
    *   Logo: "LiteNote"
    *   按钮："新建笔记"
    *   列表：所有笔记链接 (带标签预览)
    *   底部：热榜区域 (Top 5)
*   **右侧主内容区**:
    *   **列表页**: 卡片式布局，显示标题、摘要、最后更新时间、标签。
    *   **详情页**: 
        *   顶部：标题、编辑按钮、删除按钮。
        *   中间：Markdown 渲染区域。
        *   底部：阅读次数统计 (例如："128 次阅读")。
*   **编辑器**:
    *   简单的双栏模式：左侧输入框 (Markdown)，右侧实时预览。

### 6.2 交互细节
*   **加载状态**: 首次加载或网络请求时显示 Skeleton 占位符。
*   **错误处理**: 文件读写失败时弹出 Toast 提示。
*   **响应式**: 移动端自动隐藏侧边栏，改为抽屉菜单。

### 6.3 页面风格
- **整体风格**：极简主义（Minimalism）+ 扁平化设计（Flat Design）
- **核心原则**：简洁、清晰、功能性优先，避免冗余装饰（如渐变、阴影、立体效果）
- **配色方案**：低饱和度中性色（如浅灰#F5F5F5背景，白色#FFFFFF卡片，浅绿#C8E6C9强调色）
- **字体**：无衬线字体（如Inter、Arial），正文14-16px，标题18-24px，字重400-500

---

## 7. 开发实施计划 (MVP 阶段)

### Phase 1: 基础架构搭建 (Day 1)
*   [ ] 初始化 Next.js 项目。
*   [ ] 安装依赖：`better-sqlite3`, `lowdb`, `keyv`, `@keyv/file`, `tailwindcss`.
*   [ ] 编写 SQLite 初始化脚本 (创建表)。
*   [ ] 编写 LowDB 和 Keyv 的工具函数封装 (`lib/db.ts`, `lib/cache.ts`).

### Phase 2: 核心 CRUD 实现 (Day 2)
*   [ ] 实现 Server Action: `createNote`, `updateNote`, `deleteNote`.
*   [ ] 实现笔记列表页 (读取 SQLite)。
*   [ ] 实现笔记详情页 (读取 LowDB + 更新 KV)。
*   [ ] 实现 Markdown 编辑器组件。

### Phase 3: 高级功能与优化 (Day 3)
*   [ ] 实现标签筛选功能。
*   [ ] 实现“热榜”逻辑 (KV 读取与排序)。
*   [ ] 美化 UI (Tailwind/Shadcn)。
*   [ ] 测试本地文件读写权限与并发安全 (SQLite 锁机制)。

---

## 8. 验收标准 (Acceptance Criteria)

1.  **部署**: 只需 `npm install && npm run dev`，无需安装任何外部数据库服务。
2.  **数据持久化**: 关闭服务后重启，笔记内容、标题、阅读量统计依然存在。
3.  **性能**: 
    *   打开笔记详情页响应时间 < 50ms (得益于 KV 计数和快速文件读取)。
    *   创建笔记过程无阻塞感。
4.  **完整性**: 增删改查功能正常，Markdown 渲染正确，标签筛选有效。
5.  **代码质量**: 数据库操作逻辑分离清晰，注释完善，符合 Next.js App Router 规范。

---

## 9. 附录：关键依赖包清单

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "better-sqlite3": "^9.0.0",
    "lowdb": "^7.0.0",
    "keyv": "^4.5.0",
    "@keyv/file": "^1.3.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0"
  }
}
```