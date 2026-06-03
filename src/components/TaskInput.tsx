import { useState, useEffect, useRef } from "react";
import { X, Calendar, Plus, ChevronRight } from "lucide-react";
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
  { label: "无", value: 0, dot: "bg-zinc-300", active: "bg-zinc-400" },
  { label: "低", value: 1, dot: "bg-blue-400", active: "bg-blue-500" },
  { label: "中", value: 2, dot: "bg-amber-400", active: "bg-amber-500" },
  { label: "高", value: 3, dot: "bg-red-400", active: "bg-red-500" },
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
      setTimeout(() => inputRef.current?.focus(), 100);
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") close();
  };

  if (!open) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50 backdrop-blur-sm
                   animate-in fade-in duration-200"
        onClick={close}
      />

      {/* 弹窗 */}
      <div className="fixed inset-x-4 top-[15%] z-50 max-w-lg mx-auto
                      animate-in slide-in-from-top-4 duration-200">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl
                        border border-zinc-200 dark:border-zinc-700
                        shadow-black/10 dark:shadow-black/50 overflow-hidden">
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-5 py-3
                         border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              {parentId ? (
                <>
                  <ChevronRight size={14} className="text-indigo-400" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    添加子任务
                  </span>
                </>
              ) : (
                <>
                  <Plus size={16} className="text-indigo-500" />
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    新建任务
                  </span>
                </>
              )}
            </div>
            <button onClick={close}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800
                         text-zinc-400 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* 输入区 */}
          <div className="p-5 space-y-4">
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="任务标题..."
              className="w-full px-0 py-2 text-lg font-medium bg-transparent
                         border-b-2 border-zinc-200 dark:border-zinc-700
                         focus:outline-none focus:border-indigo-500
                         text-zinc-800 dark:text-zinc-100
                         placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
            />

            {/* 选项行 */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* 分类 */}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700
                           bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
                           focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300
                           appearance-none cursor-pointer"
              >
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>

              {/* 优先级 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 mr-0.5">优先级</span>
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    title={p.label}
                    className={`w-7 h-7 rounded-full flex items-center justify-center
                                text-[10px] font-bold transition-all duration-150
                                ${priority === p.value
                                  ? `${p.active} text-white scale-110 shadow-md`
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:scale-105 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
                  >
                    {p.value === 0 ? "—" : p.label}
                  </button>
                ))}
              </div>

              {/* 日期 */}
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="pl-8 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700
                             bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                />
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
                className="px-5 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700
                           text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800
                           transition-colors font-medium">
                取消
              </button>
              <button onClick={handleSubmit} disabled={loading || !title.trim()}
                className="px-5 py-2 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-500
                           text-white font-medium transition-all duration-150
                           disabled:opacity-30 disabled:cursor-not-allowed
                           shadow-lg shadow-indigo-500/20 active:scale-95">
                {loading ? "创建中..." : "创建任务"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
