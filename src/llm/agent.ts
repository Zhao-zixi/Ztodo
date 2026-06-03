/**
 * Agent 循环 — 用户输入 → LLM → 工具调用 → 执行 → 结果 → LLM → 最终回复。
 */

import type { Message, ToolCall, LLMConfig } from "./llmClient";
import { createLLMClient } from "./llmClient";
import { ALL_TOOLS } from "./toolRegistry";
import { executeTool } from "./toolExecutor";

export interface AgentStep {
  type: "llm_call" | "tool_call" | "tool_result" | "final";
  content: string;
  detail?: unknown;
}

export interface AgentResult {
  finalMessage: string;
  steps: AgentStep[];
}

const MAX_TURNS = 5;

/**
 * 运行 Agent 循环。
 * @param userInput 用户输入
 * @param config LLM 配置
 * @param onStep 每步回调（用于 UI 流式展示）
 */
export async function runAgent(
  userInput: string,
  config: LLMConfig,
  onStep?: (step: AgentStep) => void,
): Promise<AgentResult> {
  const client = createLLMClient(config);
  const steps: AgentStep[] = [];
  const messages: Message[] = [
    { role: "user", content: userInput },
  ];

  const emit = (step: AgentStep) => {
    steps.push(step);
    onStep?.(step);
  };

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // ── 调用 LLM ──
    emit({ type: "llm_call", content: `第 ${turn + 1} 轮推理...` });

    let response;
    try {
      response = await client.chat(messages, ALL_TOOLS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit({ type: "final", content: `❌ LLM 调用失败: ${msg}` });
      return { finalMessage: `抱歉，调用 AI 失败：${msg}`, steps };
    }

    // ── LLM 返回纯文本 → 结束 ──
    if (response.content && !response.tool_calls?.length) {
      emit({
        type: "final",
        content: response.content,
      });
      return { finalMessage: response.content, steps };
    }

    // ── LLM 返回 tool_calls → 执行 ──
    if (response.tool_calls?.length) {
      // 记录 assistant 消息
      messages.push({
        role: "assistant",
        content: response.content,
        tool_calls: response.tool_calls,
      });

      for (const tc of response.tool_calls) {
        const fnName = tc.function.name;
        let fnArgs: Record<string, unknown>;

        try {
          fnArgs = JSON.parse(tc.function.arguments);
        } catch {
          emit({
            type: "tool_result",
            content: `⚠️ 参数解析失败: ${tc.function.arguments.slice(0, 100)}`,
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            name: fnName,
            content: `参数解析失败`,
          });
          continue;
        }

        emit({
          type: "tool_call",
          content: `🔧 ${fnName}(${JSON.stringify(fnArgs)})`,
          detail: { name: fnName, args: fnArgs },
        });

        let result: unknown;
        try {
          result = await executeTool(fnName, fnArgs);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result = { error: msg };
          emit({
            type: "tool_result",
            content: `❌ 执行失败: ${msg}`,
            detail: result,
          });
        }

        const resultStr = JSON.stringify(result);
        emit({
          type: "tool_result",
          content: resultStr.length > 500
            ? resultStr.slice(0, 500) + "..."
            : resultStr,
          detail: result,
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: fnName,
          content: resultStr,
        });
      }

      // 继续下一轮
      continue;
    }

    // 没有 content 也没有 tool_calls
    emit({ type: "final", content: "（AI 没有返回有效内容）" });
    return { finalMessage: "（AI 没有返回有效内容）", steps };
  }

  // 超过最大轮数
  emit({
    type: "final",
    content: `已达到最大 ${MAX_TURNS} 轮交互，请简化你的问题。`,
  });
  return {
    finalMessage: `处理步骤较多（超过 ${MAX_TURNS} 轮），请简化你的需求。`,
    steps,
  };
}

/**
 * 任务完成时，调用 LLM 生成总结和经验教训。
 * @param taskInfo 任务详情
 * @param existingTips 当前 skill 已有经验
 * @param config LLM 配置
 */
export async function summarizeCompletion(
  taskInfo: {
    title: string;
    note: string;
    category: string;
    completedAt: string;
    subtaskTitles: string[];
  },
  existingTips: string,
  config: LLMConfig,
): Promise<{ summary: string; lessons: string }> {
  const client = createLLMClient(config);

  const prompt = `你是一个经验总结助手。用户刚完成了一个任务，请总结完成情况和经验教训。

返回格式为 JSON：{"summary": "简短总结", "lessons": "经验教训（如果和已有经验重复则留空）"}

已有经验（避免重复）：
${existingTips || "（暂无）"}`;

  const context = `任务：${taskInfo.title}
分类：${taskInfo.category}
备注：${taskInfo.note || "无"}
完成时间：${taskInfo.completedAt}
子任务步骤：${taskInfo.subtaskTitles.join(" → ") || "无"}`;

  const text = await client.summarize(prompt, context);

  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || text.slice(0, 100),
        lessons: parsed.lessons || "",
      };
    }
  } catch {
    // fall through
  }

  return {
    summary: text.slice(0, 200),
    lessons: "",
  };
}
