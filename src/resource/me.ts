// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import type { AccessKeyPrincipal } from "../types.js";
import { parseMePrincipal } from "../utils.js";
import { Resource } from "./base.js";

export class Me extends Resource {
  async get(): Promise<AccessKeyPrincipal> {
    const data = await this.request<Record<string, unknown>>("GET", "/api/v1/me");
    return parseMePrincipal(data);
  }
}
