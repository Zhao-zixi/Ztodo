import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Settings, ChevronDown, ChevronRight, BookOpen, Sparkles } from "lucide-react";
import { runAgent, type AgentStep } from "../llm/agent";
import type { LLMConfig } from "../llm/llmClient";
import SkillPanel from "./SkillPanel";

interface ChatMessage {
  role: "user" | "agent" | "tool";
  content: string;
  steps?: AgentStep[];
}

const STORAGE_KEY = "ztodo-llm-config";

function loadConfig(): LLMConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {
    endpoint: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
  };
}

function saveConfig(config: LLMConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export default function AIChat({ onRefresh }: { onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<LLMConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(!config.apiKey);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<"chat" | "skills">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    if (!config.apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: "请先在设置中填写 API Key" },
      ]);
      setShowSettings(true);
      return;
    }

    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const agentIdx = messages.length + 1;
    const placeholder: ChatMessage = { role: "agent", content: "思考中...", steps: [] };
    setMessages((prev) => [...prev, placeholder]);

    const allSteps: AgentStep[] = [];

    try {
      const result = await runAgent(text, config, (step) => {
        allSteps.push(step);
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[agentIdx]) {
            updated[agentIdx] = {
              role: "agent",
              content: step.type === "final" ? step.content : "处理中...",
              steps: [...allSteps],
            };
          }
          return updated;
        });
      });

      setMessages((prev) => {
        const updated = [...prev];
        if (updated[agentIdx]) {
          updated[agentIdx] = {
            role: "agent",
            content: result.finalMessage,
            steps: result.steps,
          };
        }
        return updated;
      });

      const hasToolCall = result.steps.some((s) => s.type === "tool_call");
      if (hasToolCall) onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[agentIdx]) {
          updated[agentIdx] = { role: "agent", content: `出错了: ${msg}`, steps: allSteps };
        }
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function toggleStep(idx: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  return (
    <>
      {/* FAB 按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-30 w-12 h-12 rounded-2xl
                     bg-gradient-to-br from-indigo-500 to-purple-600
                     hover:from-indigo-400 hover:to-purple-500
                     text-white shadow-lg shadow-indigo-500/25
                     flex items-center justify-center
                     transition-all duration-200 hover:scale-105 active:scale-95"
          title="AI 助手"
        >
          <Sparkles size={20} />
        </button>
      )}

      {/* 面板 */}
      {open && (
        <div className="fixed bottom-4 right-4 z-40 w-[400px] max-h-[650px]
                        bg-white dark:bg-zinc-900
                        border border-zinc-200 dark:border-zinc-700/50
                        rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/50
                        flex flex-col overflow-hidden
                        animate-in slide-in-from-bottom-4 duration-200">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3
                         border-b border-zinc-100 dark:border-zinc-800
                         bg-gradient-to-r from-zinc-50 to-white
                         dark:from-zinc-900 dark:to-zinc-850 shrink-0">
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-0.5">
              <button
                onClick={() => setTab("chat")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                  ${tab === "chat"
                    ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-600"}`}
              >
                <Sparkles size={12} />对话
              </button>
              <button
                onClick={() => setTab("skills")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                  ${tab === "skills"
                    ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-600"}`}
              >
                <BookOpen size={12} />模板
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-lg transition-colors
                  ${showSettings
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500"
                    : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                title="设置"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400
                           hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* 设置区 */}
          {tab === "chat" && showSettings && (
            <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800
                           bg-zinc-50/50 dark:bg-zinc-800/30 space-y-2.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">API 地址</label>
                <input type="text" value={config.endpoint}
                  onChange={(e) => { const n = { ...config, endpoint: e.target.value }; setConfig(n); saveConfig(n); }}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                            dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                            text-zinc-700 dark:text-zinc-300" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">API Key</label>
                <input type="password" value={config.apiKey}
                  onChange={(e) => { const n = { ...config, apiKey: e.target.value }; setConfig(n); saveConfig(n); }}
                  placeholder="sk-..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                            dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                            text-zinc-700 dark:text-zinc-300" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">模型</label>
                <input type="text" value={config.model}
                  onChange={(e) => { const n = { ...config, model: e.target.value }; setConfig(n); saveConfig(n); }}
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700
                            dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                            text-zinc-700 dark:text-zinc-300" />
              </div>
            </div>
          )}

          {/* 内容区 */}
          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[250px]">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100
                                   dark:from-indigo-900/20 dark:to-purple-900/20
                                   flex items-center justify-center mb-3">
                      <Sparkles size={22} className="text-indigo-500" />
                    </div>
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">AI 助手</p>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-[250px]">
                      试试：<br />
                      「写周报」「今天有哪些任务？」<br />
                      「创建一个高优任务」
                    </p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i}>
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] bg-indigo-600 text-white text-sm
                                       px-4 py-2 rounded-2xl rounded-br-md leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm text-zinc-700 dark:text-zinc-300
                                       whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>
                        {msg.steps && msg.steps.length > 0 && (
                          <button
                            onClick={() => toggleStep(i)}
                            className="flex items-center gap-1 mt-1.5 text-[11px] text-zinc-400
                                      hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                          >
                            {expandedSteps.has(i) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            处理过程 ({msg.steps.length} 步)
                          </button>
                        )}
                        {expandedSteps.has(i) && msg.steps && (
                          <div className="mt-2 ml-3 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-1">
                            {msg.steps.map((s, j) => (
                              <div key={j} className="text-[11px] text-zinc-400 font-mono leading-relaxed">
                                {s.content}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {loading && messages[messages.length - 1]?.role !== "agent" && (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    思考中...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* 输入区 */}
              <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                <div className="flex items-end gap-2 bg-zinc-100 dark:bg-zinc-800
                               rounded-2xl px-3 py-2 focus-within:ring-2
                               focus-within:ring-indigo-500/20 transition-all">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入指令..."
                    disabled={loading}
                    className="flex-1 bg-transparent text-sm py-1
                               focus:outline-none text-zinc-800 dark:text-zinc-200
                               placeholder:text-zinc-400"
                  />
                  <button onClick={handleSend} disabled={loading || !input.trim()}
                    className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-600
                               hover:bg-indigo-500 disabled:opacity-30
                               text-white flex items-center justify-center
                               transition-all active:scale-90">
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === "skills" && (
            <SkillPanel onRefresh={onRefresh} />
          )}
        </div>
      )}
    </>
  );
}
