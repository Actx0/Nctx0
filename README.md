### Nctx0 Package

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

#### Examples

Fill in `ACCESS_KEY`, `WORKSPACE_ID`, and (for chat examples) `OPENROUTER_KEY` in the example files, then:

```bash
npx tsx examples/01_me.ts
npx tsx examples/02_docs.ts
npx tsx examples/03_agents.ts
npx tsx examples/04_prompts.ts
npx tsx examples/07_sessions.ts
```

Interactive assistants (also need indexed docs from `02_docs.ts`):

```bash
npx tsx examples/05_messages_list.ts
npx tsx examples/05_messages_search.ts
npx tsx examples/06_memories_list.ts
npx tsx examples/06_memories_search.ts
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
