// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import { Actx0Error } from "./errors.js";
import type { ClientOptions } from "./types.js";
import type { PreparedFile } from "./utils.js";

export type RequestOptions = {
  params?: Record<string, string | number | undefined | null>;
  json?: unknown;
  form?: Record<string, string>;
  file?: PreparedFile;
  headers?: Record<string, string>;
};

export class BaseClient {
  protected baseUrl: string;
  protected timeout: number;
  protected accessKey: string | undefined;
  protected workspaceId: string | undefined;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "https://app.actx0.com").replace(/\/$/, "");
    this.timeout = options.timeout ?? 30_000;
    this.accessKey = options.accessKey;
    this.workspaceId = options.workspaceId;
  }

  /** Copy transport settings from another client (shared facade resources). */
  protected copyFrom(parent: BaseClient): void {
    this.baseUrl = parent.baseUrl;
    this.timeout = parent.timeout;
    this.accessKey = parent.accessKey;
    this.workspaceId = parent.workspaceId;
  }

  protected async request<T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    if (!this.accessKey) {
      throw new Error("accessKey is required");
    }

    const url = new URL(path, `${this.baseUrl}/`);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value != null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      "X-Access-Key": this.accessKey,
      ...options.headers,
    };

    let body: BodyInit | undefined;
    if (options.file) {
      const form = new FormData();
      if (options.form) {
        for (const [key, value] of Object.entries(options.form)) {
          form.append(key, value);
        }
      }
      const blob = new Blob([new Uint8Array(options.file.content)], {
        type: options.file.contentType,
      });
      form.append("file", blob, options.file.filename);
      body = form;
    } else if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.json);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (response.status === 204) {
        return undefined as T;
      }

      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }

      if (!response.ok) {
        throw new Actx0Error(response.status, parsed);
      }

      return parsed as T;
    } finally {
      clearTimeout(timer);
    }
  }

  close(): void {
    // fetch has no persistent connection to close; kept for API parity
  }

  async [Symbol.asyncDispose](): Promise<void> {
    this.close();
  }
}
