// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import type {
  Message,
  MessageInput,
  MessageList,
  MessageRole,
  MessageSearchResults,
} from "../types.js";
import {
  buildMessageBatchPayload,
  buildQueryParams,
  encodeItem,
  encodeUpdateBody,
} from "../utils.js";
import { Resource } from "./base.js";

type MessageListResponse = {
  messages: Message[];
  _meta: { limit: number; offset: number; total: number };
};

type MessageBatchResponse = {
  messages: Message[];
};

export class Messages extends Resource {
  async list(
    agentId: string,
    sessionId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<MessageList> {
    const { limit = 50, offset = 0 } = options;
    const params = buildQueryParams({ limit, offset });
    const data = await this.request<MessageListResponse>(
      "GET",
      this.agentPath(agentId, "sessions", sessionId, "messages"),
      { params },
    );
    return {
      messages: data.messages,
      limit: data._meta.limit,
      offset: data._meta.offset,
      total: data._meta.total,
    };
  }

  async get(agentId: string, sessionId: string, messageId: string): Promise<Message> {
    return this.request<Message>(
      "GET",
      this.agentPath(agentId, "sessions", sessionId, "messages", messageId),
    );
  }

  async search(
    agentId: string,
    sessionId: string,
    options: { query: string; limit?: number },
  ): Promise<MessageSearchResults> {
    return this.request<MessageSearchResults>(
      "POST",
      this.agentPath(agentId, "sessions", sessionId, "messages", "search"),
      { json: { query: options.query, limit: options.limit ?? 10 } },
    );
  }

  async create(agentId: string, sessionId: string, message: MessageInput): Promise<Message>;
  async create(agentId: string, sessionId: string, message: MessageInput[]): Promise<Message[]>;
  async create(
    agentId: string,
    sessionId: string,
    message: MessageInput | MessageInput[],
  ): Promise<Message | Message[]> {
    if (Array.isArray(message)) {
      const data = await this.request<MessageBatchResponse>(
        "POST",
        this.agentPath(agentId, "sessions", sessionId, "messages", "batch"),
        { json: buildMessageBatchPayload(message) },
      );
      return data.messages;
    }

    return this.request<Message>(
      "POST",
      this.agentPath(agentId, "sessions", sessionId, "messages"),
      { json: encodeItem(message) },
    );
  }

  async update(
    agentId: string,
    sessionId: string,
    messageId: string,
    options: {
      content: string;
      role?: MessageRole;
      meta?: Record<string, unknown>;
    },
  ): Promise<Message> {
    return this.request<Message>(
      "PUT",
      this.agentPath(agentId, "sessions", sessionId, "messages", messageId),
      {
        json: encodeUpdateBody({
          content: options.content,
          meta: options.meta,
          role: options.role,
        }),
      },
    );
  }

  async delete(agentId: string, sessionId: string, id: string | string[]): Promise<void> {
    if (Array.isArray(id)) {
      await this.request(
        "DELETE",
        this.agentPath(agentId, "sessions", sessionId, "messages", "batch"),
        { json: { ids: id } },
      );
      return;
    }
    await this.request("DELETE", this.agentPath(agentId, "sessions", sessionId, "messages", id));
  }
}
