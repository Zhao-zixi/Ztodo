import { useState, useEffect } from "react";
import { Sun, Moon, Plus } from "lucide-react";
import TaskInput from "./components/TaskInput";
import TaskList from "./components/TaskList";
import AIChat from "./components/AIChat";

function getInitialTheme(): "light" | "dark" {
  const saved = localStorage.getItem("ztodo-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [subtaskParentId, setSubtaskParentId] = useState<number | null>(null);
  const [inputOpen, setInputOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("ztodo-theme", theme);
  }, [theme]);

  const handleTaskAdded = () => {
    setRefreshKey((k) => k + 1);
    setSubtaskParentId(null);
  };

  const handleAddSubtask = (parentId: number) => {
    setSubtaskParentId(parentId);
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950
                    text-zinc-900 dark:text-zinc-100
                    selection:bg-indigo-200 dark:selection:bg-indigo-800">
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3
                   border-b border-zinc-100 dark:border-zinc-800/50
                   bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl
                   select-none shrink-0"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center
                          shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">Ztodo</h1>
            <p className="text-[10px] text-zinc-400 leading-tight">AI 驱动的待办事项</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center
                       bg-zinc-100 dark:bg-zinc-800
                       text-zinc-500 dark:text-zinc-400
                       hover:bg-zinc-200 dark:hover:bg-zinc-700
                       active:scale-95 transition-all duration-150"
            title={theme === "dark" ? "浅色模式" : "深色模式"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <span className="text-[10px] font-mono text-zinc-300 dark:text-zinc-600
                          px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/50">
            v0.2.0
          </span>
        </div>
      </header>

      {/* 任务列表（占据全部空间） */}
      <TaskList
        refreshKey={refreshKey}
        onAddSubtask={handleAddSubtask}
      />

      {/* 悬浮添加按钮 */}
      <button
        onClick={() => { setSubtaskParentId(null); setInputOpen(true); }}
        className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-2xl
                   bg-indigo-600 hover:bg-indigo-500 active:scale-95
                   text-white shadow-lg shadow-indigo-500/25
                   flex items-center justify-center
                   transition-all duration-200"
      >
        <Plus size={24} />
      </button>

      {/* 悬浮输入弹窗 */}
      <TaskInput
        onTaskAdded={handleTaskAdded}
        parentId={subtaskParentId}
        onCancelSubtask={() => setSubtaskParentId(null)}
        open={inputOpen}
        onOpenChange={setInputOpen}
      />

      {/* AI 助手 */}
      <AIChat onRefresh={handleTaskAdded} />
    </div>
  );
}
