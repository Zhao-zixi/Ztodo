import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Settings, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
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

export default function AIChat({
  onRefresh,
}: {
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<LLMConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
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
      return;
    }

    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    // 占位 agent 消息，后续更新
    const agentIdx = messages.length + 1; // 下一个索引
    const placeholder: ChatMessage = { role: "agent", content: "思考中...", steps: [] };
    setMessages((prev) => [...prev, placeholder]);

    const allSteps: AgentStep[] = [];

    try {
      const result = await runAgent(text, config, (step) => {
        allSteps.push(step);
        // 实时更新 agent 消息
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

      // 如果有工具调用，刷新任务列表
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
      {/* 浮动按钮 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full
                     bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg
                     flex items-center justify-center transition-all"
          title="AI 助手"
        >
          <MessageCircle size={20} />
        </button>
      )}

      {/* 面板 */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-[380px] max-h-[600px]
                        bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700
                        rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-2.5
                         border-b border-zinc-200 dark:border-zinc-700
                         bg-zinc-50 dark:bg-zinc-800">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTab("chat")}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded
                  ${tab === "chat"
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-400 hover:text-zinc-600"
                  }`}
              >
                <MessageCircle size={12} />
                对话
              </button>
              <button
                onClick={() => setTab("skills")}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded
                  ${tab === "skills"
                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                    : "text-zinc-400 hover:text-zinc-600"
                  }`}
              >
                <BookOpen size={12} />
                模板
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
                title="设置"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* 设置区 — 仅对话模式 */}
          {tab === "chat" && showSettings && (
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-700
                           bg-zinc-50 dark:bg-zinc-800 space-y-2 text-xs">
              <div>
                <label className="text-zinc-500">API Endpoint</label>
                <input
                  type="text"
                  value={config.endpoint}
                  onChange={(e) => {
                    const next = { ...config, endpoint: e.target.value };
                    setConfig(next);
                    saveConfig(next);
                  }}
                  className="w-full mt-0.5 px-2 py-1 rounded border border-zinc-300
                            dark:border-zinc-600 dark:bg-zinc-700 text-sm"
                />
              </div>
              <div>
                <label className="text-zinc-500">API Key</label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => {
                    const next = { ...config, apiKey: e.target.value };
                    setConfig(next);
                    saveConfig(next);
                  }}
                  placeholder="sk-..."
                  className="w-full mt-0.5 px-2 py-1 rounded border border-zinc-300
                            dark:border-zinc-600 dark:bg-zinc-700 text-sm"
                />
              </div>
              <div>
                <label className="text-zinc-500">Model</label>
                <input
                  type="text"
                  value={config.model}
                  onChange={(e) => {
                    const next = { ...config, model: e.target.value };
                    setConfig(next);
                    saveConfig(next);
                  }}
                  className="w-full mt-0.5 px-2 py-1 rounded border border-zinc-300
                            dark:border-zinc-600 dark:bg-zinc-700 text-sm"
                />
              </div>
            </div>
          )}

          {/* 对话内容 */}
          {tab === "chat" && (
            <>
          {/* 消息区 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
            {messages.length === 0 && (
              <div className="text-center text-zinc-400 text-sm py-8">
                <p>👋 我能帮你管理任务</p>
                <p className="mt-1 text-xs">
                  试试：「写周报」「今天有哪些任务？」<br />
                  「创建一个高优任务：提交报告」
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-indigo-600 text-white
                                   text-sm px-3 py-2 rounded-xl rounded-br-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-sm text-zinc-800 dark:text-zinc-200
                                   whitespace-pre-wrap leading-relaxed">
                      {msg.role === "tool" ? null : msg.content}
                    </div>

                    {/* 展开步骤 */}
                    {msg.steps && msg.steps.length > 0 && (
                      <div className="mt-1">
                        <button
                          onClick={() => toggleStep(i)}
                          className="flex items-center gap-1 text-xs text-zinc-400
                                    hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                          {expandedSteps.has(i)
                            ? <ChevronDown size={12} />
                            : <ChevronRight size={12} />
                          }
                          处理过程 ({msg.steps.length} 步)
                        </button>
                        {expandedSteps.has(i) && (
                          <div className="mt-1 ml-4 border-l-2 border-zinc-200
                                         dark:border-zinc-700 pl-3 space-y-0.5">
                            {msg.steps.map((s, j) => (
                              <div key={j} className="text-xs text-zinc-400">
                                {s.content}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role !== "agent" && (
              <div className="text-sm text-zinc-400 animate-pulse">思考中...</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="p-3 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入指令..."
                disabled={loading}
                className="flex-1 text-sm px-3 py-1.5 rounded-lg border
                          border-zinc-300 dark:border-zinc-600
                          dark:bg-zinc-800 placeholder-zinc-400
                          focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500
                          disabled:opacity-40 text-white rounded-lg text-sm
                          transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
            </>
          )}

          {/* 技能模板 */}
          {tab === "skills" && (
            <SkillPanel onRefresh={onRefresh} />
          )}
        </div>
      )}
    </>
  );
}
