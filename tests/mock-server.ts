// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import http from "node:http";
import querystring from "node:querystring";
import { URL } from "node:url";

export const DEFAULT_WORKSPACE_ACCESS_KEY = "test-workspace-access-key";
export const DEFAULT_WORKSPACE_ID = "ws-test-1";
export const DEFAULT_AGENT_ID = "agt-test-1";
const TIMESTAMP = "2026-07-11T10:00:00Z";

type Json = Record<string, unknown>;

function defaultAgent(agentId = DEFAULT_AGENT_ID): Json {
  return {
    id: agentId,
    workspaceId: DEFAULT_WORKSPACE_ID,
    name: "Support bot",
    kind: "unmanaged",
    promptId: null,
    kbLabels: {},
    handle: "a8k2m9x1",
    description: "Handles customer questions",
    status: "active",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function shortId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

type Store = {
  agents: Map<string, Json>;
  documents: Map<string, Json>;
  sessions: Map<string, Json>;
  messages: Map<string, Json[]>;
  memories: Map<string, Json[]>;
  prompts: Map<string, Json>;
  promptVersions: Map<string, Map<string, Json>>;
};

function createStore(): Store {
  const promptId = "prm_customer_support";
  const prompt = {
    promptId,
    name: "Customer Support",
    handle: "customer-support",
    description: "Customer Support Prompt",
  };
  const v1: Json = {
    id: "prv_v1",
    name: "Customer Support",
    handle: "customer-support",
    description: "Customer Support Prompt",
    version: 1,
    type: "text",
    content: "You are a helpful assistant v1\n{{ctx}}",
    config: { model: "gpt3" },
    labels: [],
    commitMessage: "initial",
    commitHash: "ba506ac20c11",
    meta: null,
    status: "active",
    production: true,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
  const v2: Json = {
    id: "prv_v2",
    name: "Customer Support",
    handle: "customer-support",
    description: "Customer Support Prompt",
    version: 2,
    type: "text",
    content: "You are a helpful assistant v2\n{{ctx}}",
    config: { model: "gpt3" },
    labels: ["latest"],
    commitMessage: "v2",
    commitHash: "ba506ac20c12",
    meta: null,
    status: "active",
    production: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };

  return {
    agents: new Map([[DEFAULT_AGENT_ID, defaultAgent()]]),
    documents: new Map(),
    sessions: new Map(),
    messages: new Map(),
    memories: new Map(),
    prompts: new Map([[promptId, prompt]]),
    promptVersions: new Map([
      [
        promptId,
        new Map([
          ["prv_v1", v1],
          ["prv_v2", v2],
        ]),
      ],
    ]),
  };
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseMultipart(
  buffer: Buffer,
  contentType: string,
): Record<string, string | { filename: string; content: Buffer }> {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!boundaryMatch) {
    return {};
  }
  const boundary = boundaryMatch[1] ?? boundaryMatch[2]!;
  const parts = buffer.toString("binary").split(`--${boundary}`);
  const result: Record<string, string | { filename: string; content: Buffer }> = {};

  for (const part of parts) {
    if (part === "--\r\n" || part === "--" || part.trim() === "") {
      continue;
    }
    const cleaned = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const sep = cleaned.indexOf("\r\n\r\n");
    if (sep < 0) {
      continue;
    }
    const rawHeaders = cleaned.slice(0, sep);
    const rawBody = cleaned.slice(sep + 4).replace(/\r\n$/, "");
    const nameMatch = /name="([^"]+)"/.exec(rawHeaders);
    if (!nameMatch) {
      continue;
    }
    const name = nameMatch[1]!;
    const filenameMatch = /filename="([^"]*)"/.exec(rawHeaders);
    if (filenameMatch) {
      result[name] = {
        filename: filenameMatch[1] || "upload.md",
        content: Buffer.from(rawBody, "binary"),
      };
    } else {
      result[name] = Buffer.from(rawBody, "binary").toString("utf8");
    }
  }
  return result;
}

export class LocalServer {
  private server: Server | null = null;
  private store = createStore();
  private port = 0;

  get url(): string {
    if (!this.server) {
      throw new Error("server is not running");
    }
    return `http://127.0.0.1:${this.port}`;
  }

  async start(): Promise<void> {
    this.store = createStore();
    this.server = http.createServer((req, res) => {
      void this.handle(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(0, "127.0.0.1", () => {
        const address = this.server!.address();
        if (address && typeof address === "object") {
          this.port = address.port;
          resolve();
        } else {
          reject(new Error("failed to bind mock server"));
        }
      });
      this.server!.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  private authorized(req: IncomingMessage): boolean {
    return req.headers["x-access-key"] === DEFAULT_WORKSPACE_ACCESS_KEY;
  }

  private send(res: ServerResponse, status: number, data?: Json | null): void {
    const body = data == null ? "" : JSON.stringify(data);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
  }

  private listMeta(items: unknown[], query: Record<string, string>): Json {
    return {
      limit: Number(query.limit ?? 50),
      offset: Number(query.offset ?? 0),
      total: items.length,
    };
  }

  private queryLabels(query: Record<string, string>): Record<string, string> {
    const labels: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (!["id", "limit", "offset"].includes(key)) {
        labels[key] = value;
      }
    }
    return labels;
  }

  private findSessionByLabels(query: Record<string, string>): Json | undefined {
    const externalId = query.id;
    const labels = this.queryLabels(query);
    for (const session of this.store.sessions.values()) {
      if (externalId && session.externalId === externalId) {
        return session;
      }
      if (
        Object.keys(labels).length > 0 &&
        JSON.stringify(session.labels) === JSON.stringify(labels)
      ) {
        return session;
      }
    }
    return undefined;
  }

  private agentObject(agentId: string, name: string, description: string): Json {
    return {
      id: agentId,
      workspaceId: DEFAULT_WORKSPACE_ID,
      name,
      kind: "unmanaged",
      promptId: null,
      kbLabels: {},
      handle: shortId(),
      description,
      status: "active",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    };
  }

  private documentObject(options: {
    documentId: string;
    title: string;
    filename: string;
    labels?: string[];
    content?: Buffer;
  }): Json {
    const content = options.content ?? Buffer.alloc(0);
    return {
      id: options.documentId,
      workspaceId: DEFAULT_WORKSPACE_ID,
      title: options.title,
      filename: options.filename,
      contentType: "text/markdown",
      checksum: createHash("sha256").update(content).digest("hex"),
      size: { value: content.length || 100, unit: "bytes" },
      charCount: content.toString("utf8").length || 80,
      labels: options.labels ?? [],
      chunkingStrategy: "recursive",
      chunkSize: 2000,
      chunkOverlap: 400,
      status: "processing",
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    };
  }

  private promptSummary(promptId: string): Json {
    const prompt = this.store.prompts.get(promptId)!;
    const versions = this.store.promptVersions.get(promptId) ?? new Map();
    return {
      promptId: prompt.promptId,
      name: prompt.name,
      handle: prompt.handle,
      description: prompt.description ?? "",
      versionCount: versions.size,
    };
  }

  private promptVersionObject(options: {
    prompt: Json;
    versionId: string;
    version: number;
    type: string;
    content: string;
    config?: unknown;
    commitMessage?: string | null;
    meta?: string | null;
    status?: string;
    production?: boolean;
    labels?: string[];
  }): Json {
    let parsedConfig: Record<string, unknown> = {};
    if (typeof options.config === "string") {
      parsedConfig = options.config ? JSON.parse(options.config) : {};
    } else if (options.config && typeof options.config === "object") {
      parsedConfig = options.config as Record<string, unknown>;
    }
    return {
      id: options.versionId,
      name: options.prompt.name,
      handle: options.prompt.handle,
      description: options.prompt.description ?? "",
      version: options.version,
      type: options.type,
      content: options.content,
      config: parsedConfig,
      labels: options.labels ?? [],
      commitMessage: options.commitMessage ?? null,
      commitHash: shortId() + shortId().slice(0, 4),
      meta: options.meta ?? null,
      status: options.status ?? "active",
      production: options.production ?? false,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    };
  }

  private findPromptByHandle(handle: string): Json | undefined {
    for (const prompt of this.store.prompts.values()) {
      if (prompt.handle === handle) {
        return prompt;
      }
    }
    return undefined;
  }

  private findPromptVersionByName(handle: string, version: string | undefined): Json | undefined {
    const prompt = this.findPromptByHandle(handle);
    if (!prompt) {
      return undefined;
    }
    const versions = [
      ...(this.store.promptVersions.get(prompt.promptId as string)?.values() ?? []),
    ];
    if (versions.length === 0) {
      return undefined;
    }
    versions.sort((a, b) => (a.version as number) - (b.version as number));

    if (version == null || version === "latest") {
      return versions[versions.length - 1];
    }
    if (version === "production") {
      return versions.find((item) => item.production) ?? versions[0];
    }
    let number: number | undefined;
    if (version.startsWith("v") && /^\d+$/.test(version.slice(1))) {
      number = Number(version.slice(1));
    } else if (/^\d+$/.test(version)) {
      number = Number(version);
    } else {
      return undefined;
    }
    return versions.find((item) => item.version === number);
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const method = req.method ?? "GET";
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const path = url.pathname;
      const query: Record<string, string> = {};
      for (const [key, value] of Object.entries(querystring.parse(url.searchParams.toString()))) {
        if (Array.isArray(value)) {
          if (value[0] != null) {
            query[key] = value[0];
          }
        } else if (value != null) {
          query[key] = value;
        }
      }

      const rawBody = method === "GET" || method === "HEAD" ? Buffer.alloc(0) : await readBody(req);
      const contentType = req.headers["content-type"] ?? "";

      let jsonBody: Json = {};
      let form: Record<string, string | { filename: string; content: Buffer }> = {};
      if (contentType.includes("multipart/form-data")) {
        form = parseMultipart(rawBody, contentType);
      } else if (rawBody.length > 0) {
        jsonBody = JSON.parse(rawBody.toString("utf8")) as Json;
      }

      const result = this.route(method, path, query, jsonBody, form, req);
      this.send(res, result.status, result.data);
    } catch (error) {
      this.send(res, 500, {
        errorMessage: error instanceof Error ? error.message : "internal error",
      });
    }
  }

  private route(
    method: string,
    path: string,
    query: Record<string, string>,
    body: Json,
    form: Record<string, string | { filename: string; content: Buffer }>,
    req: IncomingMessage,
  ): { status: number; data?: Json | null } {
    if (method === "GET" && path === "/api/v1/_health") {
      return { status: 200, data: { status: "ok" } };
    }

    if (method === "GET" && path === "/api/v1/me") {
      return this.meResponse(req);
    }

    const promptByNamePrefix = `/api/v1/workspaces/${DEFAULT_WORKSPACE_ID}/promptsByName/`;
    if (method === "GET" && path.startsWith(promptByNamePrefix)) {
      if (!this.authorized(req)) {
        return { status: 401, data: { errorMessage: "Invalid access key." } };
      }
      const handle = path.slice(promptByNamePrefix.length);
      const found = this.findPromptVersionByName(handle, query.version);
      if (!found) {
        return { status: 404, data: { errorMessage: "prompt not found" } };
      }
      return { status: 200, data: found };
    }

    const agentPrefix = `/api/v1/workspaces/${DEFAULT_WORKSPACE_ID}/agents/`;
    if (path.startsWith(agentPrefix)) {
      return this.agentRoute(method, path, query, body, req);
    }

    const wsPrefix = `/api/v1/workspaces/${DEFAULT_WORKSPACE_ID}`;
    if (path.startsWith(`${wsPrefix}/`)) {
      const result = this.workspaceRoute(method, path, query, body, form, req, wsPrefix);
      if (result.status !== 404) {
        return result;
      }
    }

    return { status: 404, data: { error: "not found" } };
  }

  private meResponse(req: IncomingMessage): { status: number; data: Json } {
    const accessKey = req.headers["x-access-key"];
    if (accessKey) {
      if (accessKey !== DEFAULT_WORKSPACE_ACCESS_KEY) {
        return { status: 401, data: { errorMessage: "Invalid access key." } };
      }
      return {
        status: 200,
        data: {
          principalType: "access_key",
          accessKey: {
            id: "wkey_ghi789",
            workspaceId: DEFAULT_WORKSPACE_ID,
            name: "Agent runtime",
            permissions: ["CAN_LIST_AGENTS", "CAN_GET_AGENT"],
            expiresAt: "2026-08-01T00:00:00Z",
            createdAt: "2026-07-05T08:00:00Z",
            updatedAt: "2026-07-05T08:00:00Z",
          },
        },
      };
    }
    return { status: 403, data: { errorMessage: "X-Access-Key header is required." } };
  }

  private workspaceRoute(
    method: string,
    path: string,
    query: Record<string, string>,
    body: Json,
    form: Record<string, string | { filename: string; content: Buffer }>,
    req: IncomingMessage,
    wsPrefix: string,
  ): { status: number; data?: Json | null } {
    if (path === `${wsPrefix}/agents`) {
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        const agents = [...this.store.agents.values()];
        return {
          status: 200,
          data: { agents, _meta: this.listMeta(agents, query) },
        };
      }
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const agentId = `agt_${shortId()}`;
        const agent = this.agentObject(agentId, body.name as string, body.description as string);
        this.store.agents.set(agentId, agent);
        return { status: 201, data: agent };
      }
    }

    const promptResult = this.promptRoute(method, path, query, body, req, wsPrefix);
    if (promptResult.status !== 404) {
      return promptResult;
    }

    if (path === `${wsPrefix}/documents`) {
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        const documents = [...this.store.documents.values()];
        return {
          status: 200,
          data: { documents, _meta: this.listMeta(documents, query) },
        };
      }
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const fileInfo = (form.file ?? {}) as { filename?: string; content?: Buffer };
        const filename = fileInfo.filename ?? "upload.md";
        const content = fileInfo.content ?? Buffer.alloc(0);
        const title = (form.title as string) ?? "Untitled";
        const labelsRaw = form.labels as string | undefined;
        const labels = labelsRaw ? (JSON.parse(labelsRaw) as string[]) : [];
        const documentId = `doc_${shortId()}`;
        const document = this.documentObject({
          documentId,
          title,
          filename,
          labels,
          content,
        });
        this.store.documents.set(documentId, document);
        return { status: 201, data: document };
      }
    }

    if (path === `${wsPrefix}/documents/search`) {
      if (!this.authorized(req)) {
        return { status: 401, data: { errorMessage: "Invalid access key." } };
      }
      return {
        status: 200,
        data: {
          results: [
            {
              documentId: "doc_search_1",
              chunkId: "chunk_1",
              score: 0.87,
              text: `Result for: ${body.query}`,
              labels: (body.labels as Record<string, string>) ?? {},
            },
          ],
        },
      };
    }

    const docPrefix = `${wsPrefix}/documents/`;
    if (path.startsWith(docPrefix) && method === "DELETE") {
      const documentId = path.slice(docPrefix.length);
      if (this.store.documents.has(documentId)) {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        this.store.documents.delete(documentId);
        return { status: 204, data: null };
      }
    }

    return { status: 404, data: { errorMessage: "not found" } };
  }

  private promptRoute(
    method: string,
    path: string,
    query: Record<string, string>,
    body: Json,
    req: IncomingMessage,
    wsPrefix: string,
  ): { status: number; data?: Json | null } {
    if (path === `${wsPrefix}/prompts`) {
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        const prompts = [...this.store.prompts.keys()].map((id) => this.promptSummary(id));
        return {
          status: 200,
          data: { prompts, _meta: this.listMeta(prompts, query) },
        };
      }
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const promptId = `prm_${shortId()}`;
        const handle = String(body.name).toLowerCase().replace(/ /g, "-");
        const prompt = {
          promptId,
          name: body.name,
          handle,
          description: body.description ?? "",
        };
        const versionId = `prv_${shortId()}`;
        const version = this.promptVersionObject({
          prompt,
          versionId,
          version: 1,
          type: body.type as string,
          content: body.content as string,
          config: body.config,
          commitMessage: body.commitMessage as string | undefined,
          meta: body.meta as string | undefined,
          production: Boolean(body.production ?? false),
          labels: ["latest"],
        });
        this.store.prompts.set(promptId, prompt);
        this.store.promptVersions.set(promptId, new Map([[versionId, version]]));
        return { status: 201, data: this.promptSummary(promptId) };
      }
    }

    const promptPrefix = `${wsPrefix}/prompts/`;
    if (!path.startsWith(promptPrefix)) {
      return { status: 404, data: { errorMessage: "not found" } };
    }

    const remainder = path.slice(promptPrefix.length);
    const parts = remainder.split("/");
    const promptId = parts[0]!;
    if (!this.store.prompts.has(promptId)) {
      return { status: 404, data: { errorMessage: "prompt not found" } };
    }

    if (parts.length === 1) {
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        return { status: 200, data: this.promptSummary(promptId) };
      }
      if (method === "DELETE") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        this.store.prompts.delete(promptId);
        this.store.promptVersions.delete(promptId);
        return { status: 204, data: null };
      }
      return { status: 405, data: { errorMessage: "method not allowed" } };
    }

    if (parts[1] !== "versions") {
      return { status: 404, data: { errorMessage: "not found" } };
    }

    const versions = this.store.promptVersions.get(promptId) ?? new Map();
    this.store.promptVersions.set(promptId, versions);
    const prompt = this.store.prompts.get(promptId)!;

    if (parts.length === 2) {
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        const items = [...versions.values()].sort(
          (a, b) => (a.version as number) - (b.version as number),
        );
        return {
          status: 200,
          data: { versions: items, _meta: this.listMeta(items, query) },
        };
      }
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const nextVersion =
          Math.max(0, ...[...versions.values()].map((v) => v.version as number)) + 1;
        const versionId = `prv_${shortId()}`;
        const production = Boolean(body.production ?? false);
        if (production) {
          for (const item of versions.values()) {
            item.production = false;
          }
        }
        for (const item of versions.values()) {
          item.labels = ((item.labels as string[]) ?? []).filter((label) => label !== "latest");
        }
        const version = this.promptVersionObject({
          prompt,
          versionId,
          version: nextVersion,
          type: body.type as string,
          content: body.content as string,
          config: body.config,
          commitMessage: body.commitMessage as string | undefined,
          meta: body.meta as string | undefined,
          production,
          labels: ["latest"],
        });
        versions.set(versionId, version);
        return { status: 201, data: version };
      }
      return { status: 405, data: { errorMessage: "method not allowed" } };
    }

    const versionId = parts[2]!;
    if (!versions.has(versionId)) {
      return { status: 404, data: { errorMessage: "version not found" } };
    }

    if (method === "GET") {
      if (!this.authorized(req)) {
        return { status: 401, data: { errorMessage: "Invalid access key." } };
      }
      return { status: 200, data: versions.get(versionId)! };
    }
    if (method === "PUT") {
      if (!this.authorized(req)) {
        return { status: 403, data: { errorMessage: "Write requires user API key." } };
      }
      const current = versions.get(versionId)!;
      if (body.type != null) {
        current.type = body.type;
      }
      current.content = body.content;
      if (body.config != null) {
        current.config =
          typeof body.config === "string"
            ? body.config
              ? JSON.parse(body.config)
              : {}
            : (body.config ?? {});
      }
      if (body.commitMessage != null) {
        current.commitMessage = body.commitMessage;
      }
      if (body.meta != null) {
        current.meta = body.meta;
      }
      if (body.status != null) {
        current.status = body.status;
      }
      if (body.production) {
        for (const item of versions.values()) {
          item.production = false;
        }
        current.production = true;
      }
      current.updatedAt = TIMESTAMP;
      return { status: 200, data: current };
    }
    if (method === "DELETE") {
      if (!this.authorized(req)) {
        return { status: 403, data: { errorMessage: "Write requires user API key." } };
      }
      versions.delete(versionId);
      return { status: 204, data: null };
    }
    return { status: 405, data: { errorMessage: "method not allowed" } };
  }

  private agentRoute(
    method: string,
    path: string,
    query: Record<string, string>,
    body: Json,
    req: IncomingMessage,
  ): { status: number; data?: Json | null } {
    const match = /^\/api\/v1\/workspaces\/([^/]+)\/agents\/([^/]+)(\/.*)?$/.exec(path);
    if (!match) {
      return { status: 404, data: { errorMessage: "not found" } };
    }
    const [, workspaceId, agentId, rawSuffix] = match;
    if (workspaceId !== DEFAULT_WORKSPACE_ID) {
      return { status: 404, data: { errorMessage: "workspace not found" } };
    }
    const suffix = rawSuffix ?? "";

    if (suffix === "") {
      const agent = this.store.agents.get(agentId!);
      if (!agent) {
        return { status: 404, data: { errorMessage: "Agent not found." } };
      }
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        return { status: 200, data: agent };
      }
      if (method === "PUT") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        agent.name = body.name;
        agent.description = body.description;
        agent.updatedAt = TIMESTAMP;
        return { status: 200, data: agent };
      }
      if (method === "DELETE") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        this.store.agents.delete(agentId!);
        return { status: 204, data: null };
      }
    }

    if (suffix === "/sessions") {
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        const externalId = query.id;
        const labels = this.queryLabels(query);
        if (!externalId && Object.keys(labels).length === 0) {
          return { status: 400, data: { errorMessage: "id or labels required" } };
        }
        if (externalId && this.findSessionByLabels({ id: externalId })) {
          return { status: 409, data: { errorMessage: "Session already exists." } };
        }
        const sessionId = `ses_${shortId()}`;
        const session: Json = {
          id: sessionId,
          externalId: externalId ?? randomUUID(),
          workspaceId,
          agentId,
          title: (body.title as string) ?? "",
          status: "active",
          labels,
          meta: {},
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        };
        this.store.sessions.set(sessionId, session);
        this.store.messages.set(sessionId, []);
        this.store.memories.set(sessionId, []);
        return { status: 201, data: session };
      }
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        let sessions = [...this.store.sessions.values()].filter((s) => s.agentId === agentId);
        if (query.id) {
          sessions = sessions.filter((s) => s.externalId === query.id);
        }
        const labels = this.queryLabels(query);
        if (Object.keys(labels).length > 0) {
          sessions = sessions.filter((s) => JSON.stringify(s.labels) === JSON.stringify(labels));
        }
        return {
          status: 200,
          data: { sessions, _meta: this.listMeta(sessions, query) },
        };
      }
    }

    if (suffix === "/sessions/by-labels") {
      if (!this.authorized(req)) {
        return { status: 401, data: { errorMessage: "Invalid access key." } };
      }
      const session = this.findSessionByLabels(query);
      if (!session) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      if (method === "GET") {
        return { status: 200, data: session };
      }
      if (method === "PUT") {
        if (body.title != null) {
          session.title = body.title;
        }
        if (body.labels != null) {
          session.labels = body.labels;
        }
        session.updatedAt = TIMESTAMP;
        return { status: 200, data: session };
      }
      if (method === "DELETE") {
        this.store.sessions.delete(session.id as string);
        this.store.messages.delete(session.id as string);
        this.store.memories.delete(session.id as string);
        return { status: 204, data: null };
      }
    }

    const sessionMatch = /^\/sessions\/([^/]+)$/.exec(suffix);
    if (sessionMatch && method === "GET") {
      if (!this.authorized(req)) {
        return { status: 401, data: { errorMessage: "Invalid access key." } };
      }
      const session = this.store.sessions.get(sessionMatch[1]!);
      if (!session) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      return { status: 200, data: session };
    }

    return this.sessionNestedRoute(method, suffix, body, req);
  }

  private sessionNestedRoute(
    method: string,
    suffix: string,
    body: Json,
    req: IncomingMessage,
  ): { status: number; data?: Json | null } {
    const messageBatchMatch = /^\/sessions\/([^/]+)\/messages\/batch$/.exec(suffix);
    if (messageBatchMatch) {
      const sessionId = messageBatchMatch[1]!;
      if (!this.store.sessions.has(sessionId)) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const created: Json[] = [];
        for (const item of body.messages as Json[]) {
          const message = {
            id: `msg_${shortId()}`,
            sessionId,
            role: item.role,
            content: item.content,
            meta: item.meta ? JSON.parse(item.meta as string) : {},
            createdAt: TIMESTAMP,
          };
          this.store.messages.get(sessionId)!.push(message);
          created.push(message);
        }
        return { status: 201, data: { messages: created } };
      }
      if (method === "DELETE") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const deleteIds = new Set(body.ids as string[]);
        this.store.messages.set(
          sessionId,
          this.store.messages.get(sessionId)!.filter((m) => !deleteIds.has(m.id as string)),
        );
        return { status: 204, data: null };
      }
    }

    const messageSearchMatch = /^\/sessions\/([^/]+)\/messages\/search$/.exec(suffix);
    if (messageSearchMatch && method === "POST") {
      if (!this.authorized(req)) {
        return { status: 401, data: { errorMessage: "Invalid access key." } };
      }
      const sessionId = messageSearchMatch[1]!;
      if (!this.store.sessions.has(sessionId)) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      const queryText = body.query;
      const limit = (body.limit as number) ?? 10;
      if (typeof queryText !== "string" || !queryText || !(limit >= 1 && limit <= 100)) {
        return { status: 400, data: { errorMessage: "Invalid search request." } };
      }
      const matches = this.store.messages
        .get(sessionId)!
        .filter((item) => String(item.content).toLowerCase().includes(queryText.toLowerCase()))
        .map((item) => ({
          id: item.id,
          role: item.role,
          score: 0.91,
          text: item.content,
        }))
        .slice(0, limit);
      return { status: 200, data: { results: matches } };
    }

    const messageMatch = /^\/sessions\/([^/]+)\/messages$/.exec(suffix);
    if (messageMatch) {
      const sessionId = messageMatch[1]!;
      if (!this.store.sessions.has(sessionId)) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        const items = this.store.messages.get(sessionId)!;
        return {
          status: 200,
          data: { messages: items, _meta: this.listMeta(items, {}) },
        };
      }
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const message = {
          id: `msg_${shortId()}`,
          sessionId,
          role: body.role,
          content: body.content,
          meta: body.meta ? JSON.parse(body.meta as string) : {},
          createdAt: TIMESTAMP,
        };
        this.store.messages.get(sessionId)!.push(message);
        return { status: 201, data: message };
      }
    }

    const messageItemMatch = /^\/sessions\/([^/]+)\/messages\/([^/]+)$/.exec(suffix);
    if (messageItemMatch) {
      const sessionId = messageItemMatch[1]!;
      const messageId = messageItemMatch[2]!;
      if (!this.store.sessions.has(sessionId)) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      const items = this.store.messages.get(sessionId)!;
      const message = items.find((m) => m.id === messageId);
      if (!message) {
        return { status: 404, data: { errorMessage: "Message not found." } };
      }
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        return { status: 200, data: message };
      }
      if (method === "PUT") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        if (body.role != null) {
          message.role = body.role;
        }
        message.content = body.content;
        if (body.meta != null) {
          message.meta = JSON.parse(body.meta as string);
        }
        return { status: 200, data: message };
      }
      if (method === "DELETE") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        this.store.messages.set(
          sessionId,
          items.filter((m) => m.id !== messageId),
        );
        return { status: 204, data: null };
      }
    }

    const memoryBatchMatch = /^\/sessions\/([^/]+)\/memories\/batch$/.exec(suffix);
    if (memoryBatchMatch) {
      const sessionId = memoryBatchMatch[1]!;
      if (!this.store.sessions.has(sessionId)) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const created: Json[] = [];
        for (const item of body.memories as Json[]) {
          const memory = {
            id: `mem_${shortId()}`,
            sessionId,
            kind: item.kind,
            content: item.content,
            meta: item.meta ? JSON.parse(item.meta as string) : {},
            createdAt: TIMESTAMP,
            updatedAt: TIMESTAMP,
          };
          this.store.memories.get(sessionId)!.push(memory);
          created.push(memory);
        }
        return { status: 201, data: { memories: created } };
      }
      if (method === "DELETE") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const deleteIds = new Set(body.ids as string[]);
        this.store.memories.set(
          sessionId,
          this.store.memories.get(sessionId)!.filter((m) => !deleteIds.has(m.id as string)),
        );
        return { status: 204, data: null };
      }
    }

    const memorySearchMatch = /^\/sessions\/([^/]+)\/memories\/search$/.exec(suffix);
    if (memorySearchMatch && method === "POST") {
      if (!this.authorized(req)) {
        return { status: 401, data: { errorMessage: "Invalid access key." } };
      }
      const sessionId = memorySearchMatch[1]!;
      if (!this.store.sessions.has(sessionId)) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      const queryText = body.query;
      const limit = (body.limit as number) ?? 10;
      if (typeof queryText !== "string" || !queryText || !(limit >= 1 && limit <= 100)) {
        return { status: 400, data: { errorMessage: "Invalid search request." } };
      }
      const matches = this.store.memories
        .get(sessionId)!
        .filter((item) => String(item.content).toLowerCase().includes(queryText.toLowerCase()))
        .map((item) => ({
          id: item.id,
          kind: item.kind,
          score: 0.88,
          text: item.content,
        }))
        .slice(0, limit);
      return { status: 200, data: { results: matches } };
    }

    const memoryMatch = /^\/sessions\/([^/]+)\/memories$/.exec(suffix);
    if (memoryMatch) {
      const sessionId = memoryMatch[1]!;
      if (!this.store.sessions.has(sessionId)) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        const items = this.store.memories.get(sessionId)!;
        return {
          status: 200,
          data: { memories: items, _meta: this.listMeta(items, {}) },
        };
      }
      if (method === "POST") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        const memory = {
          id: `mem_${shortId()}`,
          sessionId,
          kind: body.kind,
          content: body.content,
          meta: body.meta ? JSON.parse(body.meta as string) : {},
          createdAt: TIMESTAMP,
          updatedAt: TIMESTAMP,
        };
        this.store.memories.get(sessionId)!.push(memory);
        return { status: 201, data: memory };
      }
    }

    const memoryItemMatch = /^\/sessions\/([^/]+)\/memories\/([^/]+)$/.exec(suffix);
    if (memoryItemMatch) {
      const sessionId = memoryItemMatch[1]!;
      const memoryId = memoryItemMatch[2]!;
      if (!this.store.sessions.has(sessionId)) {
        return { status: 404, data: { errorMessage: "Session not found." } };
      }
      const items = this.store.memories.get(sessionId)!;
      const memory = items.find((m) => m.id === memoryId);
      if (!memory) {
        return { status: 404, data: { errorMessage: "Memory not found." } };
      }
      if (method === "GET") {
        if (!this.authorized(req)) {
          return { status: 401, data: { errorMessage: "Invalid access key." } };
        }
        return { status: 200, data: memory };
      }
      if (method === "PUT") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        if (body.kind != null) {
          memory.kind = body.kind;
        }
        memory.content = body.content;
        if (body.meta != null) {
          memory.meta = JSON.parse(body.meta as string);
        }
        memory.updatedAt = TIMESTAMP;
        return { status: 200, data: memory };
      }
      if (method === "DELETE") {
        if (!this.authorized(req)) {
          return { status: 403, data: { errorMessage: "Write requires user API key." } };
        }
        this.store.memories.set(
          sessionId,
          items.filter((m) => m.id !== memoryId),
        );
        return { status: 204, data: null };
      }
    }

    return { status: 404, data: { errorMessage: "not found" } };
  }
}
