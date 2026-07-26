// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import type { Session, SessionList } from "../types.js";
import { buildQueryParams } from "../utils.js";
import { Resource } from "./base.js";

type SessionListResponse = {
  sessions: Session[];
  _meta: { limit: number; offset: number; total: number };
};

export class Sessions extends Resource {
  async create(
    agentId: string,
    options: {
      externalId?: string;
      labels?: Record<string, string>;
      title?: string;
    } = {},
  ): Promise<Session> {
    const params = buildQueryParams({
      externalId: options.externalId,
      labels: options.labels,
    });
    if (Object.keys(params).length === 0) {
      throw new Error("externalId or labels is required");
    }

    const json = options.title != null ? { title: options.title } : undefined;
    return this.request<Session>("POST", this.agentPath(agentId, "sessions"), {
      params,
      json,
    });
  }

  async list(
    agentId: string,
    options: {
      externalId?: string;
      labels?: Record<string, string>;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<SessionList> {
    const { limit = 50, offset = 0 } = options;
    const params = buildQueryParams({
      externalId: options.externalId,
      labels: options.labels,
      limit,
      offset,
    });
    const data = await this.request<SessionListResponse>(
      "GET",
      this.agentPath(agentId, "sessions"),
      { params: Object.keys(params).length ? params : undefined },
    );
    return {
      sessions: data.sessions,
      limit: data._meta.limit,
      offset: data._meta.offset,
      total: data._meta.total,
    };
  }

  async get(agentId: string, sessionId: string): Promise<Session> {
    return this.request<Session>("GET", this.agentPath(agentId, "sessions", sessionId));
  }

  async getByLabels(
    agentId: string,
    options: { externalId?: string; labels?: Record<string, string> } = {},
  ): Promise<Session> {
    const params = buildQueryParams({
      externalId: options.externalId,
      labels: options.labels,
    });
    if (Object.keys(params).length === 0) {
      throw new Error("externalId or labels is required");
    }
    return this.request<Session>("GET", this.agentPath(agentId, "sessions", "by-labels"), {
      params,
    });
  }

  async update(
    agentId: string,
    options: {
      externalId?: string;
      labels?: Record<string, string>;
      title?: string;
      newLabels?: Record<string, string>;
    },
  ): Promise<Session> {
    const params = buildQueryParams({
      externalId: options.externalId,
      labels: options.labels,
    });
    if (Object.keys(params).length === 0) {
      throw new Error("externalId or labels is required");
    }

    const body: Record<string, unknown> = {};
    if (options.title != null) {
      body.title = options.title;
    }
    if (options.newLabels != null) {
      body.labels = options.newLabels;
    }

    return this.request<Session>("PUT", this.agentPath(agentId, "sessions", "by-labels"), {
      params,
      json: body,
    });
  }

  async delete(
    agentId: string,
    options: { externalId?: string; labels?: Record<string, string> } = {},
  ): Promise<void> {
    const params = buildQueryParams({
      externalId: options.externalId,
      labels: options.labels,
    });
    if (Object.keys(params).length === 0) {
      throw new Error("externalId or labels is required");
    }
    await this.request("DELETE", this.agentPath(agentId, "sessions", "by-labels"), {
      params,
    });
  }
}
