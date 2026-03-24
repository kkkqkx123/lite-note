# LiteNote - 轻量级全栈笔记系统

一个专注于"快速记录"与"知识关联"的本地化笔记应用,演示混合数据库架构在Web开发中的实际应用。

## 技术栈

### 前端
- **框架**: Next.js 14+ (App Router)
- **UI组件**: Tailwind CSS + 自定义组件
- **Markdown渲染**: react-markdown + remark-gfm

### 后端
- **运行时**: Node.js (Next.js 内置)
- **ORM/SQL**: better-sqlite3 (同步操作,高性能,单文件)
- **文档存储**: lowdb (基于JSON文件的微型数据库)
- **KV缓存**: keyv + 自定义文件适配器

### 数据存储布局
```
/data
├── app.db              # SQLite主数据库(索引、元数据)
├── cache.json          # KV缓存文件(热度、会话)
└── docs/               # 文档目录
    ├── {note_id}.json  # 每篇笔记对应一个JSON文件(正文内容)
```

## 功能特性

### 核心功能
- ✅ 笔记创建、编辑、删除
- ✅ Markdown编辑器(实时预览)
- ✅ 笔记列表展示(卡片式布局)
- ✅ 搜索功能(标题搜索)
- ✅ 标签管理
- ✅ 阅读量统计
- ✅ 热门笔记排行(Top 5)

### 技术特性
- ✅ 混合数据库架构(SQLite + LowDB + KV)
- ✅ Server Actions实现
- ✅ 响应式设计
- ✅ 数据持久化
- ✅ 无需外部数据库服务

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
npm start
```

## 项目结构

```
lite-note/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── actions/           # Server Actions
│   │   │   └── notes.ts       # 笔记相关操作
│   │   ├── note/              # 笔记相关页面
│   │   │   ├── [id]/         # 笔记详情页
│   │   │   ├── new/          # 新建笔记页
│   │   │   └── edit/[id]/    # 编辑笔记页
│   │   ├── layout.tsx        # 根布局
│   │   ├── page.tsx          # 首页
│   │   └── globals.css       # 全局样式
│   ├── components/           # React组件
│   │   ├── ui/              # UI基础组件
│   │   ├── note-card.tsx    # 笔记卡片
│   │   ├── note-list.tsx    # 笔记列表
│   │   ├── note-editor.tsx  # 笔记编辑器
│   │   ├── hot-notes.tsx    # 热门笔记
│   │   ├── search-bar.tsx   # 搜索栏
│   │   └── sidebar.tsx      # 侧边栏
│   └── lib/                 # 工具库
│       ├── db/              # 数据库客户端
│       │   ├── sqlite.ts    # SQLite客户端
│       │   ├── lowdb.ts     # LowDB客户端
│       │   └── kv.ts        # KV客户端
│       ├── types/           # TypeScript类型定义
│       └── utils/           # 工具函数
├── data/                    # 数据存储目录
│   ├── app.db              # SQLite数据库
│   ├── cache.json          # KV缓存
│   └── docs/               # 文档存储
└── docs/                   # 项目文档
    └── PRD.md              # 产品需求文档
```

## 数据库设计

### SQLite Schema
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY UNIQUE,
  title TEXT NOT NULL,
  tags TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

### LowDB文档结构
```json
{
  "id": "uuid-xxx",
  "content": "# 标题\n这是笔记内容...",
  "metadata": {
    "word_count": 120,
    "last_edited_by": "system",
    "custom_fields": {}
  }
}
```

### KV键值结构
- `note:{id}:views` -> Integer (阅读计数)
- `hot_notes:top5` -> Array of IDs (热榜缓存)

## API接口

### Server Actions

#### createNote
创建新笔记
- 输入: `{ title, content, tags }`
- 输出: `{ success, data: { id } }`

#### updateNote
更新笔记
- 输入: `{ id, title?, content?, tags? }`
- 输出: `{ success }`

#### deleteNote
删除笔记
- 输入: `id`
- 输出: `{ success }`

#### getNoteList
获取笔记列表
- 输入: `{ search?, tag?, limit?, offset? }`
- 输出: `{ success, data: { notes, total } }`

#### getNoteDetail
获取笔记详情
- 输入: `id`
- 输出: `{ success, data: { id, title, content, tags, created_at, updated_at, views } }`

#### getHotNotes
获取热门笔记
- 输出: `{ success, data: [{ id, title, views }] }`

## 验收标准

### 功能验收
- ✅ 笔记创建、编辑、删除功能正常
- ✅ 笔记列表展示、搜索、筛选功能正常
- ✅ Markdown渲染正确,支持代码高亮
- ✅ 热榜展示和阅读计数功能正常
- ✅ 标签管理和筛选功能正常

### 性能验收
- ✅ 笔记详情页响应时间<50ms
- ✅ 列表页加载时间<200ms
- ✅ 创建笔记过程无阻塞感

### 数据验收
- ✅ 系统重启后数据完整保留
- ✅ SQLite、LowDB、KV数据持久化正常

### 部署验收
- ✅ `npm install && npm run dev` 可成功启动
- ✅ 无需外部数据库服务

## 开发说明

### 环境要求
- Node.js 18+
- npm 或 yarn

### 注意事项
1. 数据库文件存储在`data/`目录下
2. 首次运行会自动创建数据库和表结构
3. SQLite使用WAL模式提升并发性能
4. 所有数据操作通过Server Actions完成

## 许可证

MIT License
