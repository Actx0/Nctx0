#!/usr/bin/env npx tsx
// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.
/**
 * Create, list, get, update, and delete an agent.
 *
 * npx tsx examples/03_agents.ts
 */

import { Nctx0Client } from "../src/index.js";

const ACCESS_KEY = "~~";
const WORKSPACE_ID = "~~";
const BASE_URL = "https://actx0.com";

async function main(): Promise<void> {
  const client = new Nctx0Client({
    accessKey: ACCESS_KEY,
    workspaceId: WORKSPACE_ID,
    baseUrl: BASE_URL,
  });

  const created = await client.agent.create({
    name: "Mara assistant",
    description: "Answers questions about Mara Ellison from the docs knowledge base.",
    configs: { memoryPipeline: true },
  });
  console.log("Created");
  console.log("=".repeat(40));
  console.dir(created, { depth: null });

  const listed = await client.agent.list();
  console.log(`\nListed (total=${listed.total})`);
  console.log("=".repeat(40));
  for (const agent of listed.agents) {
    console.log(
      `  ${agent.id}  ${agent.name}  status=${agent.status}  memoryPipeline=${agent.configs.memoryPipeline}`,
    );
  }

  const fetched = await client.agent.get(created.id);
  console.log("\nFetched");
  console.log("=".repeat(40));
  console.dir(fetched, { depth: null });

  const updated = await client.agent.update(created.id, {
    name: "Mara assistant v2",
    description: "Updated description for the Mara docs agent.",
    configs: { memoryPipeline: true },
  });
  console.log("\nUpdated");
  console.log("=".repeat(40));
  console.dir(updated, { depth: null });

  await client.agent.delete(created.id);
  console.log(`\nDeleted ${created.id}`);

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
