// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

export type MemoryKind = "summary" | "fact" | "preference";
export type MessageRole = "system" | "user" | "assistant";
export type PromptType = "text" | "chat";
export type PromptStatus = "active" | "archived";

export type FileInput =
  | string
  | {
      filename: string;
      content: Buffer | Uint8Array | string;
      contentType?: string;
    };

export type MessageInput = {
  role: MessageRole;
  content: string;
  meta?: Record<string, unknown>;
};

export type MemoryInput = {
  kind: MemoryKind;
  content: string;
  meta?: Record<string, unknown>;
};

export type ListMeta = {
  limit: number;
  offset: number;
  total: number;
};

export type AgentConfigs = {
  memoryPipeline: boolean;
};

export type Agent = {
  id: string;
  workspaceId: string;
  name: string;
  kind: string;
  /** Omitted when empty. */
  promptId?: string | null;
  /** Omitted when empty. */
  kbLabels?: Record<string, string>;
  handle: string;
  description: string;
  status: string;
  configs: AgentConfigs;
  createdAt: string;
  updatedAt: string;
};

export type AgentWriteOptions = {
  name: string;
  description: string;
  /** Omit or leave unset → memoryPipeline defaults to false on the server. */
  configs?: {
    memoryPipeline?: boolean;
  };
};

export type AgentList = {
  agents: Agent[];
} & ListMeta;

export type Session = {
  id: string;
  externalId: string;
  workspaceId: string;
  agentId: string;
  title: string;
  status: string;
  labels: Record<string, string>;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SessionList = {
  sessions: Session[];
} & ListMeta;

export type Message = {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type MessageList = {
  messages: Message[];
} & ListMeta;

export type MessageSearchHit = {
  id: string;
  role: MessageRole;
  score: number;
  text: string;
};

export type MessageSearchResults = {
  results: MessageSearchHit[];
};

export type Memory = {
  id: string;
  sessionId: string;
  kind: MemoryKind;
  content: string;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MemoryList = {
  memories: Memory[];
} & ListMeta;

export type MemorySearchHit = {
  id: string;
  kind: MemoryKind;
  score: number;
  text: string;
};

export type MemorySearchResults = {
  results: MemorySearchHit[];
};

export type DocumentSize = {
  value: number;
  unit: string;
};

export type Document = {
  id: string;
  workspaceId: string;
  title: string;
  filename: string;
  contentType: string;
  checksum: string;
  size: DocumentSize;
  charCount: number;
  labels: string[];
  chunkingStrategy: string;
  chunkSize: number;
  chunkOverlap: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentList = {
  documents: Document[];
} & ListMeta;

export type SearchHit = {
  documentId: string;
  chunkId: string;
  score: number;
  text: string;
  labels: Record<string, string>;
};

export type SearchResults = {
  results: SearchHit[];
};

export type AccessKeyInfo = {
  id: string;
  workspaceId: string;
  name: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
};

export type AccessKeyPrincipal = {
  principalType: "access_key";
  accessKey: AccessKeyInfo;
};

export type MePrincipal = AccessKeyPrincipal;

export type PromptInfo = {
  promptId: string;
  name: string;
  handle: string;
  description: string;
  versionCount: number;
};

export type PromptList = {
  prompts: PromptInfo[];
} & ListMeta;

export type Prompt = {
  id: string;
  name: string;
  handle: string;
  description: string;
  version: number;
  type: string;
  content: string;
  commitHash: string;
  status: string;
  production: boolean;
  createdAt: string;
  updatedAt: string;
  config: Record<string, unknown>;
  labels: string[];
  commitMessage?: string | null;
  meta?: string | null;
};

export type PromptVersionList = {
  versions: Prompt[];
} & ListMeta;

/** Backward-compatible alias. */
export type PromptVersion = Prompt;

export type ClientOptions = {
  baseUrl?: string;
  timeout?: number;
  accessKey?: string;
  workspaceId?: string;
};
