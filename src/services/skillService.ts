import { invoke } from "@tauri-apps/api/core";
import type {
  Skill,
  CreateSkillInput,
  UpdateSkillInput,
  InstantiateSkillInput,
  InstantiateResult,
} from "../types/skill";

// ── 查询 ──

export async function listSkills(
  category?: string,
  tag?: string,
): Promise<Skill[]> {
  return invoke("list_skills", { category, tag });
}

export async function getSkill(id: number): Promise<Skill> {
  return invoke("get_skill", { id });
}

// ── 增删改 ──

export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  return invoke("create_skill", { input });
}

export async function updateSkill(input: UpdateSkillInput): Promise<void> {
  return invoke("update_skill", { input });
}

export async function deleteSkill(id: number): Promise<void> {
  return invoke("delete_skill", { id });
}

// ── 导入 / 实例化 ──

export async function importTaskAsSkill(taskId: number): Promise<Skill> {
  return invoke("import_task_as_skill", { taskId });
}

export async function instantiateSkill(
  input: InstantiateSkillInput,
): Promise<InstantiateResult> {
  return invoke("instantiate_skill", { input });
}
