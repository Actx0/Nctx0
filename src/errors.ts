// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

export class Actx0Error extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? Actx0Error.formatMessage(status, body));
    this.name = "Actx0Error";
    this.status = status;
    this.body = body;
  }

  private static formatMessage(status: number, body: unknown): string {
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const errorMessage = record.errorMessage ?? record.error;
      if (typeof errorMessage === "string") {
        return `Actx0 API error ${status}: ${errorMessage}`;
      }
    }
    if (typeof body === "string" && body.length > 0) {
      return `Actx0 API error ${status}: ${body}`;
    }
    return `Actx0 API error ${status}`;
  }
}
