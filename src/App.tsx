import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
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

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("ztodo-theme", theme);
  }, [theme]);

  const handleTaskAdded = () => {
    setRefreshKey((k) => k + 1);
    setSubtaskParentId(null); // 添加完清除子任务模式
  };

  const handleAddSubtask = (parentId: number) => {
    setSubtaskParentId(parentId);
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header
        className="flex items-center justify-between px-4 py-3 
                   border-b border-zinc-200 dark:border-zinc-800 select-none"
        data-tauri-drag-region
      >
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-indigo-600">Z</span>todo
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800
                       text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300
                       transition-colors"
            title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
            v0.2.0
          </span>
        </div>
      </header>

      <TaskInput
        onTaskAdded={handleTaskAdded}
        parentId={subtaskParentId}
        onCancelSubtask={() => setSubtaskParentId(null)}
      />
      <TaskList
        refreshKey={refreshKey}
        onAddSubtask={handleAddSubtask}
      />
      <AIChat onRefresh={handleTaskAdded} />
    </div>
  );
}
