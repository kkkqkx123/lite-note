# LiteNote轻量级全栈笔记系统 - 技术设计文档

## 1. 架构概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 首页列表 │  │ 笔记详情 │  │ 编辑器页 │  │ 热榜组件 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                    Server Actions层                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ createNote   │  │ updateNote   │  │ deleteNote   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ getNoteList  │  │ getNoteDetail│  │ getHotNotes  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                      数据访问层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ SQLiteClient │  │ LowDBClient  │  │  KVClient    │     │
│  │  (元数据)    │  │  (文档内容)  │  │  (缓存统计)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                      文件系统层                              │
│         /data/app.db    /data/docs/*.json    /data/cache.json│
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈详细说明

| 层级 | 技术选型 | 版本要求 | 职责说明 |
|------|---------|---------|---------|
| **前端框架** | Next.js | 14.0+ | App Router架构，SSR/SSG支持 |
| **UI框架** | React | 18.2+ | 组件化UI开发 |
| **样式方案** | Tailwind CSS | 3.4+ | 原子化CSS，快速样式开发 |
| **组件库** | Shadcn/UI | latest | 可复用UI组件基础 |
| **类型系统** | TypeScript | 5.0+ | 全栈类型安全 |
| **关系数据库** | better-sqlite3 | 9.0+ | 同步SQLite操作，高性能 |
| **文档数据库** | lowdb | 7.0+ | JSON文件文档存储 |
| **键值存储** | keyv + @keyv/file | 4.5+ / 1.3+ | 持久化KV缓存 |
| **Markdown渲染** | react-markdown | 9.0+ | Markdown内容渲染 |
| **Markdown扩展** | remark-gfm | 4.0+ | GitHub风格Markdown支持 |

---

## 2. 目录结构设计

```
lite-note/
├── app/                          # Next.js App Router目录
│   ├── layout.tsx                # 根布局组件
│   ├── page.tsx                  # 首页（笔记列表）
│   ├── note/
│   │   ├── [id]/
│   │   │   └── page.tsx          # 笔记详情页
│   │   └── new/
│   │       └── page.tsx          # 新建笔记页
│   │   └── edit/
│   │       └── [id]/
│   │           └── page.tsx      # 编辑笔记页
│   └── actions/
│       └── notes.ts              # Server Actions（笔记操作）
├── components/                   # 可复用UI组件
│   ├── ui/                       # Shadcn/UI基础组件
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── toast.tsx
│   ├── note-card.tsx             # 笔记卡片组件
│   ├── note-list.tsx             # 笔记列表组件
│   ├── note-editor.tsx           # Markdown编辑器组件
│   ├── hot-notes.tsx             # 热榜组件
│   ├── tag-badge.tsx             # 标签徽章组件
│   ├── sidebar.tsx               # 侧边栏组件
│   └── search-bar.tsx            # 搜索栏组件
├── lib/                          # 核心工具库
│   ├── db/
│   │   ├── sqlite.ts             # SQLite客户端封装
│   │   ├── lowdb.ts              # LowDB客户端封装
│   │   └── kv.ts                 # KV客户端封装
│   ├── types/
│   │   ├── note.ts               # 笔记类型定义
│   │   └── api.ts                # API类型定义
│   ├── utils/
│   │   ├── uuid.ts               # UUID生成工具
│   │   ├── markdown.ts           # Markdown处理工具
│   │   └── validation.ts         # 数据验证工具
│   └── constants.ts              # 常量定义
├── data/                         # 数据存储目录
│   ├── app.db                    # SQLite数据库文件
│   ├── cache.json                # KV缓存文件
│   └── docs/                     # 文档存储目录
│       └── {note-id}.json        # 笔记文档文件
├── public/                       # 静态资源
└── styles/
    └── globals.css               # 全局样式
```

---

## 3. 数据模型设计

### 3.1 SQLite Schema设计

```sql
-- 笔记元数据表
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  tags TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title);
```

**TypeScript类型定义**:
```typescript
interface NoteMetadata {
  id: string;              // UUID格式
  title: string;           // 最大200字符
  tags: string;            // 逗号分隔，最多10个标签
  created_at: number;      // Unix时间戳
  updated_at: number;      // Unix时间戳
}
```

### 3.2 LowDB文档结构设计

**文件路径**: `data/docs/{note-id}.json`

```typescript
interface NoteDocument {
  id: string;              // 与SQLite中的id一致
  content: string;         // Markdown正文内容
  metadata: {
    word_count: number;    // 字数统计
    last_edited_by: string; // 最后编辑者（默认"system"）
    custom_fields: Record<string, unknown>; // 可扩展字段
  };
}
```

### 3.3 KV存储结构设计

**缓存键设计**:
```typescript
// 阅读计数键
const VIEW_COUNT_KEY = (noteId: string) => `note:${noteId}:views`;

// 热榜缓存键（可选优化）
const HOT_NOTES_KEY = 'hot_notes:top5';

// KV存储类型
interface KVStore {
  // 阅读计数存储
  [key: `note:${string}:views`]: number;
  
  // 热榜缓存
  'hot_notes:top5'?: string[]; // 笔记ID数组
}
```

---

## 4. API接口设计

### 4.1 Server Actions接口

#### 4.1.1 创建笔记
```typescript
// app/actions/notes.ts
'use server';

interface CreateNoteInput {
  title: string;
  content: string;
  tags?: string;
}

interface CreateNoteOutput {
  success: boolean;
  data?: { id: string };
  error?: string;
}

async function createNote(input: CreateNoteInput): Promise<CreateNoteOutput>
```

**执行流程**:
1. 验证输入数据（标题长度、标签数量）
2. 生成UUID作为笔记ID
3. 获取当前时间戳
4. **SQLite操作**: 插入元数据记录
5. **LowDB操作**: 创建文档JSON文件
6. **KV操作**: 初始化阅读计数为0
7. 返回创建结果

#### 4.1.2 更新笔记
```typescript
interface UpdateNoteInput {
  id: string;
  title?: string;
  content?: string;
  tags?: string;
}

interface UpdateNoteOutput {
  success: boolean;
  data?: NoteMetadata;
  error?: string;
}

async function updateNote(input: UpdateNoteInput): Promise<UpdateNoteOutput>
```

**执行流程**:
1. 验证笔记是否存在
2. 获取当前时间戳
3. **SQLite操作**: 更新元数据记录
4. **LowDB操作**: 更新文档JSON文件
5. 返回更新结果（不重置阅读计数）

#### 4.1.3 删除笔记
```typescript
interface DeleteNoteInput {
  id: string;
}

interface DeleteNoteOutput {
  success: boolean;
  error?: string;
}

async function deleteNote(input: DeleteNoteInput): Promise<DeleteNoteOutput>
```

**执行流程**:
1. 验证笔记是否存在
2. **SQLite操作**: 删除元数据记录
3. **LowDB操作**: 删除文档JSON文件
4. **KV操作**: 删除阅读计数缓存
5. 返回删除结果

#### 4.1.4 获取笔记列表
```typescript
interface GetNoteListInput {
  searchQuery?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

interface GetNoteListOutput {
  success: boolean;
  data?: {
    notes: NoteMetadata[];
    total: number;
  };
  error?: string;
}

async function getNoteList(input?: GetNoteListInput): Promise<GetNoteListOutput>
```

**执行流程**:
1. 构建SQL查询语句
2. 应用搜索过滤（LIKE查询标题）
3. 应用标签过滤（LIKE查询tags字段）
4. 应用排序（updated_at DESC）
5. 应用分页（LIMIT和OFFSET）
6. 返回笔记列表和总数

#### 4.1.5 获取笔记详情
```typescript
interface GetNoteDetailInput {
  id: string;
}

interface GetNoteDetailOutput {
  success: boolean;
  data?: {
    metadata: NoteMetadata;
    document: NoteDocument;
    viewCount: number;
  };
  error?: string;
}

async function getNoteDetail(input: GetNoteDetailInput): Promise<GetNoteDetailOutput>
```

**执行流程**:
1. **SQLite操作**: 查询笔记元数据
2. **LowDB操作**: 读取文档JSON文件
3. **KV操作**: 增加阅读计数（incr操作）
4. 组装并返回完整数据

#### 4.1.6 获取热榜笔记
```typescript
interface GetHotNotesOutput {
  success: boolean;
  data?: Array<{
    id: string;
    title: string;
    viewCount: number;
  }>;
  error?: string;
}

async function getHotNotes(): Promise<GetHotNotesOutput>
```

**执行流程**:
1. **KV操作**: 遍历所有`note:*:views`键
2. 提取所有笔记的阅读计数
3. 按阅读计数降序排序
4. 取前5个笔记ID
5. **SQLite操作**: 批量查询笔记标题
6. 返回热榜数据

---

## 5. 组件架构设计

### 5.1 页面组件

#### 5.1.1 首页 (app/page.tsx)
```typescript
// 组件职责：展示笔记列表、搜索栏、热榜侧边栏
export default async function HomePage() {
  // 服务端获取初始数据
  const notes = await getNoteList();
  const hotNotes = await getHotNotes();
  
  return (
    <Layout>
      <Sidebar>
        <HotNotes data={hotNotes} />
      </Sidebar>
      <MainContent>
        <SearchBar />
        <NoteList notes={notes} />
      </MainContent>
    </Layout>
  );
}
```

#### 5.1.2 笔记详情页 (app/note/[id]/page.tsx)
```typescript
// 组件职责：展示笔记详情、Markdown渲染、阅读统计
export default async function NoteDetailPage({ params }: { params: { id: string } }) {
  const note = await getNoteDetail({ id: params.id });
  
  if (!note.success) {
    notFound();
  }
  
  return (
    <Layout>
      <NoteHeader metadata={note.data.metadata} />
      <MarkdownContent content={note.data.document.content} />
      <ViewCount count={note.data.viewCount} />
    </Layout>
  );
}
```

#### 5.1.3 编辑器页 (app/note/edit/[id]/page.tsx)
```typescript
// 组件职责：提供Markdown编辑界面、实时预览
export default async function NoteEditPage({ params }: { params: { id: string } }) {
  const note = await getNoteDetail({ id: params.id });
  
  return (
    <Layout>
      <NoteEditor
        initialData={note.data}
        onSave={updateNote}
      />
    </Layout>
  );
}
```

### 5.2 核心UI组件

#### 5.2.1 NoteEditor组件
```typescript
interface NoteEditorProps {
  initialData?: {
    metadata: NoteMetadata;
    document: NoteDocument;
  };
  onSave: (data: UpdateNoteInput) => Promise<void>;
}

// 功能特性：
// - 左右分栏：左侧编辑，右侧预览
// - 实时Markdown预览
// - 标签输入（逗号分隔）
// - 保存按钮（调用Server Action）
// - 加载状态和错误处理
```

#### 5.2.2 NoteList组件
```typescript
interface NoteListProps {
  notes: NoteMetadata[];
  onTagClick?: (tag: string) => void;
}

// 功能特性：
// - 卡片式布局展示
// - 每个卡片显示：标题、摘要、标签、更新时间
// - 点击跳转详情页
// - 支持无限滚动或分页
```

#### 5.2.3 HotNotes组件
```typescript
interface HotNotesProps {
  data: Array<{ id: string; title: string; viewCount: number }>;
}

// 功能特性：
// - 显示Top 5热榜
// - 每项显示：标题、阅读次数
// - 点击跳转详情页
```

---

## 6. 数据流设计

### 6.1 创建笔记数据流

```
用户输入表单
    ↓
客户端验证（标题非空、长度限制）
    ↓
调用createNote Server Action
    ↓
服务端验证
    ↓
生成UUID和时间戳
    ↓
┌─────────────────────────────────────┐
│  事务性操作（按顺序执行）            │
│  1. SQLite INSERT notes             │
│  2. LowDB WRITE docs/{id}.json      │
│  3. KV SET note:{id}:views = 0      │
└─────────────────────────────────────┘
    ↓
返回结果 { success: true, data: { id } }
    ↓
客户端跳转到 /note/{id}
```

### 6.2 查看笔记数据流

```
用户访问 /note/{id}
    ↓
服务端组件渲染
    ↓
调用getNoteDetail Server Action
    ↓
┌─────────────────────────────────────┐
│  并行操作                            │
│  - SQLite SELECT notes WHERE id=?   │
│  - LowDB READ docs/{id}.json        │
└─────────────────────────────────────┘
    ↓
KV INCR note:{id}:views
    ↓
组装数据返回
    ↓
服务端渲染Markdown内容
    ↓
返回完整HTML页面
```

### 6.3 热榜数据流

```
首页加载
    ↓
调用getHotNotes Server Action
    ↓
KV遍历所有 note:*:views 键
    ↓
提取并排序（降序）
    ↓
取Top 5笔记ID
    ↓
SQLite批量查询标题
    ↓
返回热榜数据
    ↓
客户端渲染HotNotes组件
```

---

## 7. 性能优化设计

### 7.1 数据库优化

**SQLite优化**:
- 创建`updated_at`降序索引，优化列表查询
- 创建`title`索引，优化搜索查询
- 使用同步API（better-sqlite3），避免异步开销
- 启用WAL模式，提升并发性能

**LowDB优化**:
- 每个笔记独立JSON文件，避免单文件过大
- 使用JSON缩进格式，便于调试和版本控制

**KV优化**:
- 使用文件持久化，避免内存占用
- 热榜数据可缓存到`hot_notes:top5`键，定期更新

### 7.2 渲染优化

**服务端渲染**:
- 首页和详情页使用SSR，首屏快速加载
- Markdown在服务端渲染，减少客户端计算

**客户端优化**:
- 编辑器实时预览使用防抖（debounce 300ms）
- 列表滚动使用虚拟滚动（笔记数>100时）
- 图片和静态资源使用Next.js自动优化

### 7.3 缓存策略

**数据缓存**:
- 笔记列表使用Next.js内置缓存，revalidate: 60s
- 热榜数据缓存5分钟，减少KV遍历开销

**CDN缓存**:
- 静态资源使用Next.js自动CDN缓存
- Markdown编辑器组件使用动态导入（dynamic import）

---

## 8. 错误处理设计

### 8.1 错误类型定义

```typescript
enum ErrorCode {
  // 输入验证错误
  INVALID_TITLE = 'INVALID_TITLE',
  TITLE_TOO_LONG = 'TITLE_TOO_LONG',
  TOO_MANY_TAGS = 'TOO_MANY_TAGS',
  
  // 数据库错误
  NOTE_NOT_FOUND = 'NOTE_NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  
  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
```

### 8.2 错误处理流程

```
操作执行
    ↓
捕获异常
    ↓
┌─────────────────────────────────┐
│  错误分类                        │
│  - 输入验证错误 → 返回错误信息   │
│  - 数据库错误 → 记录日志，返回通用错误 │
│  - 文件系统错误 → 记录日志，返回通用错误 │
└─────────────────────────────────┘
    ↓
返回统一错误格式
    ↓
客户端显示Toast提示
```

### 8.3 用户友好错误提示

| 错误类型 | 用户提示信息 |
|---------|-------------|
| INVALID_TITLE | 请输入笔记标题 |
| TITLE_TOO_LONG | 标题长度不能超过200字符 |
| TOO_MANY_TAGS | 最多添加10个标签 |
| NOTE_NOT_FOUND | 笔记不存在或已被删除 |
| DATABASE_ERROR | 操作失败，请稍后重试 |
| FILE_WRITE_ERROR | 文件保存失败，请检查权限 |

---

## 9. 安全设计

### 9.1 输入验证

**服务端验证**:
- 标题：非空，最大200字符
- 标签：逗号分隔，单个标签最大50字符，最多10个标签
- 内容：无长度限制，但记录字数统计

**XSS防护**:
- Markdown渲染使用react-markdown，自动转义HTML
- 禁止HTML标签直接渲染，仅支持Markdown语法

### 9.2 文件系统安全

**路径安全**:
- 笔记ID使用UUID格式，避免路径遍历攻击
- 文件操作限制在`/data`目录内
- 禁止使用相对路径访问上级目录

**权限控制**:
- 数据文件仅服务端可访问
- 客户端无法直接访问文件系统
- 所有数据操作通过Server Actions

---

## 10. 部署设计

### 10.1 环境要求

- Node.js 18+
- npm 或 pnpm
- 文件系统读写权限

### 10.2 初始化流程

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据目录
mkdir -p data/docs

# 3. 初始化SQLite数据库
# (首次启动时自动创建表和索引)

# 4. 启动开发服务器
npm run dev
```

### 10.3 生产部署

```bash
# 1. 构建生产版本
npm run build

# 2. 启动生产服务器
npm start

# 数据持久化：
# - /data/app.db (SQLite)
# - /data/docs/*.json (LowDB)
# - /data/cache.json (KV)
```

---

## 11. 监控与日志

### 11.1 日志设计

```typescript
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  operation: string;
  duration?: number;  // 操作耗时（ms）
  error?: string;
  metadata?: Record<string, unknown>;
}
```

**关键操作日志**:
- 笔记创建、编辑、删除操作
- 数据库操作耗时（>50ms警告）
- 文件读写错误
- API调用失败

### 11.2 性能监控

**关键指标**:
- 笔记详情页响应时间（目标<50ms）
- 列表页加载时间（目标<200ms）
- 数据库操作耗时
- 内存使用情况

---

## 12. 扩展性设计

### 12.1 未来扩展点

**功能扩展**:
- 笔记分类和目录管理
- 全文搜索（集成Lunr.js）
- 笔记导出（PDF、HTML）
- 版本历史和回滚
- 多用户支持（添加认证）

**技术扩展**:
- 数据库迁移工具
- API接口版本管理
- 插件系统架构
- 主题定制系统

### 12.2 可扩展架构

**插件化设计**:
- Markdown渲染器可替换
- 存储后端可替换（如切换到MongoDB）
- UI主题可定制

**配置化设计**:
```typescript
interface AppConfig {
  database: {
    sqlite: { path: string };
    lowdb: { docsPath: string };
    kv: { cachePath: string };
  };
  ui: {
    theme: 'light' | 'dark';
    pageSize: number;
  };
  features: {
    enableHotNotes: boolean;
    enableTagFilter: boolean;
    enableExport: boolean;
  };
}
```

---

## 13. 技术风险与缓解

| 风险项 | 影响 | 缓解措施 |
|-------|------|---------|
| SQLite并发写入冲突 | 数据不一致 | 使用WAL模式，启用锁机制 |
| 文件系统权限问题 | 数据无法保存 | 启动时检查权限，提供友好错误提示 |
| JSON文件损坏 | 笔记内容丢失 | 实现数据备份机制，定期快照 |
| 内存占用过大 | 性能下降 | 限制单笔记大小，实现虚拟滚动 |
| Markdown渲染XSS | 安全漏洞 | 使用安全渲染器，禁用HTML标签 |

---

## 14. 依赖包清单

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

---

## 15. 设计决策记录

### 决策1: 使用混合数据库架构
**背景**: 需要在本地实现功能完整的笔记系统，无需外部数据库服务。

**决策**: 采用SQLite（元数据）+ LowDB（文档）+ KV（缓存）混合架构。

**理由**:
- SQLite提供结构化查询能力，适合元数据管理
- LowDB提供文档灵活性，适合非结构化内容
- KV提供高性能读写，适合缓存和统计

### 决策2: 使用Server Actions而非API Routes
**背景**: Next.js 14提供Server Actions和API Routes两种服务端方案。

**决策**: 使用Server Actions作为主要数据操作方式。

**理由**:
- Server Actions提供更好的类型安全
- 减少样板代码，直接在组件中调用
- 自动处理表单提交和重新验证

### 决策3: 每个笔记独立JSON文件
**背景**: LowDB支持单文件和多文件存储模式。

**决策**: 每个笔记使用独立的JSON文件存储。

**理由**:
- 避免单文件过大影响性能
- 便于版本控制和差异对比
- 提高并发写入性能
- 单文件损坏不影响其他笔记
