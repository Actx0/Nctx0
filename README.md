### @actx0/nctx0

Node.js client for the Actx0 platform.

#### Install

```bash
npm install @actx0/nctx0
```

#### Usage

```ts
import { knowledge } from "@actx0/nctx0";

const client = knowledge({
  accessKey: "your-access-key",
  workspaceId: "your-workspace-id",
});

const docs = await client.list();
```

Or use the full client when you need multiple API areas:

```ts
import { Nctx0Client } from "@actx0/nctx0";

const client = new Nctx0Client({
  accessKey: "your-access-key",
  workspaceId: "your-workspace-id",
});

await client.health();
await client.knowledge.list();
```

#### Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Tests start a local mock API server automatically. To run against your own local Actx0 server:

```bash
NCTX0_BASE_URL=http://127.0.0.1:8000 npm test
```
