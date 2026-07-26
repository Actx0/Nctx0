// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import type { Agent, AgentList } from "../types.js";
import { buildQueryParams } from "../utils.js";
import { Resource } from "./base.js";

type AgentListResponse = {
  agents: Agent[];
  _meta: { limit: number; offset: number; total: number };
};

export class Agents extends Resource {
  async list(options: { limit?: number; offset?: number } = {}): Promise<AgentList> {
    const { limit = 50, offset = 0 } = options;
    const params = buildQueryParams({ limit, offset });
    const data = await this.request<AgentListResponse>("GET", this.workspacePath("agents"), {
      params,
    });
    return {
      agents: data.agents,
      limit: data._meta.limit,
      offset: data._meta.offset,
      total: data._meta.total,
    };
  }

  async get(agentId: string): Promise<Agent> {
    return this.request<Agent>("GET", this.workspacePath("agents", agentId));
  }

  async create(options: { name: string; description: string }): Promise<Agent> {
    return this.request<Agent>("POST", this.workspacePath("agents"), {
      json: { name: options.name, description: options.description },
    });
  }

  async update(agentId: string, options: { name: string; description: string }): Promise<Agent> {
    return this.request<Agent>("PUT", this.workspacePath("agents", agentId), {
      json: { name: options.name, description: options.description },
    });
  }

  async delete(agentId: string): Promise<void> {
    await this.request("DELETE", this.workspacePath("agents", agentId));
  }
}
