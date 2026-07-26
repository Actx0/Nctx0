// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

import type { AccessKeyPrincipal, FileInput, MemoryInput, MessageInput } from "./types.js";

const RESERVED_QUERY_KEYS = new Set(["id", "limit", "offset"]);
const TEMPLATE_VAR = /\{\{(\w+)\}\}/g;

export type PreparedFile = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export function buildQueryParams(options: {
  externalId?: string | null;
  labels?: Record<string, string> | null;
  limit?: number | null;
  offset?: number | null;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (options.externalId != null) {
    params.id = options.externalId;
  }
  if (options.labels) {
    for (const [key, value] of Object.entries(options.labels)) {
      if (RESERVED_QUERY_KEYS.has(key)) {
        throw new Error(`reserved query key: ${key}`);
      }
      params[key] = value;
    }
  }
  if (options.limit != null) {
    params.limit = String(options.limit);
  }
  if (options.offset != null) {
    params.offset = String(options.offset);
  }
  return params;
}

export function stringifyMeta(meta: Record<string, unknown> | null | undefined): string | null {
  if (meta == null) {
    return null;
  }
  return JSON.stringify(meta);
}

export function encodeItem(item: MessageInput | MemoryInput): Record<string, string> {
  const body: Record<string, string> = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === "meta" || value == null) {
      continue;
    }
    body[key] = String(value);
  }
  const meta = stringifyMeta(item.meta);
  if (meta != null) {
    body.meta = meta;
  }
  return body;
}

export function buildMessageBatchPayload(items: MessageInput[]): {
  messages: Record<string, string>[];
} {
  return { messages: items.map(encodeItem) };
}

export function buildMemoryBatchPayload(items: MemoryInput[]): {
  memories: Record<string, string>[];
} {
  return { memories: items.map(encodeItem) };
}

export function encodeUpdateBody(options: {
  content: string;
  meta?: Record<string, unknown> | null;
  [key: string]: string | Record<string, unknown> | null | undefined;
}): Record<string, string> {
  const body: Record<string, string> = { content: options.content };
  for (const [key, value] of Object.entries(options)) {
    if (key === "content" || key === "meta" || value == null) {
      continue;
    }
    body[key] = String(value);
  }
  const encodedMeta = stringifyMeta(options.meta as Record<string, unknown> | null | undefined);
  if (encodedMeta != null) {
    body.meta = encodedMeta;
  }
  return body;
}

export function parseMePrincipal(data: Record<string, unknown>): AccessKeyPrincipal {
  const principalType = data.principalType;
  if (principalType === "access_key") {
    const accessKey = data.accessKey as AccessKeyPrincipal["accessKey"];
    return {
      principalType: "access_key",
      accessKey,
    };
  }
  throw new Error(`unknown principalType: ${String(principalType)}`);
}

export function prepareFile(file: FileInput): PreparedFile {
  if (typeof file === "string") {
    const content = readFileSync(file);
    const contentType = extname(file) === ".md" ? "text/markdown" : "text/plain";
    return {
      filename: basename(file),
      content,
      contentType,
    };
  }

  const content =
    typeof file.content === "string" ? Buffer.from(file.content) : Buffer.from(file.content);
  return {
    filename: file.filename,
    content,
    contentType: file.contentType ?? "application/octet-stream",
  };
}

export function fileChecksum(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function compilePrompt(content: string, variables: Record<string, string>): string {
  return content.replace(TEMPLATE_VAR, (_match, key: string) => {
    if (!(key in variables)) {
      throw new Error(`missing template variable: ${key}`);
    }
    return variables[key]!;
  });
}

export function normalizePrompt(data: Record<string, unknown>): import("./types.js").Prompt {
  let config = data.config ?? {};
  if (typeof config === "string") {
    config = config ? JSON.parse(config) : {};
  }
  return {
    id: data.id as string,
    name: data.name as string,
    handle: data.handle as string,
    description: (data.description as string) ?? "",
    version: data.version as number,
    type: data.type as string,
    content: data.content as string,
    commitHash: data.commitHash as string,
    status: data.status as string,
    production: data.production as boolean,
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
    config: (config && typeof config === "object" ? config : {}) as Record<string, unknown>,
    labels: (data.labels as string[]) ?? [],
    commitMessage: (data.commitMessage as string | null | undefined) ?? null,
    meta: (data.meta as string | null | undefined) ?? null,
  };
}
