#!/usr/bin/env npx tsx
// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.
/**
 * Create sessions keyed by externalId or by labels.
 *
 * npx tsx examples/07_sessions.ts
 */

import { Nctx0Client } from "../src/index.js";

const ACCESS_KEY = "~~";
const WORKSPACE_ID = "~~";
const BASE_URL = "https://app.actx0.com";

function show(label: string, value: unknown): void {
  console.log(`\n${label}`);
  console.log("=".repeat(40));
  console.dir(value, { depth: null });
}

async function main(): Promise<void> {
  const client = new Nctx0Client({
    accessKey: ACCESS_KEY,
    workspaceId: WORKSPACE_ID,
    baseUrl: BASE_URL,
  });

  const agent = await client.agent.create({
    name: "Sessions demo bot",
    description: "Used only to demonstrate session create/lookup.",
  });
  console.log(`agent=${agent.id}`);

  // 1) Create + look up by externalId (your own thread / ticket id).
  const byExternalId = await client.session.create(agent.id, {
    externalId: "support-ticket-42",
    title: "Support ticket #42",
  });
  show("Created with externalId", byExternalId);

  let fetched = await client.session.getByLabels(agent.id, {
    externalId: "support-ticket-42",
  });
  show("Fetched by externalId", fetched);

  // 2) Create + look up by labels (arbitrary key/value filters).
  const byLabels = await client.session.create(agent.id, {
    labels: { userId: "u-100", channel: "web" },
    title: "Web chat for user u-100",
  });
  show("Created with labels", byLabels);

  fetched = await client.session.getByLabels(agent.id, {
    labels: { userId: "u-100", channel: "web" },
  });
  show("Fetched by labels", fetched);

  const listed = await client.session.list(agent.id);
  console.log(`\nListed (total=${listed.total})`);
  console.log("=".repeat(40));
  for (const session of listed.sessions) {
    console.log(
      `  ${session.id}  title=${JSON.stringify(session.title)}  ` +
        `externalId=${JSON.stringify(session.externalId)}  labels=${JSON.stringify(session.labels)}`,
    );
  }

  // Cleanup: delete by the same keys used to create.
  await client.session.delete(agent.id, { externalId: "support-ticket-42" });
  console.log("\nDeleted session with externalId=support-ticket-42");

  await client.session.delete(agent.id, {
    labels: { userId: "u-100", channel: "web" },
  });
  console.log("Deleted session with labels={userId=u-100, channel=web}");

  await client.agent.delete(agent.id);
  console.log(`Deleted agent ${agent.id}`);

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
