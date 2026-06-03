import { useState, useEffect, useRef } from "react";
import { X, Calendar, Plus, ChevronRight, Flag, Folder } from "lucide-react";
import { createTask } from "../lib/tauri";

interface Props {
  onTaskAdded: () => void;
  parentId: number | null;
  onCancelSubtask: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = ["工作", "个人", "学习", "生活", "其他"];
const PRIORITIES = [
  { label: "无", value: 0, color: "bg-zinc-300", ring: "" },
  { label: "低", value: 1, color: "bg-blue-400", ring: "ring-blue-400/20" },
  { label: "中", value: 2, color: "bg-amber-400", ring: "ring-amber-400/20" },
  { label: "高", value: 3, color: "bg-red-400", ring: "ring-red-400/20" },
];

export default function TaskInput({ onTaskAdded, parentId, onCancelSubtask, open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("默认");
  const [priority, setPriority] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  useEffect(() => {
    if (parentId) onOpenChange(true);
  }, [parentId]);

  const resetForm = () => {
    setTitle("");
    setCategory("默认");
    setPriority(0);
    setDueDate("");
    setError("");
  };

  const close = () => {
    resetForm();
    onOpenChange(false);
    if (parentId) onCancelSubtask();
  };

  const handleSubmit = async () => {
    const text = title.trim();
    if (!text) return;
    setError("");
    setLoading(true);
    try {
      await createTask({
        title: text,
        category: category === "默认" ? undefined : category,
        priority: priority > 0 ? priority : undefined,
        due_date: dueDate || undefined,
        parent_id: parentId || undefined,
      });
      resetForm();
      onTaskAdded();
      onOpenChange(false);
      if (parentId) onCancelSubtask();
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || e?.toString?.() || "未知错误";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === "Escape") close();
  };

  if (!open) return null;

  const activePri = PRIORITIES[priority];

  return (
    <>
      {/* 遮罩 */}
      <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/60 backdrop-blur-[2px]
                      animate-in fade-in duration-150"
        onClick={close} />

      {/* 弹窗 */}
      <div className="fixed inset-x-4 top-[12%] z-50 max-w-md mx-auto
                      animate-in zoom-in-95 fade-in duration-150">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl
                        shadow-black/20 dark:shadow-black/60
                        border border-zinc-200/50 dark:border-zinc-700/50 overflow-hidden">
          {/* 顶栏 */}
          <div className="flex items-center justify-between px-5 py-3.5
                         border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center
                ${parentId
                  ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500"
                  : "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"}`}>
                {parentId ? <ChevronRight size={16} /> : <Plus size={16} />}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {parentId ? "添加子任务" : "新建任务"}
                </p>
                {parentId && (
                  <p className="text-[11px] text-zinc-400">将添加到当前任务下</p>
                )}
              </div>
            </div>
            <button onClick={close}
              className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800
                         text-zinc-400 hover:text-zinc-600 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* 表单 */}
          <div className="p-5 space-y-5">
            {/* 标题 */}
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入任务标题..."
              className="w-full px-0 py-2 text-lg font-semibold bg-transparent
                         border-b-2 border-zinc-200 dark:border-zinc-700
                         focus:outline-none focus:border-indigo-500
                         text-zinc-800 dark:text-zinc-100
                         placeholder:text-zinc-300 dark:placeholder:text-zinc-600
                         transition-colors"
            />

            {/* 属性行 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 分类 */}
              <div className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
                              bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700
                              focus-within:ring-2 focus-within:ring-indigo-500/20">
                <Folder size={13} className="text-zinc-400" />
                <select value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-transparent text-xs font-medium text-zinc-600 dark:text-zinc-300
                             focus:outline-none cursor-pointer appearance-none pr-3">
                  {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>

              {/* 优先级 */}
              <div className="flex items-center gap-0.5 px-3 py-2 rounded-xl
                              bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                <Flag size={13} className="text-zinc-400 mr-1" />
                {PRIORITIES.map((p) => (
                  <button key={p.value} onClick={() => setPriority(p.value)}
                    title={p.label}
                    className={`w-6 h-6 rounded-full flex items-center justify-center
                                text-[9px] font-bold transition-all duration-150
                                ${priority === p.value
                                  ? `${p.color} text-white scale-110 shadow-sm ${p.ring}`
                                  : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}>
                    {p.value === 0 ? "—" : p.label}
                  </button>
                ))}
              </div>

              {/* 日期 */}
              <div className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl
                              bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700
                              focus-within:ring-2 focus-within:ring-indigo-500/20">
                <Calendar size={13} className="text-zinc-400" />
                <input type="date" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-transparent text-xs font-medium text-zinc-600 dark:text-zinc-300
                             focus:outline-none cursor-pointer" />
              </div>
            </div>

            {/* 错误 */}
            {error && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20
                              border border-red-200 dark:border-red-800
                              rounded-xl text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* 按钮 */}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={close}
                className="px-5 py-2.5 text-sm rounded-xl
                           text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300
                           hover:bg-zinc-100 dark:hover:bg-zinc-800
                           transition-colors font-medium">
                取消
              </button>
              <button onClick={handleSubmit} disabled={loading || !title.trim()}
                className="px-6 py-2.5 text-sm rounded-xl
                           bg-indigo-600 hover:bg-indigo-500 active:scale-95
                           text-white font-semibold transition-all duration-150
                           disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100
                           shadow-lg shadow-indigo-500/20">
                {loading ? "创建中..." : "创建任务"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
