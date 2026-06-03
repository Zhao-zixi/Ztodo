import { invoke } from "@tauri-apps/api/core";
import type { Task, CreateTaskInput, UpdateTaskInput } from "../types/task";

export async function getAllTasks(): Promise<Task[]> {
  return invoke("get_all_tasks");
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return invoke("create_task", { input });
}

export async function updateTask(input: UpdateTaskInput): Promise<void> {
  return invoke("update_task", { input });
}

export async function deleteTask(id: number): Promise<void> {
  return invoke("delete_task", { id });
}
