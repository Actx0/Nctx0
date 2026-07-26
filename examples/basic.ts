// Copyright 2026 Actx0. All rights reserved.
// License can be found in the LICENSE file.

import { knowledge, Nctx0Client } from "@actx0/nctx0";

async function main() {
  const docs = knowledge({
    accessKey: process.env.ACTX0_ACCESS_KEY,
    workspaceId: process.env.ACTX0_WORKSPACE_ID,
  });

  const listed = await docs.list();
  console.log(`documents: ${listed.total}`);

  const client = new Nctx0Client({
    accessKey: process.env.ACTX0_ACCESS_KEY,
    workspaceId: process.env.ACTX0_WORKSPACE_ID,
  });

  console.log(await client.health());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
