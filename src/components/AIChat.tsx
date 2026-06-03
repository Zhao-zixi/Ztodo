import { useState, useRef, useEffect } from "react";
import { X, Send, ChevronDown, ChevronRight, BookOpen, Sparkles, MessageCircle } from "lucide-react";
import { runAgent, type AgentStep } from "../llm/agent";
import type { LLMConfig } from "../llm/llmClient";
import SkillPanel from "./SkillPanel";

interface ChatMessage {
  role: "user" | "agent";
  content: string;
  steps?: AgentStep[];
}

export default function AIChat({ onRefresh, llmConfig }: { onRefresh: () => void; llmConfig: LLMConfig }) {
  const [open, setOpen] = useState(false);
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

  return (
    <>
      {/* FAB */}
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
        <>
          {/* 移动端遮罩 */}
          <div className="fixed inset-0 z-30 bg-black/20 dark:bg-black/50 backdrop-blur-sm
                          animate-in fade-in duration-150 lg:hidden"
            onClick={() => setOpen(false)} />

          <div className="fixed bottom-4 right-4 z-40 w-[400px] max-h-[650px]
                          bg-white dark:bg-zinc-900
                          border border-zinc-200 dark:border-zinc-700/50
                          rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/50
                          flex flex-col overflow-hidden
                          animate-in slide-in-from-bottom-4 duration-200">
            {/* 头部 + 标签 */}
            <div className="flex items-center justify-between px-4 py-2.5
                           border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-500" />
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">AI 助手</span>
              </div>
              <div className="flex items-center gap-1">
                {/* 标签切换 */}
                <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 mr-1">
                  <button onClick={() => setTab("chat")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all
                      ${tab === "chat"
                        ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"}`}>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={11} />对话
                    </span>
                  </button>
                  <button onClick={() => setTab("skills")}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all
                      ${tab === "skills"
                        ? "bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"}`}>
                    <span className="flex items-center gap-1">
                      <BookOpen size={11} />模板
                    </span>
                  </button>
                </div>
                <button onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400
                             hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* 内容 */}
            {tab === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50
                                     dark:from-indigo-950/30 dark:to-purple-950/30
                                     flex items-center justify-center mb-4">
                        <Sparkles size={24} className="text-indigo-500" />
                      </div>
                      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        有什么我可以帮你的？
                      </p>
                      <div className="mt-3 space-y-1.5">
                        {["「写周报」— 用模板创建任务", "「今天有什么任务？」— 查看任务", "「帮我创建一个高优任务」"].map((t, i) => (
                          <button key={i} onClick={() => { setInput(t.replace(/[「」—].*/g, "")); }}
                            className="block text-xs text-zinc-400 hover:text-indigo-500
                                       transition-colors px-2 py-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            {t}
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
                                           px-4 py-2.5 rounded-2xl rounded-br-md leading-relaxed">
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
                                  className="flex items-center gap-1 mt-1.5 text-[11px] text-zinc-400
                                            hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                                  {expandedSteps.has(i) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                  处理过程 ({msg.steps.length} 步)
                                </button>
                                {expandedSteps.has(i) && (
                                  <div className="mt-2 ml-3 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-1">
                                    {msg.steps.map((s, j) => (
                                      <div key={j} className="text-[11px] text-zinc-400 font-mono">
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
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      思考中...
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* 输入区 — 固定在底部 */}
                <div className="px-3 py-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0
                               bg-white dark:bg-zinc-900">
                  <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800
                                 rounded-2xl px-3.5 py-2
                                 focus-within:ring-2 focus-within:ring-indigo-500/20
                                 focus-within:bg-white dark:focus-within:bg-zinc-800
                                 transition-all">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={llmConfig.apiKey ? "输入指令..." : "请先在顶栏 ⚙ 设置 API Key"}
                      disabled={loading}
                      className="flex-1 bg-transparent text-sm
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

            {tab === "skills" && <SkillPanel onRefresh={onRefresh} />}
          </div>
        </>
      )}
    </>
  );
}
