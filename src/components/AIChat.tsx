import { useState, useRef, useEffect } from "react";
import { Send, ChevronDown, ChevronRight, BookOpen, Sparkles, MessageCircle } from "lucide-react";
import { runAgent, type AgentStep } from "../llm/agent";
import type { LLMConfig } from "../llm/llmClient";
import SkillPanel from "./SkillPanel";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  steps?: AgentStep[];
}

interface Props {
  onRefresh: () => void;
  llmConfig: LLMConfig;
  inline?: boolean;
}

export default function AIChat({ onRefresh, llmConfig, inline }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [tab, setTab] = useState<"chat" | "skills">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    if (!llmConfig.apiKey) {
      setMessages((prev) => [...prev, { role: "agent", content: "请先在顶部 ⚙ 设置中填写 API Key" }]);
      return;
    }

    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const agentIdx = messages.length + 1;
    setMessages((prev) => [...prev, { role: "agent", content: "思考中...", steps: [] }]);

    const allSteps: AgentStep[] = [];

    try {
      const result = await runAgent(text, llmConfig, (step) => {
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
          updated[agentIdx] = { role: "agent", content: result.finalMessage, steps: result.steps };
        }
        return updated;
      });

      if (result.steps.some((s) => s.type === "tool_call")) onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const updated = [...prev];
        if (updated[agentIdx]) updated[agentIdx] = { role: "agent", content: `出错了: ${msg}`, steps: allSteps };
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
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  // ══════ 内嵌模式（在 App header 下方展开）══════
  if (inline) {
    return (
      <div className="bg-white dark:bg-zinc-950 flex flex-col" style={{ height: "400px" }}>
        {/* 标签栏 */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 shrink-0">
          <button onClick={() => setTab("chat")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-all
              ${tab === "chat"
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"}`}>
            <MessageCircle size={12} />对话
          </button>
          <button onClick={() => setTab("skills")}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-all
              ${tab === "skills"
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"}`}>
            <BookOpen size={12} />模板
          </button>
        </div>

        {tab === "chat" ? (
          <>
            {/* 消息区 */}
            <div className="flex-1 overflow-y-auto px-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30
                                 flex items-center justify-center mb-3">
                    <Sparkles size={18} className="text-indigo-500" />
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">有什么我可以帮你的？</p>
                  <div className="mt-2 space-y-1.5">
                    {["写周报", "今天有什么任务？", "帮我创建一个高优任务"].map((t, i) => (
                      <button key={i} onClick={() => { setInput(t); }}
                        className="block text-sm text-zinc-400 hover:text-indigo-500
                                   transition-colors px-2 py-0.5 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        「{t}」
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i}>
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] bg-indigo-600 text-white text-sm
                                       px-3.5 py-2.5 rounded-2xl rounded-br-md leading-relaxed">
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
                          <>
                            <button onClick={() => toggleStep(i)}
                              className="flex items-center gap-1 mt-1 text-[10px] text-zinc-400
                                        hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                              {expandedSteps.has(i) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                              处理过程 ({msg.steps.length} 步)
                            </button>
                            {expandedSteps.has(i) && (
                              <div className="mt-1.5 ml-3 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-0.5">
                                {msg.steps.map((s, j) => (
                                  <div key={j} className="text-[10px] text-zinc-400 font-mono">
                                    {s.content}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}

              {loading && messages[messages.length - 1]?.role !== "agent" && (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  思考中...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 输入区 */}
            <div className="px-4 py-3 shrink-0 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 bg-zinc-100 dark:bg-zinc-800
                             rounded-xl px-3.5 py-2.5
                             focus-within:ring-2 focus-within:ring-indigo-500/20
                             transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={llmConfig.apiKey ? "输入指令..." : "请先在 ⚙ 中配置 API Key"}
                  disabled={loading}
                  className="flex-1 bg-transparent text-sm
                             focus:outline-none text-zinc-800 dark:text-zinc-200
                             placeholder:text-zinc-400"
                />
                <button onClick={handleSend} disabled={loading || !input.trim()}
                  className="flex-shrink-0 w-7 h-7 rounded-lg bg-indigo-600
                             hover:bg-indigo-500 disabled:opacity-30
                             text-white flex items-center justify-center
                             transition-all active:scale-90">
                  <Send size={11} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <SkillPanel onRefresh={onRefresh} />
          </div>
        )}
      </div>
    );
  }

  // ══════ 悬浮模式（保留兼容）══════
  return null;
}
