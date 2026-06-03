# Ztodo LLM Agent 架构规划

> **目标：** 将所有任务操作抽象为统一工具接口，由 LLM 根据用户自然语言输入自主选择工具并填入参数，实现"对话式任务管理"。支持 Skill 模板的导入、存储、实例化（自动展开为子任务）、以及完成时的经验沉淀。

**架构思路：** 采用 **前端 Agent 模式** — LLM 交互逻辑放在前端（TypeScript），Rust 后端只负责纯粹的数据 CRUD。前端 Agent 拿到 LLM 返回的工具调用后，通过 Tauri `invoke` 执行相应的 Rust command，结果喂回 LLM 形成多轮推理循环。

**技术栈：** Tauri 2 + React 19 + TypeScript + Rust (rusqlite) + OpenAI API 兼容格式

---

## 一、整体分层架构

```
┌──────────────────────────────────────────────────────────┐
│                      UI 层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ TaskInput │  │ TaskList  │  │      AIChat 🆕       │   │
│  │  (现有)   │  │  (现有)   │  │  (对话 + Skill管理)  │   │
│  └──────────┘  └──────────┘  └──────────┬───────────┘   │
│                                         │                │
├─────────────────────────────────────────┼────────────────┤
│                  Agent 层 🆕             │                │
│  ┌──────────────────────────────────────▼───────────┐    │
│  │                Agent Loop                         │    │
│  │  用户输入 → LLM → tool_call?                      │    │
│  │    → 执行工具 → 结果 → LLM → 最终回复             │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌────────────────────┐  ┌─────────────────────────┐    │
│  │   Tool Registry     │  │     Tool Executor        │    │
│  │   (17 个工具的       │  │   name → service 调用     │    │
│  │    JSON Schema)     │  │                          │    │
│  └────────────────────┘  └──────────┬──────────────┘    │
│                                     │                    │
├─────────────────────────────────────┼────────────────────┤
│             Service 层 🆕            │                    │
│  ┌──────────────────────────────────▼────────────────┐   │
│  │  taskService.ts    │   skillService.ts 🆕         │   │
│  │  (10 个任务操作)    │   (6 个技能操作)              │   │
│  └───────────────────────────────────────────────────┘   │
│                          │                                │
├──────────────────────────┼────────────────────────────────┤
│         Tauri IPC        │                                │
│  ┌───────────────────────▼───────────────────────────┐   │
│  │          invoke("command", args)                   │   │
│  └───────────────────────┬───────────────────────────┘   │
│                          │                                │
├──────────────────────────┼────────────────────────────────┤
│           Rust 后端       │                                │
│  ┌───────────────────────▼───────────────────────────┐   │
│  │  commands.rs (扩展)                                │   │
│  │  任务: get_all_tasks, get_task, create_task,      │   │
│  │        update_task, delete_task, search_tasks,     │   │
│  │        get_subtasks, get_task_stats,               │   │
│  │        batch_update_tasks, reorder_tasks           │   │
│  │  技能: list_skills, get_skill, create_skill,       │   │
│  │        update_skill, delete_skill,                 │   │
│  │        instantiate_skill 🆕                        │   │
│  └───────────────────────┬───────────────────────────┘   │
│  ┌───────────────────────▼───────────────────────────┐   │
│  │  db.rs (扩展)                                      │   │
│  │  tasks 表 + skills 表 + task_completions 表        │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 二、数据库扩展

### 2.1 skills 表

```sql
CREATE TABLE skills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,           -- 技能名，如 "写周报"
  description TEXT,                    -- 简述
  category    TEXT DEFAULT '默认',
  steps       TEXT NOT NULL DEFAULT '[]',  -- JSON: [{"order":1, "content":"..."}]
  tips        TEXT DEFAULT '',             -- 经验教训，多条以换行分隔
  tags        TEXT DEFAULT '[]',           -- JSON: ["工作","写作"]
  usage_count INTEGER DEFAULT 0,
  last_used_at TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime')),
  updated_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

### 2.2 task_completions 表

```sql
CREATE TABLE task_completions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      INTEGER NOT NULL,
  skill_id     INTEGER,                -- 关联的 skill（可为空）
  summary      TEXT,                    -- LLM 生成的完成总结
  lessons      TEXT,                    -- LLM 提取的经验教训
  completed_at TEXT DEFAULT (datetime('now','localtime'))
);
```

### 2.3 tasks 表新增字段

```sql
ALTER TABLE tasks ADD COLUMN skill_id INTEGER REFERENCES skills(id);
```

---

## 三、完整工具清单（17 个）

---

### A. 任务操作（10 个）

| # | 工具名 | 做什么 | LLM 调用示例 |
|---|--------|--------|-------------|
| 1 | `list_tasks` | 列出任务，可选 `status`/`category` 过滤 | "今天有哪些进行中的任务？" |
| 2 | `get_task` | 查询单个任务全部字段（含子任务列表） | "看一下「写周报」的详情" |
| 3 | `create_task` | 创建任务，可指定标题/备注/分类/优先级/截止日/父任务/skill_id | "加一个高优任务：交报告，明天截止" |
| 4 | `update_task` | 修改任务任意字段（状态/优先级/进度/标题...） | "把「写周报」标为已完成" |
| 5 | `delete_task` | 删除任务 | "删掉「买菜」" |
| 6 | `search_tasks` | 关键词搜索 title + note | "搜跟「报告」相关的任务" |
| 7 | `get_subtasks` | 获取某父任务的所有子任务 | "「项目上线」下面有哪些？" |
| 8 | `get_stats` | 按状态/分类统计，含完成率 | "我这周完成情况怎么样？" |
| 9 | `batch_update_tasks` | 批量修改（统一改状态/分类/优先级） | "把「工作」分类全标为进行中" |
| 10 | `reorder_tasks` | 拖拽排序后持久化 sort_order | "这三个按优先级排一下" |

---

### B. 技能操作（7 个）

| # | 工具名 | 做什么 | LLM 调用示例 |
|---|--------|--------|-------------|
| 11 | `list_skills` | 列出所有 skill，可选 `category`/`tag` 过滤 | "有哪些可用的模板？" |
| 12 | `get_skill` | 查看单个 skill 详情（步骤+经验） | "「写周报」的步骤是什么？" |
| 13 | `create_skill` | 手动创建 skill（名称+步骤+分类+标签） | "新建一个叫「代码审查」的模板" |
| 14 | `update_skill` | 修改 skill（追加步骤/经验/标签） | "给「写周报」加一个步骤" |
| 15 | `delete_skill` | 删除 skill | "删掉那个不用的模板" |
| 16 | `import_task_as_skill` | 将已完成任务转为 skill 模板 | "把「写周报」存为模板" |
| 17 | **`instantiate_skill`** 🆕 | **核心：用 skill 创建任务 + 子任务** | "写周报" → 自动展开为 N 个子任务 |

---

## 四、核心流程详解

---

### 流程 A：Skill 实例化（用户说"写周报"）

```
用户: "写周报"  或  "写周报，周五截止"
        │
        ▼
   ┌─────────────────────────────────────────────────────┐
   │  Step 1: LLM 推理                                    │
   │  用户想创建一个任务，但说的是一个常见模板名          │
   │  → 先调用 list_skills 看看有没有匹配的 skill         │
   └────────────────────────┬────────────────────────────┘
                            │
                            ▼  tool_call: list_skills()
   ┌─────────────────────────────────────────────────────┐
   │  Step 2: 返回结果                                    │
   │  [{id:5, name:"写周报", steps:[...], usage_count:3}] │
   └────────────────────────┬────────────────────────────┘
                            │
                            ▼  tool_call: instantiate_skill(skill_id=5, due_date="2026-06-05")
   ┌─────────────────────────────────────────────────────┐
   │  Step 3: instantiate_skill 内部逻辑 (Rust)           │
   │                                                      │
   │  ① 创建父任务:                                       │
   │     title="写周报", skill_id=5, status="进行中"      │
   │     due_date="2026-06-05"                            │
   │                                                      │
   │  ② 读取 skill.steps = [                              │
   │     {order:1, content:"收集本周工作数据"},            │
   │     {order:2, content:"按项目分类整理"},              │
   │     {order:3, content:"写入周报模板"},                │
   │     {order:4, content:"发送邮件给团队"}              │
   │  ]                                                   │
   │                                                      │
   │  ③ 为每个 step 创建子任务:                            │
   │     parent_id=父任务id, sort_order=step.order        │
   │     title=step.content, status="待开始"              │
   │                                                      │
   │  ④ 更新 skill.usage_count += 1                       │
   │     skill.last_used_at = now                         │
   │                                                      │
   │  ⑤ 返回: { parent: Task, subtasks: Task[] }          │
   └────────────────────────┬────────────────────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────────┐
   │  Step 4: LLM 总结回复                                │
   │  "已根据「写周报」模板创建任务，包含 4 个子步骤：    │
   │    ✅ 收集本周工作数据                                │
   │    ✅ 按项目分类整理                                  │
   │    ✅ 写入周报模板                                    │
   │    ✅ 发送邮件给团队                                  │
   │   截止日期：周五                                      │
   │   去任务列表逐个完成吧！"                             │
   └─────────────────────────────────────────────────────┘
```

**关键点：** `instantiate_skill` 是一个复合操作，一次调用完成父任务+所有子任务创建，减少 LLM 往返轮数。

---

### 流程 B：任务完成 → 自动总结 + 更新 Skill

```
用户将任务 "写周报" 标为「已完成」
        │
        ▼
   ┌─────────────────────────────────────────────────────┐
   │  Step 1: update_task(id=42, status="已完成")         │
   │  Rust 触发: 检测到 status="已完成" 且 skill_id=5     │
   │  → 不立即返回，先触发总结流程                        │
   └────────────────────────┬────────────────────────────┘
                            │
                            ▼  读取上下文
   ┌─────────────────────────────────────────────────────┐
   │  Step 2: 组装 LLM prompt                            │
   │  - 任务信息: title, note, created_at, completed_at  │
   │  - Skill 当前经验: skill.tips                        │
   │  - 本次所有子任务完成情况                             │
   │  → LLM 分析 → { summary, lessons }                   │
   └────────────────────────┬────────────────────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────────┐
   │  Step 3: 保存结果                                    │
   │  ① INSERT INTO task_completions (summary, lessons)  │
   │  ② UPDATE skills SET tips = tips + "\n" + lessons   │
   │  ③ UPDATE skills SET updated_at = now              │
   └────────────────────────┬────────────────────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────────┐
   │  Step 4: 前端提示                                    │
   │  "✅ 已完成！经验已更新:"                             │
   │  "本次发现：周五下午 16:00 前数据可能未更新，         │
   │              应等到 17:00 后再汇总"                   │
   └─────────────────────────────────────────────────────┘
```

**关键点：** 总结在前端 Agent 层完成（需要 LLM），Rust 只负责数据读写。或者简化为：`update_task` 返回后，前端检测到 `skill_id` 不为空且 status="已完成"，自动触发 Agent 做总结。

---

### 流程 C：导入任务为 Skill

```
用户: "把「写周报」存为模板，以后每周五都要做"
        │
        ▼
   tool_call: import_task_as_skill(task_id=42)
        │
        ▼
   ┌─────────────────────────────────────────────────────┐
   │  import_task_as_skill 内部逻辑 (Rust)                │
   │                                                      │
   │  ① 读取任务数据: id=42, title="写周报"               │
   │  ② 读取所有子任务作为 steps:                          │
   │     subtask 1 → step.order=1, step.content="收集数据" │
   │     subtask 2 → step.order=2, ...                     │
   │  ③ 如果没有子任务，用 task.note 拆分为 steps          │
   │  ④ INSERT INTO skills                                │
   │  ⑤ UPDATE tasks SET skill_id = 新 skill id           │
   │  ⑥ 返回新创建的 skill                                 │
   └────────────────────────┬────────────────────────────┘
                            │
                            ▼
   ┌─────────────────────────────────────────────────────┐
   │  LLM 回复:                                           │
   │  "已将「写周报」保存为模板 ✅                        │
   │   包含 4 个步骤，标记为「工作」分类                   │
   │   下次你只需要说「写周报」，我会自动展开所有子任务"   │
   └─────────────────────────────────────────────────────┘
```

---

## 五、Agent 循环完整流程图

```
用户输入: "写周报，周五前完成"
        │
        ▼
┌──────────────────────────────────────────────────┐
│               Agent Loop                          │
│                                                   │
│  ┌─────────────────────────────────────────┐     │
│  │ Turn 1: LLM 推理                         │     │
│  │ "写周报" 看起来很可能是已有 skill        │     │
│  │ → tool_call: list_skills()               │     │
│  └────────────────┬────────────────────────┘     │
│                   │                               │
│  ┌────────────────▼────────────────────────┐     │
│  │ Turn 1 结果: [写周报, 代码审查, ...]     │     │
│  └────────────────┬────────────────────────┘     │
│                   │                               │
│  ┌────────────────▼────────────────────────┐     │
│  │ Turn 2: LLM 推理                         │     │
│  │ 找到了"写周报" skill (id=5)              │     │
│  │ 用户说"周五前完成" → due_date=本周五      │     │
│  │ → tool_call: instantiate_skill(          │     │
│  │       skill_id=5,                        │     │
│  │       due_date="2026-06-05"              │     │
│  │   )                                      │     │
│  └────────────────┬────────────────────────┘     │
│                   │                               │
│  ┌────────────────▼────────────────────────┐     │
│  │ Turn 2 结果: { parent任务, 4个子任务 }   │     │
│  └────────────────┬────────────────────────┘     │
│                   │                               │
│  ┌────────────────▼────────────────────────┐     │
│  │ Turn 3: LLM 推理                         │     │
│  │ 工具调用成功，无需再调工具               │     │
│  │ → 纯文本回复给用户                       │     │
│  └──────────────────────────────────────────┘     │
│                                                   │
└──────────────────────────────────────────────────┘
```

**循环终止条件：**
- LLM 返回纯文本（无 tool_calls）→ 显示回复
- 达到最大轮数（5 轮）→ 显示最后回复
- 错误发生 → 显示错误

---

## 六、文件结构规划

```
src/                              # 前端
├── types/
│   ├── task.ts                   # (现有)
│   └── skill.ts                  # 🆕 Skill, SkillStep, TaskCompletion
├── services/
│   ├── taskService.ts            # 🆕 任务操作封装
│   └── skillService.ts           # 🆕 技能操作封装
├── llm/
│   ├── toolRegistry.ts           # 🆕 17 个工具的 JSON Schema
│   ├── toolExecutor.ts           # 🆕 name → service 执行映射
│   ├── llmClient.ts              # 🆕 OpenAI 兼容 API 客户端
│   ├── agent.ts                  # 🆕 Agent 循环 + 自动总结
│   └── completionSummarizer.ts   # 🆕 任务完成时总结 prompt
├── components/
│   ├── TaskInput.tsx              # (现有)
│   ├── TaskList.tsx               # (现有)
│   ├── TaskItem.tsx               # (现有)
│   ├── AIChat.tsx                 # 🆕 AI 对话面板
│   └── SkillPanel.tsx             # 🆕 技能管理面板
├── lib/
│   └── tauri.ts                   # (扩展)
├── App.tsx                        # (扩展：集成 AIChat)
└── ...

src-tauri/src/                    # Rust 后端
├── db.rs                          # (扩展：skills + task_completions 表)
├── commands.rs                    # (扩展：+12 个 command)
├── lib.rs                         # (扩展：注册新 command)
└── main.rs                        # (不变)
```

---

## 七、Rust Command 总览（17 个）

| # | Command | 参数 | 返回 |
|---|---------|------|------|
| 1 | `get_all_tasks` | status?, category? | `Vec<Task>` |
| 2 | `get_task` | id | `Task` (含子任务) |
| 3 | `create_task` | CreateTaskInput | `Task` |
| 4 | `update_task` | UpdateTaskInput | `()` |
| 5 | `delete_task` | id | `()` |
| 6 | `search_tasks` | query | `Vec<Task>` |
| 7 | `get_subtasks` | parent_id | `Vec<Task>` |
| 8 | `get_task_stats` | 无 | `Stats { by_status, by_category, total, completed }` |
| 9 | `batch_update_tasks` | ids, status?, category?, priority? | `()` |
| 10 | `reorder_tasks` | ordered_ids | `()` |
| 11 | `list_skills` | category?, tag? | `Vec<Skill>` |
| 12 | `get_skill` | id | `Skill` |
| 13 | `create_skill` | CreateSkillInput | `Skill` |
| 14 | `update_skill` | UpdateSkillInput | `()` |
| 15 | `delete_skill` | id | `()` |
| 16 | `import_task_as_skill` | task_id | `Skill` |
| 17 | `instantiate_skill` | skill_id, due_date?, priority?, category? | `{ parent: Task, subtasks: Vec<Task> }` |

---

## 八、实现阶段

| 阶段 | 内容 | 估计工作量 |
|------|------|-----------|
| **Phase 1** | Rust 扩展：db.rs 新增 skills + task_completions 表，commands.rs 新增 12 个 command | 大 |
| **Phase 2** | 前端 Service 层：taskService + skillService | 中 |
| **Phase 3** | LLM Agent 核心：toolRegistry + toolExecutor + llmClient + agent + completionSummarizer | 中 |
| **Phase 4** | UI 集成：AIChat + SkillPanel，App.tsx 整合 | 小 |

---

## 九、用户体验示例

```
用户: "写周报"
Ztodo: "已根据模板「写周报」创建任务，包含 4 个子步骤：
        □ 收集本周工作数据
        □ 按项目分类整理
        □ 写入周报模板
        □ 发送邮件给团队
        截止日期：无，需要设一个吗？"

用户: "设周五截止"
Ztodo: "已将截止日期设为 6 月 5 日（周五）"

--- 几天后，用户逐个完成子任务 ---

用户: [点完成最后一个子任务]
Ztodo: "🎉 「写周报」全部完成！
        本次经验已更新：
        • 这周发现 CRM 数据延迟，周五 17:00 后才准确
        • 邮件抄送经理时记得先确认格式
        已完成 3 次，模板越来越准了！"
```

---

> **核心设计原则：** Skill 是"活的"——每次使用都在变聪明。用户只需说一句话，系统自动展开步骤、跟踪完成、沉淀经验。下次再做同样的事，更顺畅。
