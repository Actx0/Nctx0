// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import { BaseClient } from "../client.js";
import type { ClientOptions } from "../types.js";

export class Resource extends BaseClient {
  constructor(options: ClientOptions = {}) {
    super(options);
  }

  /** Share transport settings with a parent client instance. */
  attachTo(parent: BaseClient): this {
    this.copyFrom(parent);
    return this;
  }

  /** Expose shared identity for tests (same parent config). */
  get sharedKey(): string {
    return `${this.baseUrl}|${this.timeout}|${this.accessKey}|${this.workspaceId}`;
  }

  protected requireWorkspace(): string {
    if (!this.workspaceId) {
      throw new Error("workspaceId is required");
    }
    return this.workspaceId;
  }

  protected workspacePath(...parts: string[]): string {
    let path = `/api/v1/workspaces/${this.requireWorkspace()}`;
    for (const part of parts) {
      path = `${path}/${part}`;
    }
    return path;
  }

  protected agentPath(agentId: string, ...parts: string[]): string {
    return this.workspacePath("agents", agentId, ...parts);
  }
}
