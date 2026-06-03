export interface Skill {
  id: number;
  name: string;
  description: string;
  category: string;
  steps: string;       // JSON: [{"order":1,"content":"..."}]
  tips: string;
  tags: string;        // JSON: ["tag1","tag2"]
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillStep {
  order: number;
  content: string;
}

/** 解析 steps JSON 字符串为数组 */
export function parseSkillSteps(skill: Skill): SkillStep[] {
  try {
    return JSON.parse(skill.steps);
  } catch {
    return [];
  }
}

/** 解析 tags JSON 字符串为数组 */
export function parseSkillTags(skill: Skill): string[] {
  try {
    return JSON.parse(skill.tags);
  } catch {
    return [];
  }
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  category?: string;
  steps?: string;
  tips?: string;
  tags?: string;
}

export interface UpdateSkillInput {
  id: number;
  name?: string;
  description?: string;
  category?: string;
  steps?: string;
  tips?: string;
  tags?: string;
  usage_count?: number;
}

export interface InstantiateSkillInput {
  skill_id: number;
  due_date?: string;
  priority?: number;
  category?: string;
}

export interface InstantiateResult {
  parent: Task;
  subtasks: Task[];
}

import type { Task } from "./task";
