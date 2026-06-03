export interface Task {
  id: number;
  title: string;
  note: string;
  category: string;
  priority: number;
  due_date: string | null;
  status: string;            // 待开始 | 进行中 | 等待中 | 已完成 | 已搁置
  progress: number;
  parent_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  note?: string;
  category?: string;
  priority?: number;
  due_date?: string;
  parent_id?: number;
  status?: string;
}

export interface UpdateTaskInput {
  id: number;
  title?: string;
  note?: string;
  category?: string;
  priority?: number;
  due_date?: string;
  status?: string;
  progress?: number;
  parent_id?: number;
}

/** 终态（不可编辑） */
export function isTerminal(s: string): boolean {
  return s === "已完成" || s === "已搁置";
}
