// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import type {
  Prompt,
  PromptInfo,
  PromptList,
  PromptStatus,
  PromptType,
  PromptVersionList,
} from "../types.js";
import { buildQueryParams, normalizePrompt } from "../utils.js";
import { Resource } from "./base.js";

type PromptListResponse = {
  prompts: PromptInfo[];
  _meta: { limit: number; offset: number; total: number };
};

type PromptVersionListResponse = {
  versions: Record<string, unknown>[];
  _meta: { limit: number; offset: number; total: number };
};

function encodeJsonField(
  value: Record<string, unknown> | string | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function promptWriteBody(options: {
  content: string;
  type?: PromptType;
  config?: Record<string, unknown> | string | null;
  commitMessage?: string | null;
  meta?: Record<string, unknown> | string | null;
  status?: PromptStatus;
  production?: boolean;
  name?: string;
  description?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = { content: options.content };
  if (options.name != null) {
    body.name = options.name;
  }
  if (options.description != null) {
    body.description = options.description;
  }
  if (options.type != null) {
    body.type = options.type;
  }
  const encodedConfig = encodeJsonField(options.config);
  if (encodedConfig != null) {
    body.config = encodedConfig;
  }
  if (options.commitMessage != null) {
    body.commitMessage = options.commitMessage;
  }
  const encodedMeta = encodeJsonField(options.meta);
  if (encodedMeta != null) {
    body.meta = encodedMeta;
  }
  if (options.status != null) {
    body.status = options.status;
  }
  if (options.production != null) {
    body.production = options.production;
  }
  return body;
}

export class Prompts extends Resource {
  async list(options: { limit?: number; offset?: number } = {}): Promise<PromptList> {
    const { limit = 50, offset = 0 } = options;
    const params = buildQueryParams({ limit, offset });
    const data = await this.request<PromptListResponse>("GET", this.workspacePath("prompts"), {
      params,
    });
    return {
      prompts: data.prompts,
      limit: data._meta.limit,
      offset: data._meta.offset,
      total: data._meta.total,
    };
  }

  async create(options: {
    name: string;
    type: PromptType;
    content: string;
    description?: string;
    config?: Record<string, unknown> | string | null;
    commitMessage?: string | null;
    meta?: Record<string, unknown> | string | null;
    production?: boolean;
  }): Promise<PromptInfo> {
    return this.request<PromptInfo>("POST", this.workspacePath("prompts"), {
      json: promptWriteBody(options),
    });
  }

  async get(promptId: string): Promise<PromptInfo> {
    return this.request<PromptInfo>("GET", this.workspacePath("prompts", promptId));
  }

  async delete(promptId: string): Promise<void> {
    await this.request("DELETE", this.workspacePath("prompts", promptId));
  }

  async getByName(name: string, options: { version?: string } = {}): Promise<Prompt> {
    const params = options.version != null ? { version: options.version } : undefined;
    const data = await this.request<Record<string, unknown>>(
      "GET",
      this.workspacePath("promptsByName", name),
      { params },
    );
    return normalizePrompt(data);
  }

  async listVersions(
    promptId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<PromptVersionList> {
    const { limit = 50, offset = 0 } = options;
    const params = buildQueryParams({ limit, offset });
    const data = await this.request<PromptVersionListResponse>(
      "GET",
      this.workspacePath("prompts", promptId, "versions"),
      { params },
    );
    return {
      versions: data.versions.map((item) => normalizePrompt(item)),
      limit: data._meta.limit,
      offset: data._meta.offset,
      total: data._meta.total,
    };
  }

  async createVersion(
    promptId: string,
    options: {
      type: PromptType;
      content: string;
      config?: Record<string, unknown> | string | null;
      commitMessage?: string | null;
      meta?: Record<string, unknown> | string | null;
      production?: boolean;
    },
  ): Promise<Prompt> {
    const data = await this.request<Record<string, unknown>>(
      "POST",
      this.workspacePath("prompts", promptId, "versions"),
      { json: promptWriteBody(options) },
    );
    return normalizePrompt(data);
  }

  async getVersion(promptId: string, versionId: string): Promise<Prompt> {
    const data = await this.request<Record<string, unknown>>(
      "GET",
      this.workspacePath("prompts", promptId, "versions", versionId),
    );
    return normalizePrompt(data);
  }

  async updateVersion(
    promptId: string,
    versionId: string,
    options: {
      content: string;
      type?: PromptType;
      config?: Record<string, unknown> | string | null;
      commitMessage?: string | null;
      meta?: Record<string, unknown> | string | null;
      status?: PromptStatus;
      production?: boolean;
    },
  ): Promise<Prompt> {
    const data = await this.request<Record<string, unknown>>(
      "PUT",
      this.workspacePath("prompts", promptId, "versions", versionId),
      { json: promptWriteBody(options) },
    );
    return normalizePrompt(data);
  }

  async deleteVersion(promptId: string, versionId: string): Promise<void> {
    await this.request("DELETE", this.workspacePath("prompts", promptId, "versions", versionId));
  }
}
