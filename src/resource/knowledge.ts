// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import type { Document, DocumentList, FileInput, SearchResults } from "../types.js";
import { buildQueryParams, fileChecksum, prepareFile } from "../utils.js";
import { Resource } from "./base.js";

type DocumentListResponse = {
  documents: Document[];
  _meta: { limit: number; offset: number; total: number };
};

export class Documents extends Resource {
  async list(options: { limit?: number; offset?: number } = {}): Promise<DocumentList> {
    const { limit = 50, offset = 0 } = options;
    const params = buildQueryParams({ limit, offset });
    const data = await this.request<DocumentListResponse>("GET", this.workspacePath("documents"), {
      params,
    });
    return {
      documents: data.documents,
      limit: data._meta.limit,
      offset: data._meta.offset,
      total: data._meta.total,
    };
  }

  async exists(options: {
    file: FileInput;
    labels?: Record<string, string>;
    pageSize?: number;
  }): Promise<Document | null> {
    const prepared = prepareFile(options.file);
    const checksum = fileChecksum(prepared.content);
    const expectedLabels = options.labels
      ? new Set(Object.entries(options.labels).map(([k, v]) => `${k}=${v}`))
      : new Set<string>();
    const pageSize = options.pageSize ?? 50;

    let offset = 0;
    while (true) {
      const listed = await this.list({ limit: pageSize, offset });
      for (const doc of listed.documents) {
        const labelSet = new Set(doc.labels);
        const labelsMatch =
          labelSet.size === expectedLabels.size &&
          [...expectedLabels].every((label) => labelSet.has(label));
        if (doc.filename === prepared.filename && doc.checksum === checksum && labelsMatch) {
          return doc;
        }
      }
      offset += pageSize;
      if (offset >= listed.total) {
        return null;
      }
    }
  }

  async upload(options: {
    file: FileInput;
    title: string;
    labels?: Record<string, string>;
  }): Promise<Document> {
    const uploadFile = prepareFile(options.file);
    const form: Record<string, string> = { title: options.title };
    if (options.labels != null) {
      form.labels = JSON.stringify(
        Object.entries(options.labels).map(([key, value]) => `${key}=${value}`),
      );
    }
    return this.request<Document>("POST", this.workspacePath("documents"), {
      form,
      file: uploadFile,
    });
  }

  async search(options: {
    query: string;
    labels?: Record<string, string>;
    limit?: number;
  }): Promise<SearchResults> {
    const body: Record<string, unknown> = {
      query: options.query,
      limit: options.limit ?? 10,
    };
    if (options.labels != null) {
      body.labels = options.labels;
    }
    return this.request<SearchResults>("POST", this.workspacePath("documents", "search"), {
      json: body,
    });
  }

  async delete(documentId: string): Promise<void> {
    await this.request("DELETE", this.workspacePath("documents", documentId));
  }
}

/** Backward-compatible alias. */
export { Documents as Knowledge };
