/**
 * 工具注册表 — 定义所有暴露给 LLM 的工具及其 JSON Schema。
 * 格式兼容 OpenAI function calling / 大多数 LLM API。
 */

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

// ============================================================
//  任务工具 (1-10)
// ============================================================

const listTasks: ToolDefinition = {
  type: "function",
  function: {
    name: "list_tasks",
    description:
      "列出所有任务，可按状态或分类过滤。默认按「进行中>等待中>待开始>已搁置>已完成」排序。",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["待开始", "进行中", "等待中", "已完成", "已搁置"],
          description: "按状态过滤，不填则返回全部",
        },
        category: {
          type: "string",
          description: "按分类过滤，如「工作」「个人」，不填则返回全部",
        },
      },
      required: [],
    },
  },
};

const getTask: ToolDefinition = {
  type: "function",
  function: {
    name: "get_task",
    description:
      "获取单个任务的详细信息，包括标题、备注、优先级、截止日期、状态、进度、子任务列表等。",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "任务 ID",
        },
      },
      required: ["id"],
    },
  },
};

const createTask: ToolDefinition = {
  type: "function",
  function: {
    name: "create_task",
    description:
      "创建新任务。可指定标题、备注、分类、优先级（0=无,1=低,2=中,3=高）、截止日期(YYYY-MM-DD)、父任务 ID。",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "任务标题（必填）",
        },
        note: {
          type: "string",
          description: "备注/详细描述",
        },
        category: {
          type: "string",
          description: "分类，默认「默认」",
        },
        priority: {
          type: "number",
          enum: [0, 1, 2, 3],
          description: "优先级：0=无, 1=低, 2=中, 3=高，默认 0",
        },
        due_date: {
          type: "string",
          description: "截止日期，格式 YYYY-MM-DD",
        },
        parent_id: {
          type: "number",
          description: "父任务 ID，用于创建子任务",
        },
        status: {
          type: "string",
          enum: ["待开始", "进行中", "等待中"],
          description: "初始状态，默认「待开始」",
        },
      },
      required: ["title"],
    },
  },
};

const updateTask: ToolDefinition = {
  type: "function",
  function: {
    name: "update_task",
    description:
      "修改任务的任意字段。可修改标题、备注、分类、优先级、截止日期、状态、进度(0-100)。状态改为「已完成」时进度自动设 100，改为「待开始」时进度自动设 0。",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "任务 ID（必填）",
        },
        title: {
          type: "string",
          description: "新标题",
        },
        note: {
          type: "string",
          description: "新备注",
        },
        category: {
          type: "string",
          description: "新分类",
        },
        priority: {
          type: "number",
          enum: [0, 1, 2, 3],
        },
        due_date: {
          type: "string",
          description: "新截止日期 YYYY-MM-DD",
        },
        status: {
          type: "string",
          enum: ["待开始", "进行中", "等待中", "已完成", "已搁置"],
          description: "新状态",
        },
        progress: {
          type: "number",
          description: "进度 0-100",
        },
      },
      required: ["id"],
    },
  },
};

const deleteTask: ToolDefinition = {
  type: "function",
  function: {
    name: "delete_task",
    description: "删除任务。注意：不可恢复！",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "要删除的任务 ID",
        },
      },
      required: ["id"],
    },
  },
};

const searchTasks: ToolDefinition = {
  type: "function",
  function: {
    name: "search_tasks",
    description: "按关键词搜索任务（同时搜索标题和备注），返回匹配列表。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词",
        },
      },
      required: ["query"],
    },
  },
};

const getSubtasks: ToolDefinition = {
  type: "function",
  function: {
    name: "get_subtasks",
    description: "获取某个父任务下的所有子任务，按顺序排列。",
    parameters: {
      type: "object",
      properties: {
        parent_id: {
          type: "number",
          description: "父任务 ID",
        },
      },
      required: ["parent_id"],
    },
  },
};

const getStats: ToolDefinition = {
  type: "function",
  function: {
    name: "get_stats",
    description:
      "获取任务统计概览：总任务数、已完成数、按状态分布、按分类分布。",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

const batchUpdateTasks: ToolDefinition = {
  type: "function",
  function: {
    name: "batch_update_tasks",
    description:
      "批量更新多个任务。可统一修改状态、分类、优先级。适合「把所有工作分类的任务标为进行中」这类操作。",
    parameters: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "number" },
          description: "要更新的任务 ID 列表",
        },
        status: {
          type: "string",
          enum: ["待开始", "进行中", "等待中", "已完成", "已搁置"],
        },
        category: {
          type: "string",
        },
        priority: {
          type: "number",
          enum: [0, 1, 2, 3],
        },
      },
      required: ["ids"],
    },
  },
};

const reorderTasks: ToolDefinition = {
  type: "function",
  function: {
    name: "reorder_tasks",
    description: "按指定顺序重新排列任务（用于拖拽排序后持久化）。",
    parameters: {
      type: "object",
      properties: {
        ordered_ids: {
          type: "array",
          items: { type: "number" },
          description: "按新顺序排列的任务 ID 列表",
        },
      },
      required: ["ordered_ids"],
    },
  },
};

// ============================================================
//  技能工具 (11-17)
// ============================================================

const listSkills: ToolDefinition = {
  type: "function",
  function: {
    name: "list_skills",
    description:
      "列出所有可用技能模板，可选按分类或标签过滤。按使用次数降序排列。",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "按分类过滤",
        },
        tag: {
          type: "string",
          description: "按标签过滤，如「工作」「写作」",
        },
      },
      required: [],
    },
  },
};

const getSkill: ToolDefinition = {
  type: "function",
  function: {
    name: "get_skill",
    description: "查看单个技能的详细信息，包括步骤清单和历史经验。",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "技能 ID",
        },
      },
      required: ["id"],
    },
  },
};

const createSkill: ToolDefinition = {
  type: "function",
  function: {
    name: "create_skill",
    description:
      "手动创建一个技能模板。steps 为 JSON 数组：[{order:1, content:\"步骤内容\"}]。tags 为 JSON 字符串数组。",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "技能名称",
        },
        description: {
          type: "string",
          description: "描述",
        },
        category: {
          type: "string",
          description: "分类",
        },
        steps: {
          type: "string",
          description: 'JSON 步骤数组，如 [{"order":1,"content":"收集数据"}]',
        },
        tips: {
          type: "string",
          description: "经验提示",
        },
        tags: {
          type: "string",
          description: 'JSON 标签数组，如 ["工作","写作"]',
        },
      },
      required: ["name"],
    },
  },
};

const updateSkill: ToolDefinition = {
  type: "function",
  function: {
    name: "update_skill",
    description: "修改技能模板（追加步骤、更新经验等）。",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "技能 ID",
        },
        name: { type: "string" },
        description: { type: "string" },
        category: { type: "string" },
        steps: { type: "string", description: "JSON 步骤数组" },
        tips: { type: "string", description: "经验文字" },
        tags: { type: "string", description: "JSON 标签数组" },
      },
      required: ["id"],
    },
  },
};

const deleteSkill: ToolDefinition = {
  type: "function",
  function: {
    name: "delete_skill",
    description: "删除技能模板。",
    parameters: {
      type: "object",
      properties: {
        id: { type: "number", description: "技能 ID" },
      },
      required: ["id"],
    },
  },
};

const importTaskAsSkill: ToolDefinition = {
  type: "function",
  function: {
    name: "import_task_as_skill",
    description:
      "将已完成的任务（及其子任务）导入为技能模板，下次可直接复用。子任务会变成技能的步骤。",
    parameters: {
      type: "object",
      properties: {
        task_id: {
          type: "number",
          description: "要导入的任务 ID",
        },
      },
      required: ["task_id"],
    },
  },
};

const instantiateSkill: ToolDefinition = {
  type: "function",
  function: {
    name: "instantiate_skill",
    description:
      "【核心】用技能模板创建任务。自动创建一个父任务 + 按技能步骤展开所有子任务。当用户说「写周报」「做代码审查」等时，先用 list_skills 查找匹配的技能，然后调用此工具。",
    parameters: {
      type: "object",
      properties: {
        skill_id: {
          type: "number",
          description: "技能 ID",
        },
        due_date: {
          type: "string",
          description: "截止日期 YYYY-MM-DD",
        },
        priority: {
          type: "number",
          enum: [0, 1, 2, 3],
          description: "优先级 0-3",
        },
        category: {
          type: "string",
          description: "覆盖技能默认分类",
        },
      },
      required: ["skill_id"],
    },
  },
};

// ============================================================
//  导出
// ============================================================

export const ALL_TOOLS: ToolDefinition[] = [
  // 任务
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  searchTasks,
  getSubtasks,
  getStats,
  batchUpdateTasks,
  reorderTasks,
  // 技能
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  importTaskAsSkill,
  instantiateSkill,
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find((t) => t.function.name === name);
}
