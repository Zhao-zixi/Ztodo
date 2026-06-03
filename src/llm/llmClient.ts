/**
 * LLM API 客户端 — 兼容 OpenAI API 格式。
 * 支持 function calling。
 */

import type { ToolDefinition } from "./toolRegistry";

export interface LLMConfig {
  endpoint: string;   // 默认 https://api.openai.com/v1
  apiKey: string;
  model: string;      // 默认 gpt-4o-mini
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;      // tool role 时必填
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;   // JSON string
  };
}

export interface LLMResponse {
  role: "assistant";
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface StreamCallback {
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onDone?: (fullResponse: LLMResponse) => void;
  onError?: (error: Error) => void;
}

const SYSTEM_PROMPT = `你是 Ztodo 智能助手，帮助用户管理待办事项。

你的能力：
- 创建、查看、修改、删除任务
- 搜索任务、查看子任务、获取统计
- 管理技能模板（将常用任务流程保存为模板，下次一句话创建）
- 用技能模板快速创建任务 + 子任务

行为准则：
1. 用户说类似"写周报""做代码审查"等短语时，先用 list_skills 查是否有匹配的模板
2. 找到模板后用 instantiate_skill 创建，找不到则用 create_task
3. 创建/修改任务后简要告知结果
4. 删除任务前确认一下
5. 回复简洁，用中文

当前日期：${new Date().toISOString().slice(0, 10)}`;

export function createLLMClient(config: LLMConfig) {
  const baseUrl = config.endpoint.replace(/\/$/, "");

  async function chat(
    messages: Message[],
    tools: ToolDefinition[],
    onStream?: StreamCallback,
  ): Promise<LLMResponse> {
    const systemMessages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const body: Record<string, unknown> = {
      model: config.model,
      messages: systemMessages,
      temperature: 0.3,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error("LLM 返回为空");

    const msg = choice.message;
    const response: LLMResponse = {
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    };

    onStream?.onDone?.(response);
    return response;
  }

  /**
   * 专门用于任务完成总结的调用（无工具，纯文本）。
   */
  async function summarize(
    prompt: string,
    context: string,
  ): Promise<string> {
    const messages: Message[] = [
      { role: "system", content: prompt },
      { role: "user", content: context },
    ];

    const body = {
      model: config.model,
      messages,
      temperature: 0.5,
      max_tokens: 500,
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "（无法生成总结）";
  }

  return { chat, summarize };
}
