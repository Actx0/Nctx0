// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import { BaseClient } from "./client.js";
import { Agents } from "./resource/agent.js";
import { Documents } from "./resource/knowledge.js";
import { Me } from "./resource/me.js";
import { Memories } from "./resource/memory.js";
import { Messages } from "./resource/message.js";
import { Prompts } from "./resource/prompt.js";
import { Sessions } from "./resource/session.js";
import type { ClientOptions } from "./types.js";

export class Nctx0Client extends BaseClient {
  readonly agent: Agents;
  readonly document: Documents;
  readonly knowledge: Documents;
  readonly me: Me;
  readonly memory: Memories;
  readonly message: Messages;
  readonly prompt: Prompts;
  readonly session: Sessions;

  constructor(options: ClientOptions = {}) {
    super(options);
    this.agent = new Agents().attachTo(this);
    this.document = new Documents().attachTo(this);
    this.knowledge = this.document;
    this.me = new Me().attachTo(this);
    this.memory = new Memories().attachTo(this);
    this.message = new Messages().attachTo(this);
    this.prompt = new Prompts().attachTo(this);
    this.session = new Sessions().attachTo(this);
  }

  async health(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("GET", "/api/v1/public/_health");
  }
}

export function agent(options?: ClientOptions): Agents {
  return new Agents(options);
}

export function document(options?: ClientOptions): Documents {
  return new Documents(options);
}

export function knowledge(options?: ClientOptions): Documents {
  return new Documents(options);
}

export function me(options?: ClientOptions): Me {
  return new Me(options);
}

export function memory(options?: ClientOptions): Memories {
  return new Memories(options);
}

export function message(options?: ClientOptions): Messages {
  return new Messages(options);
}

export function prompt(options?: ClientOptions): Prompts {
  return new Prompts(options);
}

export function session(options?: ClientOptions): Sessions {
  return new Sessions(options);
}
