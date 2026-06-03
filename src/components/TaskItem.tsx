import { useState, useRef, useEffect } from "react";
import {
  Trash2, Pencil, Calendar, ChevronRight, ChevronDown, Plus,
  Circle, Loader, Pause, Check, Archive, Clock,
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
  { key: "待开始", label: "待开始", icon: Circle, color: "text-zinc-400", dot: "bg-zinc-300" },
  { key: "进行中", label: "进行中", icon: Loader, color: "text-blue-500", dot: "bg-blue-400 animate-pulse" },
  { key: "等待中", label: "等待中", icon: Pause, color: "text-amber-500", dot: "bg-amber-400" },
  { key: "已完成", label: "已完成", icon: Check, color: "text-emerald-500", dot: "bg-emerald-400" },
  { key: "已搁置", label: "已搁置", icon: Archive, color: "text-zinc-400", dot: "bg-zinc-400" },
];

const PRIORITY_LABELS = ["", "低", "中", "高"];
const PRIORITY_RINGS = ["", "ring-blue-400/30", "ring-amber-400/30", "ring-red-400/30"];
const PRIORITY_DOTS = ["", "bg-blue-400", "bg-amber-400", "bg-red-400"];

const CATEGORY_STYLES: Record<string, string> = {
  工作: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  个人: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
  学习: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  生活: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
  其他: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const fmtDate = (d: string): string => {
  const date = new Date(d);
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days < 0) return `过期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天截止";
  if (days === 1) return "明天截止";
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

  const cycleStatus = async () => {
    if (terminal) return;
    const order = ["待开始", "进行中", "等待中"];
    const idx = order.indexOf(task.status);
    const next = order[(idx + 1) % order.length];
    const extra: Record<string, unknown> = {};
    if (next === "待开始") extra.progress = 0;
    await updateTask({ id: task.id, status: next, ...extra } as any);
    onChanged();
  };

  const markDone = async () => {
    await updateTask({ id: task.id, status: "已完成" });
    if (task.parent_id) await syncParentProgress(task.parent_id);
    onChanged();
  };

  const markArchived = async () => {
    await updateTask({ id: task.id, status: "已搁置" });
    onChanged();
  };

  const handleDelete = async () => {
    if (!confirm(`确定删除「${task.title}」？`)) return;
    await deleteTask(task.id);
    if (task.parent_id) await syncParentProgress(task.parent_id);
    onChanged();
  };

  const syncParentProgress = async (parentId: number) => {
    const all = await getAllTasks();
    const siblings = all.filter((t) => t.parent_id === parentId);
    if (siblings.length > 0) {
      const done = siblings.filter((c) => c.status === "已完成").length;
      const progress = Math.round((done / siblings.length) * 100);
      await updateTask({ id: parentId, progress });
    }
  };

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
  const catStyle = CATEGORY_STYLES[task.category] || CATEGORY_STYLES["其他"];
  const indentLeft = depth * 24;
  const ov = overdue(task.due_date);

  // ══════════ 编辑模式 ══════════
  if (editing) {
    return (
      <div
        className="mx-3 my-1 rounded-xl border-2 border-indigo-200 dark:border-indigo-800
                   bg-white dark:bg-zinc-900 shadow-lg shadow-indigo-500/5 overflow-hidden"
        style={{ marginLeft: `${12 + indentLeft}px` }}
      >
        <div className="p-4 space-y-3">
          <input ref={inputRef} type="text" value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)} onKeyDown={handleEditKeyDown}
            placeholder="任务标题"
            className="w-full px-0 py-1 text-base font-medium bg-transparent
                       border-b-2 border-indigo-200 dark:border-indigo-700
                       focus:outline-none focus:border-indigo-500
                       text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-300" />

          <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)}
            placeholder="添加备注..."
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg
                       bg-zinc-50 dark:bg-zinc-800 resize-none
                       border border-zinc-200 dark:border-zinc-700
                       focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300
                       text-zinc-600 dark:text-zinc-300 placeholder:text-zinc-300" />

          {/* 状态选择 */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUSES.map((s) => {
              const Icon = s.icon;
              const active = editStatus === s.key;
              return (
                <button key={s.key} onClick={() => setEditStatus(s.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             transition-all duration-150
                             ${active
                               ? `${s.color} bg-zinc-100 dark:bg-zinc-800 shadow-sm`
                               : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}>
                  <Icon size={13} />{s.label}
                </button>
              );
            })}
          </div>

          {/* 分类 / 优先级 / 日期 */}
          <div className="flex items-center gap-3 flex-wrap">
            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                         bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>

            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((i) => (
                <button key={i} onClick={() => setEditPriority(i)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center
                              text-[10px] font-bold transition-all duration-150
                              ${i === editPriority
                                ? `${PRIORITY_DOTS[i] || "bg-zinc-400"} text-white scale-110 shadow-md`
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:scale-105"}`}>
                  {i === 0 ? "—" : PRIORITY_LABELS[i]}
                </button>
              ))}
            </div>

            <div className="relative">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                           bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          {/* 进度（子任务） */}
          {isSubtask && editStatus === "进行中" && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-zinc-400 w-8">{editProgress}%</span>
              <input type="range" min={0} max={100} step={5} value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
                className="flex-1 h-1.5 rounded-full accent-indigo-500 cursor-pointer" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)}
              className="px-4 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                         text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              取消
            </button>
            <button onClick={saveEdit}
              className="px-4 py-1.5 text-xs rounded-lg bg-indigo-600 text-white
                         hover:bg-indigo-500 transition-colors shadow-sm">
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════ 查看模式 ══════════
  const StatusIcon = si.icon;

  return (
    <div
      className={`group relative flex items-center gap-3 px-4 py-2.5 mx-2 my-0.5
                  rounded-xl transition-all duration-200
                  hover:bg-zinc-50 dark:hover:bg-zinc-800/50
                  ${terminal ? "opacity-50" : ""}
                  ${isSubtask ? "ml-2" : ""}`}
      style={{ marginLeft: `${8 + indentLeft}px` }}
    >
      {/* 优先级左边框 */}
      {task.priority > 0 && (
        <div className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full ${PRIORITY_DOTS[task.priority]}`} />
      )}

      {/* 展开/折叠 */}
      {hasChildren ? (
        <button onClick={onToggleCollapse}
          className="flex-shrink-0 p-0.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700
                     text-zinc-400 transition-colors">
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      ) : (
        <div className="w-5 flex-shrink-0" />
      )}

      {/* 状态圆圈（可点击循环） */}
      <button
        onClick={cycleStatus}
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center
                    transition-all duration-200
                    ${terminal
                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 cursor-default"
                      : "border-zinc-300 dark:border-zinc-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:scale-110 cursor-pointer"}`}
        title={terminal ? si.label : "点击切换状态"}
      >
        {terminal ? (
          <Check size={11} className="text-emerald-500" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${si.dot}`} />
        )}
      </button>

      {/* 主内容 */}
      <div className="flex-1 min-w-0" onClick={startEdit}>
        {/* 标题行 */}
        <div className="flex items-baseline gap-2">
          <span className={`text-sm truncate select-none
            ${terminal
              ? "text-zinc-400 dark:text-zinc-500 line-through"
              : "text-zinc-800 dark:text-zinc-200 font-medium"}`}>
            {task.title}
          </span>

          {/* 内联徽章 — 非终态显示 */}
          {!terminal && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {task.category !== "默认" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${catStyle}`}>
                  {task.category}
                </span>
              )}
              {task.due_date && (
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium
                  ${ov
                    ? "bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-400"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                  <Clock size={10} />
                  {fmtDate(task.due_date)}
                </span>
              )}
              {task.progress > 0 && task.status === "进行中" && (
                <span className="text-[10px] text-indigo-500 font-mono">{task.progress}%</span>
              )}
            </div>
          )}
        </div>

        {/* 备注预览 */}
        {task.note && (
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500 truncate select-none">
            {task.note}
          </p>
        )}
      </div>

      {/* 悬停操作按钮 */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {!terminal && (
          <>
            <button onClick={markDone}
              className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30
                         text-zinc-400 hover:text-emerald-500 transition-colors"
              title="完成">
              <Check size={14} />
            </button>
            <button onClick={markArchived}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700
                         text-zinc-400 hover:text-zinc-500 transition-colors"
              title="搁置">
              <Archive size={13} />
            </button>
            {!isSubtask && (
              <button onClick={onAddSubtask}
                className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30
                           text-zinc-400 hover:text-indigo-500 transition-colors"
                title="添加子任务">
                <Plus size={14} />
              </button>
            )}
            <button onClick={startEdit}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700
                         text-zinc-400 hover:text-zinc-600 transition-colors"
              title="编辑">
              <Pencil size={13} />
            </button>
          </>
        )}
        <button onClick={handleDelete}
          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30
                     text-zinc-400 hover:text-red-500 transition-colors"
          title="删除">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
