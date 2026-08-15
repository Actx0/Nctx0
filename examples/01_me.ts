#!/usr/bin/env npx tsx
// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.
/**
 * Create a client and print access key info via /api/v1/me.
 *
 * npx tsx examples/01_me.ts
 */

import { Nctx0Client } from "../src/index.js";

const ACCESS_KEY = "~~";
const WORKSPACE_ID = "~~";
const BASE_URL = "https://app.actx0.com";

async function main(): Promise<void> {
  const client = new Nctx0Client({
    accessKey: ACCESS_KEY,
    workspaceId: WORKSPACE_ID,
    baseUrl: BASE_URL,
  });

  const me = await client.me.get();
  console.log("Access key info");
  console.log("=".repeat(40));
  console.dir(me.accessKey, { depth: null });
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
