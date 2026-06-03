import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Calendar, X } from "lucide-react";
import { createTask } from "../lib/tauri";

interface Props {
  onTaskAdded: () => void;
  parentId: number | null;
  onCancelSubtask: () => void;
}

const CATEGORIES = ["工作", "个人", "学习", "生活", "其他"];
const PRIORITIES = [
  { label: "无", value: 0, color: "bg-zinc-300" },
  { label: "低", value: 1, color: "bg-blue-400" },
  { label: "中", value: 2, color: "bg-amber-400" },
  { label: "高", value: 3, color: "bg-red-400" },
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

  // 切换到子任务模式时自动聚焦
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
      const result = await createTask({
        title: text,
        category: category === "默认" ? undefined : category,
        priority: priority > 0 ? priority : undefined,
        due_date: dueDate || undefined,
        parent_id: parentId || undefined,
      });
      console.log("Task created:", result);
      resetForm();
      onTaskAdded();
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || e?.toString?.() || "未知错误";
      setError(msg);
      console.error("添加失败:", e);
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
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
      {/* 子任务提示条 */}
      {parentId && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-xs">
          <span className="text-indigo-600 dark:text-indigo-400">
            📎 正在添加子任务
          </span>
          <button
            onClick={onCancelSubtask}
            className="ml-auto p-0.5 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-400"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 主输入行 */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={parentId ? "输入子任务，按回车添加..." : "输入新任务，按回车添加..."}
          className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 
                     bg-white dark:bg-zinc-800 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                     placeholder:text-zinc-400 dark:placeholder:text-zinc-500
                     text-zinc-800 dark:text-zinc-200"
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
                     text-white rounded-lg text-sm font-medium
                     transition-colors duration-150 disabled:opacity-50"
        >
          {loading ? "添加中..." : "添加"}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 
                        dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* 展开详情 */}
      {!parentId && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 
                       dark:hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            更多选项
          </button>

          {expanded && (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">分类</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-zinc-200 
                             dark:border-zinc-700 bg-white dark:bg-zinc-800
                             text-zinc-700 dark:text-zinc-300
                             focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">优先级</label>
                <div className="flex gap-1">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      title={p.label}
                      className={`w-6 h-6 rounded-full flex items-center justify-center
                                  text-[10px] font-medium transition-all
                                  ${priority === p.value
                                    ? `${p.color} text-white scale-110 ring-2 ring-offset-1 ring-zinc-300 dark:ring-zinc-600`
                                    : `${p.color} opacity-40 hover:opacity-70`}`}
                    >
                      {p.value === 0 ? "—" : p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">截止</label>
                <div className="relative">
                  <Calendar size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-6 pr-2 py-1.5 text-xs rounded-lg border border-zinc-200 
                               dark:border-zinc-700 bg-white dark:bg-zinc-800
                               text-zinc-700 dark:text-zinc-300
                               focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
