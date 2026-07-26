// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import type { Memory, MemoryInput, MemoryKind, MemoryList, MemorySearchResults } from "../types.js";
import {
  buildMemoryBatchPayload,
  buildQueryParams,
  encodeItem,
  encodeUpdateBody,
} from "../utils.js";
import { Resource } from "./base.js";

type MemoryListResponse = {
  memories: Memory[];
  _meta: { limit: number; offset: number; total: number };
};

type MemoryBatchResponse = {
  memories: Memory[];
};

export class Memories extends Resource {
  async list(
    agentId: string,
    sessionId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<MemoryList> {
    const { limit = 50, offset = 0 } = options;
    const params = buildQueryParams({ limit, offset });
    const data = await this.request<MemoryListResponse>(
      "GET",
      this.agentPath(agentId, "sessions", sessionId, "memories"),
      { params },
    );
    return {
      memories: data.memories,
      limit: data._meta.limit,
      offset: data._meta.offset,
      total: data._meta.total,
    };
  }

  async get(agentId: string, sessionId: string, memoryId: string): Promise<Memory> {
    return this.request<Memory>(
      "GET",
      this.agentPath(agentId, "sessions", sessionId, "memories", memoryId),
    );
  }

  async search(
    agentId: string,
    sessionId: string,
    options: { query: string; limit?: number },
  ): Promise<MemorySearchResults> {
    return this.request<MemorySearchResults>(
      "POST",
      this.agentPath(agentId, "sessions", sessionId, "memories", "search"),
      { json: { query: options.query, limit: options.limit ?? 10 } },
    );
  }

  async create(agentId: string, sessionId: string, memory: MemoryInput): Promise<Memory>;
  async create(agentId: string, sessionId: string, memory: MemoryInput[]): Promise<Memory[]>;
  async create(
    agentId: string,
    sessionId: string,
    memory: MemoryInput | MemoryInput[],
  ): Promise<Memory | Memory[]> {
    if (Array.isArray(memory)) {
      const data = await this.request<MemoryBatchResponse>(
        "POST",
        this.agentPath(agentId, "sessions", sessionId, "memories", "batch"),
        { json: buildMemoryBatchPayload(memory) },
      );
      return data.memories;
    }

    return this.request<Memory>(
      "POST",
      this.agentPath(agentId, "sessions", sessionId, "memories"),
      { json: encodeItem(memory) },
    );
  }

  async update(
    agentId: string,
    sessionId: string,
    memoryId: string,
    options: {
      content: string;
      kind?: MemoryKind;
      meta?: Record<string, unknown>;
    },
  ): Promise<Memory> {
    return this.request<Memory>(
      "PUT",
      this.agentPath(agentId, "sessions", sessionId, "memories", memoryId),
      {
        json: encodeUpdateBody({
          content: options.content,
          meta: options.meta,
          kind: options.kind,
        }),
      },
    );
  }

  async delete(agentId: string, sessionId: string, id: string | string[]): Promise<void> {
    if (Array.isArray(id)) {
      await this.request(
        "DELETE",
        this.agentPath(agentId, "sessions", sessionId, "memories", "batch"),
        { json: { ids: id } },
      );
      return;
    }
    await this.request("DELETE", this.agentPath(agentId, "sessions", sessionId, "memories", id));
  }
}
