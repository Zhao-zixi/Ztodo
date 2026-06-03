import { useState, useEffect } from "react";
import { Sun, Moon, Plus, Search, Sparkles, Minus, Square, X, Settings } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TaskInput from "./components/TaskInput";
import TaskList from "./components/TaskList";
import AIChat from "./components/AIChat";
import type { LLMConfig } from "./llm/llmClient";

const STORAGE_KEY = "ztodo-llm-config";

function loadConfig(): LLMConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { endpoint: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" };
}

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
  const [search, setSearch] = useState("");
  const [llmConfig, setLLMConfig] = useState<LLMConfig>(loadConfig);
  const [showLLMSettings, setShowLLMSettings] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const appWindow = getCurrentWindow();

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

  const saveLLMConfig = (c: LLMConfig) => {
    setLLMConfig(c);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950
                    text-zinc-900 dark:text-zinc-100 rounded-xl overflow-hidden
                    selection:bg-indigo-200 dark:selection:bg-indigo-800">
      {/* ══════ 自定义标题栏 ══════ */}
      <header
        className="flex items-center gap-3 px-3.5 py-2.5 shrink-0
                   bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800/50"
        data-tauri-drag-region
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center
                          shadow-sm shadow-indigo-500/20">
            <span className="text-white font-bold text-xs">Z</span>
          </div>
          <span className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">Ztodo</span>
        </div>

        {/* 搜索栏 */}
        <div className="flex-1 max-w-[260px] relative" data-tauri-drag-region={false as any}>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务..."
            className="w-full pl-8 pr-8 py-2 text-xs rounded-xl
                       border border-zinc-200 dark:border-zinc-700
                       bg-zinc-50 dark:bg-zinc-800/50
                       focus:outline-none focus:border-indigo-300 dark:focus:border-indigo-600
                       placeholder:text-zinc-400 text-zinc-700 dark:text-zinc-300
                       transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex-1" data-tauri-drag-region />

        {/* 右侧控件 */}
        <div className="flex items-center gap-1" data-tauri-drag-region={false as any}>
          {/* 主题 */}
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300
                       hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={theme === "dark" ? "浅色模式" : "深色模式"}>
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* AI 设置 */}
          <button onClick={() => { setShowLLMSettings(!showLLMSettings); setShowAIChat(false); }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
              ${showLLMSettings
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
            title="AI 设置">
            <Settings size={14} />
          </button>

          {/* AI 对话 */}
          <button onClick={() => { setShowAIChat(!showAIChat); setShowLLMSettings(false); }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
              ${showAIChat
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500"
                : "text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"}`}
            title="AI 助手">
            <Sparkles size={14} />
          </button>

          {/* 分隔 */}
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

          {/* 窗口控制 */}
          <button onClick={() => appWindow.minimize()}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800
                       transition-colors" title="最小化">
            <Minus size={14} />
          </button>
          <button onClick={() => appWindow.toggleMaximize()}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800
                       transition-colors" title="最大化">
            <Square size={12} />
          </button>
          <button onClick={() => appWindow.close()}
            className="w-8 h-8 rounded-lg flex items-center justify-center
                       text-zinc-400 hover:text-white hover:bg-red-500
                       transition-colors" title="关闭">
            <X size={14} />
          </button>
        </div>
      </header>

      {/* LLM 设置面板 */}
      {showLLMSettings && (
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800
                        bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm
                        grid grid-cols-3 gap-3 shrink-0 animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">API 地址</label>
            <input type="text" value={llmConfig.endpoint}
              onChange={(e) => saveLLMConfig({ ...llmConfig, endpoint: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                        dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500
                        text-zinc-700 dark:text-zinc-300" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">API Key</label>
            <input type="password" value={llmConfig.apiKey}
              onChange={(e) => saveLLMConfig({ ...llmConfig, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                        dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500
                        text-zinc-700 dark:text-zinc-300" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">模型</label>
            <input type="text" value={llmConfig.model}
              onChange={(e) => saveLLMConfig({ ...llmConfig, model: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                        dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-indigo-500
                        text-zinc-700 dark:text-zinc-300" />
          </div>
        </div>
      )}

      {/* AI 对话面板（内嵌） */}
      {showAIChat && (
        <div className="border-b border-zinc-100 dark:border-zinc-800 shrink-0
                        animate-in slide-in-from-top-2 duration-150">
          <AIChat
            onRefresh={handleTaskAdded}
            llmConfig={llmConfig}
            inline
          />
        </div>
      )}

      {/* 任务列表 */}
      <TaskList
        refreshKey={refreshKey}
        onAddSubtask={handleAddSubtask}
        search={search}
      />

      {/* 悬浮 + 按钮 */}
      <button
        onClick={() => { setSubtaskParentId(null); setInputOpen(true); }}
        className="fixed bottom-4 right-4 z-30 w-14 h-14 rounded-2xl
                   bg-indigo-600 hover:bg-indigo-500 active:scale-95
                   text-white shadow-lg shadow-indigo-500/25
                   flex items-center justify-center
                   transition-all duration-200"
      >
        <Plus size={24} />
      </button>

      {/* 新建任务弹窗 */}
      <TaskInput
        onTaskAdded={handleTaskAdded}
        parentId={subtaskParentId}
        onCancelSubtask={() => setSubtaskParentId(null)}
        open={inputOpen}
        onOpenChange={setInputOpen}
      />
    </div>
  );
}
