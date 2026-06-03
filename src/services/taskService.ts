import { invoke } from "@tauri-apps/api/core";
import type { Task, CreateTaskInput, UpdateTaskInput } from "../types/task";

// ── 查询 ──

export async function getAllTasks(
  status?: string,
  category?: string,
): Promise<Task[]> {
  return invoke("get_all_tasks", { status, category });
}

export async function getTask(id: number): Promise<{ task: Task; subtasks: Task[] }> {
  return invoke("get_task", { id });
}

export async function searchTasks(query: string): Promise<Task[]> {
  return invoke("search_tasks", { query });
}

export async function getSubtasks(parentId: number): Promise<Task[]> {
  return invoke("get_subtasks", { parentId });
}

// ── 统计 ──

export interface StatusCount {
  status: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface TaskStats {
  total: number;
  completed: number;
  by_status: StatusCount[];
  by_category: CategoryCount[];
}

export async function getTaskStats(): Promise<TaskStats> {
  return invoke("get_task_stats");
}

// ── 增删改 ──

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return invoke("create_task", { input });
}

export async function updateTask(input: UpdateTaskInput): Promise<void> {
  return invoke("update_task", { input });
}

export async function deleteTask(id: number): Promise<void> {
  return invoke("delete_task", { id });
}

// ── 批量操作 ──

export interface BatchUpdateInput {
  ids: number[];
  status?: string;
  category?: string;
  priority?: number;
}

export async function batchUpdateTasks(input: BatchUpdateInput): Promise<void> {
  return invoke("batch_update_tasks", { input });
}

export async function reorderTasks(orderedIds: number[]): Promise<void> {
  return invoke("reorder_tasks", { orderedIds });
}
