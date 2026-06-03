import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Calendar, X, Plus } from "lucide-react";
import { createTask } from "../lib/tauri";

interface Props {
  onTaskAdded: () => void;
  parentId: number | null;
  onCancelSubtask: () => void;
}

const CATEGORIES = ["工作", "个人", "学习", "生活", "其他"];
const PRIORITIES = [
  { label: "无", value: 0, dot: "bg-zinc-300" },
  { label: "低", value: 1, dot: "bg-blue-400" },
  { label: "中", value: 2, dot: "bg-amber-400" },
  { label: "高", value: 3, dot: "bg-red-400" },
];

export default function TaskInput({ onTaskAdded, parentId, onCancelSubtask }: Props) {
  const [title, setTitle] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState("默认");
  const [priority, setPriority] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (parentId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [parentId]);

  const resetForm = () => {
    setTitle("");
    setCategory("默认");
    setPriority(0);
    setDueDate("");
    setExpanded(false);
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
    if (e.key === "Escape" && parentId) {
      onCancelSubtask();
    }
  };

  return (
    <div className="px-4 pt-4 pb-3">
      {/* 子任务提示 */}
      {parentId && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2
                        bg-indigo-50 dark:bg-indigo-950/30
                        border border-indigo-200 dark:border-indigo-800
                        rounded-xl text-xs">
          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
            添加子任务
          </span>
          <button
            onClick={onCancelSubtask}
            className="ml-auto p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50
                       text-indigo-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 主输入区 */}
      <div className="relative">
        <div className={`rounded-2xl border transition-all duration-200
          ${title
            ? "border-indigo-200 dark:border-indigo-700 shadow-sm shadow-indigo-500/5 bg-white dark:bg-zinc-900"
            : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-600"}`}
        >
          <div className="flex items-center gap-2 px-4 py-1">
            <Plus size={16} className="text-zinc-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => !parentId && setExpanded(true)}
              placeholder={parentId ? "输入子任务..." : "添加新任务..."}
              className="flex-1 py-2.5 text-sm bg-transparent
                         focus:outline-none
                         text-zinc-800 dark:text-zinc-200
                         placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !title.trim()}
              className="px-4 py-1.5 text-xs font-medium rounded-xl
                         bg-indigo-600 hover:bg-indigo-500 active:scale-95
                         text-white transition-all duration-150
                         disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? "..." : "添加"}
            </button>
          </div>

          {/* 展开选项 */}
          {!parentId && expanded && (
            <div className="px-4 pb-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700
                             bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                >
                  {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>

                <div className="flex items-center gap-1">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      title={p.label}
                      className={`w-7 h-7 rounded-full flex items-center justify-center
                                  text-[10px] font-bold transition-all duration-150
                                  ${priority === p.value
                                    ? `${p.dot} text-white scale-110 shadow-md`
                                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:scale-105"}`}
                    >
                      {p.value === 0 ? "—" : p.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="pl-7 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700
                               bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
                               focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 收起按钮 */}
      {!parentId && expanded && title && (
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 mt-2 text-xs text-zinc-400 hover:text-zinc-600
                     dark:hover:text-zinc-300 transition-colors"
        >
          <ChevronUp size={13} />
          收起选项
        </button>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-950/20
                        border border-red-200 dark:border-red-800
                        rounded-xl text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
