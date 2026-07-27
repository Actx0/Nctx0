// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.
/** Shared helpers for nctx0 examples (setup, RAG, OpenRouter streaming). */

import type {
  Memory,
  MemorySearchHit,
  Message,
  MessageSearchHit,
  Nctx0Client,
  SearchHit,
} from "../src/index.js";

export const ACCESS_KEY = "~~";
export const WORKSPACE_ID = "~~";
export const BASE_URL = "https://actx0.com";

export const OPENROUTER_KEY = "~~";
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.6";
export const DOC_LABELS = { source: "docs", team: "platform-team" };

export type Setup = {
  agentId: string;
  promptId: string;
  system: string;
  sessionId: string;
  sessionExternalId: string;
};

export type ChatMessage = { role: string; content: string };

/** Create a prompt, agent, and session. */
export async function setup(
  client: Nctx0Client,
  options: {
    agentName: string;
    agentDescription: string;
    promptName: string;
    promptContent: string;
    sessionExternalId: string;
    sessionTitle: string;
  },
): Promise<Setup> {
  const promptInfo = await client.prompt.create({
    name: options.promptName,
    type: "text",
    content: options.promptContent,
    commitMessage: "initial",
    production: true,
  });
  const system = (await client.prompt.getByName(promptInfo.handle)).content;
  const agent = await client.agent.create({
    name: options.agentName,
    description: options.agentDescription,
  });
  const session = await client.session.create(agent.id, {
    externalId: options.sessionExternalId,
    title: options.sessionTitle,
  });
  return {
    agentId: agent.id,
    promptId: promptInfo.promptId,
    system,
    sessionId: session.id,
    sessionExternalId: options.sessionExternalId,
  };
}

export async function teardown(client: Nctx0Client, s: Setup): Promise<void> {
  await client.session.delete(s.agentId, { externalId: s.sessionExternalId });
  await client.agent.delete(s.agentId);
  await client.prompt.delete(s.promptId);
}

export async function ragContext(
  client: Nctx0Client,
  query: string,
  options: { limit?: number } = {},
): Promise<string> {
  const limit = options.limit ?? 3;
  const results = await client.document.search({
    query,
    labels: DOC_LABELS,
    limit,
  });
  return formatHits(results.results, { limit });
}

export function historyFromMessages(messages: Message[]): ChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export function historyFromMessageHits(hits: MessageSearchHit[]): ChatMessage[] {
  return hits.map((hit) => ({ role: hit.role, content: hit.text }));
}

export function historyFromMemories(memories: Memory[]): ChatMessage[] {
  if (memories.length === 0) {
    return [];
  }
  const facts = memories.map((m) => `- [${m.kind}] ${m.content}`).join("\n");
  return [{ role: "assistant", content: `Here is what I remember:\n${facts}` }];
}

export function historyFromMemoryHits(hits: MemorySearchHit[]): ChatMessage[] {
  if (hits.length === 0) {
    return [];
  }
  const facts = hits.map((hit) => `- [${hit.kind}] ${hit.text}`).join("\n");
  return [{ role: "assistant", content: `Here is what I remember:\n${facts}` }];
}

export function formatHits(hits: SearchHit[], options: { limit?: number } = {}): string {
  const selected = options.limit == null ? hits : hits.slice(0, options.limit);
  if (selected.length === 0) {
    return "";
  }
  return selected.map((hit, i) => `[${i + 1}] ${hit.text}`).join("\n\n");
}

export function buildMessages(options: {
  system: string;
  user: string;
  context?: string | null;
  history?: ChatMessage[] | null;
}): ChatMessage[] {
  let user = options.user;
  if (options.context) {
    user = `Context:\n${options.context}\n\nQuestion: ${user}`;
  }
  const messages: ChatMessage[] = [{ role: "system", content: options.system }];
  if (options.history) {
    messages.push(...options.history);
  }
  messages.push({ role: "user", content: user });
  return messages;
}

export async function ask(options: {
  system: string;
  user: string;
  history: ChatMessage[];
  context: string;
}): Promise<[string, Record<string, number> | null]> {
  const messages = buildMessages({
    system: options.system,
    user: options.user,
    context: options.context || null,
    history: options.history,
  });
  console.log(
    `[ctx] history=${options.history.length} (prior turns) ` +
      `sending=${messages.length} (system + history + current user)`,
  );

  const [reply, usage] = await streamResponse({ messages });
  if (usage) {
    console.log(
      `[tokens] prompt=${usage.prompt_tokens ?? "?"} ` +
        `completion=${usage.completion_tokens ?? "?"} ` +
        `total=${usage.total_tokens ?? "?"}`,
    );
  }
  return [reply, usage];
}

export async function streamResponse(options: {
  messages: ChatMessage[];
  model?: string;
  apiKey?: string;
  timeout?: number;
}): Promise<[string, Record<string, number> | null]> {
  const model = options.model ?? DEFAULT_MODEL;
  const apiKey = options.apiKey ?? OPENROUTER_KEY;
  const timeout = options.timeout ?? 60_000;

  if (!apiKey) {
    throw new Error("OPENROUTER_KEY is required");
  }

  const parts: string[] = [];
  let usage: Record<string, number> | null = null;
  process.stdout.write("agent> ");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/actx0/nctx0",
        "X-Title": "nctx0 examples",
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${detail}`);
    }

    if (!response.body) {
      throw new Error("OpenRouter response missing body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line.startsWith("data: ")) {
          continue;
        }
        const data = line.slice("data: ".length).trim();
        if (!data) {
          continue;
        }
        if (data === "[DONE]") {
          break;
        }

        const chunk = JSON.parse(data) as {
          usage?: Record<string, number>;
          choices?: Array<{ delta?: { content?: string } }>;
        };
        if (chunk.usage) {
          usage = chunk.usage;
        }
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          process.stdout.write(delta);
          parts.push(delta);
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }

  process.stdout.write("\n\n");
  return [parts.join(""), usage];
}
