# LiteNote轻量级全栈笔记系统 - 任务规划

## 任务概览

本文档将技术设计拆解为具体的编码任务，按优先级和依赖关系排序，每个任务包含明确的验收标准。

**任务统计**: 共10个主任务，28个子任务，覆盖所有需求规格。

---

## 任务1: 项目初始化与基础架构搭建

**优先级**: P0  
**预估工时**: 2小时  
**任务描述**: 初始化Next.js项目，安装依赖包，配置TypeScript和Tailwind CSS，创建基础目录结构。

### 子任务1.1: 初始化Next.js项目
**输入**: 无  
**输出**: 初始化的Next.js 14项目（App Router架构）  
**验收标准**:
- 项目使用Next.js 14+版本
- 启用App Router架构
- 配置TypeScript严格模式
- 项目可成功启动（npm run dev）

**执行步骤**:
1. 执行 `npx create-next-app@latest lite-note --typescript --tailwind --app`
2. 配置tsconfig.json启用严格模式
3. 验证项目启动成功

### 子任务1.2: 安装核心依赖包
**输入**: 初始化的Next.js项目  
**输出**: 完整的依赖包配置  
**验收标准**:
- 安装better-sqlite3、lowdb、keyv、@keyv/file
- 安装react-markdown、remark-gfm
- 安装Shadcn/UI相关依赖（clsx、tailwind-merge）
- 安装类型定义包（@types/better-sqlite3）
- package.json包含所有必需依赖

**执行步骤**:
1. 安装生产依赖：`npm install better-sqlite3 lowdb keyv @keyv/file react-markdown remark-gfm clsx tailwind-merge`
2. 安装开发依赖：`npm install -D @types/better-sqlite3`
3. 验证依赖安装成功

### 子任务1.3: 创建目录结构
**输入**: 安装依赖后的项目  
**输出**: 完整的项目目录结构  
**验收标准**:
- 创建lib/db、lib/types、lib/utils目录
- 创建components/ui目录
- 创建data/docs目录
- 创建app/actions目录
- 目录结构符合设计文档规范

**执行步骤**:
1. 创建lib子目录：db、types、utils
2. 创建components/ui目录
3. 创建data和data/docs目录
4. 创建app/actions目录

---

## 任务2: 数据库客户端封装

**优先级**: P0  
**预估工时**: 3小时  
**任务描述**: 封装SQLite、LowDB、KV三种数据库客户端，提供统一的数据访问接口。

### 子任务2.1: 实现SQLite客户端
**输入**: 项目基础结构  
**输出**: lib/db/sqlite.ts文件  
**验收标准**:
- 初始化SQLite数据库连接（data/app.db）
- 创建notes表（id、title、tags、created_at、updated_at）
- 创建updated_at降序索引和title索引
- 启用WAL模式提升并发性能
- 提供查询、插入、更新、删除方法
- 所有方法具有类型安全

**执行步骤**:
1. 导入better-sqlite3
2. 创建数据库连接（单例模式）
3. 执行CREATE TABLE和CREATE INDEX语句
4. 启用WAL模式（PRAGMA journal_mode=WAL）
5. 封装查询方法（get、all、run）
6. 导出数据库实例和方法

### 子任务2.2: 实现LowDB客户端
**输入**: 项目基础结构  
**输出**: lib/db/lowdb.ts文件  
**验收标准**:
- 初始化LowDB适配器（data/docs目录）
- 提供读取文档方法（readDocument）
- 提供写入文档方法（writeDocument）
- 提供删除文档方法（deleteDocument）
- 文档路径使用UUID避免冲突
- 所有方法具有类型安全

**执行步骤**:
1. 导入lowdb和JSONFile适配器
2. 实现readDocument方法（读取docs/{id}.json）
3. 实现writeDocument方法（写入docs/{id}.json）
4. 实现deleteDocument方法（删除docs/{id}.json）
5. 导出所有方法

### 子任务2.3: 实现KV客户端
**输入**: 项目基础结构  
**输出**: lib/db/kv.ts文件  
**验收标准**:
- 初始化Keyv实例（data/cache.json）
- 提供get、set、delete方法
- 提供incr方法（计数器增加）
- 支持遍历所有键（用于热榜）
- 所有方法具有类型安全

**执行步骤**:
1. 导入keyv和@keyv/file
2. 创建Keyv实例（file适配器）
3. 封装get、set、delete方法
4. 实现incr方法（原子增加）
5. 导出所有方法

---

## 任务3: 类型定义与工具函数

**优先级**: P0  
**预估工时**: 2小时  
**任务描述**: 定义核心类型接口，实现UUID生成、数据验证等工具函数。

### 子任务3.1: 定义核心类型
**输入**: 数据库设计文档  
**输出**: lib/types/note.ts和lib/types/api.ts文件  
**验收标准**:
- 定义NoteMetadata接口（id、title、tags、created_at、updated_at）
- 定义NoteDocument接口（id、content、metadata）
- 定义API输入输出类型（CreateNoteInput、UpdateNoteInput等）
- 定义错误类型（ErrorCode、AppError）
- 所有类型导出可供全局使用

**执行步骤**:
1. 创建lib/types/note.ts，定义笔记相关类型
2. 创建lib/types/api.ts，定义API接口类型
3. 定义ErrorCode枚举和AppError接口
4. 导出所有类型

### 子任务3.2: 实现UUID生成工具
**输入**: 类型定义  
**输出**: lib/utils/uuid.ts文件  
**验收标准**:
- 实现generateUUID函数
- UUID格式符合标准（v4版本）
- 函数具有类型签名

**执行步骤**:
1. 使用crypto.randomUUID或uuid库
2. 封装generateUUID函数
3. 导出函数

### 子任务3.3: 实现数据验证工具
**输入**: 类型定义、业务约束  
**输出**: lib/utils/validation.ts文件  
**验收标准**:
- 实现validateTitle函数（非空、最大200字符）
- 实现validateTags函数（最多10个标签，单个最大50字符）
- 实现validateNoteId函数（UUID格式）
- 返回验证结果和错误信息

**执行步骤**:
1. 实现validateTitle函数
2. 实现validateTags函数
3. 实现validateNoteId函数
4. 导出所有验证函数

---

## 任务4: Server Actions实现

**优先级**: P0  
**预估工时**: 4小时  
**任务描述**: 实现所有Server Actions，包括笔记的创建、更新、删除、查询和热榜功能。

### 子任务4.1: 实现createNote Server Action
**输入**: 数据库客户端、类型定义、验证工具  
**输出**: app/actions/notes.ts中的createNote函数  
**验收标准**:
- 验证输入数据（标题、标签）
- 生成UUID和时间戳
- SQLite插入元数据记录
- LowDB创建文档JSON文件
- KV初始化阅读计数为0
- 返回创建结果（成功/失败）
- 错误处理完善

**执行步骤**:
1. 创建app/actions/notes.ts，添加'use server'指令
2. 实现createNote函数
3. 调用验证函数验证输入
4. 生成UUID和当前时间戳
5. 执行SQLite INSERT操作
6. 执行LowDB写入操作
7. 执行KV SET操作
8. 返回结果

### 子任务4.2: 实现updateNote Server Action
**输入**: 数据库客户端、类型定义  
**输出**: app/actions/notes.ts中的updateNote函数  
**验收标准**:
- 验证笔记是否存在
- 更新SQLite元数据
- 更新LowDB文档内容
- 更新updated_at时间戳
- 不重置KV阅读计数
- 返回更新结果

**执行步骤**:
1. 实现updateNote函数
2. 验证笔记存在性
3. 获取当前时间戳
4. 执行SQLite UPDATE操作
5. 执行LowDB更新操作
6. 返回结果

### 子任务4.3: 实现deleteNote Server Action
**输入**: 数据库客户端、类型定义  
**输出**: app/actions/notes.ts中的deleteNote函数  
**验收标准**:
- 验证笔记是否存在
- 删除SQLite元数据记录
- 删除LowDB文档文件
- 删除KV阅读计数缓存
- 返回删除结果

**执行步骤**:
1. 实现deleteNote函数
2. 验证笔记存在性
3. 执行SQLite DELETE操作
4. 执行LowDB删除操作
5. 执行KV DELETE操作
6. 返回结果

### 子任务4.4: 实现getNoteList Server Action
**输入**: 数据库客户端、类型定义  
**输出**: app/actions/notes.ts中的getNoteList函数  
**验收标准**:
- 支持搜索过滤（LIKE查询标题）
- 支持标签过滤（LIKE查询tags）
- 按updated_at降序排序
- 支持分页（limit、offset）
- 返回笔记列表和总数

**执行步骤**:
1. 实现getNoteList函数
2. 构建SQL查询语句
3. 应用搜索和标签过滤
4. 应用排序和分页
5. 执行查询并返回结果

### 子任务4.5: 实现getNoteDetail Server Action
**输入**: 数据库客户端、类型定义  
**输出**: app/actions/notes.ts中的getNoteDetail函数  
**验收标准**:
- 查询SQLite元数据
- 读取LowDB文档内容
- KV增加阅读计数（incr操作）
- 组装并返回完整数据
- 笔记不存在时返回错误

**执行步骤**:
1. 实现getNoteDetail函数
2. 查询SQLite元数据
3. 读取LowDB文档
4. 执行KV INCR操作
5. 组装数据并返回

### 子任务4.6: 实现getHotNotes Server Action
**输入**: 数据库客户端、类型定义  
**输出**: app/actions/notes.ts中的getHotNotes函数  
**验收标准**:
- 遍历KV中所有note:*:views键
- 提取阅读计数并降序排序
- 取前5个笔记ID
- 批量查询SQLite获取标题
- 返回热榜数据

**执行步骤**:
1. 实现getHotNotes函数
2. 遍历KV所有键
3. 提取并排序阅读计数
4. 取Top 5笔记ID
5. 批量查询SQLite标题
6. 返回热榜数据

---

## 任务5: Shadcn/UI基础组件集成

**优先级**: P0  
**预估工时**: 2小时  
**任务描述**: 集成Shadcn/UI基础组件，包括Button、Input、Card、Toast等。

### 子任务5.1: 初始化Shadcn/UI
**输入**: 项目基础结构  
**输出**: 配置好的Shadcn/UI环境  
**验收标准**:
- 安装Shadcn/UI CLI
- 初始化Shadcn/UI配置
- 配置components.json
- 创建utils/cn工具函数

**执行步骤**:
1. 执行 `npx shadcn-ui@latest init`
2. 配置样式和主题
3. 创建lib/utils/cn.ts（clsx + tailwind-merge）

### 子任务5.2: 添加基础UI组件
**输入**: Shadcn/UI配置  
**输出**: components/ui目录下的基础组件  
**验收标准**:
- 添加Button组件
- 添加Input组件
- 添加Card组件
- 添加Toast组件
- 所有组件可正常使用

**执行步骤**:
1. 执行 `npx shadcn-ui@latest add button`
2. 执行 `npx shadcn-ui@latest add input`
3. 执行 `npx shadcn-ui@latest add card`
4. 执行 `npx shadcn-ui@latest add toast`

---

## 任务6: 核心UI组件开发

**优先级**: P0  
**预估工时**: 5小时  
**任务描述**: 开发笔记卡片、笔记列表、Markdown编辑器、热榜等核心UI组件。

### 子任务6.1: 开发NoteCard组件
**输入**: Shadcn/UI组件、类型定义  
**输出**: components/note-card.tsx文件  
**验收标准**:
- 显示笔记标题、摘要（前100字符）
- 显示标签徽章
- 显示更新时间
- 点击跳转详情页
- 响应式布局

**执行步骤**:
1. 创建NoteCard组件
2. 使用Card组件构建布局
3. 显示标题、摘要、标签、时间
4. 添加点击跳转逻辑
5. 添加响应式样式

### 子任务6.2: 开发NoteList组件
**输入**: NoteCard组件、类型定义  
**输出**: components/note-list.tsx文件  
**验收标准**:
- 卡片式布局展示笔记列表
- 支持标签点击筛选
- 支持无限滚动或分页
- 空状态显示提示

**执行步骤**:
1. 创建NoteList组件
2. 使用NoteCard渲染列表
3. 实现标签点击回调
4. 实现分页或无限滚动
5. 添加空状态提示

### 子任务6.3: 开发NoteEditor组件
**输入**: Shadcn/UI组件、react-markdown  
**输出**: components/note-editor.tsx文件  
**验收标准**:
- 左右分栏布局（编辑+预览）
- 实时Markdown预览（防抖300ms）
- 标题和标签输入
- 保存按钮调用Server Action
- 加载状态和错误提示

**执行步骤**:
1. 创建NoteEditor组件
2. 实现左右分栏布局
3. 集成react-markdown预览
4. 添加防抖逻辑
5. 实现保存功能
6. 添加加载和错误状态

### 子任务6.4: 开发HotNotes组件
**输入**: Shadcn/UI组件、类型定义  
**输出**: components/hot-notes.tsx文件  
**验收标准**:
- 显示Top 5热榜列表
- 每项显示标题和阅读次数
- 点击跳转详情页
- 空状态显示提示

**执行步骤**:
1. 创建HotNotes组件
2. 渲染热榜列表
3. 显示标题和阅读次数
4. 添加点击跳转逻辑
5. 添加空状态提示

### 子任务6.5: 开发TagBadge组件
**输入**: Shadcn/UI组件  
**输出**: components/tag-badge.tsx文件  
**验收标准**:
- 显示单个标签徽章
- 支持点击筛选
- 样式美观统一

**执行步骤**:
1. 创建TagBadge组件
2. 使用Badge组件
3. 添加点击回调
4. 设置样式

### 子任务6.6: 开发SearchBar组件
**输入**: Shadcn/UI组件  
**输出**: components/search-bar.tsx文件  
**验收标准**:
- 搜索输入框
- 实时搜索（防抖300ms）
- 清除搜索按钮

**执行步骤**:
1. 创建SearchBar组件
2. 使用Input组件
3. 添加防抖逻辑
4. 添加清除按钮

### 子任务6.7: 开发Sidebar组件
**输入**: HotNotes组件、Shadcn/UI组件  
**输出**: components/sidebar.tsx文件  
**验收标准**:
- 显示Logo和新建按钮
- 显示热榜组件
- 移动端转为抽屉菜单
- 响应式布局

**执行步骤**:
1. 创建Sidebar组件
2. 添加Logo和新建按钮
3. 集成HotNotes组件
4. 实现移动端抽屉菜单
5. 添加响应式样式

---

## 任务7: 页面组件开发

**优先级**: P0  
**预估工时**: 4小时  
**任务描述**: 开发首页、笔记详情页、编辑器页等页面组件。

### 子任务7.1: 开发根布局组件
**输入**: Sidebar组件、Shadcn/UI组件  
**输出**: app/layout.tsx文件  
**验收标准**:
- 包含Sidebar组件
- 包含主内容区域
- 响应式布局
- 全局样式应用

**执行步骤**:
1. 修改app/layout.tsx
2. 集成Sidebar组件
3. 设置主内容区域
4. 添加响应式布局
5. 应用全局样式

### 子任务7.2: 开发首页
**输入**: NoteList、SearchBar、Server Actions  
**输出**: app/page.tsx文件  
**验收标准**:
- 服务端获取笔记列表和热榜
- 显示搜索栏
- 显示笔记列表
- 支持搜索和标签筛选
- 响应式布局

**执行步骤**:
1. 修改app/page.tsx
2. 调用getNoteList和getHotNotes
3. 集成SearchBar和NoteList
4. 实现搜索和筛选逻辑
5. 添加响应式样式

### 子任务7.3: 开发笔记详情页
**输入**: react-markdown、Server Actions  
**输出**: app/note/[id]/page.tsx文件  
**验收标准**:
- 服务端获取笔记详情
- 渲染Markdown内容
- 显示阅读次数
- 显示编辑和删除按钮
- 笔记不存在显示404

**执行步骤**:
1. 创建app/note/[id]/page.tsx
2. 调用getNoteDetail
3. 使用react-markdown渲染内容
4. 显示阅读次数
5. 添加编辑和删除按钮
6. 处理404情况

### 子任务7.4: 开发新建笔记页
**输入**: NoteEditor组件  
**输出**: app/note/new/page.tsx文件  
**验收标准**:
- 显示NoteEditor组件
- 初始数据为空
- 保存后跳转详情页

**执行步骤**:
1. 创建app/note/new/page.tsx
2. 集成NoteEditor组件
3. 实现保存逻辑
4. 添加跳转逻辑

### 子任务7.5: 开发编辑笔记页
**输入**: NoteEditor组件、Server Actions  
**输出**: app/note/edit/[id]/page.tsx文件  
**验收标准**:
- 服务端获取笔记详情
- 显示NoteEditor组件并填充数据
- 保存后跳转详情页

**执行步骤**:
1. 创建app/note/edit/[id]/page.tsx
2. 调用getNoteDetail获取数据
3. 集成NoteEditor组件
4. 实现保存逻辑
5. 添加跳转逻辑

---

## 任务8: Markdown渲染与样式优化

**优先级**: P1  
**预估工时**: 2小时  
**任务描述**: 优化Markdown渲染效果，配置代码高亮和样式。

### 子任务8.1: 配置Markdown渲染器
**输入**: react-markdown、remark-gfm  
**输出**: lib/utils/markdown.ts文件  
**验收标准**:
- 配置react-markdown渲染器
- 启用remark-gfm支持（表格、删除线等）
- 配置代码块语法高亮
- 配置链接在新窗口打开
- XSS防护（禁用HTML标签）

**执行步骤**:
1. 创建lib/utils/markdown.ts
2. 配置react-markdown组件
3. 添加remark-gfm插件
4. 配置代码高亮
5. 设置安全选项

### 子任务8.2: 优化全局样式
**输入**: Tailwind CSS配置  
**输出**: styles/globals.css文件  
**验收标准**:
- 配置Markdown样式（标题、列表、代码块等）
- 配置响应式字体大小
- 配置颜色主题
- 样式美观统一

**执行步骤**:
1. 修改styles/globals.css
2. 添加Markdown样式
3. 配置响应式样式
4. 设置颜色主题

---

## 任务9: 错误处理与用户体验优化

**优先级**: P1  
**预估工时**: 2小时  
**任务描述**: 完善错误处理机制，添加加载状态和Toast提示。

### 子任务9.1: 实现Toast通知系统
**输入**: Shadcn/UI Toast组件  
**输出**: 全局Toast通知功能  
**验收标准**:
- 成功操作显示绿色Toast
- 错误操作显示红色Toast
- Toast自动消失（3秒）
- 可手动关闭Toast

**执行步骤**:
1. 配置Toast Provider
2. 创建useToast hook
3. 在Server Actions中集成Toast
4. 测试各种场景

### 子任务9.2: 添加加载状态
**输入**: Shadcn/UI组件  
**输出**: 各页面的加载状态  
**验收标准**:
- 列表页显示Skeleton占位符
- 详情页显示加载动画
- 编辑器保存显示加载状态
- 删除操作显示确认对话框

**执行步骤**:
1. 创建Skeleton组件
2. 在列表页添加加载状态
3. 在详情页添加加载状态
4. 在编辑器添加保存状态
5. 实现删除确认对话框

---

## 任务10: 测试与验收

**优先级**: P0  
**预估工时**: 3小时  
**任务描述**: 测试所有功能，验证验收标准，修复问题。

### 子任务10.1: 功能测试
**输入**: 完整的系统  
**输出**: 功能测试报告  
**验收标准**:
- 笔记创建功能正常
- 笔记编辑功能正常
- 笔记删除功能正常
- 笔记列表展示正常
- 搜索和筛选功能正常
- 热榜展示正常
- 阅读计数正常

**执行步骤**:
1. 测试创建笔记流程
2. 测试编辑笔记流程
3. 测试删除笔记流程
4. 测试列表和搜索功能
5. 测试热榜和阅读计数
6. 记录测试结果

### 子任务10.2: 性能测试
**输入**: 完整的系统  
**输出**: 性能测试报告  
**验收标准**:
- 笔记详情页响应时间<50ms
- 列表页加载时间<200ms
- 创建笔记无阻塞感
- 数据库操作性能达标

**执行步骤**:
1. 测试详情页响应时间
2. 测试列表页加载时间
3. 测试创建笔记性能
4. 记录性能数据

### 子任务10.3: 数据持久化测试
**输入**: 完整的系统  
**输出**: 数据持久化测试报告  
**验收标准**:
- 重启服务后数据完整保留
- SQLite数据持久化
- LowDB文档持久化
- KV缓存持久化

**执行步骤**:
1. 创建测试数据
2. 重启服务
3. 验证数据完整性
4. 记录测试结果

### 子任务10.4: 兼容性测试
**输入**: 完整的系统  
**输出**: 兼容性测试报告  
**验收标准**:
- Chrome浏览器正常工作
- Firefox浏览器正常工作
- Safari浏览器正常工作
- 移动端响应式正常

**执行步骤**:
1. 在Chrome测试
2. 在Firefox测试
3. 在Safari测试
4. 在移动端测试
5. 记录测试结果

---

## 任务依赖关系图

```
任务1 (项目初始化)
  ↓
任务2 (数据库客户端) ← 任务3 (类型定义)
  ↓                    ↓
任务4 (Server Actions)
  ↓
任务5 (Shadcn/UI) ← 任务6 (核心UI组件)
  ↓                    ↓
任务7 (页面组件)
  ↓
任务8 (Markdown优化) ← 任务9 (错误处理)
  ↓                      ↓
任务10 (测试验收)
```

---

## 任务执行建议

### 执行顺序
1. **第一阶段（基础架构）**: 任务1 → 任务2 → 任务3
2. **第二阶段（核心逻辑）**: 任务4
3. **第三阶段（UI开发）**: 任务5 → 任务6 → 任务7
4. **第四阶段（优化完善）**: 任务8 → 任务9
5. **第五阶段（测试验收）**: 任务10

### 关键里程碑
- **里程碑1**: 完成任务1-3，基础架构搭建完成
- **里程碑2**: 完成任务4，核心业务逻辑实现
- **里程碑3**: 完成任务5-7，UI界面开发完成
- **里程碑4**: 完成任务8-9，系统优化完成
- **里程碑5**: 完成任务10，系统验收通过

### 风险提示
- 任务2数据库客户端封装是核心基础，需优先完成
- 任务4 Server Actions是业务核心，需仔细测试
- 任务6 NoteEditor组件较复杂，需预留充足时间
- 任务10测试验收需全面覆盖所有功能

---

## 验收标准汇总

### 功能验收
- ✅ 笔记创建、编辑、删除功能正常
- ✅ 笔记列表展示、搜索、筛选功能正常
- ✅ Markdown渲染正确，支持代码高亮
- ✅ 热榜展示和阅读计数功能正常
- ✅ 标签管理和筛选功能正常

### 性能验收
- ✅ 笔记详情页响应时间<50ms
- ✅ 列表页加载时间<200ms
- ✅ 创建笔记过程无阻塞感

### 数据验收
- ✅ 系统重启后数据完整保留
- ✅ SQLite、LowDB、KV数据持久化正常

### 兼容性验收
- ✅ 主流浏览器正常工作
- ✅ 移动端响应式布局正常

### 部署验收
- ✅ `npm install && npm run dev` 可成功启动
- ✅ 无需外部数据库服务

---

## 编码任务执行指引

本任务规划文档已将技术设计拆解为具体的编码任务，每个任务包含：
- **明确的输入输出**：清楚定义任务的前置条件和交付物
- **详细的验收标准**：确保任务完成质量可衡量
- **具体的执行步骤**：提供清晰的实施路径

**建议执行方式**：
1. 按照任务依赖关系顺序执行
2. 每完成一个子任务进行自测验证
3. 遇到问题及时记录并调整
4. 完成每个主任务后进行阶段性验收

现在可以基于本任务规划文档开始编码实现工作。
