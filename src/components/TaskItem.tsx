import { useState, useRef, useEffect } from "react";
import {
  Trash2, Pencil, Calendar, ChevronRight, ChevronDown, Plus,
  Circle, Loader, Pause, Check, Archive,
} from "lucide-react";
import type { Task } from "../types/task";
import { isTerminal } from "../types/task";
import { updateTask, deleteTask, getAllTasks } from "../lib/tauri";

interface Props {
  task: Task;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onChanged: () => void;
  onAddSubtask: () => void;
}

const CATEGORIES = ["工作", "个人", "学习", "生活", "其他"];

const STATUSES = [
  { key: "待开始", label: "待开始", icon: Circle, color: "text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800" },
  { key: "进行中", label: "进行中", icon: Loader, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30" },
  { key: "等待中", label: "等待中", icon: Pause, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-900/30" },
  { key: "已完成", label: "已完成", icon: Check, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30" },
  { key: "已搁置", label: "已搁置", icon: Archive, color: "text-zinc-500", bg: "bg-zinc-200 dark:bg-zinc-700" },
];

const PRIORITY_CONFIG = [
  { label: "无", color: "bg-zinc-300 dark:bg-zinc-600" },
  { label: "低", color: "bg-blue-400" },
  { label: "中", color: "bg-amber-400" },
  { label: "高", color: "bg-red-400" },
];

const CATEGORY_COLORS: Record<string, string> = {
  工作: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  个人: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  学习: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  生活: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  其他: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const fmtDate = (d: string): string => {
  const date = new Date(d);
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return `过期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  if (days < 7) return `${days} 天后`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};

const overdue = (d: string | null): boolean =>
  !!d && new Date(d).getTime() < Date.now();

const statusInfo = (s: string) => STATUSES.find((x) => x.key === s) || STATUSES[0];

export default function TaskItem({
  task, depth, hasChildren, isCollapsed,
  onToggleCollapse, onChanged, onAddSubtask,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNote, setEditNote] = useState(task.note);
  const [editCategory, setEditCategory] = useState(task.category);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due_date || "");
  const [editStatus, setEditStatus] = useState(task.status);
  const [editProgress, setEditProgress] = useState(task.progress);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSubtask = depth > 0;
  const terminal = isTerminal(task.status);

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

  // ── 切换状态 ──
  const cycleStatus = async () => {
    if (terminal) return;
    const order = ["待开始", "进行中", "等待中"];
    const idx = order.indexOf(task.status);
    const next = order[(idx + 1) % order.length];

    // 联动进度
    const extra: Record<string, unknown> = {};
    if (next === "进行中" && task.progress === 0) extra.progress = 0;
    if (next === "待开始") extra.progress = 0;

    await updateTask({ id: task.id, status: next, ...extra } as any);
    onChanged();
  };

  // ── 标记完成 ──
  const markDone = async () => {
    await updateTask({ id: task.id, status: "已完成" });

    // 更新父进度
    if (task.parent_id) await syncParentProgress(task.parent_id);

    onChanged();
  };

  const markArchived = async () => {
    await updateTask({ id: task.id, status: "已搁置" });
    onChanged();
  };

  // ── 删除 ──
  const handleDelete = async () => {
    if (!confirm("确定删除这个任务吗？")) return;
    await deleteTask(task.id);
    if (task.parent_id) await syncParentProgress(task.parent_id);
    onChanged();
  };

  // ── 同步父进度 ──
  const syncParentProgress = async (parentId: number) => {
    const all = await getAllTasks();
    const siblings = all.filter((t) => t.parent_id === parentId);
    if (siblings.length > 0) {
      const done = siblings.filter((c) => c.status === "已完成").length;
      const progress = Math.round((done / siblings.length) * 100);
      await updateTask({ id: parentId, progress });
    }
  };

  // ── 编辑 ──
  const startEdit = () => {
    if (terminal) return;
    setEditTitle(task.title);
    setEditNote(task.note);
    setEditCategory(task.category);
    setEditPriority(task.priority);
    setEditDueDate(task.due_date || "");
    setEditStatus(task.status);
    setEditProgress(task.progress);
    setEditing(true);
  };

  const saveEdit = async () => {
    const t = editTitle.trim();
    if (!t) return;

    // 状态联动进度
    let prog = editProgress;
    if (editStatus === "已完成") prog = 100;
    else if (editStatus === "待开始" && task.status !== "待开始") prog = 0;

    await updateTask({
      id: task.id, title: t, note: editNote.trim(),
      category: editCategory, priority: editPriority,
      due_date: editDueDate || undefined,
      status: editStatus, progress: prog,
    });
    setEditing(false);
    onChanged();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    if (e.key === "Escape") setEditing(false);
  };

  const si = statusInfo(task.status);
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG[0];
  const catColor = CATEGORY_COLORS[task.category] || CATEGORY_COLORS["其他"];
  const indentLeft = depth * 20;
  const ov = overdue(task.due_date);

  // ────────── 编辑模式 ──────────
  if (editing) {
    return (
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-indigo-50/50 dark:bg-indigo-950/20"
        style={{ paddingLeft: `${16 + indentLeft}px` }}>
        <div className="space-y-2">
          <input ref={inputRef} type="text" value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)} onKeyDown={handleEditKeyDown}
            placeholder="任务标题"
            className="w-full px-2 py-1.5 text-sm rounded border border-indigo-300 
                       dark:border-indigo-600 bg-white dark:bg-zinc-800
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200" />
          <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
            placeholder="备注..." rows={2}
            className="w-full px-2 py-1.5 text-xs rounded border border-zinc-200 
                       dark:border-zinc-700 bg-white dark:bg-zinc-800 resize-none
                       focus:outline-none focus:ring-1 focus:ring-indigo-500
                       text-zinc-600 dark:text-zinc-400" />

          {/* 状态选择器 */}
          <div>
            <label className="block text-[11px] text-zinc-400 mb-1">状态</label>
            <div className="flex gap-1">
              {STATUSES.map((s) => {
                const Icon = s.icon;
                return (
                  <button key={s.key} onClick={() => setEditStatus(s.key)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all
                      ${editStatus === s.key
                        ? `${s.bg} ${s.color} font-medium ring-1 ring-inset ring-zinc-300 dark:ring-zinc-600`
                        : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                    <Icon size={12} />{s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
              className="px-2 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 
                         bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300
                         focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <div className="flex gap-1 items-center justify-center">
              {PRIORITY_CONFIG.map((p, i) => (
                <button key={i} onClick={() => setEditPriority(i)}
                  className={`w-6 h-6 rounded-full text-[10px] font-medium transition-all
                    ${i === editPriority ? `${p.color} text-white scale-110 ring-2 ring-offset-1 ring-zinc-300`
                      : `${p.color} opacity-40 hover:opacity-70`}`}>
                  {i === 0 ? "—" : p.label}
                </button>
              ))}
            </div>
            <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)}
              className="px-2 py-1.5 text-xs rounded border border-zinc-200 dark:border-zinc-700 
                         bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300
                         focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>

          {/* 进度（非子任务不显示） */}
          {isSubtask && editStatus === "进行中" && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-400 w-8 text-right">{editProgress}%</span>
              <input type="range" min={0} max={100} step={5} value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-indigo-500 cursor-pointer" />
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-[11px] text-zinc-400">Enter 保存 · Esc 取消</span>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)}
                className="px-3 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-600
                           text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">取消</button>
              <button onClick={saveEdit}
                className="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700">保存</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────────── 查看模式 ──────────
  const StatusIcon = si.icon;

  return (
    <div
      className={`group flex items-start gap-2.5 px-4 py-3 border-b 
        border-zinc-100 dark:border-zinc-800 transition-colors
        hover:bg-zinc-50 dark:hover:bg-zinc-800/30
        ${terminal ? "opacity-50" : ""}
        ${isSubtask ? "bg-zinc-50/50 dark:bg-zinc-900/20" : ""}`}
      style={{ paddingLeft: `${16 + indentLeft}px` }}
    >
      {/* 状态图标 — 点击循环切换 */}
      <button
        onClick={terminal ? undefined : cycleStatus}
        className={`mt-0.5 flex-shrink-0 transition-colors
          ${terminal ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
        title={terminal ? si.label : `点击切换状态（当前：${si.label}）`}
      >
        <StatusIcon size={18} className={si.color} />
      </button>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        {/* 元数据行 */}
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${si.bg} ${si.color}`}>
            {si.label}
          </span>
          {task.priority > 0 && (
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pc.color}`} />
          )}
          {task.category !== "默认" && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${catColor}`}>
              {task.category}
            </span>
          )}
          {task.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded
              ${ov ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                   : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
              <Calendar size={10} />{fmtDate(task.due_date)}
            </span>
          )}
          {task.progress > 0 && task.status !== "已完成" && (
            <span className="text-[10px] text-zinc-400">{task.progress}%</span>
          )}
        </div>

        {/* 进度条 */}
        {task.progress > 0 && task.status !== "已完成" && (
          <div className="w-full h-1 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-1">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${task.progress}%` }} />
          </div>
        )}

        {/* 标题行 */}
        <div className="flex items-center gap-1.5">
          {hasChildren && (
            <button onClick={onToggleCollapse}
              className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 flex-shrink-0">
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          <span onClick={startEdit}
            className={`text-sm select-none
              ${terminal ? "text-zinc-400 dark:text-zinc-500 cursor-default"
                : isSubtask ? "text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 cursor-pointer"
                : "text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 cursor-pointer"}`}
            title={terminal ? "" : "点击编辑"}>
            {task.title}
          </span>
          {!terminal && (
            <>
              <button onClick={startEdit}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded
                           hover:bg-zinc-200 dark:hover:bg-zinc-700
                           text-zinc-400 hover:text-zinc-600 transition-all duration-150" title="编辑">
                <Pencil size={12} />
              </button>
              {!isSubtask && (
                <button onClick={onAddSubtask}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded
                             hover:bg-indigo-100 dark:hover:bg-indigo-900/30
                             text-zinc-400 hover:text-indigo-600 transition-all duration-150" title="添加子任务">
                  <Plus size={14} />
                </button>
              )}
            </>
          )}
        </div>

        {/* 备注 */}
        {task.note && (
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 select-none">
            {task.note}
          </p>
        )}
      </div>

      {/* 右侧操作（非终态） */}
      {!terminal && (
        <div className="flex items-center gap-0.5 mt-0.5">
          {/* 完成按钮 */}
          <button onClick={markDone}
            className="opacity-0 group-hover:opacity-100 p-1 rounded
                       hover:bg-green-100 dark:hover:bg-green-900/30
                       text-zinc-400 hover:text-green-500 transition-all duration-150"
            title="标记完成">
            <Check size={14} />
          </button>
          {/* 搁置按钮 */}
          <button onClick={markArchived}
            className="opacity-0 group-hover:opacity-100 p-1 rounded
                       hover:bg-zinc-200 dark:hover:bg-zinc-700
                       text-zinc-400 hover:text-zinc-500 transition-all duration-150"
            title="搁置">
            <Archive size={13} />
          </button>
          {/* 删除 */}
          <button onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded
                       hover:bg-red-100 dark:hover:bg-red-900/30
                       text-zinc-400 hover:text-red-500 transition-all duration-150"
            title="删除">
            <Trash2 size={14} />
          </button>
        </div>
      )}
      {terminal && (
        <button onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md mt-0.5
                     hover:bg-red-100 dark:hover:bg-red-900/30
                     text-zinc-400 hover:text-red-500 transition-all duration-150"
          title="删除">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
