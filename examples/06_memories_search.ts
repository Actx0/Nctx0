#!/usr/bin/env npx tsx
// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.
/**
 * Interactive personal assistant using memory search hits as history (+ RAG).
 *
 * npx tsx examples/06_memories_search.ts
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { Nctx0Client } from "../src/index.js";
import * as u from "./00_utils.js";

const SYSTEM =
  "You are a helpful personal assistant. Use what you remember about the user " +
  "and any provided context to answer. Cite context like [1]. If unsure, say so.";

async function main(): Promise<void> {
  const client = new Nctx0Client({
    accessKey: u.ACCESS_KEY,
    workspaceId: u.WORKSPACE_ID,
    baseUrl: u.BASE_URL,
  });
  const s = await u.setup(client, {
    agentName: "Personal assistant (memories search)",
    agentDescription: "Personal assistant using memory search history + RAG.",
    promptName: "Personal Assistant Memories Search",
    promptContent: SYSTEM,
    sessionExternalId: "personal-assistant-memories-search",
    sessionTitle: "Personal assistant — memories search",
  });
  console.log(`agent=${s.agentId} session=${s.sessionId}`);
  console.log("chat — quit/exit to stop\n");

  const rl = readline.createInterface({ input, output });
  try {
    while (true) {
      const text = (await rl.question("you> ")).trim();
      if (!text || text.toLowerCase() === "quit" || text.toLowerCase() === "exit") {
        break;
      }

      const hits = await client.memory.search(s.agentId, s.sessionId, {
        query: text,
        limit: 5,
      });
      const [reply, usage] = await u.ask({
        system: s.system,
        user: text,
        history: u.historyFromMemoryHits(hits.results),
        context: await u.ragContext(client, text),
      });
      if (reply) {
        await client.message.create(s.agentId, s.sessionId, [
          { role: "user", content: text },
          {
            role: "assistant",
            content: reply,
            meta: { model: u.DEFAULT_MODEL, usage },
          },
        ]);
      }
    }
  } finally {
    rl.close();
    await u.teardown(client, s);
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
