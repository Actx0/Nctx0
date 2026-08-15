#!/usr/bin/env npx tsx
// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.
/**
 * Create a prompt, add a version, fetch it by handle, then delete it.
 *
 * npx tsx examples/04_prompts.ts
 */

import { compilePrompt, Nctx0Client } from "../src/index.js";

const ACCESS_KEY = "~~";
const WORKSPACE_ID = "~~";
const BASE_URL = "https://app.actx0.com";

async function main(): Promise<void> {
  const client = new Nctx0Client({
    accessKey: ACCESS_KEY,
    workspaceId: WORKSPACE_ID,
    baseUrl: BASE_URL,
  });

  const created = await client.prompt.create({
    name: "Mara Guide",
    type: "text",
    content: "You answer questions about Mara Ellison using retrieved context.",
    description: "System prompt for the Mara docs agent",
    commitMessage: "initial",
    production: true,
  });
  console.log("Created prompt");
  console.log("=".repeat(40));
  console.dir(created, { depth: null });

  const version = await client.prompt.createVersion(created.promptId, {
    type: "text",
    content:
      "You answer questions about Mara Ellison using only the provided context. " +
      "Cite sources like [1]. If the context is missing an answer, say so.",
    commitMessage: "add citation rule",
    production: true,
  });
  console.log("\nCreated version");
  console.log("=".repeat(40));
  console.dir(version, { depth: null });

  const latest = await client.prompt.getByName(created.handle);
  console.log("\nFetched by handle");
  console.log("=".repeat(40));
  console.dir(latest, { depth: null });
  console.log(`\ncompiled: ${compilePrompt(latest.content, {})}`);

  await client.prompt.delete(created.promptId);
  console.log(`\nDeleted ${created.promptId}`);

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
