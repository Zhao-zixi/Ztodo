/**
 * 工具执行器 — 将 LLM 返回的 tool_call 映射到实际的 service 调用。
 */

import * as taskService from "../services/taskService";
import * as skillService from "../services/skillService";

export type ToolCallResult = unknown;

/**
 * 执行单个工具调用。
 * @param name 工具名（与 toolRegistry 中一致）
 * @param args LLM 传入的参数字典
 * @returns 执行结果
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  switch (name) {
    // ── 任务 ──
    case "list_tasks":
      return taskService.getAllTasks(
        args.status as string | undefined,
        args.category as string | undefined,
      );

    case "get_task":
      return taskService.getTask(args.id as number);

    case "create_task":
      return taskService.createTask({
        title: args.title as string,
        note: args.note as string | undefined,
        category: args.category as string | undefined,
        priority: args.priority as number | undefined,
        due_date: args.due_date as string | undefined,
        parent_id: args.parent_id as number | undefined,
        status: args.status as string | undefined,
      });

    case "update_task":
      return taskService.updateTask({
        id: args.id as number,
        title: args.title as string | undefined,
        note: args.note as string | undefined,
        category: args.category as string | undefined,
        priority: args.priority as number | undefined,
        due_date: args.due_date as string | undefined,
        status: args.status as string | undefined,
        progress: args.progress as number | undefined,
      });

    case "delete_task":
      return taskService.deleteTask(args.id as number);

    case "search_tasks":
      return taskService.searchTasks(args.query as string);

    case "get_subtasks":
      return taskService.getSubtasks(args.parent_id as number);

    case "get_stats":
      return taskService.getTaskStats();

    case "batch_update_tasks":
      return taskService.batchUpdateTasks({
        ids: args.ids as number[],
        status: args.status as string | undefined,
        category: args.category as string | undefined,
        priority: args.priority as number | undefined,
      });

    case "reorder_tasks":
      return taskService.reorderTasks(args.ordered_ids as number[]);

    // ── 技能 ──
    case "list_skills":
      return skillService.listSkills(
        args.category as string | undefined,
        args.tag as string | undefined,
      );

    case "get_skill":
      return skillService.getSkill(args.id as number);

    case "create_skill":
      return skillService.createSkill({
        name: args.name as string,
        description: args.description as string | undefined,
        category: args.category as string | undefined,
        steps: args.steps as string | undefined,
        tips: args.tips as string | undefined,
        tags: args.tags as string | undefined,
      });

    case "update_skill":
      return skillService.updateSkill({
        id: args.id as number,
        name: args.name as string | undefined,
        description: args.description as string | undefined,
        category: args.category as string | undefined,
        steps: args.steps as string | undefined,
        tips: args.tips as string | undefined,
        tags: args.tags as string | undefined,
      });

    case "delete_skill":
      return skillService.deleteSkill(args.id as number);

    case "import_task_as_skill":
      return skillService.importTaskAsSkill(args.task_id as number);

    case "instantiate_skill":
      return skillService.instantiateSkill({
        skill_id: args.skill_id as number,
        due_date: args.due_date as string | undefined,
        priority: args.priority as number | undefined,
        category: args.category as string | undefined,
      });

    default:
      throw new Error(`未知工具: ${name}`);
  }
}
