# Ztodo

> 简约待办事项 · 对话式任务管理 · AI 原生

Ztodo 是一款基于 **Tauri 2** 的桌面待办应用，支持**自然语言交互**——你可以直接对 AI 说「写周报」，它会自动创建任务、展开子步骤、完成后总结经验。

---

## 特性

### 📋 基础任务管理
- 创建/编辑/删除任务，支持优先级、截止日期、分类
- 五状态流转：待开始 → 进行中 → 等待中 → 已完成 / 已搁置
- 子任务（无限层级）
- 深色/浅色主题

### 🤖 AI 对话式操作
- 内置 LLM Agent，支持 OpenAI 兼容 API（GPT-4o、DeepSeek、Qwen 等）
- 17 个工具接口：创建、搜索、统计、批量操作...
- **自然语言驱动**：说「帮我创建明天截止的高优任务：提交报告」即可

### 📝 技能模板（Skill）
- 将常用任务流程保存为模板
- **一句话展开**：说「写周报」，自动创建父任务 + 所有子步骤
- **自动学习**：每次完成任务后，LLM 总结经验并沉淀到模板中
- 模板越用越聪明

---

## 截图

<!-- TODO: 添加截图 -->
<!-- ![主界面](screenshots/main.png) -->
<!-- ![AI 对话](screenshots/chat.png) -->

---

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2 |
| 前端 | React 19 + TypeScript + Tailwind CSS 4 |
| 后端 | Rust (rusqlite + serde) |
| 数据库 | SQLite |
| AI | OpenAI 兼容 API（function calling） |

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **pnpm**（推荐）或 npm
- **Rust** 工具链（[rustup](https://rustup.rs/)）
- **Windows**: Visual Studio 2022 Build Tools（MSVC 工具链）

### 安装

```bash
# 克隆仓库
git clone git@github.com:Zhao-zixi/Ztodo.git
cd Ztodo

# 安装前端依赖
pnpm install

# 启动开发模式
pnpm tauri dev
```

首次编译 Rust 后端可能需要几分钟（下载依赖 + 编译 SQLite）。

### 构建发布版

```bash
pnpm tauri build
```

产物在 `src-tauri/target/release/bundle/`。

---

## 使用教程

### 1. 基础操作

打开应用后：
- 顶部输入框直接添加任务，按回车
- 点击任务可展开编辑面板：修改标题、备注、优先级、截止日期、状态
- 每个任务右侧 `＋` 按钮添加子任务
- 托拽排序（待实现）

### 2. 配置 AI

1. 点击右下角 💬 按钮打开 AI 面板
2. 点击 ⚙ 设置图标
3. 填入你的 API 信息：

| 字段 | 说明 | 示例 |
|------|------|------|
| API Endpoint | API 地址 | `https://api.openai.com/v1` |
| API Key | 密钥 | `sk-...` |
| Model | 模型名 | `gpt-4o-mini` |

支持任意 OpenAI 兼容接口，包括：
- OpenAI 官方
- DeepSeek（`https://api.deepseek.com/v1`，model: `deepseek-chat`）
- 通义千问
- 本地 Ollama 等

配置保存在浏览器 localStorage 中。

### 3. 对话示例

| 你说 | Ztodo 做什么 |
|------|-------------|
| 「今天有哪些进行中的任务？」 | 列出所有进行中任务 |
| 「创建一个高优任务：提交报告，明天截止」 | 创建任务，priority=3，due_date=明天 |
| 「把『写周报』标为已完成」 | 更新状态 |
| 「搜一下跟报告相关的」 | 搜索 title + note |
| 「我这周完成情况怎么样？」 | 显示统计 |
| 「把『写周报』存为模板」 | 导入为 Skill |

### 4. 技能模板（Skill）

**创建模板：**
1. 完成一个任务后，对 AI 说「把 xxx 存为模板」
2. 或者在 AI 面板的「模板」标签页手动管理

**使用模板：**
- 直接对 AI 说模板名，如「写周报」
- 系统自动创建父任务 + 展开所有子步骤
- 在「模板」标签页也可以点击「执行」按钮

**自动学习：**
- 每次完成关联了模板的任务，LLM 会自动总结经验
- 经验积累在模板的 tips 中，下次使用时会参考
- 模板越用越精准

---

## 项目结构

```
Ztodo/
├── src/                          # 前端 (React + TypeScript)
│   ├── components/
│   │   ├── TaskInput.tsx         # 任务输入框
│   │   ├── TaskList.tsx          # 任务列表
│   │   ├── TaskItem.tsx          # 单个任务卡片
│   │   ├── AIChat.tsx            # AI 对话面板
│   │   └── SkillPanel.tsx        # 技能模板管理
│   ├── services/
│   │   ├── taskService.ts        # 任务操作封装（10 个接口）
│   │   └── skillService.ts       # 技能操作封装（7 个接口）
│   ├── llm/
│   │   ├── toolRegistry.ts       # 17 个工具的 JSON Schema
│   │   ├── toolExecutor.ts       # 工具名 → 实际调用映射
│   │   ├── llmClient.ts          # LLM API 客户端（OpenAI 兼容）
│   │   └── agent.ts              # Agent 循环 + 完成总结
│   ├── types/
│   │   ├── task.ts               # 任务类型定义
│   │   └── skill.ts              # 技能类型定义
│   ├── lib/tauri.ts              # Tauri invoke 桥接
│   ├── App.tsx                   # 主应用
│   └── main.tsx                  # 入口
├── src-tauri/                    # 后端 (Rust)
│   └── src/
│       ├── db.rs                 # SQLite 数据库 + 迁移
│       ├── commands.rs           # 17 个 Tauri Command
│       ├── lib.rs                # 应用入口 + 注册
│       └── main.rs               # 主函数
├── .hermes/plans/                # 架构规划文档
└── package.json
```

---

## 数据库表

| 表 | 说明 |
|----|------|
| `tasks` | 任务（含 skill_id 关联） |
| `skills` | 技能模板（name, steps JSON, tips, tags） |
| `task_completions` | 完成记录（summary, lessons） |

---

## LLM Agent 架构

```
用户输入 "写周报"
    │
    ▼
Agent Loop（前端 TS）
    │
    ├─→ LLM 推理 → tool_call: list_skills()
    ├─→ 找到 "写周报" skill (id=5)
    ├─→ tool_call: instantiate_skill(skill_id=5)
    │       ├─ 创建父任务 "写周报"
    │       ├─ 展开 4 个子步骤
    │       └─ usage_count += 1
    ├─→ LLM 回复: "已创建，包含 4 个步骤..."
    │
    ▼
用户逐个完成子任务
    │
    ▼
最后一个完成时 → LLM 自动总结 → 追加到 skill.tips
```

---

## License

MIT
