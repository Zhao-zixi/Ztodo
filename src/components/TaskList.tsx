import { useEffect, useState, useMemo } from "react";
import { Search, Loader, Pause, Circle, Archive, Check } from "lucide-react";
import type { Task } from "../types/task";
import { isTerminal } from "../types/task";
import { getAllTasks } from "../lib/tauri";
import TaskItem from "./TaskItem";

interface Props {
  refreshKey: number;
  onAddSubtask: (parentId: number) => void;
}

const STATUS_GROUPS = [
  { key: "进行中", label: "进行中", icon: Loader, color: "text-blue-500" },
  { key: "等待中", label: "等待中", icon: Pause, color: "text-amber-500" },
  { key: "待开始", label: "待开始", icon: Circle, color: "text-zinc-400" },
  { key: "已搁置", label: "已搁置", icon: Archive, color: "text-zinc-500" },
  { key: "已完成", label: "已完成", icon: Check, color: "text-green-500" },
];

export default function TaskList({ refreshKey, onAddSubtask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const loadTasks = async () => {
    try {
      setTasks(await getAllTasks());
    } catch (e) {
      console.error("加载任务失败:", e);
    }
  };

  useEffect(() => { loadTasks(); }, [refreshKey]);

  // 树结构 + 搜索
  const { roots, childrenMap, totalVisible } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const roots: Task[] = [];
    const map = new Map<number, Task[]>();
    let visible = 0;

    for (const t of tasks) {
      if (q && !t.title.toLowerCase().includes(q) && !t.note.toLowerCase().includes(q))
        continue;
      visible++;
      if (t.parent_id) {
        const arr = map.get(t.parent_id) || [];
        arr.push(t);
        map.set(t.parent_id, arr);
      } else {
        roots.push(t);
      }
    }

    // 子任务按创建时间升序
    for (const [, children] of map) {
      children.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }

    return { roots, childrenMap: map, totalVisible: visible };
  }, [tasks, search]);

  // 按状态分组根任务（后端已排好序，只需按状态切分）
  const grouped = useMemo(() => {
    const result: { key: string; label: string; icon: any; color: string; tasks: Task[] }[] = [];
    const done = new Set<number>();

    for (const g of STATUS_GROUPS) {
      const items = roots.filter((t) => t.status === g.key && !done.has(t.id));
      if (items.length > 0) {
        result.push({ ...g, tasks: items });
        items.forEach((t) => done.add(t.id));
      }
    }
    return result;
  }, [roots]);

  const toggleCollapse = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderWithChildren = (task: Task, depth: number) => {
    const children = childrenMap.get(task.id) || [];
    const hasChildren = children.length > 0;
    const collapsedNow = collapsed.has(task.id);

    return (
      <div key={task.id}>
        <TaskItem
          task={task} depth={depth}
          hasChildren={hasChildren} isCollapsed={collapsedNow}
          onToggleCollapse={() => toggleCollapse(task.id)}
          onChanged={() => loadTasks()}
          onAddSubtask={() => onAddSubtask(task.id)}
        />
        {hasChildren && !collapsedNow &&
          children.map((c) => renderWithChildren(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 搜索 */}
      <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700
                       bg-zinc-50 dark:bg-zinc-800/50 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       placeholder:text-zinc-400 text-zinc-800 dark:text-zinc-200" />
          {search && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">
              {totalVisible} 条
            </span>
          )}
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400 dark:text-zinc-500">
            <svg className="w-16 h-16 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">还没有任务</p>
            <p className="text-xs mt-1 opacity-60">在上面输入框中添加你的第一个任务 ✨</p>
          </div>
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Search size={40} className="mb-3 opacity-30" />
            <p className="text-sm">未找到匹配 "{search}" 的任务</p>
            <button onClick={() => setSearch("")} className="mt-2 text-xs text-indigo-500">清除搜索</button>
          </div>
        ) : (
          grouped.map((group) => {
            const Icon = group.icon;
            const muted = isTerminal(group.key);
            return (
              <div key={group.key}>
                <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5
                  ${muted ? "text-zinc-400 dark:text-zinc-500 border-t border-zinc-200 dark:border-zinc-800"
                          : "text-zinc-500 dark:text-zinc-400"}`}>
                  <Icon size={12} className={group.color} />
                  {group.label}
                  <span className="font-normal normal-case">({group.tasks.length})</span>
                </div>
                {group.tasks.map((task) => renderWithChildren(task, 0))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
