import { useEffect, useState, useMemo } from "react";
import { Search, Loader, Pause, Circle, Archive, Check, Inbox } from "lucide-react";
import type { Task } from "../types/task";
import { isTerminal } from "../types/task";
import { getAllTasks } from "../lib/tauri";
import TaskItem from "./TaskItem";

interface Props {
  refreshKey: number;
  onAddSubtask: (parentId: number) => void;
}

const STATUS_GROUPS = [
  { key: "进行中", label: "进行中", icon: Loader, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/20", dot: "bg-blue-400" },
  { key: "等待中", label: "等待中", icon: Pause, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/20", dot: "bg-amber-400" },
  { key: "待开始", label: "待开始", icon: Circle, color: "text-zinc-400", bg: "bg-zinc-50 dark:bg-zinc-800/50", dot: "bg-zinc-300" },
  { key: "已搁置", label: "已搁置", icon: Archive, color: "text-zinc-400", bg: "bg-zinc-50 dark:bg-zinc-800/50", dot: "bg-zinc-400" },
  { key: "已完成", label: "已完成", icon: Check, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/20", dot: "bg-emerald-400" },
];

export default function TaskList({ refreshKey, onAddSubtask }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");

  const loadTasks = async () => {
    try {
      setTasks(await getAllTasks());
    } catch (e) {
      console.error("加载任务失败:", e);
    }
  };

  useEffect(() => { loadTasks(); }, [refreshKey]);

  // 树结构 + 搜索
  const { roots, childrenMap, totalVisible, notFound } = useMemo(() => {
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

    for (const [, children] of map) {
      children.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }

    return { roots, childrenMap: map, totalVisible: visible, notFound: q && visible === 0 };
  }, [tasks, search]);

  // 按状态分组
  const grouped = useMemo(() => {
    const result: { key: string; label: string; icon: any; color: string; bg: string; dot: string; tasks: Task[]; count: number }[] = [];
    const done = new Set<number>();

    for (const g of STATUS_GROUPS) {
      const items = roots.filter((t) => t.status === g.key && !done.has(t.id));
      if (items.length > 0 || !search) {
        result.push({ ...g, tasks: items, count: items.length });
        items.forEach((t) => done.add(t.id));
      }
    }
    return result;
  }, [roots, search]);

  // 统计
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "已完成").length;
    const active = tasks.filter((t) => t.status === "进行中").length;
    return { total, done, active };
  }, [tasks]);

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

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
      {/* 搜索栏 + 统计 */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务..."
            className="w-full pl-9 pr-16 py-2 text-sm rounded-xl
                       border border-zinc-200 dark:border-zinc-700
                       bg-zinc-50 dark:bg-zinc-800/50
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300
                       dark:focus:border-indigo-600
                       placeholder:text-zinc-400 dark:placeholder:text-zinc-500
                       text-zinc-800 dark:text-zinc-200" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {search && (
              <span className="text-[11px] text-zinc-400">{totalVisible} 条</span>
            )}
            {!search && stats.total > 0 && (
              <span className="text-[11px] text-zinc-400">
                {stats.done}/{stats.total} 完成
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto px-1">
        {tasks.length === 0 ? (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800
                           flex items-center justify-center mb-4">
              <Inbox size={28} className="text-zinc-300 dark:text-zinc-600" />
            </div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">还没有任务</p>
            <p className="text-xs mt-1 text-zinc-400 dark:text-zinc-500">在上方输入框中添加你的第一个任务</p>
          </div>
        ) : notFound ? (
          /* 搜索无结果 */
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
            <Search size={28} className="mb-3 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm">未找到 "{search}"</p>
            <button onClick={() => setSearch("")}
              className="mt-2 text-xs text-indigo-500 hover:text-indigo-600 transition-colors">
              清除搜索
            </button>
          </div>
        ) : (
          /* 分组列表 */
          grouped.map((group) => {
            const Icon = group.icon;
            const muted = isTerminal(group.key);
            if (group.tasks.length === 0 && search) return null;
            return (
              <div key={group.key} className="mb-1">
                {/* 分组头 */}
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg mx-1
                  ${muted ? "opacity-60" : ""}`}>
                  <div className={`w-2 h-2 rounded-full ${group.dot}`} />
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    {group.label}
                  </span>
                  <span className="text-[11px] text-zinc-400 tabular-nums">
                    {group.tasks.length}
                  </span>
                </div>

                {/* 该组任务 */}
                {group.tasks.length > 0 ? (
                  group.tasks.map((task) => renderWithChildren(task, 0))
                ) : (
                  !search && (
                    <div className="px-4 py-3 text-xs text-zinc-400 text-center">
                      暂无
                    </div>
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
